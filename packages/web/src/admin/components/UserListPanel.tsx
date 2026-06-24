import { useState } from 'react';
import type { UserListRow } from '../mockData';
import { AdminPanel } from './AdminPanel';

type UserTypeFilter = 'All' | 'Registered' | 'Guest';
type OnlineFilter = 'All' | 'Online' | 'Offline';

interface UserListPanelProps {
  rows: UserListRow[];
  selectedUserId: string | null;
  search: string;
  typeFilter: UserTypeFilter;
  onlineFilter: OnlineFilter;
  page: number;
  totalCount: number;
  pageSize: number;
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: UserTypeFilter) => void;
  onOnlineFilterChange: (value: OnlineFilter) => void;
  onSelect: (userId: string) => void;
  onPageChange: (page: number) => void;
}

function truncateId(userId: string): string {
  if (userId.length <= 14) return userId;
  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}

export function UserListPanel({
  rows,
  selectedUserId,
  search,
  typeFilter,
  onlineFilter,
  page,
  totalCount,
  pageSize,
  onSearchChange,
  onTypeFilterChange,
  onOnlineFilterChange,
  onSelect,
  onPageChange,
}: UserListPanelProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <AdminPanel
      title={`Users (${totalCount.toLocaleString()})`}
      className="admin-users__list"
    >
      <div className="admin-users__toolbar">
        <div className="admin-users__search-wrap">
          <svg className="admin-users__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="admin-users__search"
            placeholder="Search by name, email or ID…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <div className="admin-users__filter-wrap">
          <button
            type="button"
            className={`admin-users__filter-btn${filterOpen ? ' admin-users__filter-btn--active' : ''}`}
            onClick={() => setFilterOpen(o => !o)}
            aria-label="Toggle filters"
            aria-expanded={filterOpen}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </button>
          {filterOpen && (
            <div className="admin-users__filter-popover">
              <label className="admin-users__filter-field">
                <span>Account type</span>
                <select
                  value={typeFilter}
                  onChange={e => onTypeFilterChange(e.target.value as UserTypeFilter)}
                >
                  <option value="All">All</option>
                  <option value="Registered">Registered</option>
                  <option value="Guest">Guest</option>
                </select>
              </label>
              <label className="admin-users__filter-field">
                <span>Status</span>
                <select
                  value={onlineFilter}
                  onChange={e => onOnlineFilterChange(e.target.value as OnlineFilter)}
                >
                  <option value="All">All</option>
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                </select>
              </label>
            </div>
          )}
        </div>
      </div>

      <ul className="admin-users__rows">
        {rows.length === 0 ? (
          <li className="admin-users__empty">No users match your search.</li>
        ) : (
          rows.map(user => (
            <li key={user.userId}>
              <button
                type="button"
                className={`admin-users__row${selectedUserId === user.userId ? ' admin-users__row--selected' : ''}`}
                onClick={() => onSelect(user.userId)}
              >
                <span className="admin-table__avatar">{user.initials}</span>
                <span className="admin-users__row-body">
                  <span className="admin-users__row-name">{user.displayName}</span>
                  <span className="admin-users__row-id">{truncateId(user.userId)}</span>
                  <span className="admin-users__row-tags">
                    <span className={`admin-users__type-tag${user.isGuest ? ' admin-users__type-tag--guest' : ''}`}>
                      {user.isGuest ? 'Guest' : 'Registered'}
                    </span>
                    <span className={`admin-users__online${user.isOnline ? ' admin-users__online--on' : ''}`}>
                      <span className="admin-status-pill__dot" />
                      {user.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="admin-pagination">
        <span>Showing {start} to {end} of {totalCount.toLocaleString()} users</span>
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
