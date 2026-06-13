import { useGame } from '../state/GameProvider';
import './ConnectionBanner.css';

/**
 * Non-blocking banner shown when an established socket drops. The very first
 * connect is handled by App's full-screen spinner instead, so this only appears
 * once a session exists — i.e. a genuine mid-session disconnect. Socket.io
 * reconnects automatically; the banner clears itself when `connected` flips back.
 */
export function ConnectionBanner(): React.ReactNode {
  const { connected, session } = useGame();
  if (connected || !session) return null;

  return (
    <div className="conn-banner" role="status" aria-live="polite">
      <span className="conn-banner__dot" />
      Disconnected from server — reconnecting…
    </div>
  );
}
