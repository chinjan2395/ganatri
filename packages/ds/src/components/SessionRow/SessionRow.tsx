import type { ReactNode } from 'react';
import './SessionRow.css';

export interface DsSessionRowProps {
  sessionId: string;
  userAgent: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  busy: boolean;
  onRevoke: (sessionId: string) => void;
  onLogoutCurrent: () => void;
}

export function DsSessionRow({
  sessionId,
  userAgent,
  current,
  createdAt,
  lastSeenAt,
  expiresAt,
  busy,
  onRevoke,
  onLogoutCurrent,
}: DsSessionRowProps): ReactNode {
  const rootClass = `ds-session-row${current ? ' ds-session-row--current' : ''}`;

  return (
    <article className={rootClass}>
      <div className="ds-session-row__main">
        <div className="ds-session-row__topline">
          <span className="ds-session-row__useragent">{userAgent}</span>
          <span
            className={`ds-session-row__badge${current ? ' ds-session-row__badge--current' : ''}`}
          >
            {current ? 'Current device' : 'Active'}
          </span>
        </div>
        <div className="ds-session-row__meta">
          <span>Created {createdAt}</span>
          <span>Last seen {lastSeenAt}</span>
          <span>Expires {expiresAt}</span>
        </div>
      </div>
      <div className="ds-session-row__actions">
        {current ? (
          <button type="button" className="secondary" onClick={onLogoutCurrent}>
            Log out
          </button>
        ) : (
          <button
            type="button"
            className="secondary"
            onClick={() => onRevoke(sessionId)}
            disabled={busy}
          >
            Revoke
          </button>
        )}
      </div>
    </article>
  );
}
