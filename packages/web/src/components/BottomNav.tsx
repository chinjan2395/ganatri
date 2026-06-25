import type React from 'react';
import { useState } from 'react';
import './BottomNav.css';

type TabId = 'chat' | 'score' | 'history' | 'more';

interface BottomNavProps {
  onLeave: () => void;
  /** Score data: array of { name, count } */
  scores?: Array<{ name: string; count: number }>;
  /** History events */
  events?: string[];
}

export function BottomNav({ onLeave, scores = [], events = [] }: BottomNavProps): React.ReactNode {
  const [activeTab, setActiveTab] = useState<TabId | null>(null);

  const toggle = (tab: TabId): void => {
    setActiveTab(prev => prev === tab ? null : tab);
  };

  return (
    <>
      {/* Slide-up sheet */}
      {activeTab && (
        <div className="bnav__sheet" onClick={() => setActiveTab(null)}>
          <div className="bnav__sheet-inner" onClick={e => e.stopPropagation()}>
            <div className="bnav__sheet-handle" />

            {activeTab === 'chat' && (
              <div className="bnav__panel">
                <p className="bnav__placeholder">Chat coming soon</p>
              </div>
            )}

            {activeTab === 'score' && (
              <div className="bnav__panel">
                <h3 className="bnav__title">Scores</h3>
                {scores.length === 0 ? (
                  <p className="bnav__placeholder">No scores yet</p>
                ) : (
                  <ul className="bnav__score-list">
                    {scores.map((s, i) => (
                      <li key={i} className="bnav__score-row">
                        <span className="bnav__score-name">{s.name}</span>
                        <span className="bnav__score-val">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="bnav__panel">
                <h3 className="bnav__title">History</h3>
                {events.length === 0 ? (
                  <p className="bnav__placeholder">No events yet</p>
                ) : (
                  <ul className="bnav__event-list">
                    {events.map((e, i) => (
                      <li key={i} className="bnav__event">{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {activeTab === 'more' && (
              <div className="bnav__panel">
                <h3 className="bnav__title">More</h3>
                <button type="button" className="bnav__leave-btn" onClick={onLeave}>
                  Leave Room
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <nav className="bnav" aria-label="Game navigation">
        {([
          { id: 'chat' as TabId, icon: '💬', label: 'Chat' },
          { id: 'score' as TabId, icon: '🏆', label: 'Score' },
          { id: 'history' as TabId, icon: '🕐', label: 'History' },
          { id: 'more' as TabId, icon: '•••', label: 'More' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`bnav__tab${activeTab === tab.id ? ' bnav__tab--active' : ''}`}
            onClick={() => toggle(tab.id)}
            aria-pressed={activeTab === tab.id}
          >
            <span className="bnav__tab-icon" aria-hidden>{tab.icon}</span>
            <span className="bnav__tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
