import { useEffect, useState } from 'react';
import { useGame } from '../state/GameProvider';
import type { RespondToInviteAck } from '../protocol';
import './InviteToast.css';

const INVITE_TIMEOUT_S = 60;

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function errorMessage(ack: RespondToInviteAck & { ok: false }): string {
  if (ack.error === 'UNAVAILABLE') return 'Unavailable, try again';
  if (ack.error === 'NOT_FOUND') return 'Invite expired';
  return 'Something went wrong';
}

export function InviteToast(): React.ReactNode {
  const { pendingInvite, respondToInvite } = useGame();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(INVITE_TIMEOUT_S);

  // Reset all local state when the invite changes (new invite arrived or dismissed).
  const inviterUserId = pendingInvite?.inviterUserId ?? null;
  useEffect(() => {
    setError(null);
    setBusy(false);
    setBlocked(false);
    setSecondsLeft(INVITE_TIMEOUT_S);
  }, [inviterUserId]);

  // Countdown timer — runs while an invite is pending.
  useEffect(() => {
    if (!inviterUserId) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [inviterUserId]);

  // The component only renders while pendingInvite is non-null.
  if (!pendingInvite) return null;

  const { displayName, avatarUrl } = pendingInvite;

  async function handleAccept(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const ack = await respondToInvite(pendingInvite!.inviterUserId, true);
      if (!ack.ok) {
        setError(errorMessage(ack));
      }
      // On success, `room` becomes non-null via ROOM_UPDATE → App.tsx routes to RoomScreen.
      // `pendingInvite` is cleared by GameProvider on accept.
    } finally {
      setBusy(false);
    }
  }

  async function handleDecline(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const ack = await respondToInvite(pendingInvite!.inviterUserId, false);
      if (!ack.ok) {
        setError(errorMessage(ack));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleBlock(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const ack = await respondToInvite(pendingInvite!.inviterUserId, false, true);
      if (ack.ok) {
        setBlocked(true);
        // Show "User blocked" confirmation for 1.5 s — the parent component
        // will naturally unmount once `pendingInvite` is cleared by the server
        // INVITE_CANCELLED push (or we rely on a server-side rejection clearing it).
        // Nothing extra is needed here; the message is visible until unmount.
      } else {
        setError(errorMessage(ack));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="invite-toast" role="dialog" aria-modal="false" aria-label="Game invitation">
      <div className="invite-toast__card">
        <div className="invite-toast__avatar-wrap">
          {avatarUrl ? (
            <img
              className="invite-toast__avatar"
              src={avatarUrl}
              alt={displayName}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="invite-toast__avatar-initials" aria-hidden="true">
              {getInitials(displayName)}
            </div>
          )}
          <div className="invite-toast__info">
            <span className="invite-toast__name">{displayName}</span>
            <span className="invite-toast__subtitle">wants to play with you!</span>
          </div>
          <div
            className="invite-toast__countdown"
            aria-label={`Invite expires in ${secondsLeft} seconds`}
          >
            {secondsLeft}s
          </div>
        </div>

        {blocked ? (
          <p className="invite-toast__blocked-msg">User blocked</p>
        ) : (
          <>
            {error && <p className="invite-toast__error">{error}</p>}
            <div className="invite-toast__actions">
              <button
                className="invite-toast__accept-btn"
                onClick={() => void handleAccept()}
                disabled={busy}
                aria-label="Accept invite"
              >
                {busy ? <span className="invite-toast__spinner" aria-hidden="true" /> : 'Accept'}
              </button>
              <button
                className="invite-toast__decline-btn"
                onClick={() => void handleDecline()}
                disabled={busy}
                aria-label="Decline invite"
              >
                Decline
              </button>
              <button
                className="invite-toast__block-btn"
                onClick={() => void handleBlock()}
                disabled={busy}
                aria-label="Block this player"
              >
                Block
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
