import { useState } from 'react';
import { AdminPanel } from '../components/AdminPanel';
import { AdminTabs } from '../components/AdminTabs';
import {
  FAILED_LOGIN_CHART,
  MOCK_ADMIN_ACCOUNTS,
  MOCK_FAILED_LOGINS,
  MOCK_PERMISSION_ROLES,
  MOCK_SECURITY_AUDIT,
} from '../securityMockData';

const SECURITY_TABS = [
  'Admin Accounts',
  'Permission Roles',
  'Audit Logs',
  'Failed Logins',
  'Session Monitoring',
  'GDPR & Privacy',
];

function roleBadgeClass(role: string): string {
  if (role === 'Super Admin') return 'admin-badge--danger';
  if (role === 'Admin') return 'admin-badge--gold';
  return 'admin-badge--blue';
}

export function SecurityPage() {
  const [activeTab, setActiveTab] = useState('Admin Accounts');
  const maxChart = Math.max(...FAILED_LOGIN_CHART, 1);

  return (
    <div className="admin-page admin-page--security">
      <AdminTabs tabs={SECURITY_TABS} active={activeTab} onChange={setActiveTab} />

      <div className="admin-security__grid">
        <AdminPanel
          title="Admin Accounts"
          className="admin-security__accounts"
          action={
            <button type="button" className="admin-btn-gold">
              + Add Admin
            </button>
          }
        >
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--rich">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_ADMIN_ACCOUNTS.map(row => (
                  <tr key={row.email}>
                    <td>
                      <div className="admin-table__user">
                        <span className="admin-table__avatar">{row.initials}</span>
                        <span>{row.name}</span>
                      </div>
                    </td>
                    <td>{row.email}</td>
                    <td>
                      <span className={`admin-badge ${roleBadgeClass(row.role)}`}>{row.role}</span>
                    </td>
                    <td>
                      <span className={`admin-status-pill ${row.status === 'Active' ? 'admin-status--playing' : 'admin-status--progress'}`}>
                        <span className="admin-status-pill__dot" />
                        {row.status}
                      </span>
                    </td>
                    <td>{row.lastLogin}</td>
                    <td>
                      <div className="admin-table__actions">
                        <button type="button" className="admin-table__action-btn" aria-label="Edit">✎</button>
                        <button type="button" className="admin-table__action-btn" aria-label="Reset key">🔑</button>
                        <button type="button" className="admin-table__action-btn admin-table__action-btn--danger" aria-label="Delete">🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span>Showing 1–4 of 4</span>
            <div className="admin-pagination__btns">
              <button type="button" className="admin-pagination__btn" disabled>&lsaquo;</button>
              <button type="button" className="admin-pagination__btn admin-pagination__btn--active">1</button>
              <button type="button" className="admin-pagination__btn" disabled>&rsaquo;</button>
            </div>
          </div>
        </AdminPanel>

        <div className="admin-security__side">
          <AdminPanel title="Permission Overview">
            <ul className="admin-perm-list">
              {MOCK_PERMISSION_ROLES.map(r => (
                <li key={r.role} className="admin-perm-list__item">
                  <div className="admin-perm-list__head">
                    <span className={`admin-badge ${roleBadgeClass(r.role)}`}>{r.role}</span>
                    <span className="admin-perm-list__count">{r.count}</span>
                  </div>
                  <p className="admin-perm-list__desc">{r.description}</p>
                </li>
              ))}
            </ul>
          </AdminPanel>

          <AdminPanel title="Failed Login Attempts">
            <p className="admin-panel__subtitle admin-panel__subtitle--inline">Last 24 hours</p>
            <div className="admin-mini-chart">
              {FAILED_LOGIN_CHART.map((v, i) => (
                <div
                  key={i}
                  className="admin-mini-chart__bar admin-mini-chart__bar--danger"
                  style={{ height: `${(v / maxChart) * 100}%` }}
                  title={`${v} failures`}
                />
              ))}
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--compact">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Email</th>
                    <th>IP</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_FAILED_LOGINS.map((row, i) => (
                    <tr key={i}>
                      <td>{row.time}</td>
                      <td>{row.email}</td>
                      <td>{row.ip}</td>
                      <td><span className="admin-badge admin-badge--danger-soft">{row.reason}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminPanel>
        </div>

        <AdminPanel title="Audit Logs" className="admin-security__audit">
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--rich">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_SECURITY_AUDIT.map((row, i) => (
                  <tr key={i}>
                    <td>{row.time}</td>
                    <td>{row.admin}</td>
                    <td>{row.action}</td>
                    <td>{row.target}</td>
                    <td className="admin-table__muted">{row.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminPanel>

        <AdminPanel title="GDPR & Privacy" className="admin-security__gdpr">
          <p className="admin-panel__subtitle admin-panel__subtitle--inline">Future panel — compliance tooling</p>
          <div className="admin-gdpr-cards">
            <div className="admin-gdpr-card">
              <span className="admin-gdpr-card__icon">📤</span>
              <h4>Export User Data</h4>
              <p>Right-to-access data package</p>
              <button type="button" className="admin-btn-gold admin-btn-gold--sm">Export</button>
            </div>
            <div className="admin-gdpr-card">
              <span className="admin-gdpr-card__icon">🗑</span>
              <h4>Delete User Data</h4>
              <p>Right-to-erasure workflow</p>
              <button type="button" className="admin-btn-gold admin-btn-gold--sm">Manage</button>
            </div>
            <div className="admin-gdpr-card">
              <span className="admin-gdpr-card__icon">📋</span>
              <h4>Retention Rules</h4>
              <p>Configure data lifecycle</p>
              <button type="button" className="admin-btn-gold admin-btn-gold--sm">Configure</button>
            </div>
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
