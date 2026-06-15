import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../net/socket';
import {
  EVENTS,
  type VoiceOfferPayload,
  type VoiceAnswerPayload,
  type VoiceIcePayload,
  type VoiceOfferRelayPayload,
  type VoiceAnswerRelayPayload,
  type VoiceIceRelayPayload,
} from '../protocol';

export type VoiceMode = 'ptt' | 'open';

export interface VoiceChatState {
  muted: boolean;
  deafened: boolean;
  mode: VoiceMode;
  pttActive: boolean;
  speaking: Set<string>;
  permissionDenied: boolean;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleMode: () => void;
  setPttActive: (active: boolean) => void;
}

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

const SPEAKING_POLL_MS = 100;
const SPEAKING_THRESHOLD_DB = -50;
const SPEAKING_DEBOUNCE_MS = 150;

// Explicit constraints: disable browser noise suppression and AGC because
// they make voices sound muffled/robotic. Echo cancellation stays on to
// prevent acoustic feedback when testing on the same machine.
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
  sampleRate: 48000,   // Opus native rate — avoids resampling artifacts
  channelCount: 1,     // mono is fine for voice chat
};

// Boost Opus above its conservative default (~32 kbps) for clearer speech.
const OPUS_MAX_BITRATE_BPS = 128_000;

export function useVoiceChat(
  myPlayerId: string | null,
  roomPlayers: readonly string[],
): VoiceChatState {
  const [muted, setMuted] = useState(true);
  const [deafened, setDeafened] = useState(false);
  const [mode, setMode] = useState<VoiceMode>('ptt');
  const [pttActive, setPttActiveState] = useState(false);
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const [permissionDenied, setPermissionDenied] = useState(false);
  // State (not ref) so peer-connection effect re-runs when stream becomes available
  const [localStreamReady, setLocalStreamReady] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  // Mirror deafened in a ref so playRemoteStream (a stable callback) can read it.
  const deafenedRef = useRef(false);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserCleanupRef = useRef<Map<string, () => void>>(new Map());

  // ── speaking detection ──────────────────────────────────────────────────

  const startSpeakingDetection = useCallback((playerId: string, stream: MediaStream) => {
    // One analyser per player; skip if already running.
    if (analyserCleanupRef.current.has(playerId)) return;

    const ctx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    // Note: we do NOT connect analyser to ctx.destination — remote audio is
    // played via <audio> elements; local audio should not echo back.

    const data = new Float32Array(analyser.fftSize);
    let isSpeaking = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const interval = setInterval(() => {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = data[i] ?? 0; sum += v * v; }
      const rms = Math.sqrt(sum / data.length);
      const db = 20 * Math.log10(rms + 1e-9);

      const nowSpeaking = db > SPEAKING_THRESHOLD_DB;
      if (nowSpeaking !== isSpeaking) {
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          isSpeaking = nowSpeaking;
          setSpeaking(prev => {
            const next = new Set(prev);
            if (isSpeaking) next.add(playerId);
            else next.delete(playerId);
            return next;
          });
        }, SPEAKING_DEBOUNCE_MS);
      }
    }, SPEAKING_POLL_MS);

    analyserCleanupRef.current.set(playerId, () => {
      clearInterval(interval);
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      source.disconnect();
    });
  }, []);

  const stopSpeakingDetection = useCallback((playerId: string) => {
    analyserCleanupRef.current.get(playerId)?.();
    analyserCleanupRef.current.delete(playerId);
    setSpeaking(prev => {
      const next = new Set(prev);
      next.delete(playerId);
      return next;
    });
  }, []);

  // ── play remote stream through an <audio> element ──────────────────────

  const playRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    // Reuse existing element if one already exists for this peer.
    let el = audioElementsRef.current.get(peerId);
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.muted = deafenedRef.current;
      // Keep out of the DOM visual tree but attached so GC doesn't collect it.
      el.style.display = 'none';
      document.body.appendChild(el);
      audioElementsRef.current.set(peerId, el);
    }
    el.srcObject = stream;
    void el.play().catch(() => {
      // Autoplay was blocked — will start playing on next user interaction.
    });
  }, []);

  const removeRemoteAudio = useCallback((peerId: string) => {
    const el = audioElementsRef.current.get(peerId);
    if (el) {
      el.srcObject = null;
      el.remove();
      audioElementsRef.current.delete(peerId);
    }
  }, []);

  // ── init / cleanup local stream ─────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: false }).then(stream => {
      if (cancelled) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      // Start muted in PTT mode so we don't transmit before the user speaks.
      stream.getAudioTracks().forEach(t => { t.enabled = false; });
      localStreamRef.current = stream;
      setLocalStreamReady(true);
      if (myPlayerId) startSpeakingDetection(myPlayerId, stream);
    }).catch(() => {
      if (!cancelled) setPermissionDenied(true);
    });

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setLocalStreamReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── build/tear-down peer connections when player list or stream changes ─

  useEffect(() => {
    // localStreamReady is the state-based trigger ensuring this re-runs after
    // getUserMedia resolves even if roomPlayers didn't change.
    if (!myPlayerId || !localStreamReady || !localStreamRef.current) return;

    const stream = localStreamRef.current;
    const peers = peersRef.current;
    const currentPeers = new Set(peers.keys());
    const desiredPeers = new Set(roomPlayers.filter(p => p !== myPlayerId));

    // Remove stale connections (player left the room)
    for (const pid of currentPeers) {
      if (!desiredPeers.has(pid)) {
        peers.get(pid)?.close();
        peers.delete(pid);
        stopSpeakingDetection(pid);
        removeRemoteAudio(pid);
      }
    }

    // Create new connections (player joined the room)
    for (const peerId of desiredPeers) {
      if (peers.has(peerId)) continue;

      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      peers.set(peerId, pc);

      // Add local audio track so the peer can hear us.
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

      // When remote audio arrives: play it AND detect speaking.
      pc.ontrack = (ev) => {
        const remoteStream = ev.streams[0];
        if (!remoteStream) return;
        playRemoteStream(peerId, remoteStream);
        startSpeakingDetection(peerId, remoteStream);
      };

      // Once connected, bump Opus bitrate above its conservative default.
      pc.onconnectionstatechange = () => {
        if (pc.connectionState !== 'connected') return;
        for (const sender of pc.getSenders()) {
          if (sender.track?.kind !== 'audio') continue;
          const params = sender.getParameters();
          if (params.encodings.length === 0) params.encodings.push({});
          params.encodings[0]!.maxBitrate = OPUS_MAX_BITRATE_BPS;
          void sender.setParameters(params);
        }
      };

      // Relay ICE candidates via server.
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          const payload: VoiceIcePayload = {
            targetPlayerId: peerId,
            candidate: ev.candidate.toJSON(),
          };
          socket.emit(EVENTS.VOICE_ICE, payload);
        }
      };

      // Initiator rule: higher-sorted playerId sends the offer.
      // This ensures exactly one side initiates per pair, avoiding glare.
      if (myPlayerId > peerId) {
        void pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .then(() => {
            const payload: VoiceOfferPayload = {
              targetPlayerId: peerId,
              offer: pc.localDescription as RTCSessionDescriptionInit,
            };
            socket.emit(EVENTS.VOICE_OFFER, payload);
          });
      }
    }
  }, [myPlayerId, roomPlayers, localStreamReady, startSpeakingDetection, stopSpeakingDetection, playRemoteStream, removeRemoteAudio]);

  // ── socket: handle relayed signaling ───────────────────────────────────

  useEffect(() => {
    function onOffer({ sourcePlayerId, offer }: VoiceOfferRelayPayload) {
      const pc = peersRef.current.get(sourcePlayerId);
      if (!pc) return;
      void pc.setRemoteDescription(offer)
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
          const payload: VoiceAnswerPayload = {
            targetPlayerId: sourcePlayerId,
            answer: pc.localDescription as RTCSessionDescriptionInit,
          };
          socket.emit(EVENTS.VOICE_ANSWER, payload);
        });
    }

    function onAnswer({ sourcePlayerId, answer }: VoiceAnswerRelayPayload) {
      const pc = peersRef.current.get(sourcePlayerId);
      if (!pc) return;
      void pc.setRemoteDescription(answer);
    }

    function onIce({ sourcePlayerId, candidate }: VoiceIceRelayPayload) {
      const pc = peersRef.current.get(sourcePlayerId);
      if (!pc) return;
      void pc.addIceCandidate(candidate);
    }

    socket.on(EVENTS.VOICE_OFFER_RELAY, onOffer);
    socket.on(EVENTS.VOICE_ANSWER_RELAY, onAnswer);
    socket.on(EVENTS.VOICE_ICE_RELAY, onIce);
    return () => {
      socket.off(EVENTS.VOICE_OFFER_RELAY, onOffer);
      socket.off(EVENTS.VOICE_ANSWER_RELAY, onAnswer);
      socket.off(EVENTS.VOICE_ICE_RELAY, onIce);
    };
  }, []);

  // ── mute / PTT sync ─────────────────────────────────────────────────────

  const applyMuteState = useCallback((shouldMute: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !shouldMute; });
    if (myPlayerId && shouldMute) {
      setSpeaking(prev => {
        const next = new Set(prev);
        next.delete(myPlayerId);
        return next;
      });
    }
  }, [myPlayerId]);

  useEffect(() => {
    if (mode === 'open') {
      applyMuteState(muted);
    } else {
      // PTT: track enabled only while button/Space is held.
      applyMuteState(!pttActive);
    }
  }, [muted, mode, pttActive, applyMuteState]);

  // ── keyboard push-to-talk ────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== 'ptt') return;

    function onKeyDown(e: KeyboardEvent) {
      if (
        e.code === 'Space' && !e.repeat &&
        !(e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLButtonElement)
      ) {
        e.preventDefault();
        setPttActiveState(true);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setPttActiveState(false);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [mode]);

  // ── deafen: sync to all remote audio elements ───────────────────────────

  useEffect(() => {
    deafenedRef.current = deafened;
    for (const el of audioElementsRef.current.values()) {
      el.muted = deafened;
    }
  }, [deafened]);

  // ── full cleanup on unmount ──────────────────────────────────────────────

  useEffect(() => {
    return () => {
      for (const cleanup of analyserCleanupRef.current.values()) cleanup();
      analyserCleanupRef.current.clear();
      for (const pc of peersRef.current.values()) pc.close();
      peersRef.current.clear();
      for (const [pid] of audioElementsRef.current) removeRemoteAudio(pid);
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  // removeRemoteAudio is stable (useCallback with no deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = useCallback(() => setMuted(m => !m), []);
  const toggleDeafen = useCallback(() => setDeafened(d => !d), []);
  const toggleMode = useCallback(() => {
    setMode(m => {
      const next = m === 'ptt' ? 'open' : 'ptt';
      if (next === 'ptt') setPttActiveState(false);
      return next;
    });
  }, []);
  const setPttActive = useCallback((active: boolean) => setPttActiveState(active), []);

  return { muted, deafened, mode, pttActive, speaking, permissionDenied, toggleMute, toggleDeafen, toggleMode, setPttActive };
}
