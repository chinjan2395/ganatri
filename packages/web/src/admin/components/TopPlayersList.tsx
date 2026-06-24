import type { TopPlayer } from '../mockData';
import { AdminPanel } from './AdminPanel';

interface TopPlayersListProps {
  players: TopPlayer[];
  title?: string;
}

export function TopPlayersList({ players, title = 'Top Players' }: TopPlayersListProps) {
  return (
    <AdminPanel title={title} action={<span className="admin-panel__subtitle">This Week</span>}>
      <ul className="admin-top-players">
        {players.map(p => (
          <li key={p.rank} className="admin-top-players__row">
            <span className="admin-top-players__rank">{p.rank}</span>
            <div className="admin-top-players__avatar">{p.initials}</div>
            <span className="admin-top-players__name">{p.name}</span>
            <span className="admin-top-players__star" aria-hidden="true">★</span>
            <span className="admin-top-players__score">{p.score.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}
