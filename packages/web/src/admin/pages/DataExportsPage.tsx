interface DataExportsPageProps {
  exportLoading: boolean;
  exportError: string | null;
  onExport: () => void;
}

export function DataExportsPage({ exportLoading, exportError, onExport }: DataExportsPageProps) {
  return (
    <div className="admin-page admin__export-section">
      <h2 className="admin-page__title">Data Exports</h2>
      <p className="admin-page__desc">Download all games data as JSON for offline analysis.</p>
      <div className="admin__actions">
        <button
          type="button"
          className="admin__btn admin__export-btn"
          onClick={onExport}
          disabled={exportLoading}
        >
          {exportLoading ? 'Exporting...' : 'Export Games (JSON)'}
        </button>
      </div>
      {exportError && <p className="admin__error">{exportError}</p>}
    </div>
  );
}
