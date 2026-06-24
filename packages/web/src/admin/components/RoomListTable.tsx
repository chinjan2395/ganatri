import type { RoomListRow, RoomStatus } from '../mockData';
import { AdminPanel } from './AdminPanel';

interface RoomListTableProps {
  rows: RoomListRow[];
  selectedCode: string | null;
  search: string;
  statusFilter: RoomStatus | 'All';
  playerFilter: 'All' | 'Full' | 'Open';
  page: number;
  totalCount: number;
  pageSize: number;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: RoomStatus | 'All') => void;
  onPlayerFilterChange: (value: 'All' | 'Full' | 'Open') => void;
  onRefresh: () => void;
  onSelect: (code: string) => void;
  onPageChange: (page: number) => void;
}

function statusClass(status: RoomStatus): string {
  if (status === 'Playing') return 'admin-status--playing';
  if (status === 'Lobby') return 'admin-status--progress';
  if (status === 'Finished') return 'admin-status--finished';
  return 'admin-status--closed';
}

export function RoomListTable({
  rows,
  selectedCode,
  search,
  statusFilter,
  playerFilter,
  page,
  totalCount,
  pageSize,
  onSearchChange,
  onStatusFilterChange,
  onPlayerFilterChange,
  onRefresh,
  onSelect,
  onPageChange,
}: RoomListTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <AdminPanel title="Room List" className="admin-rooms__list">
      <div className="admin-rooms__toolbar">
        <div className="admin-rooms__search-wrap">
          <svg className="admin-rooms__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="admin-rooms__search"
            placeholder="Search room code or host…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <select
          className="admin-rooms__select"
          value={statusFilter}
          onChange={e => onStatusFilterChange(e.target.value as RoomStatus | 'All')}
          aria-label="Filter by status"
        >
          <option value="All">All Status</option>
          <option value="Playing">Playing</option>
          <option value="Lobby">Lobby</option>
          <option value="Finished">Finished</option>
          <option value="Closed">Closed</option>
        </select>
        <select
          className="admin-rooms__select"
          value={playerFilter}
          onChange={e => onPlayerFilterChange(e.target.value as 'All' | 'Full' | 'Open')}
          aria-label="Filter by capacity"
        >
          <option value="All">All</option>
          <option value="Full">Full</option>
          <option value="Open">Open seats</option>
        </select>
        <button type="button" className="admin-rooms__refresh" onClick={onRefresh}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table admin-table--rich">
          <thead>
            <tr>
              <th>Room Code</th>
              <th>Host</th>
              <th>Players</th>
              <th>Status</th>
              <th>Created At</th>
              <th>Duration</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-table__muted admin-rooms__empty-row">
                  No rooms match your filters.
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr
                  key={row.code}
                  className={selectedCode === row.code ? 'admin-rooms__row--selected' : ''}
                  onClick={() => onSelect(row.code)}
                >
                  <td className="admin-rooms__code">{row.code}</td>
                  <td>
                    <div className="admin-table__user">
                      <span className="admin-table__avatar">{row.hostInitials}</span>
                      <span>{row.hostName}</span>
                    </div>
                  </td>
                  <td>{row.players}</td>
                  <td>
                    <span className={`admin-status-pill ${statusClass(row.status)}`}>{row.status}</span>
                  </td>
                  <td className="admin-table__muted">{row.createdAt}</td>
                  <td>{row.duration}</td>
                  <td>
                    <div className="admin-rooms__row-actions">
                      <button
                        type="button"
                        className="admin-rooms__inspect-btn"
                        onClick={e => {
                          e.stopPropagation();
                          onSelect(row.code);
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Inspect
                      </button>
                      <button
                        type="button"
                        className="admin-table__action-btn"
                        aria-label="More actions"
                        onClick={e => e.stopPropagation()}
                      >
                        ⋮
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination">
        <span>Showing {start} to {end} of {totalCount} rooms</span>
        <div className="admin-pagination__btns">
          <button
            type="button"
            className="admin-pagination__btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            &lsaquo;
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              type="button"
              className={`admin-pagination__btn${page === p ? ' admin-pagination__btn--active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ))}
          {totalPages > 5 && (
            <>
              <span className="admin-pagination__ellipsis">…</span>
              <button
                type="button"
                className="admin-pagination__btn"
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}
          <button
            type="button"
            className="admin-pagination__btn"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            &rsaquo;
          </button>
        </div>
      </div>
    </AdminPanel>
  );
}
