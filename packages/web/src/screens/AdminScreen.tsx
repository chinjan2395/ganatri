// SCREEN SHELL: no reusable component definitions here.
// Components → packages/ds | Screens → packages/web/src/screens
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  ADMIN_EVENTS,
  AdminExportDataAck,
  AdminGetKpiStatsAck,
  AdminGetStatsAck,
  GameConfig,
} from '../protocol';
import { AdminAuthPage } from '../admin/AdminAuthPage';
import { AdminLayout } from '../admin/AdminLayout';
import { AnalyticsPage } from '../admin/pages/AnalyticsPage';
import { DashboardPage } from '../admin/pages/DashboardPage';
import { DataExportsPage } from '../admin/pages/DataExportsPage';
import { LeaderboardsPage } from '../admin/pages/LeaderboardsPage';
import { LiveOperationsPage } from '../admin/pages/LiveOperationsPage';
import { RoomManagementPage } from '../admin/pages/RoomManagementPage';
import { SecurityPage } from '../admin/pages/SecurityPage';
import { SettingsPage } from '../admin/pages/SettingsPage';
import { SocialManagementPage } from '../admin/pages/SocialManagementPage';
import { UserManagementPage } from '../admin/pages/UserManagementPage';
import { VoiceMonitoringPage } from '../admin/pages/VoiceMonitoringPage';
import type { AdminSection } from '../admin/types';
import './AdminScreen.css';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:4000';

type Screen = 'idle' | 'loading' | 'authed';

export function AdminScreen() {
  const [screen, setScreen] = useState<Screen>('idle');
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [draft, setDraft] = useState<GameConfig | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [stats, setStats] = useState<import('../protocol').AdminServerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [kpiStats, setKpiStats] = useState<import('../protocol').AdminKpiStats | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  useEffect(() => {
    const s = io(SERVER_URL, { autoConnect: false });
    socketRef.current = s;
    s.connect();
    return () => { s.disconnect(); };
  }, []);

  const fetchStats = () => {
    const s = socketRef.current;
    if (!s) return;
    setStatsLoading(true);
    s.emit(ADMIN_EVENTS.GET_STATS, {}, (ack: AdminGetStatsAck) => {
      setStatsLoading(false);
      if (ack.ok) setStats(ack.stats);
    });
  };

  const fetchKpi = () => {
    const s = socketRef.current;
    if (!s) return;
    setKpiLoading(true);
    setKpiError(null);
    s.emit(ADMIN_EVENTS.GET_KPI_STATS, {}, (ack: AdminGetKpiStatsAck) => {
      setKpiLoading(false);
      if (ack.ok) {
        setKpiStats(ack.stats);
      } else {
        setKpiError('Unavailable');
      }
    });
  };

  const handleRefreshAll = () => {
    fetchStats();
    fetchKpi();
  };

  useEffect(() => {
    if (screen !== 'authed') return;
    const id = setInterval(fetchStats, 15000);
    return () => { clearInterval(id); };
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAuth = () => {
    const s = socketRef.current;
    if (!s || !email.trim()) return;
    setScreen('loading');
    setError(null);
    s.emit(ADMIN_EVENTS.AUTH, { email, secret }, (ack: { ok: boolean; reason?: string }) => {
      if (!ack.ok) {
        setError(ack.reason === 'not_authorized' ? 'Email or secret is incorrect.' : 'Auth failed.');
        setScreen('idle');
        return;
      }
      s.emit(ADMIN_EVENTS.GET_CONFIG, {}, (res: { config: GameConfig }) => {
        setConfig(res.config);
        setDraft({ ...res.config });
        setScreen('authed');
        fetchStats();
        fetchKpi();
      });
    });
  };

  const handleSave = () => {
    const s = socketRef.current;
    if (!s || !draft) return;
    setSaveStatus('saving');
    s.emit(ADMIN_EVENTS.UPDATE_CONFIG, { config: draft }, (ack: { ok: boolean; reason?: string }) => {
      if (ack.ok) {
        setConfig({ ...draft });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    });
  };

  const handleExport = () => {
    const s = socketRef.current;
    if (!s) return;
    setExportLoading(true);
    setExportError(null);
    s.emit(ADMIN_EVENTS.EXPORT_DATA, {}, (ack: AdminExportDataAck) => {
      setExportLoading(false);
      if (ack.ok) {
        const json = JSON.stringify({ exportedAt: new Date().toISOString(), games: ack.games }, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ganatri-export.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setExportError('Export failed: ' + ack.error);
      }
    });
  };

  if (screen === 'idle' || screen === 'loading') {
    return (
      <AdminAuthPage
        email={email}
        secret={secret}
        error={error}
        loading={screen === 'loading'}
        onEmailChange={setEmail}
        onSecretChange={setSecret}
        onSubmit={handleAuth}
      />
    );
  }

  const refreshing = statsLoading || kpiLoading;

  function renderPage() {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardPage stats={stats} />;
      case 'live-operations':
        return <LiveOperationsPage />;
      case 'analytics':
        return <AnalyticsPage kpiStats={kpiStats} kpiLoading={kpiLoading} kpiError={kpiError} />;
      case 'user-management':
        return <UserManagementPage socket={socketRef.current} />;
      case 'room-management':
        return <RoomManagementPage stats={stats} />;
      case 'leaderboards':
        return <LeaderboardsPage />;
      case 'social-management':
        return <SocialManagementPage />;
      case 'voice-monitoring':
        return <VoiceMonitoringPage />;
      case 'data-exports':
        return (
          <DataExportsPage
            exportLoading={exportLoading}
            exportError={exportError}
            onExport={handleExport}
          />
        );
      case 'security':
        return <SecurityPage />;
      case 'settings':
        return (
          <SettingsPage
            draft={draft}
            config={config}
            saveStatus={saveStatus}
            onDraftChange={setDraft}
            onSave={handleSave}
          />
        );
      default:
        return <DashboardPage stats={stats} />;
    }
  }

  return (
    <AdminLayout
      activeSection={activeSection}
      onNavigate={setActiveSection}
      email={email}
      onRefresh={handleRefreshAll}
      refreshing={refreshing}
    >
      {renderPage()}
    </AdminLayout>
  );
}
