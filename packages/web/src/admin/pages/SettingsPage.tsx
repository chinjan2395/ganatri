import { useState } from 'react';
import type { GameConfig } from '../../protocol';
import { AdminPanel } from '../components/AdminPanel';
import { AdminTabs } from '../components/AdminTabs';

const SETTINGS_TABS = [
  'Gameplay',
  'Sessions & Rooms',
  'Environment',
  'Quick Actions',
];

const CONFIG_META: Record<
  keyof GameConfig,
  {
    label: string;
    description: string;
    group: 'gameplay' | 'session' | 'room';
    min: number;
    max: number;
    step: number;
    format: (v: number) => string;
    unit: string;
  }
> = {
  turnTimeoutMs: {
    label: 'Turn timeout',
    description: 'Maximum time per player turn before auto-pass',
    group: 'gameplay',
    min: 3000,
    max: 60000,
    step: 1000,
    format: v => `${(v / 1000).toFixed(0)}s per turn`,
    unit: 'ms',
  },
  maxPlayers: {
    label: 'Max players per room',
    description: 'Upper limit for players joining a single room',
    group: 'gameplay',
    min: 2,
    max: 8,
    step: 1,
    format: v => `${v} players`,
    unit: 'players',
  },
  gracePeriodMs: {
    label: 'Disconnect grace period',
    description: 'Time before a disconnected player is removed from the room',
    group: 'session',
    min: 5000,
    max: 300000,
    step: 5000,
    format: v => `${(v / 1000).toFixed(0)}s grace`,
    unit: 'ms',
  },
  roomExpiryMs: {
    label: 'Completed room expiry',
    description: 'How long finished rooms remain before purge',
    group: 'room',
    min: 60000,
    max: 86400000,
    step: 60000,
    format: v => `${(v / 3_600_000).toFixed(1)}h retention`,
    unit: 'ms',
  },
};

const GAMEPLAY_KEYS: (keyof GameConfig)[] = ['turnTimeoutMs', 'maxPlayers'];
const SESSION_KEYS: (keyof GameConfig)[] = ['gracePeriodMs'];
const ROOM_KEYS: (keyof GameConfig)[] = ['roomExpiryMs'];

interface SettingsPageProps {
  draft: GameConfig | null;
  config: GameConfig | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onDraftChange: (draft: GameConfig) => void;
  onSave: () => void;
}

function ConfigSlider({
  configKey,
  value,
  savedValue,
  onChange,
}: {
  configKey: keyof GameConfig;
  value: number;
  savedValue: number | undefined;
  onChange: (v: number) => void;
}) {
  const meta = CONFIG_META[configKey];
  const changed = savedValue !== undefined && value !== savedValue;

  return (
    <div className={`admin-setting-row${changed ? ' admin-setting-row--changed' : ''}`}>
      <div className="admin-setting-row__head">
        <span className="admin-setting-row__label">{meta.label}</span>
        <span className={`admin-badge ${changed ? 'admin-badge--gold' : 'admin-badge--blue'}`}>
          {meta.format(value)}
        </span>
      </div>
      <p className="admin-setting-row__desc">{meta.description}</p>
      <div className="admin-setting-row__controls">
        <input
          className="admin-setting-row__range"
          type="range"
          min={meta.min}
          max={meta.max}
          step={meta.step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
        />
        <input
          className="admin-setting-row__number"
          type="number"
          min={meta.min}
          max={meta.max}
          step={meta.step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          aria-label={`${meta.label} value`}
        />
      </div>
      <div className="admin-setting-row__meta">
        <span>Min {meta.min.toLocaleString()}</span>
        <span>Max {meta.max.toLocaleString()}</span>
      </div>
    </div>
  );
}

export function SettingsPage({
  draft,
  config,
  saveStatus,
  onDraftChange,
  onSave,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState('Gameplay');
  const hasChanges = config && draft && JSON.stringify(config) !== JSON.stringify(draft);

  const handleDiscard = () => {
    if (config) onDraftChange({ ...config });
  };

  const updateKey = (key: keyof GameConfig, value: number) => {
    if (!draft) return;
    onDraftChange({ ...draft, [key]: value });
  };

  return (
    <div className="admin-page admin-page--settings">
      <AdminTabs tabs={SETTINGS_TABS} active={activeTab} onChange={setActiveTab} />

      <div className="admin-settings__grid">
        <AdminPanel
          title="Gameplay Rules"
          className="admin-settings__gameplay"
          action={
            hasChanges ? (
              <span className="admin-badge admin-badge--gold">Unsaved</span>
            ) : (
              <span className="admin-status-pill admin-status--playing">
                <span className="admin-status-pill__dot" />
                Live
              </span>
            )
          }
        >
          <p className="admin-panel__subtitle admin-panel__subtitle--inline">
            Turn timing and room capacity — applies to new timers immediately
          </p>
          {draft ? (
            <div className="admin-setting-list">
              {GAMEPLAY_KEYS.map(key => (
                <ConfigSlider
                  key={key}
                  configKey={key}
                  value={draft[key]}
                  savedValue={config?.[key]}
                  onChange={v => updateKey(key, v)}
                />
              ))}
            </div>
          ) : (
            <p className="admin-setting-empty">Loading configuration…</p>
          )}
        </AdminPanel>

        <div className="admin-settings__side">
          <AdminPanel title="Active Configuration">
            {config ? (
              <ul className="admin-perm-list">
                {(Object.keys(CONFIG_META) as (keyof GameConfig)[]).map(key => {
                  const changed = draft && draft[key] !== config[key];
                  return (
                    <li key={key} className="admin-perm-list__item">
                      <div className="admin-perm-list__head">
                        <span className="admin-setting-snapshot__label">{CONFIG_META[key].label}</span>
                        <span className={`admin-badge ${changed ? 'admin-badge--gold' : 'admin-badge--blue'}`}>
                          {CONFIG_META[key].format(changed && draft ? draft[key] : config[key])}
                        </span>
                      </div>
                      <p className="admin-perm-list__desc">
                        {changed ? 'Pending save' : 'Currently active on server'}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="admin-setting-empty">No configuration loaded.</p>
            )}
          </AdminPanel>

          <AdminPanel title="Parameter Reference">
            <p className="admin-panel__subtitle admin-panel__subtitle--inline">Allowed ranges</p>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--compact">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Min</th>
                    <th>Max</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(CONFIG_META) as (keyof GameConfig)[]).map(key => (
                    <tr key={key}>
                      <td>{CONFIG_META[key].label}</td>
                      <td className="admin-table__muted">{CONFIG_META[key].min.toLocaleString()}</td>
                      <td className="admin-table__muted">{CONFIG_META[key].max.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminPanel>
        </div>

        <AdminPanel title="Session & Disconnect" className="admin-settings__session">
          <p className="admin-panel__subtitle admin-panel__subtitle--inline">
            Reconnection window for dropped players
          </p>
          {draft ? (
            <div className="admin-setting-list">
              {SESSION_KEYS.map(key => (
                <ConfigSlider
                  key={key}
                  configKey={key}
                  value={draft[key]}
                  savedValue={config?.[key]}
                  onChange={v => updateKey(key, v)}
                />
              ))}
            </div>
          ) : (
            <p className="admin-setting-empty">Loading configuration…</p>
          )}
        </AdminPanel>

        <AdminPanel title="Room Lifecycle & Actions" className="admin-settings__actions">
          {draft ? (
            <>
              <div className="admin-setting-list admin-setting-list--compact">
                {ROOM_KEYS.map(key => (
                  <ConfigSlider
                    key={key}
                    configKey={key}
                    value={draft[key]}
                    savedValue={config?.[key]}
                    onChange={v => updateKey(key, v)}
                  />
                ))}
              </div>

              <div className="admin-gdpr-cards admin-settings__action-cards">
                <div className="admin-gdpr-card">
                  <span className="admin-gdpr-card__icon">💾</span>
                  <h4>Save Changes</h4>
                  <p>Push draft values to the live server config</p>
                  <button
                    type="button"
                    className="admin-btn-gold admin-btn-gold--sm"
                    onClick={onSave}
                    disabled={saveStatus === 'saving' || !hasChanges}
                  >
                    {saveStatus === 'saving'
                      ? 'Saving…'
                      : saveStatus === 'saved'
                        ? 'Saved!'
                        : 'Save changes'}
                  </button>
                  {saveStatus === 'error' && (
                    <p className="admin-setting-error">Save failed — check server.</p>
                  )}
                </div>
                <div className="admin-gdpr-card">
                  <span className="admin-gdpr-card__icon">↩</span>
                  <h4>Discard Changes</h4>
                  <p>Revert draft to the last saved configuration</p>
                  <button
                    type="button"
                    className="admin-btn-gold admin-btn-gold--sm"
                    onClick={handleDiscard}
                    disabled={!hasChanges}
                  >
                    Discard
                  </button>
                </div>
                <div className="admin-gdpr-card">
                  <span className="admin-gdpr-card__icon">⚡</span>
                  <h4>Hot Reload</h4>
                  <p>No server restart required for these parameters</p>
                  <span className="admin-status-pill admin-status--playing">
                    <span className="admin-status-pill__dot" />
                    Immediate
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="admin-setting-empty">Loading configuration…</p>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
