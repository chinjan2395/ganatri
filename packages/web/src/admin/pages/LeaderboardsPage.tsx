import { TopPlayersList } from '../components/TopPlayersList';
import { AdminPanel } from '../components/AdminPanel';
import { MOCK_TOP_PLAYERS } from '../mockData';

export function LeaderboardsPage() {
  return (
    <div className="admin-page admin-page--two-col">
      <TopPlayersList players={MOCK_TOP_PLAYERS} title="Weekly Leaderboard" />
      <AdminPanel title="Monthly Leaderboard">
        <ul className="admin-top-players">
          {MOCK_TOP_PLAYERS.map(p => (
            <li key={`m-${p.rank}`} className="admin-top-players__row">
              <span className="admin-top-players__rank">{p.rank}</span>
              <div className="admin-top-players__avatar">{p.initials}</div>
              <span className="admin-top-players__name">{p.name}</span>
              <span className="admin-top-players__score">{(p.score * 3.2).toFixed(0)}</span>
            </li>
          ))}
        </ul>
      </AdminPanel>
    </div>
  );
}
