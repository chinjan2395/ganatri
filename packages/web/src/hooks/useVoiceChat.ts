import { useCallback, useEffect, useRef, useState } from 'react';
import { socket, requestIceServers } from '../net/socket';
import {
  EVENTS,
  type VoiceOfferPayload,
  type VoiceAnswerPayload,
  type VoiceIcePayload,
  type VoiceRenegotiatePayload,
  type VoiceOfferRelayPayload,
  type VoiceAnswerRelayPayload,
  type VoiceIceRelayPayload,
  type VoiceRenegotiateRelayPayload,
} from '../protocol';

export type VoiceMode = 'ptt' | 'open';

/** Stable voice actions — only changes on explicit user interaction, never from speaking. */
export interface VoiceChatActions {
  muted: boolean;
  deafened: boolean;
  mode: VoiceMode;
  pttActive: boolean;
  permissionDenied: boolean;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleMode: () => void;
  setPttActive: (active: boolean) => void;
}

/** Full state returned by useVoiceChat — includes the fast-updating speaking set. */
export interface VoiceChatState extends VoiceChatActions {
  speaking: Set<string>;
}

// Fallback used until the server hands over its ICE config (STUN + TURN).
const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

const SPEAKING_POLL_MS = 200;
const SPEAKING_THRESHOLD_DB = -50;
const SPEAKING_DEBOUNCE_MS = 150;

// If a peer connection hasn't reached "connected" within this window, force a
// recovery (ICE restart → fresh offer). Catches silently-dropped offers — the
// server relay drops signaling if the target socket isn't registered yet.
//
// The watchdog uses exponential backoff: it starts at WATCHDOG_BASE_MS and
// roughly doubles after each unsuccessful recovery (capped at WATCHDOG_MAX_MS),
// and gives up entirely after WATCHDOG_MAX_ATTEMPTS so a permanently-failing
// peer doesn't keep the radio awake forever (battery/heat). Reaching the
// 'connected' state resets the backoff so a later drop starts fresh.
const WATCHDOG_BASE_MS = 8_000;
const WATCHDOG_MAX_MS = 60_000;
const WATCHDOG_MAX_ATTEMPTS = 6;

// Explicit constraints: disable browser noise suppression and AGC because
// they make voices sound muffled/robotic. Echo cancellation stays on to
// prevent acoustic feedback when testing on the same machine.
// sampleRate uses { ideal } so iOS Safari doesn't throw OverconstrainedError
// when the device's native rate differs from 48000.
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
  sampleRate: { ideal: 48000 },
  channelCount: 1,
};

// Boost Opus above its conservative default (~32 kbps) for clearer speech.
const OPUS_MAX_BITRATE_BPS = 128_000;

// Per-peer connection bookkeeping. We use a deterministic single-initiator
// model (no glare): for each pair, exactly one side — the higher playerId —
// creates offers. The other only answers. This removes the simultaneous-offer
// collisions that left some pairs stuck in `have-local-offer` (one-way / no
// audio for "some players but not others").
interface PeerCtx {
  pc: RTCPeerConnection;
  // True on the side responsible for creating/refreshing offers for this pair.
  isInitiator: boolean;
  makingOffer: boolean;
  // ICE candidates that arrived before remoteDescription was set.
  iceQueue: RTCIceCandidateInit[];
  watchdog: ReturnType<typeof setTimeout> | null;
  // Exponential-backoff state for the watchdog. `watchdogDelay` is the current
  // interval (doubles each retry up to WATCHDOG_MAX_MS); `watchdogAttempts`
  // counts recovery attempts so we can give up after WATCHDOG_MAX_ATTEMPTS.
  // Both reset to their initial values once the peer reaches 'connected'.
  watchdogDelay: number;
  watchdogAttempts: number;
}

export function useVoiceChat(
  myPlayerId: string | null,
  roomPlayers: readonly string[],
  enabled: boolean,
): VoiceChatState {
  const [muted, setMuted] = useState(true);
  const [deafened, setDeafened] = useState(false);
  const [mode, setMode] = useState<VoiceMode>('ptt');
  const [pttActive, setPttActiveState] = useState(false);
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const [permissionDenied, setPermissionDenied] = useState(false);
  // State (not ref) so peer-connection effect re-runs when stream becomes available.
  const [localStreamReady, setLocalStreamReady] = useState(false);
  // ICE servers come from the server (STUN + minted Cloudflare TURN creds).
  // Gate peer creation on this so every connection is built with TURN available.
  const [iceServersReady, setIceServersReady] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  // Latest ICE servers; read by createPeer (ref so the callback stays stable).
  const iceServersRef = useRef<RTCIceServer[]>(STUN_SERVERS);
  // Mirror deafened in a ref so playRemoteStream (a stable callback) can read it.
  const deafenedRef = useRef(false);
  const peersRef = useRef<Map<string, PeerCtx>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserCleanupRef = useRef<Map<string, () => void>>(new Map());
  // Mirror `enabled` in a ref so stable callbacks (createPeer, mount cleanup)
  // can read the latest value without being re-created.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  // Audio elements whose .play() was blocked by the browser (iOS autoplay policy).
  const pendingPlayRef = useRef<Set<HTMLAudioElement>>(new Set());
  // Signaling that arrived before the PeerCtx was created (same-device race:
  // localhost socket round-trip is faster than a React effect). Replayed in
  // arrival order once the peer is built.
  type BufferedSignal =
    | { kind: 'offer'; description: RTCSessionDescriptionInit }
    | { kind: 'answer'; description: RTCSessionDescriptionInit }
    | { kind: 'ice'; candidate: RTCIceCandidateInit };
  const pendingSignalsRef = useRef<Map<string, BufferedSignal[]>>(new Map());

  // ── speaking detection ──────────────────────────────────────────────────

  const startSpeakingDetection = useCallback((playerId: string, stream: MediaStream) => {
    if (analyserCleanupRef.current.has(playerId)) return;

    const ctx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = ctx;
    // An analyser is about to poll — make sure the context isn't suspended.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128; // 128 samples is plenty for RMS voice detection; was 512
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

  // ── AudioContext power management ─────────────────────────────────────────
  //
  // The AudioContext (and its analyser polling) burns CPU/battery while running.
  // We suspend it whenever nothing needs it — i.e. there are no active analysers
  // (neither the local mic detection nor any remote-stream detection). It is
  // resumed lazily whenever an analyser is (re)started. This must not regress
  // the iOS autoplay-unlock path: unlockAudio() still resumes on user gesture,
  // and we only suspend, never close, so a later resume() works without a fresh
  // user gesture once the page has been unlocked.

  // Suspend the context if no analyser currently needs it. Remote speaking
  // detection keeps an analyser per connected peer, so this only suspends when
  // there are genuinely no active analysers (local muted AND no remote streams).
  const maybeSuspendAudioCtx = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (analyserCleanupRef.current.size > 0) return;
    if (ctx.state === 'running') void ctx.suspend().catch(() => {});
  }, []);

  // Resume the context when an analyser needs to poll. Async/best-effort: on iOS
  // resume() may reject until a user gesture, which unlockAudio() handles later.
  const resumeAudioCtx = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {});
  }, []);

  // ── iOS audio unlock ────────────────────────────────────────────────────

  // iOS Safari starts AudioContext suspended and blocks audio autoplay outside
  // of a user gesture. Resume the context and retry any blocked audio elements.
  const unlockAudio = useCallback(() => {
    // Only resume on a user gesture if something actually needs the context
    // (an active analyser). If we're muted/idle and intentionally suspended,
    // don't wake it up just because the user tapped — that would defeat Fix 3.
    if (audioCtxRef.current?.state === 'suspended' && analyserCleanupRef.current.size > 0) {
      void audioCtxRef.current.resume();
    }
    for (const el of [...pendingPlayRef.current]) {
      void el.play()
        .then(() => { pendingPlayRef.current.delete(el); })
        .catch(() => {});
    }
  }, []);

  // Persistent document-level listeners ensure any user gesture (including the
  // first touch after page load) unlocks audio and retries blocked elements.
  // Persistent (not once) so new peers added after the first gesture also unlock.
  useEffect(() => {
    const handler = () => unlockAudio();
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('click', handler);
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('click', handler);
    };
  }, [unlockAudio]);

  // ── play remote stream through an <audio> element ──────────────────────

  const playRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
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
      // iOS Safari blocks autoplay outside of a user gesture — queue for
      // the next user interaction (handled by the document-level listener above).
      pendingPlayRef.current.add(el!);
    });
  }, []);

  const removeRemoteAudio = useCallback((peerId: string) => {
    const el = audioElementsRef.current.get(peerId);
    if (el) {
      pendingPlayRef.current.delete(el);
      el.srcObject = null;
      el.remove();
      audioElementsRef.current.delete(peerId);
    }
  }, []);

  // ── init / cleanup local stream ─────────────────────────────────────────

  // Gated on `enabled` (true only while the user is in a room). When disabled
  // we never acquire the mic / start an AudioContext, so the lobby costs nothing.
  // When it flips false after being true (user leaves the room), the cleanup
  // below fully tears voice down: tracks stopped, peers closed, detection
  // stopped, AudioContext suspended.
  useEffect(() => {
    if (!enabled) return;

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
      // Local mic starts disabled, so detection stays paused until unmuted/PTT
      // (see the mute/PTT sync effect). Don't start it here.
    }).catch(() => {
      if (!cancelled) setPermissionDenied(true);
    });

    return () => {
      cancelled = true;
      // Close every peer connection and its per-peer detection/audio.
      for (const pid of [...peersRef.current.keys()]) closePeer(pid);
      // Stop local speaking detection (if running) and clear the speaking set.
      if (myPlayerId) stopSpeakingDetection(myPlayerId);
      setSpeaking(new Set());
      // Release the mic so the radio/DSP can power down.
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setLocalStreamReady(false);
      // Nothing needs the AudioContext now — suspend it (don't close, so the
      // next room keeps the iOS-unlocked context).
      maybeSuspendAudioCtx();
    };
  // closePeer/stopSpeakingDetection/maybeSuspendAudioCtx are stable callbacks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── fetch ICE servers (STUN + Cloudflare TURN) from the server ──────────

  // Always resolves: on error we keep the STUN-only fallback so voice still
  // works on the same network even if TURN credentials are unavailable.
  const loadIceServers = useCallback(async () => {
    try {
      const ack = await requestIceServers();
      if (ack?.iceServers?.length) {
        iceServersRef.current = ack.iceServers as RTCIceServer[];
      }
    } catch {
      // keep STUN fallback
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadIceServers().finally(() => {
      if (!cancelled) setIceServersReady(true);
    });
    return () => { cancelled = true; };
  }, [loadIceServers]);

  // ── Perfect Negotiation receive logic ───────────────────────────────────

  const flushIce = useCallback((ctx: PeerCtx) => {
    const queue = ctx.iceQueue;
    ctx.iceQueue = [];
    for (const candidate of queue) {
      void ctx.pc.addIceCandidate(candidate).catch(() => {});
    }
  }, []);

  // Responder side: an offer arrived → answer it. (Only the non-initiator
  // receives offers in normal flow; we still handle late/duplicate offers,
  // e.g. an ICE-restart re-offer, by re-applying and re-answering.)
  const handleOffer = useCallback(
    async (ctx: PeerCtx, peerId: string, offer: RTCSessionDescriptionInit) => {
      const { pc } = ctx;
      try {
        await pc.setRemoteDescription(offer);
        flushIce(ctx);
        await pc.setLocalDescription(); // implicit createAnswer
        const payload: VoiceAnswerPayload = {
          targetPlayerId: peerId,
          answer: pc.localDescription as RTCSessionDescriptionInit,
        };
        socket.emit(EVENTS.VOICE_ANSWER, payload);
      } catch (err) {
        console.warn('[voice] handleOffer failed for peer', peerId, err);
      }
    },
    [flushIce],
  );

  // Initiator side: an answer to our offer arrived.
  const handleAnswer = useCallback(
    async (ctx: PeerCtx, peerId: string, answer: RTCSessionDescriptionInit) => {
      const { pc } = ctx;
      // Only meaningful while we're waiting for an answer; ignore stale dups.
      if (pc.signalingState !== 'have-local-offer') return;
      try {
        await pc.setRemoteDescription(answer);
        flushIce(ctx);
      } catch (err) {
        console.warn('[voice] handleAnswer failed for peer', peerId, err);
      }
    },
    [flushIce],
  );

  const handleIce = useCallback(async (ctx: PeerCtx, candidate: RTCIceCandidateInit) => {
    // Queue until remoteDescription is set — Safari rejects addIceCandidate
    // before then, and signaling can briefly arrive out of order.
    if (!ctx.pc.remoteDescription) {
      ctx.iceQueue.push(candidate);
      return;
    }
    try {
      await ctx.pc.addIceCandidate(candidate);
    } catch {
      // Ignore — candidate for a superseded negotiation.
    }
  }, []);

  // ── create / tear down a single peer connection ─────────────────────────

  const closePeer = useCallback((peerId: string) => {
    const ctx = peersRef.current.get(peerId);
    if (!ctx) return;
    if (ctx.watchdog) clearTimeout(ctx.watchdog);
    ctx.pc.onnegotiationneeded = null;
    ctx.pc.onicecandidate = null;
    ctx.pc.ontrack = null;
    ctx.pc.onconnectionstatechange = null;
    ctx.pc.oniceconnectionstatechange = null;
    ctx.pc.close();
    peersRef.current.delete(peerId);
    pendingSignalsRef.current.delete(peerId);
    stopSpeakingDetection(peerId);
    removeRemoteAudio(peerId);
  }, [stopSpeakingDetection, removeRemoteAudio]);

  const createPeer = useCallback((peerId: string, stream: MediaStream, myId: string) => {
    if (peersRef.current.has(peerId)) return;

    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    const ctx: PeerCtx = {
      pc,
      // Deterministic role: the higher playerId initiates for this pair. Both
      // sides compute this identically, so exactly one offers — no glare.
      isInitiator: myId > peerId,
      makingOffer: false,
      iceQueue: [],
      watchdog: null,
      watchdogDelay: WATCHDOG_BASE_MS,
      watchdogAttempts: 0,
    };
    peersRef.current.set(peerId, ctx);

    // Recovery driver. Only the initiator can (re)offer; the responder asks the
    // initiator to do so via a renegotiate signal. Either side can detect a
    // stuck/failed connection, so recovery works regardless of who notices.
    const recover = () => {
      if (ctx.isInitiator) {
        if (pc.signalingState === 'have-local-offer' && pc.localDescription) {
          // Our offer was likely dropped before the peer's PC existed — resend.
          socket.emit(EVENTS.VOICE_OFFER, {
            targetPlayerId: peerId,
            offer: pc.localDescription as RTCSessionDescriptionInit,
          } satisfies VoiceOfferPayload);
        } else {
          // Connection degraded — ICE restart triggers a fresh offer.
          try { pc.restartIce(); } catch { /* noop */ }
        }
      } else {
        socket.emit(EVENTS.VOICE_RENEGOTIATE, { targetPlayerId: peerId } satisfies VoiceRenegotiatePayload);
      }
    };

    const armWatchdog = () => {
      if (ctx.watchdog) clearTimeout(ctx.watchdog);
      // Give up after the attempt cap so a permanently-failing peer stops
      // keeping the radio awake (battery/heat). Resets on 'connected'.
      if (ctx.watchdogAttempts >= WATCHDOG_MAX_ATTEMPTS) {
        console.warn(
          '[voice] watchdog gave up for peer', peerId,
          'after', ctx.watchdogAttempts, 'attempts; state=', pc.connectionState,
        );
        return;
      }
      const delay = ctx.watchdogDelay;
      ctx.watchdog = setTimeout(() => {
        if (pc.connectionState === 'connected' || pc.connectionState === 'closed') return;
        ctx.watchdogAttempts += 1;
        console.debug(
          '[voice] watchdog recovery for peer', peerId,
          'attempt', ctx.watchdogAttempts, 'state=', pc.connectionState,
        );
        recover();
        // Exponential backoff: roughly double each retry, capped.
        ctx.watchdogDelay = Math.min(ctx.watchdogDelay * 2, WATCHDOG_MAX_MS);
        armWatchdog();
      }, delay);
    };

    // Diagnostic: log whether this peer connected directly (P2P/STUN) or via a
    // TURN relay. Inspect the selected ICE candidate pair's candidate types —
    // 'relay' on either side means TURN is in use.
    const logConnectionType = async () => {
      try {
        const stats = await pc.getStats();
        const byId = new Map<string, Record<string, unknown>>();
        stats.forEach((report: { id: string }) => byId.set(report.id, report as Record<string, unknown>));

        let pair: Record<string, unknown> | undefined;
        for (const r of byId.values()) {
          if (r['type'] === 'candidate-pair' && r['state'] === 'succeeded' && r['nominated'] === true) {
            pair = r;
            break;
          }
        }
        if (!pair) {
          for (const r of byId.values()) {
            if (r['type'] === 'transport' && typeof r['selectedCandidatePairId'] === 'string') {
              pair = byId.get(r['selectedCandidatePairId']);
              break;
            }
          }
        }
        if (!pair) return;
        const localType = byId.get(pair['localCandidateId'] as string)?.['candidateType'];
        const remoteType = byId.get(pair['remoteCandidateId'] as string)?.['candidateType'];
        const usingTurn = localType === 'relay' || remoteType === 'relay';
        console.info(
          `[voice] peer ${peerId}: ${usingTurn ? '🔁 TURN relay' : '↔️ direct P2P'} ` +
          `(local=${String(localType)}, remote=${String(remoteType)})`,
        );
      } catch {
        // getStats unavailable — ignore.
      }
    };

    // Only the initiator creates offers (initial track add + ICE restarts).
    // The responder's negotiationneeded (from its own addTrack) is ignored —
    // it answers the initiator's offer instead. This removes glare entirely.
    pc.onnegotiationneeded = async () => {
      if (!ctx.isInitiator) return;
      try {
        ctx.makingOffer = true;
        await pc.setLocalDescription(); // implicit createOffer
        const payload: VoiceOfferPayload = {
          targetPlayerId: peerId,
          offer: pc.localDescription as RTCSessionDescriptionInit,
        };
        socket.emit(EVENTS.VOICE_OFFER, payload);
      } catch (err) {
        console.warn('[voice] createOffer failed for peer', peerId, err);
      } finally {
        ctx.makingOffer = false;
      }
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        const payload: VoiceIcePayload = {
          targetPlayerId: peerId,
          candidate: ev.candidate.toJSON(),
        };
        socket.emit(EVENTS.VOICE_ICE, payload);
      }
    };

    pc.ontrack = (ev) => {
      const remoteStream = ev.streams[0];
      if (!remoteStream) return;
      playRemoteStream(peerId, remoteStream);
      startSpeakingDetection(peerId, remoteStream);
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') {
        if (ctx.watchdog) { clearTimeout(ctx.watchdog); ctx.watchdog = null; }
        // Reset backoff so a later drop starts a fresh recovery sequence.
        ctx.watchdogDelay = WATCHDOG_BASE_MS;
        ctx.watchdogAttempts = 0;
        void logConnectionType();
        // Bump Opus bitrate above its conservative default.
        for (const sender of pc.getSenders()) {
          if (sender.track?.kind !== 'audio') continue;
          const params = sender.getParameters();
          if (params.encodings.length === 0) params.encodings.push({});
          params.encodings[0]!.maxBitrate = OPUS_MAX_BITRATE_BPS;
          void sender.setParameters(params).catch(() => {});
        }
      } else if (st === 'failed' || st === 'disconnected') {
        console.debug('[voice] peer', peerId, 'connectionState=', st, '→ recovering');
        recover();
        armWatchdog();
      }
    };

    pc.oniceconnectionstatechange = () => {
      // Some browsers surface ICE death here rather than on connectionState.
      if (pc.iceConnectionState === 'failed') {
        console.debug('[voice] peer', peerId, 'iceConnectionState=failed → recovering');
        recover();
        armWatchdog();
      }
    };

    // Add local audio track → fires onnegotiationneeded for the initial offer.
    stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

    // Replay any signaling that arrived before this peer existed (in order).
    const pending = pendingSignalsRef.current.get(peerId);
    if (pending) {
      pendingSignalsRef.current.delete(peerId);
      for (const sig of pending) {
        if (sig.kind === 'offer') void handleOffer(ctx, peerId, sig.description);
        else if (sig.kind === 'answer') void handleAnswer(ctx, peerId, sig.description);
        else void handleIce(ctx, sig.candidate);
      }
    }

    armWatchdog();
  }, [playRemoteStream, startSpeakingDetection, handleOffer, handleAnswer, handleIce]);

  // ── build/tear-down peer connections when player list or stream changes ─

  useEffect(() => {
    if (!enabled || !myPlayerId || !localStreamReady || !iceServersReady || !localStreamRef.current) return;

    const stream = localStreamRef.current;
    const currentPeers = new Set(peersRef.current.keys());
    const desiredPeers = new Set(roomPlayers.filter(p => p !== myPlayerId));

    // Remove stale connections (player left the room).
    for (const pid of currentPeers) {
      if (!desiredPeers.has(pid)) closePeer(pid);
    }

    // Create new connections (player joined the room).
    for (const peerId of desiredPeers) {
      createPeer(peerId, stream, myPlayerId);
    }
  }, [enabled, myPlayerId, roomPlayers, localStreamReady, iceServersReady, createPeer, closePeer]);

  // ── socket: handle relayed signaling ───────────────────────────────────

  useEffect(() => {
    function bufferSignal(peerId: string, signal: BufferedSignal) {
      const list = pendingSignalsRef.current.get(peerId) ?? [];
      list.push(signal);
      pendingSignalsRef.current.set(peerId, list);
    }

    function onOffer({ sourcePlayerId, offer }: VoiceOfferRelayPayload) {
      const ctx = peersRef.current.get(sourcePlayerId);
      if (!ctx) { bufferSignal(sourcePlayerId, { kind: 'offer', description: offer }); return; }
      void handleOffer(ctx, sourcePlayerId, offer);
    }

    function onAnswer({ sourcePlayerId, answer }: VoiceAnswerRelayPayload) {
      const ctx = peersRef.current.get(sourcePlayerId);
      if (!ctx) { bufferSignal(sourcePlayerId, { kind: 'answer', description: answer }); return; }
      void handleAnswer(ctx, sourcePlayerId, answer);
    }

    function onIce({ sourcePlayerId, candidate }: VoiceIceRelayPayload) {
      const ctx = peersRef.current.get(sourcePlayerId);
      if (!ctx) { bufferSignal(sourcePlayerId, { kind: 'ice', candidate }); return; }
      void handleIce(ctx, candidate);
    }

    // A peer asked us (the initiator) to (re)start negotiation — e.g. it never
    // received our offer, or its side detected a failure it can't fix itself.
    function onRenegotiate({ sourcePlayerId }: VoiceRenegotiateRelayPayload) {
      const ctx = peersRef.current.get(sourcePlayerId);
      if (!ctx || !ctx.isInitiator) return;
      if (ctx.pc.signalingState === 'have-local-offer' && ctx.pc.localDescription) {
        socket.emit(EVENTS.VOICE_OFFER, {
          targetPlayerId: sourcePlayerId,
          offer: ctx.pc.localDescription as RTCSessionDescriptionInit,
        } satisfies VoiceOfferPayload);
      } else {
        try { ctx.pc.restartIce(); } catch { /* noop */ }
      }
    }

    socket.on(EVENTS.VOICE_OFFER_RELAY, onOffer);
    socket.on(EVENTS.VOICE_ANSWER_RELAY, onAnswer);
    socket.on(EVENTS.VOICE_ICE_RELAY, onIce);
    socket.on(EVENTS.VOICE_RENEGOTIATE_RELAY, onRenegotiate);
    return () => {
      socket.off(EVENTS.VOICE_OFFER_RELAY, onOffer);
      socket.off(EVENTS.VOICE_ANSWER_RELAY, onAnswer);
      socket.off(EVENTS.VOICE_ICE_RELAY, onIce);
      socket.off(EVENTS.VOICE_RENEGOTIATE_RELAY, onRenegotiate);
    };
  }, [handleOffer, handleAnswer, handleIce]);

  // ── reconnect: rebuild peers after the signaling socket reconnects ──────

  // On a socket reconnect the old PeerCtx objects may be tied to a dead session
  // and never recover on their own. Tear them all down; the peer-setup effect
  // re-creates them from the next room_update.
  useEffect(() => {
    function onReconnect() {
      for (const pid of [...peersRef.current.keys()]) closePeer(pid);
      // Don't rebuild peers if voice is disabled (user not in a room).
      if (!enabledRef.current) return;
      // Refresh ICE credentials (TURN creds may have expired), then rebuild.
      void loadIceServers().finally(() => {
        const stream = localStreamRef.current;
        if (myPlayerId && stream) {
          for (const peerId of roomPlayers.filter(p => p !== myPlayerId)) {
            createPeer(peerId, stream, myPlayerId);
          }
        }
      });
    }
    socket.io.on('reconnect', onReconnect);
    return () => { socket.io.off('reconnect', onReconnect); };
  }, [myPlayerId, roomPlayers, createPeer, closePeer, loadIceServers]);

  // ── mute / PTT sync ─────────────────────────────────────────────────────

  const applyMuteState = useCallback((shouldMute: boolean) => {
    const stream = localStreamRef.current;
    stream?.getAudioTracks().forEach(t => { t.enabled = !shouldMute; });

    if (shouldMute) {
      // Muted / PTT inactive: we cannot transmit, so stop polling the local
      // analyser. If nothing else needs the AudioContext (no remote streams),
      // suspend it to save CPU/battery. stopSpeakingDetection also clears the
      // local speaking flag.
      if (myPlayerId) stopSpeakingDetection(myPlayerId);
      maybeSuspendAudioCtx();
    } else if (stream && myPlayerId) {
      // Unmuted / PTT active: resume the context and (re)start local detection.
      resumeAudioCtx();
      startSpeakingDetection(myPlayerId, stream);
    }
  }, [myPlayerId, stopSpeakingDetection, startSpeakingDetection, maybeSuspendAudioCtx, resumeAudioCtx]);

  // Also depends on localStreamReady so that once the mic stream arrives, the
  // current mute/PTT state is (re)applied — starting local detection if the
  // user is already unmuted / holding PTT.
  useEffect(() => {
    if (mode === 'open') {
      applyMuteState(muted);
    } else {
      // PTT: track enabled only while button/Space is held.
      applyMuteState(!pttActive);
    }
  }, [muted, mode, pttActive, localStreamReady, applyMuteState]);

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
    const peers = peersRef.current;
    const analysers = analyserCleanupRef.current;
    const audioEls = audioElementsRef.current;
    const pendingPlay = pendingPlayRef.current;
    const pendingSignals = pendingSignalsRef.current;
    return () => {
      for (const cleanup of analysers.values()) cleanup();
      analysers.clear();
      for (const ctx of peers.values()) {
        if (ctx.watchdog) clearTimeout(ctx.watchdog);
        ctx.pc.close();
      }
      peers.clear();
      pendingSignals.clear();
      pendingPlay.clear();
      for (const [pid] of audioEls) removeRemoteAudio(pid);
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
