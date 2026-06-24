export interface AdminAccountRow {
  name: string;
  initials: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Moderator';
  status: 'Active' | 'Inactive';
  lastLogin: string;
}

export interface PermissionRole {
  role: string;
  count: number;
  description: string;
}

export interface FailedLoginRow {
  time: string;
  email: string;
  ip: string;
  reason: string;
}

export interface AuditLogRow {
  time: string;
  admin: string;
  action: string;
  target: string;
  details: string;
}

export const MOCK_ADMIN_ACCOUNTS: AdminAccountRow[] = [
  { name: 'Admin User', initials: 'AU', email: 'admin@ganatri.com', role: 'Super Admin', status: 'Active', lastLogin: '23 Jun, 12:30 PM' },
  { name: 'Priya Sharma', initials: 'PS', email: 'priya@ganatri.com', role: 'Admin', status: 'Active', lastLogin: '23 Jun, 11:45 AM' },
  { name: 'Rohan Mehta', initials: 'RM', email: 'rohan@ganatri.com', role: 'Moderator', status: 'Active', lastLogin: '22 Jun, 6:20 PM' },
  { name: 'Kavya Reddy', initials: 'KR', email: 'kavya@ganatri.com', role: 'Moderator', status: 'Inactive', lastLogin: '18 Jun, 9:10 AM' },
];

export const MOCK_PERMISSION_ROLES: PermissionRole[] = [
  { role: 'Super Admin', count: 1, description: 'Full platform access' },
  { role: 'Admin', count: 2, description: 'Config, users, exports' },
  { role: 'Moderator', count: 3, description: 'Read-only + user search' },
  { role: 'Support', count: 0, description: 'Tickets & logs only' },
];

export const MOCK_FAILED_LOGINS: FailedLoginRow[] = [
  { time: '12:41 PM', email: 'unknown@test.com', ip: '192.168.1.42', reason: 'Invalid Secret' },
  { time: '11:22 AM', email: 'admin@ganatri.com', ip: '103.21.45.88', reason: 'Wrong Secret' },
  { time: '09:05 AM', email: 'bot@spam.net', ip: '45.33.12.9', reason: 'Invalid Secret' },
];

export const MOCK_SECURITY_AUDIT: AuditLogRow[] = [
  { time: '12:30 PM', admin: 'admin@ganatri.com', action: 'Login', target: '—', details: 'Successful auth' },
  { time: '11:15 AM', admin: 'admin@ganatri.com', action: 'Config Update', target: 'turnTimeoutMs', details: '30000 → 45000' },
  { time: '10:42 AM', admin: 'priya@ganatri.com', action: 'Data Export', target: 'games', details: '500 records' },
  { time: '09:58 AM', admin: 'admin@ganatri.com', action: 'User Search', target: 'rohan', details: '3 results' },
];

export const FAILED_LOGIN_CHART = [2, 5, 3, 8, 4, 6, 3, 7, 2, 4, 6, 5];
