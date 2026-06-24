import logo from '../../assets/ganatri-logo.png';

export function AdminSidebarBrand() {
  return (
    <div className="admin-sidebar__brand">
      <div className="admin-sidebar__brand-frame">
        <span className="admin-sidebar__corner admin-sidebar__corner--tl" aria-hidden="true" />
        <span className="admin-sidebar__corner admin-sidebar__corner--tr" aria-hidden="true" />
        <span className="admin-sidebar__corner admin-sidebar__corner--bl" aria-hidden="true" />
        <span className="admin-sidebar__corner admin-sidebar__corner--br" aria-hidden="true" />
        <div className="admin-sidebar__brand-inner">
          <img src={logo} alt="Ganatri" className="admin-sidebar__logo" />
        </div>
      </div>
    </div>
  );
}
