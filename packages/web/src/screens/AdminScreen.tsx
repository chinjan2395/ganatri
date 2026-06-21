import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ADMIN_EVENTS, GameConfig } from '../protocol';
import './AdminScreen.css';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:4000';

const LABELS: Record<keyof GameConfig, string> = {
  turnTimeoutMs: 'Turn timeout (ms)',
  maxPlayers:    'Max players per room',
  gracePeriodMs: 'Disconnect grace period (ms)',
  roomExpiryMs:  'Completed room expiry (ms)',
};

const LIMITS: Record<keyof GameConfig, { min: number; max: number; step: number }> = {
  turnTimeoutMs: { min: 3000,  max: 60000,    step: 1000  },
  maxPlayers:    { min: 2,     max: 8,         step: 1     },
  gracePeriodMs: { min: 5000,  max: 300000,    step: 5000  },
  roomExpiryMs:  { min: 60000, max: 86400000,  step: 60000 },
};

type Screen = 'idle' | 'loading' | 'authed';

export function AdminScreen() {
  const [screen, setScreen] = useState<Screen>('idle');
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [draft, setDraft] = useState<GameConfig | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = io(SERVER_URL, { autoConnect: false });
    socketRef.current = s;
    s.connect();
    return () => { s.disconnect(); };
  }, []);

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

  if (screen === 'idle' || screen === 'loading') {
    return (
      <div className="admin">
        <div className="admin__card">
          <h1 className="admin__title">Admin</h1>
          <p className="admin__subtitle">Enter your email to access game configuration.</p>
          <input
            className="admin__input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            disabled={screen === 'loading'}
            autoFocus
          />
          <input
            className="admin__input"
            type="password"
            placeholder="Admin secret"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            disabled={screen === 'loading'}
          />
          {error && <p className="admin__error">{error}</p>}
          <button
            className="admin__btn"
            onClick={handleAuth}
            disabled={screen === 'loading' || !email.trim()}
          >
            {screen === 'loading' ? 'Verifying…' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin">
      <div className="admin__card admin__card--wide">
        <h1 className="admin__title">Game Configuration</h1>
        <p className="admin__subtitle">
          Changes apply to new timers and actions immediately — no restart needed.
        </p>

        <div className="admin__fields">
          {draft && (Object.keys(LABELS) as (keyof GameConfig)[]).map(key => (
            <div className="admin__field" key={key}>
              <label className="admin__label">{LABELS[key]}</label>
              <div className="admin__row">
                <input
                  className="admin__range"
                  type="range"
                  min={LIMITS[key].min}
                  max={LIMITS[key].max}
                  step={LIMITS[key].step}
                  value={draft[key]}
                  onChange={e => setDraft(d => d ? { ...d, [key]: Number(e.target.value) } : d)}
                />
                <input
                  className="admin__number"
                  type="number"
                  min={LIMITS[key].min}
                  max={LIMITS[key].max}
                  step={LIMITS[key].step}
                  value={draft[key]}
                  onChange={e => setDraft(d => d ? { ...d, [key]: Number(e.target.value) } : d)}
                />
              </div>
              {key === 'turnTimeoutMs' && (
                <span className="admin__hint">{(draft[key] / 1000).toFixed(0)}s per turn</span>
              )}
              {key === 'gracePeriodMs' && (
                <span className="admin__hint">{(draft[key] / 1000).toFixed(0)}s before disconnected player is removed</span>
              )}
              {key === 'roomExpiryMs' && (
                <span className="admin__hint">{(draft[key] / 3_600_000).toFixed(1)}h until finished rooms are purged</span>
              )}
            </div>
          ))}
        </div>

        <div className="admin__actions">
          <button
            className="admin__btn"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved!' : 'Save changes'}
          </button>
          {saveStatus === 'error' && (
            <span className="admin__error">Save failed — check server.</span>
          )}
        </div>

        {config && draft && JSON.stringify(config) !== JSON.stringify(draft) && (
          <p className="admin__hint">You have unsaved changes.</p>
        )}
      </div>
    </div>
  );
}
