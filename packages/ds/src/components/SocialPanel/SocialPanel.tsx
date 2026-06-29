import { useState } from 'react';
import type { ReactNode } from 'react';
import { DsCard } from '../Card/Card';
import './SocialPanel.css';

export interface FriendEntry {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  gamesPlayedTogether: number;
  isOnline: boolean;
}

export interface SocialPanelProps {
  onlineFriends: FriendEntry[];
  recentOpponents: FriendEntry[];
  isLoggedIn: boolean;
  isLoading: boolean;
  onInvite: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  onViewAllFriends?: () => void;
  onViewAllOpponents?: () => void;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function mapError(error: string | undefined): string {
  switch (error) {
    case 'OFFLINE': return 'Offline';
    case 'ALREADY_IN_ROOM': return 'In a room';
    case 'ALREADY_IN_GAME': return 'In a game';
    case 'BLOCKED': return 'Unavailable';
    default: return 'Try again';
  }
}

function FriendsPanelSkeleton({ rows = 5 }: { rows?: number }): ReactNode {
  return (
    <div className="room__friends-skeleton-list">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="room__friends-skeleton-row">
          <div className="room__skeleton room__skeleton--avatar" />
          <div style={{ flex: 1 }}>
            <div className="room__skeleton" style={{ width: '70%' }} />
          </div>
          <div className="room__skeleton room__skeleton--action" />
        </div>
      ))}
    </div>
  );
}

export function SocialPanel({
  onlineFriends,
  recentOpponents,
  isLoggedIn,
  isLoading,
  onInvite,
  onViewAllFriends,
  onViewAllOpponents,
}: SocialPanelProps): ReactNode {
  const [inviteStates, setInviteStates] = useState<Record<string, 'idle' | 'loading' | 'sent' | string>>({});

  async function handleInvite(userId: string): Promise<void> {
    setInviteStates((prev) => ({ ...prev, [userId]: 'loading' }));
    const ack = await onInvite(userId);
    if (ack.ok) {
      setInviteStates((prev) => ({ ...prev, [userId]: 'sent' }));
    } else {
      setInviteStates((prev) => ({ ...prev, [userId]: mapError(ack.error) }));
    }
  }

  function renderRow(p: FriendEntry, showGames: boolean): ReactNode {
    const st = inviteStates[p.userId] ?? 'idle';
    const loading = st === 'loading';
    const sent = st === 'sent';
    const isError = st !== 'idle' && st !== 'loading' && st !== 'sent';
    return (
      <div key={p.userId} className="room__invite-row">
        {p.avatarUrl ? (
          <img
            className="room__invite-avatar"
            src={p.avatarUrl}
            alt={p.displayName}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="room__invite-initials" aria-hidden="true">
            {getInitials(p.displayName)}
          </div>
        )}
        <div className="room__invite-info">
          <span className="room__invite-name">
            {!showGames && p.isOnline && (
              <span className="room__invite-online-dot" aria-hidden="true">●</span>
            )}
            {p.displayName}
          </span>
          {showGames && (
            <span className="room__invite-sub">
              {p.gamesPlayedTogether} game{p.gamesPlayedTogether !== 1 ? 's' : ''} together
            </span>
          )}
        </div>
        {isError ? (
          <span className="room__invite-error">{st}</span>
        ) : (
          <button
            type="button"
            className={`room__invite-btn${sent ? ' room__invite-btn--sent' : ''}`}
            disabled={loading || sent || (!p.isOnline && !sent)}
            onClick={() => void handleInvite(p.userId)}
          >
            {loading ? (
              <span className="room__invite-spinner" aria-hidden="true" />
            ) : sent ? (
              'Invited'
            ) : (
              'Invite'
            )}
          </button>
        )}
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <DsCard className="room__friends-panel">
          <h3 className="room__friends-heading">FRIENDS ONLINE</h3>
          <p className="room__friends-empty muted">Sign in to invite friends</p>
        </DsCard>
        <DsCard className="room__friends-panel">
          <h3 className="room__friends-heading">RECENT OPPONENTS</h3>
          <p className="room__friends-empty muted">Sign in to see recent opponents</p>
        </DsCard>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <DsCard className="room__friends-panel">
          <h3 className="room__friends-heading">FRIENDS ONLINE</h3>
          <FriendsPanelSkeleton />
        </DsCard>
        <DsCard className="room__friends-panel">
          <h3 className="room__friends-heading">RECENT OPPONENTS</h3>
          <FriendsPanelSkeleton />
        </DsCard>
      </>
    );
  }

  return (
    <>
      <DsCard className="room__friends-panel">
        <h3 className="room__friends-heading">FRIENDS ONLINE</h3>
        {onlineFriends.length === 0 ? (
          <p className="room__friends-empty muted">No friends online</p>
        ) : (
          <div className="room__invite-list">
            {onlineFriends.map((p) => renderRow(p, false))}
          </div>
        )}
        <button type="button" className="secondary room__friends-view-all" onClick={onViewAllFriends}>
          View All Friends ›
        </button>
      </DsCard>
      <DsCard className="room__friends-panel">
        <h3 className="room__friends-heading">RECENT OPPONENTS</h3>
        {recentOpponents.length === 0 ? (
          <p className="room__friends-empty muted">No recent opponents</p>
        ) : (
          <div className="room__invite-list">
            {recentOpponents.slice(0, 4).map((p) => renderRow(p, true))}
          </div>
        )}
        <button type="button" className="secondary room__friends-view-all" onClick={onViewAllOpponents}>
          View All ›
        </button>
      </DsCard>
    </>
  );
}
