import type { AdminServerStats } from '../../protocol';
import { GamesOverTimeChart } from '../components/GamesOverTimeChart';
import { KpiSummaryRow } from '../components/KpiSummaryRow';
import { LiveGamesTable } from '../components/LiveGamesTable';
import { RecentActivityFeed } from '../components/RecentActivityFeed';
import { RoomDonutChart } from '../components/RoomDonutChart';
import { ServerHealthPanel } from '../components/ServerHealthPanel';
import { TopPlayersList } from '../components/TopPlayersList';
import {
  MOCK_ACTIVITY,
  MOCK_GAMES_OVER_TIME,
  MOCK_KPI_CARDS,
  MOCK_LIVE_GAMES,
  MOCK_ROOM_DONUT,
  MOCK_SERVER_HEALTH,
  MOCK_TOP_PLAYERS,
  applyServerHealthOverrides,
  applyStatsOverrides,
} from '../mockData';

interface DashboardPageProps {
  stats: AdminServerStats | null;
}

export function DashboardPage({ stats }: DashboardPageProps) {
  const kpiCards = applyStatsOverrides(MOCK_KPI_CARDS, stats);
  const serverHealth = applyServerHealthOverrides(MOCK_SERVER_HEALTH, stats);

  return (
    <div className="admin-dash">
      <KpiSummaryRow cards={kpiCards} />

      <div className="admin-dash__row-mid">
        <LiveGamesTable rows={MOCK_LIVE_GAMES} />
        <RoomDonutChart data={MOCK_ROOM_DONUT} />
        <ServerHealthPanel data={serverHealth} />
      </div>

      <div className="admin-dash__row-bot">
        <GamesOverTimeChart data={MOCK_GAMES_OVER_TIME} />
        <TopPlayersList players={MOCK_TOP_PLAYERS} />
        <RecentActivityFeed items={MOCK_ACTIVITY} />
      </div>
    </div>
  );
}
