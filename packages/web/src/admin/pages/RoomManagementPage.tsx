import { useMemo, useState } from 'react';
import type { AdminServerStats } from '../../protocol';
import { KpiSummaryCard } from '../components/KpiSummaryCard';
import { RoomDetailsPanel } from '../components/RoomDetailsPanel';
import { RoomListTable } from '../components/RoomListTable';
import {
  MOCK_ROOM_LIST,
  MOCK_ROOM_MGMT_KPIS,
  applyRoomStatsOverrides,
  getRoomDetail,
  type RoomListRow,
  type RoomStatus,
} from '../mockData';

const PAGE_SIZE = 10;
const TOTAL_ROOM_COUNT = 124;

interface RoomManagementPageProps {
  stats?: AdminServerStats | null;
}

function matchesSearch(row: RoomListRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return row.code.toLowerCase().includes(q) || row.hostName.toLowerCase().includes(q);
}

function matchesStatus(row: RoomListRow, status: RoomStatus | 'All'): boolean {
  return status === 'All' || row.status === status;
}

function matchesPlayers(row: RoomListRow, filter: 'All' | 'Full' | 'Open'): boolean {
  if (filter === 'All') return true;
  const [current, max] = row.players.split('/').map(Number);
  if (filter === 'Full') return current === max;
  return (current ?? 0) < (max ?? 4);
}

export function RoomManagementPage({ stats = null }: RoomManagementPageProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RoomStatus | 'All'>('All');
  const [playerFilter, setPlayerFilter] = useState<'All' | 'Full' | 'Open'>('All');
  const [page, setPage] = useState(1);
  const [selectedCode, setSelectedCode] = useState<string | null>('YD3BTK');
  const [refreshKey, setRefreshKey] = useState(0);

  const kpiCards = useMemo(() => applyRoomStatsOverrides(MOCK_ROOM_MGMT_KPIS, stats), [stats]);

  const filteredRows = useMemo(() => {
    void refreshKey;
    return MOCK_ROOM_LIST.filter(
      row =>
        matchesSearch(row, search) &&
        matchesStatus(row, statusFilter) &&
        matchesPlayers(row, playerFilter),
    );
  }, [search, statusFilter, playerFilter, refreshKey]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const selectedRow = MOCK_ROOM_LIST.find(r => r.code === selectedCode);
  const selectedDetail = selectedCode ? getRoomDetail(selectedCode, selectedRow) : null;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: RoomStatus | 'All') => {
    setStatusFilter(value);
    setPage(1);
  };

  const handlePlayerFilterChange = (value: 'All' | 'Full' | 'Open') => {
    setPlayerFilter(value);
    setPage(1);
  };

  const displayTotal = search || statusFilter !== 'All' || playerFilter !== 'All'
    ? filteredRows.length
    : TOTAL_ROOM_COUNT;

  return (
    <div className="admin-page admin-page--rooms">
      <div className="admin-rooms__kpis">
        {kpiCards.map(card => (
          <KpiSummaryCard key={card.label} data={card} />
        ))}
      </div>

      <div className={`admin-rooms__body${selectedDetail ? ' admin-rooms__body--with-detail' : ''}`}>
        <RoomListTable
          rows={pagedRows}
          selectedCode={selectedCode}
          search={search}
          statusFilter={statusFilter}
          playerFilter={playerFilter}
          page={page}
          totalCount={displayTotal}
          pageSize={PAGE_SIZE}
          onSearchChange={handleSearchChange}
          onStatusFilterChange={handleStatusFilterChange}
          onPlayerFilterChange={handlePlayerFilterChange}
          onRefresh={() => setRefreshKey(k => k + 1)}
          onSelect={setSelectedCode}
          onPageChange={setPage}
        />

        {selectedDetail && (
          <RoomDetailsPanel
            room={selectedDetail}
            onClose={() => setSelectedCode(null)}
          />
        )}
      </div>
    </div>
  );
}
