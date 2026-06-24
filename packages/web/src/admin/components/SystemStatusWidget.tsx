import { MOCK_SYSTEM_STATUS } from '../mockData';

export function SystemStatusWidget() {
  return (
    <div className="admin-sys-status">
      <div className="admin-sys-status__frame">
        <span className="admin-sys-status__corner admin-sys-status__corner--tl" aria-hidden="true" />
        <span className="admin-sys-status__corner admin-sys-status__corner--tr" aria-hidden="true" />
        <span className="admin-sys-status__corner admin-sys-status__corner--bl" aria-hidden="true" />
        <span className="admin-sys-status__corner admin-sys-status__corner--br" aria-hidden="true" />

        <div className="admin-sys-status__inner">
          <div className="admin-sys-status__header">
            <span className="admin-sys-status__title">System Status</span>
            <span className="admin-sys-status__dot" aria-hidden="true" />
          </div>
          <p className="admin-sys-status__badge">All Systems Operational</p>

          <ul className="admin-sys-status__list">
            {MOCK_SYSTEM_STATUS.services.map(svc => (
              <li key={svc.name} className="admin-sys-status__item">
                <span className="admin-sys-status__name">{svc.name}</span>
                <span className="admin-sys-status__healthy">
                  <span className="admin-sys-status__healthy-dot" aria-hidden="true" />
                  {svc.status}
                </span>
              </li>
            ))}
          </ul>

          <p className="admin-sys-status__uptime">Uptime: {MOCK_SYSTEM_STATUS.uptime}</p>
        </div>
      </div>
    </div>
  );
}
