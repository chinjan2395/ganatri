export function AdminFooter() {
  return (
    <footer className="admin-footer">
      <div className="admin-footer__left">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        You have full access to all admin features.
      </div>
      <div className="admin-footer__center">
        <span aria-hidden="true">♠</span>
        Play smart. Play sharp. Win with Ganatri.
        <span aria-hidden="true">♣</span>
      </div>
      <div className="admin-footer__right">Version 1.0.0</div>
    </footer>
  );
}
