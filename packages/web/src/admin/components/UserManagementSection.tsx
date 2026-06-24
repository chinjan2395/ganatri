import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  ADMIN_EVENTS,
  AdminGetUserStatsAck,
  AdminSearchUsersAck,
  AdminUserStatsView,
  AdminUserView,
} from '../../protocol';
import {
  MOCK_USER_LIST,
  MOCK_USER_TOTAL_COUNT,
  getUserDetail,
  type UserListRow,
} from '../mockData';
import { UserDetailPanel } from './UserDetailPanel';
import { UserListPanel } from './UserListPanel';

const PAGE_SIZE = 10;

type UserTypeFilter = 'All' | 'Registered' | 'Guest';
type OnlineFilter = 'All' | 'Online' | 'Offline';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function apiUserToRow(user: AdminUserView): UserListRow {
  return {
    userId: user.userId,
    displayName: user.displayName,
    email: user.email,
    initials: getInitials(user.displayName),
    isGuest: user.isGuest,
    isOnline: false,
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
  };
}

function matchesSearch(row: UserListRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.displayName.toLowerCase().includes(q) ||
    (row.email?.toLowerCase().includes(q) ?? false) ||
    row.userId.toLowerCase().includes(q)
  );
}

function matchesType(row: UserListRow, filter: UserTypeFilter): boolean {
  if (filter === 'All') return true;
  if (filter === 'Guest') return row.isGuest;
  return !row.isGuest;
}

function matchesOnline(row: UserListRow, filter: OnlineFilter): boolean {
  if (filter === 'All') return true;
  if (filter === 'Online') return row.isOnline;
  return !row.isOnline;
}

interface UserManagementSectionProps {
  socket: Socket | null;
}

export function UserManagementSection({ socket }: UserManagementSectionProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<UserTypeFilter>('All');
  const [onlineFilter, setOnlineFilter] = useState<OnlineFilter>('All');
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>('usr-mock-001');
  const [apiResults, setApiResults] = useState<UserListRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedStats, setSelectedStats] = useState<AdminUserStatsView | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const usingApiResults = apiResults !== null;

  const sourceRows = usingApiResults ? apiResults : MOCK_USER_LIST;

  const filteredRows = useMemo(
    () =>
      sourceRows.filter(
        row =>
          matchesSearch(row, search) &&
          matchesType(row, typeFilter) &&
          matchesOnline(row, onlineFilter),
      ),
    [sourceRows, search, typeFilter, onlineFilter],
  );

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const displayTotal = usingApiResults || search || typeFilter !== 'All' || onlineFilter !== 'All'
    ? filteredRows.length
    : MOCK_USER_TOTAL_COUNT;

  const selectedRow = sourceRows.find(u => u.userId === selectedUserId);
  const mockDetail = selectedUserId ? getUserDetail(selectedUserId, selectedRow) : null;
  const isMockUser = selectedUserId?.startsWith('usr-mock-') ?? false;

  const fetchStats = useCallback(
    (userId: string) => {
      if (!socket || userId.startsWith('usr-mock-')) {
        setSelectedStats(null);
        setStatsLoading(false);
        setStatsError(null);
        return;
      }
      setStatsLoading(true);
      setStatsError(null);
      setSelectedStats(null);
      socket.emit(ADMIN_EVENTS.GET_USER_STATS, { userId }, (ack: AdminGetUserStatsAck) => {
        setStatsLoading(false);
        if (ack.ok) {
          setSelectedStats(ack.stats);
        } else {
          const msg =
            ack.error === 'NOT_FOUND' ? 'User not found.' :
            ack.error === 'NOT_AUTHORIZED' ? 'Not authorized.' :
            'Unavailable, try again.';
          setStatsError(msg);
        }
      });
    },
    [socket],
  );

  const runApiSearch = useCallback(
    (query: string) => {
      if (!socket || query.trim() === '') {
        setApiResults(null);
        setSearchError(null);
        return;
      }
      setSearching(true);
      setSearchError(null);
      socket.emit(ADMIN_EVENTS.SEARCH_USERS, { query: query.trim() }, (ack: AdminSearchUsersAck) => {
        setSearching(false);
        if (ack.ok) {
          setApiResults(ack.users.map(apiUserToRow));
          setPage(1);
        } else {
          setSearchError(ack.error === 'NOT_AUTHORIZED' ? 'Not authorized.' : 'Search unavailable.');
        }
      });
    },
    [socket],
  );

  useEffect(() => {
    if (selectedUserId) {
      fetchStats(selectedUserId);
    }
  }, [selectedUserId, fetchStats]);

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setApiResults(null);
      return;
    }
    const timer = setTimeout(() => runApiSearch(trimmed), 400);
    return () => clearTimeout(timer);
  }, [search, runApiSearch]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    if (!value.trim()) {
      setApiResults(null);
      setSearchError(null);
    }
  };

  const detailUser = !isMockUser && selectedStats ? selectedStats : mockDetail;

  return (
    <div className="admin-page admin-page--users">
      {searchError && <p className="admin-users__banner admin-users__banner--error">{searchError}</p>}
      {searching && <p className="admin-users__banner">Searching live users…</p>}

      <div className={`admin-users__body${detailUser ? ' admin-users__body--with-detail' : ''}`}>
        <UserListPanel
          rows={pagedRows}
          selectedUserId={selectedUserId}
          search={search}
          typeFilter={typeFilter}
          onlineFilter={onlineFilter}
          page={page}
          totalCount={displayTotal}
          pageSize={PAGE_SIZE}
          onSearchChange={handleSearchChange}
          onTypeFilterChange={value => {
            setTypeFilter(value);
            setPage(1);
          }}
          onOnlineFilterChange={value => {
            setOnlineFilter(value);
            setPage(1);
          }}
          onSelect={setSelectedUserId}
          onPageChange={setPage}
        />

        {detailUser && (
          <UserDetailPanel
            user={detailUser}
            loading={statsLoading && !isMockUser}
            error={!isMockUser ? statsError : null}
            onBack={() => setSelectedUserId(null)}
          />
        )}
      </div>
    </div>
  );
}
