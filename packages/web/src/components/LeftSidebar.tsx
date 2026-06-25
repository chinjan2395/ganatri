import type React from 'react';
import './LeftSidebar.css';

export interface LeftSidebarPlayer {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isYou: boolean;
  isHost: boolean;
  captureCount: number;
  connected: boolean;
}

export interface LeftSidebarProps {
  roomCode: string;
  playerCount: number;
  maxPlayers?: number;
  partLabel: string;
  players: LeftSidebarPlayer[];
  onCopyRoomCode?: () => void;
  open?: boolean;
  onClose?: () => void;
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function LeftSidebar({
  roomCode,
  playerCount,
  maxPlayers = 4,
  partLabel,
  players,
  onCopyRoomCode,
  open = false,
  onClose,
}: LeftSidebarProps): React.ReactNode {
  const emptySlots = Math.max(0, maxPlayers - playerCount);

  return (
    <>
      <button
        type="button"
        className={`lsidebar__backdrop${open ? ' lsidebar__backdrop--visible' : ''}`}
        onClick={onClose}
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
      />
      <aside className={`lsidebar${open ? ' lsidebar--open' : ''}`}>
        <section className="lsidebar__section">
          <h4 className="lsidebar__heading">ROOM INFO</h4>
          <dl className="lsidebar__info">
            <div className="lsidebar__info-row">
              <dt>Room ID</dt>
              <dd>
                {roomCode}
                {onCopyRoomCode && (
                  <button type="button" className="lsidebar__copy" onClick={onCopyRoomCode} title="Copy room code">
                    ⧉
                  </button>
                )}
              </dd>
            </div>
            <div className="lsidebar__info-row">
              <dt>Game Mode</dt>
              <dd>Classic</dd>
            </div>
            <div className="lsidebar__info-row">
              <dt>Players</dt>
              <dd>{playerCount}/{maxPlayers}</dd>
            </div>
            <div className="lsidebar__info-row">
              <dt>Entry</dt>
              <dd>Free</dd>
            </div>
            <div className="lsidebar__info-row">
              <dt>Stake</dt>
              <dd>—</dd>
            </div>
            <div className="lsidebar__info-row">
              <dt>Round</dt>
              <dd>{partLabel}</dd>
            </div>
          </dl>
        </section>

        <section className="lsidebar__section">
          <h4 className="lsidebar__heading">PLAYERS ({playerCount}/{maxPlayers})</h4>
          <ul className="lsidebar__players">
            {players.map((p) => (
              <li key={p.id} className={`lsidebar__player${p.isYou ? ' lsidebar__player--you' : ''}`}>
                <div className="lsidebar__player-avatar">
                  {p.avatarUrl
                    ? <img src={p.avatarUrl} alt="" className="lsidebar__player-img" referrerPolicy="no-referrer" />
                    : <span>{initials(p.name)}</span>}
                  {p.isHost && <span className="lsidebar__crown" aria-hidden>♛</span>}
                </div>
                <div className="lsidebar__player-meta">
                  <span className="lsidebar__player-name">
                    {p.name}
                    {p.isYou && <span className="lsidebar__you-tag"> (You)</span>}
                  </span>
                  {!p.connected && <span className="lsidebar__offline">offline</span>}
                </div>
                <span className="lsidebar__player-score" title="Captured">
                  <span aria-hidden>⬡</span> {p.captureCount}
                </span>
              </li>
            ))}
            {Array.from({ length: emptySlots }, (_, i) => (
              <li key={`empty-${i}`} className="lsidebar__player lsidebar__player--empty">
                <div className="lsidebar__player-avatar lsidebar__player-avatar--empty" />
                <span className="lsidebar__waiting">Waiting for player…</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="lsidebar__section lsidebar__section--chat">
          <h4 className="lsidebar__heading">CHAT</h4>
          <div className="lsidebar__chat-messages">
            <p className="lsidebar__chat-empty">No messages yet</p>
          </div>
          <div className="lsidebar__chat-input-row">
            <button type="button" className="lsidebar__chat-emoji" disabled title="Emoji coming soon">😊</button>
            <input className="lsidebar__chat-input" placeholder="Type a message…" readOnly />
            <button type="button" className="lsidebar__chat-send" disabled aria-label="Send">➤</button>
          </div>
        </section>
      </aside>
    </>
  );
}
