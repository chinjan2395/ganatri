import { useEffect, useState, type ReactNode } from 'react';
import { AdminLayout } from '../admin/AdminLayout';
import { useGame } from '../state/GameProvider';
import {
  DsAlert,
  DsBadge,
  DsButton,
  DsCard,
  DsField,
  DsListRow,
  DsPageHeader,
  DsSection,
  DsStat,
  DsTabs,
} from '@ganatri/ds';
import {
  DESIGN_SECTIONS,
  type DesignSectionId,
} from '../design-system/webComponentInventory';
import logo from '../assets/ganatri-logo.png';
import './AdminScreen.css';
import './DesignSystemScreen.css';
import './RoomScreen.css';

const OWNER_EMAIL = import.meta.env.VITE_DESIGN_SYSTEM_OWNER_EMAIL?.trim().toLowerCase() ?? '';
const LOCAL_VERIFICATION_KEY = 'ganatri.designSystem.localVerifiedEmail';

function isLocalhostHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function AccessDenied({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="design-screen design-screen--gated">
      <div className="design-screen__gate card-surface">
        <span className="design-screen__gate-kicker">Design System</span>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
        {action}
      </div>
    </div>
  );
}

export function DesignSystemScreen(): ReactNode {
  const { account, loginWithGoogle } = useGame();
  const normalizedEmail = account?.email?.trim().toLowerCase() ?? '';
  const [localEmail, setLocalEmail] = useState('');
  const [localVerified, setLocalVerified] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isLocalhost = isLocalhostHost(window.location.hostname);

  // TODO: remove this bypass before deploying
  if (isLocalhost) return <DesignSystemContent />;

  useEffect(() => {
    if (!isLocalhost || !OWNER_EMAIL) return;
    const storedEmail = window.sessionStorage.getItem(LOCAL_VERIFICATION_KEY)?.trim().toLowerCase() ?? '';
    if (storedEmail === OWNER_EMAIL) {
      setLocalVerified(true);
      setLocalEmail(storedEmail);
    }
  }, [isLocalhost]);

  if (!OWNER_EMAIL) {
    return (
      <AccessDenied
        title="Owner email not configured"
        description="Set VITE_DESIGN_SYSTEM_OWNER_EMAIL to your email address to unlock this private page."
      />
    );
  }

  if (isLocalhost && localVerified) {
    return <DesignSystemContent />;
  }

  if (isLocalhost) {
    return (
      <AccessDenied
        title="Email verification required"
        description="Google login is bypassed on localhost. Enter the owner email configured for this page to continue."
        action={(
          <form
            className="design-screen__verify-form"
            onSubmit={(event) => {
              event.preventDefault();
              const candidate = localEmail.trim().toLowerCase();
              if (candidate !== OWNER_EMAIL) {
                setLocalError('Email does not match the configured owner.');
                return;
              }
              window.sessionStorage.setItem(LOCAL_VERIFICATION_KEY, candidate);
              setLocalVerified(true);
              setLocalError(null);
            }}
          >
            <input
              type="email"
              value={localEmail}
              onChange={(event) => {
                setLocalEmail(event.target.value);
                if (localError) setLocalError(null);
              }}
              placeholder="owner@example.com"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button type="submit">Verify email</button>
            {localError ? <p className="design-screen__verify-error">{localError}</p> : null}
          </form>
        )}
      />
    );
  }

  if (!account?.loggedIn) {
    return (
      <AccessDenied
        title="Login required"
        description="This page is private. Sign in with your Google account to continue."
        action={<button type="button" onClick={loginWithGoogle}>Log in with Google</button>}
      />
    );
  }

  if (normalizedEmail !== OWNER_EMAIL) {
    return (
      <AccessDenied
        title="Access denied"
        description={`This page is restricted to ${OWNER_EMAIL}. You are signed in as ${account.email ?? 'an unsupported account'}.`}
      />
    );
  }

  return <DesignSystemContent />;
}

function DesignSystemContent(): ReactNode {
  const { account } = useGame();
  const [activeSectionId, setActiveSectionId] = useState<DesignSectionId>('buttons');
  // activeSectionId is always a valid DesignSectionId present in DESIGN_SECTIONS
  const activeSection = DESIGN_SECTIONS.find((s) => s.id === activeSectionId) as NonNullable<typeof DESIGN_SECTIONS[number]>;

  return (
    <AdminLayout
      activeSection="dashboard"
      onNavigate={() => {}}
      email={account?.email ?? 'Design'}
      onRefresh={() => {}}
      refreshing={false}
      sidebar={(
        <aside className="admin-sidebar design-sidebar">
          <div className="admin-sidebar__rail" aria-hidden="true" />
          <div className="design-sidebar__brand">
            <strong>Ganatri Design System</strong>
            <p>Component showcase and design reference.</p>
          </div>
          <div className="design-sidebar__nav-section">
            <p className="design-sidebar__nav-label">Components</p>
            <nav className="design-sidebar__nav" aria-label="Design system sections">
              {DESIGN_SECTIONS.map((section) => {
                const isActive = activeSectionId === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={`design-sidebar__link${isActive ? ' design-sidebar__link--active' : ''}`}
                    onClick={() => setActiveSectionId(section.id)}
                  >
                    <span className="design-sidebar__icon-box">{section.icon}</span>
                    <span className="design-sidebar__link-text">
                      <span className="design-sidebar__link-title">{section.label}</span>
                    </span>
                    {isActive && <span className="design-sidebar__active-bar" aria-hidden="true" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>
      )}
      header={(
        <header className="admin-header design-header">
          <div className="admin-header__left">
            <div className="admin-header__titles">
              <h1 className="admin-header__title">{activeSection.label}</h1>
              <p className="admin-header__welcome">
                Ganatri Design System • {account?.email ?? 'Owner'}
              </p>
            </div>
          </div>
          <div className="admin-header__right">
            <div className="admin-header__profile">
              <div className="admin-header__avatar">DS</div>
              <div className="admin-header__profile-text">
                <span className="admin-header__profile-name">Design System</span>
                <span className="admin-header__profile-role">Owner only</span>
              </div>
            </div>
          </div>
        </header>
      )}
    >
      <main className="admin-content">
        <div className="design-screen__backdrop" aria-hidden="true" />
        <div className="design-main__frame">
          <DsPageHeader
            eyebrow="Design System"
            title={activeSection.label}
            description={activeSection.description}
          />
          <SectionContent sectionId={activeSectionId} />
        </div>
      </main>
    </AdminLayout>
  );
}

function SectionContent({ sectionId }: { sectionId: DesignSectionId }): ReactNode {
  switch (sectionId) {
    case 'buttons': return <ButtonsSection />;
    case 'typography': return <TypographySection />;
    case 'cards': return <CardsSection />;
    case 'pills-badges': return <PillsBadgesSection />;
    case 'tabs': return <TabsSection />;
    case 'modals': return <ModalsSection />;
    case 'tables': return <TablesSection />;
    case 'forms': return <FormsSection />;
    case 'logo': return <LogoSection />;
    case 'game-table': return <GameTableSection />;
    case 'header': return <HeaderSection />;
    case 'footer': return <FooterSection />;
    case 'backgrounds': return <BackgroundsSection />;
  }
}

// ─── Section previews ────────────────────────────────────────────────────────

function ButtonsSection(): ReactNode {
  return (
    <>
      <DsSection title="Primary" description="Main call-to-action. Gold gradient with dark text.">
        <div className="design-button-row">
          <DsButton label="Play Now" tone="primary" />
          <DsButton label="Join Room" tone="primary" compact />
          <DsButton label="Unavailable" tone="primary" disabled />
        </div>
      </DsSection>

      <DsSection title="Secondary" description="Neutral supporting actions. Dark background, lighter text.">
        <div className="design-button-row">
          <DsButton label="View Stats" tone="secondary" />
          <DsButton label="History" tone="secondary" compact />
          <DsButton label="Disabled" tone="secondary" disabled />
        </div>
      </DsSection>

      <DsSection title="Ghost" description="Low-emphasis or tertiary actions. Transparent with gold border.">
        <div className="design-button-row">
          <DsButton label="How to Play" tone="ghost" />
          <DsButton label="Invite" tone="ghost" compact />
          <DsButton label="Disabled" tone="ghost" disabled />
        </div>
      </DsSection>

      <DsSection title="Outline" description="Dark background with gold border. Used for secondary room actions like Settings.">
        <div className="design-button-row">
          <DsButton label="Settings" tone="outline" />
          <DsButton label="Options" tone="outline" compact />
          <DsButton label="Disabled" tone="outline" disabled />
        </div>
      </DsSection>

      <DsSection title="Danger" description="Destructive or irreversible actions. Dark background with red border.">
        <div className="design-button-row">
          <DsButton label="Exit Room" tone="danger" />
          <DsButton label="Leave" tone="danger" compact />
          <DsButton label="Disabled" tone="danger" disabled />
        </div>
      </DsSection>

      <DsSection title="Room Action Buttons" description="Primary (gold gradient) and Ghost buttons as used in the Room Details sidebar. Canonical design.">
        <div className="design-button-row">
          <DsButton label="Copy Code" tone="primary" />
          <DsButton label="Share Link" tone="ghost" />
        </div>
      </DsSection>

      <DsSection title="Start Game" description="Pulsing gold button shown to the host when the room is ready to begin.">
        <div className="design-button-row">
          <button type="button" className="room__start-btn room__start--ready">Start Game</button>
        </div>
      </DsSection>

      <DsSection title="Leave Room" description="Full-width red gradient button for exiting the room — always at the bottom of mobile layout.">
        <div style={{ width: '100%', maxWidth: 320 }}>
          <button type="button" className="room__leave-btn">Leave Room</button>
        </div>
      </DsSection>

      <DsSection title="Header Action Buttons — Desktop (Canonical)" description="Settings (outline, disabled) and Exit Room (danger) buttons shown in the desktop room header's right slot. These are the canonical header button patterns.">
        <div className="design-button-row">
          <DsButton label="Settings" tone="outline" disabled />
          <DsButton label="Exit Room" tone="danger" />
        </div>
      </DsSection>

      <DsSection title="Header Buttons — Mobile" description="Back arrow, icon-button (copy/menu), used in the sticky mobile room header.">
        <div className="design-button-row">
          <button type="button" className="room__header-back" aria-label="Leave room">←</button>
          <button type="button" className="room__header-icon-btn" aria-label="Copy room code">⎘</button>
          <button type="button" className="room__header-icon-btn" aria-label="Menu">⋮</button>
        </div>
      </DsSection>

      <DsSection title="Voice Controls" description="PTT/Mic bar and utility buttons (deafen, mode toggle) from the Voice Chat panel.">
        <div className="design-button-stack" style={{ gap: 12 }}>
          <button type="button" className="room__voice-ptt-bar">
            <span className="room__voice-ptt-pill">MIC</span>
            <span className="room__voice-ptt-hint-inline">Open mic mode</span>
          </button>
          <button type="button" className="room__voice-ptt-bar room__voice-ptt-bar--active">
            <span className="room__voice-ptt-pill">PTT</span>
            <span className="room__voice-ptt-hint-inline">Hold to talk</span>
          </button>
          <button type="button" className="room__voice-ptt-bar room__voice-ptt-bar--muted">
            <span className="room__voice-ptt-pill">Unmute</span>
            <span className="room__voice-ptt-hint-inline">Mic muted</span>
          </button>
          <div className="room__voice-util-row">
            <button type="button" className="room__voice-util-btn">🔊</button>
            <button type="button" className="room__voice-util-btn room__voice-util-btn--active">🔈</button>
            <button type="button" className="room__voice-util-btn">PTT mode</button>
            <button type="button" className="room__voice-util-btn">Open mic</button>
          </div>
        </div>
      </DsSection>

      <DsSection title="Mobile Action Row" description="Compact icon+label action buttons shown below the table on mobile (Invite Friends, Share Link).">
        <div className="room__action-row">
          <button type="button" className="room__action-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
              <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3 19c0-2.8 2.7-4.5 6-4.5s6 1.7 6 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M16 14.5c2.2.4 4 1.8 4 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Invite Friends
          </button>
          <button type="button" className="room__action-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.12 1.12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.12-1.12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Share Link
          </button>
        </div>
      </DsSection>
    </>
  );
}

function TypographySection(): ReactNode {
  return (
    <>
      <DsSection title="Display & Headings" description="Font families and weights used for titles and section headings.">
        <div className="design-type-scale">
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">Display</span>
            <p className="design-type-scale__display">Ganatri</p>
          </div>
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">H1</span>
            <p className="design-type-scale__h1">Play, capture, win.</p>
          </div>
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">H2</span>
            <p className="design-type-scale__h2">Room Details</p>
          </div>
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">H3</span>
            <p className="design-type-scale__h3">Player Stats</p>
          </div>
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">H4</span>
            <p className="design-type-scale__h4">Match History</p>
          </div>
        </div>
      </DsSection>

      <DsSection title="Body & UI Text" description="Body copy, muted text, small labels, eyebrow, and monospace.">
        <div className="design-type-scale">
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">Body</span>
            <p>Join a room, pick your seat, and play. Ganatri is a 2-to-4-player card game.</p>
          </div>
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">Muted</span>
            <p className="design-type-scale__muted">You are currently in the lobby. No active game.</p>
          </div>
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">Small</span>
            <p className="design-type-scale__small">Seat 2 of 4 · Waiting for players</p>
          </div>
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">Eyebrow</span>
            <span className="ds-eyebrow">Phase 1 — Capture</span>
          </div>
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">Mono</span>
            <code className="design-type-scale__mono">ROOM-4X7Z</code>
          </div>
        </div>
      </DsSection>

      <DsSection title="Room Screen Typography" description="Text patterns from the room screen: title, code, player count, elapsed timer, panel labels.">
        <div className="design-type-scale">
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">Room Title</span>
            <h1 className="room__header-room-title" style={{ margin: 0 }}>ROOM 4X7Z</h1>
          </div>
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">Room Code</span>
            <span className="room__header-code">4X7Z</span>
          </div>
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">Player Count</span>
            <p style={{ margin: 0 }}>
              <span className="room__player-count-label">Players </span>
              <span className="room__player-count-value">3/4</span>
            </p>
          </div>
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">Elapsed</span>
            <p style={{ margin: 0 }}>
              <span className="room__elapsed-time">04:22</span>
              <span className="room__elapsed-suffix"> elapsed</span>
            </p>
          </div>
          <div className="design-type-scale__row">
            <span className="design-type-scale__label">Panel Label</span>
            <h3 className="room__details-heading" style={{ margin: 0 }}>ROOM DETAILS</h3>
          </div>
        </div>
      </DsSection>
    </>
  );
}

function CardsSection(): ReactNode {
  return (
    <>
      <DsSection title="Card (Canonical Design)" description="Glassmorphic dark card with gold border and backdrop blur. This is the canonical card design used throughout the app for all grouped content surfaces.">
        <div className="design-grid design-grid--two">
          <DsCard title="Room Details" subtitle="Private · 4 seats">
            <p className="design-copy">Room code: ROOM-4X7Z. Created by Chinjan.</p>
          </DsCard>
          <DsCard title="Active Game" subtitle="Phase 1 in progress">
            <p className="design-copy">3 players seated. Turn 7 of 12.</p>
          </DsCard>
        </div>
      </DsSection>

      <DsSection title="Stat Tiles" description="Compact tiles for metrics, scores, and counts.">
        <div className="design-stat-grid">
          <DsStat label="Wins" value="24" delta="+3 this week" />
          <DsStat label="Games" value="61" />
          <DsStat label="Win Rate" value="39%" />
          <DsStat label="Avg. Finish" value="1.8" />
        </div>
      </DsSection>

      <DsSection title="List Rows" description="Rows for player lists, history, and session entries.">
        <div className="design-button-stack">
          <DsListRow title="Chinjan Patel" subtitle="Host · Seat 1" trailing={<DsBadge label="Host" tone="warning" />} />
          <DsListRow title="Arjun S." subtitle="Seat 2 · Ready" trailing={<DsBadge label="Ready" tone="success" />} />
          <DsListRow title="Priya M." subtitle="Seat 3 · Waiting" trailing={<DsBadge label="Waiting" tone="default" />} />
        </div>
      </DsSection>

      <DsSection title="Room Details Panel (Canonical)" description="Glassmorphic dark card (canonical) with icon-row layout — used in the Room screen left sidebar. Uses standardized Card design + Primary/Ghost buttons.">
        <div className="room__details-sidebar design-room-panel-preview">
          <h3 className="room__details-heading">ROOM DETAILS</h3>
          <div className="room__details-rows">
            <div className="room__details-row">
              <span className="room__details-icon" />
              <span className="room__details-label">Room Code</span>
              <span className="room__details-value"><span className="room__details-code">ROOM-4X7Z</span></span>
            </div>
            <div className="room__details-row">
              <span className="room__details-icon" />
              <span className="room__details-label">Game Mode</span>
              <span className="room__details-value">Classic</span>
            </div>
            <div className="room__details-row">
              <span className="room__details-icon" />
              <span className="room__details-label">Max Players</span>
              <span className="room__details-value">4 Players</span>
            </div>
            <div className="room__details-row">
              <span className="room__details-icon" />
              <span className="room__details-label">Host</span>
              <span className="room__details-value">Chinjan P.</span>
            </div>
          </div>
          <div className="room__details-actions">
            <DsButton label="Copy Code" tone="primary" />
            <DsButton label="Share Link" tone="ghost" />
          </div>
        </div>
      </DsSection>

      <DsSection title="Activity Panel" description="Live activity log with ACTIVITY / CHAT tab switching and inline chat input.">
        <div className="room__activity-panel design-room-panel-preview" style={{ maxHeight: 'none' }}>
          <div className="room__activity-tabs">
            <button type="button" className="room__activity-tab room__activity-tab--active">ACTIVITY</button>
            <button type="button" className="room__activity-tab">CHAT</button>
          </div>
          <div className="room__activity-content">
            <ul className="room__activity-log">
              {[
                { time: '9:41', text: 'You joined the room' },
                { time: '9:42', text: 'Arjun S. joined the room' },
                { time: '9:43', text: 'Priya M. joined the room' },
              ].map((entry, i) => (
                <li key={i} className="room__activity-entry">
                  <span className="room__activity-time">{entry.time}</span>
                  <span className="room__activity-entry-icon" aria-hidden="true">👤</span>
                  <span className="room__activity-text">{entry.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="room__chat-input-row">
            <button type="button" className="room__chat-emoji-btn" disabled title="Emoji">😊</button>
            <input className="room__chat-input" placeholder="Type a message..." readOnly />
            <button type="button" className="room__chat-send-btn" disabled>➤</button>
          </div>
        </div>
      </DsSection>

      <DsSection title="Voice Chat Panel" description="Voice chat section with participant row, PTT/mic bar, and utility controls.">
        <div className="room__voice-section design-room-panel-preview">
          <div className="room__voice-header">
            <h3 className="room__voice-title">VOICE CHAT</h3>
            <div className="room__voice-meta">
              <span className="room__voice-count">3 participants</span>
              <span className="room__voice-status room__voice-status--enabled">
                <span className="room__voice-status-dot" aria-hidden="true" />
                Enabled
              </span>
            </div>
          </div>
          <div className="room__voice-participants-wrap">
            <div className="room__voice-participants">
              {(['CP', 'AS', 'PM'] as const).map((initials, idx) => (
                <div key={idx} className="room__voice-participant">
                  <div className="room__voice-participant-avatar-wrap">
                    <div className={`room__voice-participant-circle${idx === 1 ? ' room__voice-participant-circle--speaking' : ''}`}>
                      <span className="room__voice-participant-initials">{initials}</span>
                    </div>
                    <span className={`room__voice-mic-badge${idx === 1 ? ' room__voice-mic-badge--live' : ''}`} aria-hidden="true">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="9" y="4" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </span>
                  </div>
                  <span className="room__voice-participant-name">
                    {idx === 0 ? 'You' : idx === 1 ? 'Arjun S.' : 'Priya M.'}
                  </span>
                </div>
              ))}
              <div className="room__voice-participant">
                <div className="room__voice-participant-avatar-wrap">
                  <div className="room__voice-participant-circle room__voice-participant-circle--empty">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="9" r="3.5" fill="currentColor" opacity="0.35" />
                      <path d="M6 19c0-3 2.7-5 6-5s6 2 6 5" fill="currentColor" opacity="0.35" />
                    </svg>
                  </div>
                </div>
                <span className="room__voice-participant-name room__voice-participant-name--empty">Empty</span>
              </div>
            </div>
            <span className="room__voice-participants-scroll" aria-hidden="true">›</span>
          </div>
          <div className="room__voice-desktop-controls">
            <button type="button" className="room__voice-ptt-bar">
              <span className="room__voice-ptt-pill">MIC</span>
              <span className="room__voice-ptt-hint-inline">Open mic mode</span>
            </button>
            <div className="room__voice-util-row">
              <button type="button" className="room__voice-util-btn" title="Deafen">🔊</button>
              <button type="button" className="room__voice-util-btn" title="Switch to push-to-talk">PTT mode</button>
            </div>
          </div>
        </div>
      </DsSection>

      <DsSection title="Friends Online Panel" description="Panel showing online friends and recent opponents with invite actions.">
        <div className="room__friends-panel design-room-panel-preview">
          <h3 className="room__friends-heading">FRIENDS ONLINE</h3>
          <div className="room__invite-list">
            {[
              { initials: 'AS', name: 'Arjun S.', sub: 'Online', online: true },
              { initials: 'PM', name: 'Priya M.', sub: 'Online', online: true },
              { initials: 'RK', name: 'Ravi K.', sub: 'Offline', online: false },
            ].map((p) => (
              <div key={p.name} className="room__invite-row">
                <div className="room__invite-initials" aria-hidden="true">{p.initials}</div>
                <div className="room__invite-info">
                  <span className="room__invite-name">
                    {p.online && <span className="room__invite-online-dot" aria-hidden="true">●</span>}
                    {p.name}
                  </span>
                  <span className="room__invite-sub">{p.sub}</span>
                </div>
                <button type="button" className="room__invite-btn" disabled={!p.online}>
                  Invite
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="secondary room__friends-view-all">View All Friends ›</button>
        </div>
      </DsSection>
    </>
  );
}

function PillsBadgesSection(): ReactNode {
  return (
    <>
      <DsSection title="Status Badges" description="Tone-coded badges for state, status, and labels.">
        <div className="design-badge-row">
          <DsBadge label="Default" tone="default" />
          <DsBadge label="Success" tone="success" />
          <DsBadge label="Warning" tone="warning" />
          <DsBadge label="Danger" tone="danger" />
          <DsBadge label="Info" tone="info" />
        </div>
      </DsSection>

      <DsSection title="In Context" description="Badges in real usage — role, state, and category labels.">
        <div className="design-badge-row">
          <DsBadge label="Host" tone="warning" />
          <DsBadge label="Ready" tone="success" />
          <DsBadge label="Waiting" tone="default" />
          <DsBadge label="Disconnected" tone="danger" />
          <DsBadge label="Spectator" tone="info" />
        </div>
      </DsSection>

      <DsSection title="Alerts" description="Inline alert blocks for contextual feedback and status messages.">
        <div className="design-button-stack">
          <DsAlert tone="success" title="Room created" description="Share the code with your friends to start the game." />
          <DsAlert tone="warning" title="Waiting for players" description="2 of 4 seats are filled. Game starts when the room is full." />
          <DsAlert tone="danger" title="Connection lost" description="Reconnecting to the server. Your seat is held." />
          <DsAlert tone="info" title="Phase 2 begins" description="Suit and cut rules are now active for this round." />
        </div>
      </DsSection>

      <DsSection title="Player Pips" description="Filled/empty circular pips showing how many seats are occupied in the room.">
        <div className="design-badge-row">
          <div className="room__pips" role="list" aria-label="3 of 4 players joined">
            {[true, true, true, false].map((filled, i) => (
              <span key={i} role="listitem" className={`room__pip${filled ? ' room__pip--filled' : ''}`}>
                {filled && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="8" fill="currentColor" />
                    <circle cx="12" cy="12" r="5.5" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
                    <path d="M12 7v10M9 10h6" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                )}
              </span>
            ))}
          </div>
        </div>
      </DsSection>

      <DsSection title="Player Status Bar" description="Two-column layout: seat counter with fill bar on the left, digital lobby timer on the right. Status strip spans the bottom.">
        <div className="room__status-panel" style={{ maxWidth: 380, padding: '12px 14px 10px' }}>
          <div className="room__status-bar">
            <div className="room__statusbar-col">
              <span className="room__statusbar-eyebrow">SEATS</span>
              <div className="room__statusbar-fraction">
                <span className="room__statusbar-num">3</span>
                <span className="room__statusbar-denom">/4</span>
              </div>
              <div className="room__pips" role="list" aria-label="3 of 4 players joined">
                {[true, true, true, false].map((filled, i) => (
                  <span key={i} role="listitem" className={`room__pip${filled ? ' room__pip--filled' : ''}`}>
                    {filled && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="8" fill="currentColor" />
                        <circle cx="12" cy="12" r="5.5" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
                        <path d="M12 7v10M9 10h6" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                ))}
              </div>
              <div className="room__statusbar-fillbar" aria-hidden="true">
                <div className="room__statusbar-fill" style={{ width: '75%' }} />
              </div>
            </div>
            <div className="room__statusbar-vline" aria-hidden="true" />
            <div className="room__statusbar-col room__statusbar-col--timer">
              <span className="room__statusbar-eyebrow">IN LOBBY</span>
              <span className="room__statusbar-clock">04:22</span>
              <span className="room__statusbar-clock-label">elapsed</span>
            </div>
            <div className="room__statusbar-footer room__statusbar-footer--ready">
              <span className="room__statusbar-footer-dot" aria-hidden="true" />
              READY TO START
            </div>
          </div>
        </div>
      </DsSection>

      <DsSection title="Room Context Pills" description="Player count badge, YOU indicator, and host crown as seen around the game table.">
        <div className="design-badge-row" style={{ alignItems: 'center', gap: 24 }}>
          <span className="room__player-badge">👥 3 PLAYER ROOM</span>
          <span className="room__seat-you-badge">YOU</span>
          <div className="room__seat-slot" style={{ flex: 'none', paddingTop: 20 }}>
            <span className="room__seat-crown" aria-label="host">♛</span>
            <div className="room__seat-circle room__seat-circle--occupied">
              <span className="room__seat-initials">CP</span>
            </div>
            <span className="room__seat-name">Chinjan P.</span>
          </div>
        </div>
      </DsSection>
    </>
  );
}

function TabsSection(): ReactNode {
  return (
    <>
      <DsSection title="Tab Strip" description="Horizontal tab navigation with active and inactive states.">
        <DsTabs items={['Activity', 'Chat', 'Players', 'Settings']} active="Activity" />
        <DsTabs items={['Activity', 'Chat', 'Players', 'Settings']} active="Players" />
      </DsSection>

      <DsSection title="Filter Pills" description="Compact pill navigation used for filters and sub-sections.">
        <DsTabs items={['All Time', 'This Week', 'Today']} active="All Time" />
        <DsTabs items={['All Modes', 'Ranked', 'Casual']} active="Ranked" />
      </DsSection>

      <DsSection title="Activity / Chat Tabs" description="Display-font uppercase tab strip from the room activity panel.">
        <div className="room__activity-panel design-room-panel-preview" style={{ maxHeight: 'none' }}>
          <div className="room__activity-tabs">
            <button type="button" className="room__activity-tab room__activity-tab--active">ACTIVITY</button>
            <button type="button" className="room__activity-tab">CHAT</button>
          </div>
        </div>
      </DsSection>
    </>
  );
}

function ModalsSection(): ReactNode {
  return (
    <>
      <DsSection title="Confirmation Modal" description="Centered overlay card for destructive or high-stakes actions.">
        <div className="design-modal-preview">
          <div className="design-modal-preview__card">
            <span className="ds-eyebrow">Confirm Action</span>
            <p className="design-modal-preview__title">Leave this room?</p>
            <p className="design-copy">You will lose your seat. You can rejoin if the room is still open and has a free seat.</p>
            <div className="design-modal-preview__actions">
              <DsButton label="Cancel" tone="secondary" />
              <DsButton label="Leave Room" tone="danger" />
            </div>
          </div>
        </div>
      </DsSection>

      <DsSection title="Info Modal" description="Informational panel for rules, how-to-play, and contextual content.">
        <div className="design-modal-preview">
          <div className="design-modal-preview__card">
            <span className="ds-eyebrow">How to Play</span>
            <p className="design-modal-preview__title">Part 1 — Capture</p>
            <p className="design-copy">Play a card to capture matching cards on the board. Summation captures also count — the values of cards on the board must add up to your played card.</p>
            <div className="design-modal-preview__actions">
              <DsButton label="Got it" tone="primary" />
            </div>
          </div>
        </div>
      </DsSection>
    </>
  );
}

function TablesSection(): ReactNode {
  return (
    <>
      <DsSection title="Data Table" description="Tabular layout with a fixed header row and styled body rows.">
        <div className="design-table">
          <div className="design-table__row design-table__row--head">
            <span>Player</span>
            <span>Score</span>
            <span>Status</span>
          </div>
          <div className="design-table__row">
            <span>Chinjan Patel</span>
            <span>48 pts</span>
            <DsBadge label="Host" tone="warning" />
          </div>
          <div className="design-table__row">
            <span>Arjun S.</span>
            <span>31 pts</span>
            <DsBadge label="Active" tone="success" />
          </div>
          <div className="design-table__row">
            <span>Priya M.</span>
            <span>22 pts</span>
            <DsBadge label="Active" tone="success" />
          </div>
          <div className="design-table__row">
            <span>Ravi K.</span>
            <span>—</span>
            <DsBadge label="Waiting" tone="default" />
          </div>
        </div>
      </DsSection>

      <DsSection title="Leaderboard Table" description="Ranked list with player name, win count, and win-rate columns.">
        <div className="design-table">
          <div className="design-table__row design-table__row--head">
            <span>Rank · Player</span>
            <span>Wins</span>
            <span>Win Rate</span>
          </div>
          {[
            { rank: '1', name: 'Chinjan P.', wins: '24', rate: '39%' },
            { rank: '2', name: 'Arjun S.', wins: '19', rate: '34%' },
            { rank: '3', name: 'Priya M.', wins: '14', rate: '28%' },
          ].map((row) => (
            <div key={row.rank} className="design-table__row">
              <span>#{row.rank} {row.name}</span>
              <span>{row.wins}</span>
              <span>{row.rate}</span>
            </div>
          ))}
        </div>
      </DsSection>
    </>
  );
}

function FormsSection(): ReactNode {
  return (
    <>
      <DsSection title="Input Fields" description="Labelled input fields with placeholder, value, and helper-text states.">
        <div className="design-field-stack">
          <DsField label="Display Name" placeholder="Enter your name" helper="Shown to other players in the room." />
          <DsField label="Room Code" value="ROOM-4X7Z" helper="Share this code to invite friends." />
          <DsField label="Room Code" placeholder="e.g. ROOM-4X7Z" helper="No room found with this code. Please check and try again." />
        </div>
      </DsSection>
    </>
  );
}

function LogoSection(): ReactNode {
  return (
    <>
      <DsSection title="Logo Mark" description="Ganatri logo mark at full, medium, and compact sizes.">
        <div className="design-logo-row">
          <div className="design-logo-sample design-logo-sample--lg">G</div>
          <div className="design-logo-sample">G</div>
          <div className="design-logo-sample design-logo-sample--sm">G</div>
        </div>
      </DsSection>

      <DsSection title="Logo Asset" description="PNG logo with drop-shadow glow — used in the room header and mobile screens.">
        <div className="design-logo-asset-row">
          <img src={logo} alt="Ganatri" className="design-logo-asset" />
          <img src={logo} alt="Ganatri" className="design-logo-asset design-logo-asset--sm" />
        </div>
      </DsSection>

      <DsSection title="Wordmark" description="Full wordmark combining the logo mark with the Ganatri logotype.">
        <div className="design-wordmark-row">
          <div className="design-logo-sample design-logo-sample--sm">G</div>
          <span className="design-wordmark-text">Ganatri</span>
        </div>
      </DsSection>
    </>
  );
}

function GameTableSection(): ReactNode {
  return (
    <>
      <DsSection title="Oval Game Table" description="Felt-style board with wood rail, amber lights, dealer chip, and 4 absolute-positioned seat slots.">
        <div className="room__table-area">
          <div className="room__oval">
            <div className="room__oval-rail" aria-hidden="true">
              <div className="room__oval-felt">
                <span className="room__oval-mark">♠</span>
              </div>
              <span className="room__rail-light room__rail-light--tl" />
              <span className="room__rail-light room__rail-light--tr" />
              <span className="room__rail-light room__rail-light--bl" />
              <span className="room__rail-light room__rail-light--br" />
            </div>
            <span className="room__dealer-chip" aria-label="Dealer">D</span>
            <div className="room__seat room__seat--0">
              <div className="room__seat-slot">
                <span className="room__seat-crown" aria-label="host">♛</span>
                <div className="room__seat-circle room__seat-circle--occupied room__seat-circle--you">
                  <span className="room__seat-initials">CP</span>
                </div>
                <span className="room__seat-name">Chinjan P.</span>
                <span className="room__seat-you-badge">YOU</span>
              </div>
            </div>
            <div className="room__seat room__seat--1">
              <div className="room__seat-slot">
                <div className="room__seat-circle room__seat-circle--occupied">
                  <span className="room__seat-initials">AS</span>
                </div>
                <span className="room__seat-name">Arjun S.</span>
              </div>
            </div>
            <div className="room__seat room__seat--2">
              <div className="room__seat-slot">
                <div className="room__seat-circle room__seat-circle--occupied">
                  <span className="room__seat-initials">PM</span>
                </div>
                <span className="room__seat-name">Priya M.</span>
              </div>
            </div>
            <div className="room__seat room__seat--3">
              <div className="room__seat-slot">
                <div className="room__seat-circle room__seat-circle--empty">
                  <span className="room__seat-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="9" r="3.5" fill="currentColor" opacity="0.35" />
                      <path d="M6 19c0-3 2.7-5 6-5s6 2 6 5" fill="currentColor" opacity="0.35" />
                    </svg>
                  </span>
                </div>
                <span className="room__seat-waiting-label">
                  Waiting for<br />player...
                </span>
              </div>
            </div>
          </div>
        </div>
      </DsSection>

      <DsSection title="Game Chips" description="Casino-style chips used as decorative elements throughout the room screen.">
        <div className="design-table-preview__chips">
          <span className="design-chip design-chip--gold" />
          <span className="design-chip design-chip--green" />
          <span className="design-chip design-chip--blue" />
          <span className="design-chip design-chip--red" />
          <span className="design-chip design-chip--gold" />
        </div>
      </DsSection>
    </>
  );
}

function HeaderSection(): ReactNode {
  return (
    <>
      <DsSection title="Room Header — Desktop" description="Transparent header with logo, gold room title flourishes, player badge, and action buttons.">
        <header className="room__header-desktop design-room-header-wrap">
          <div className="room__header-left">
            <img src={logo} alt="Ganatri" className="room__header-logo" style={{ width: 120 }} />
          </div>
          <div className="room__header-center">
            <div className="room__header-title-block">
              <span className="room__header-flourish" aria-hidden="true" />
              <h1 className="room__header-room-title">ROOM 4X7Z</h1>
              <span className="room__header-flourish room__header-flourish--right" aria-hidden="true" />
            </div>
            <span className="room__player-badge room__player-badge--header">
              <span className="room__player-badge-icon" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
                  <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M3 19c0-2.8 2.7-4.5 6-4.5s6 1.7 6 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </span>
              4 PLAYER ROOM
            </span>
          </div>
          <div className="room__header-right">
            <button type="button" className="room__header-settings-btn" disabled>
              Settings
            </button>
            <button type="button" className="room__header-exit-btn">
              Exit Room
            </button>
          </div>
        </header>
      </DsSection>

      <DsSection title="Room Header — Mobile" description="Compact sticky header with back button, room code display, and overflow menu icon.">
        <header className="room__header-mobile design-room-header-wrap" style={{ position: 'static' }}>
          <button type="button" className="room__header-back" aria-label="Leave room">←</button>
          <div className="room__header-title-wrap">
            <span className="room__header-title">Room</span>
            <span className="room__header-code">4X7Z</span>
          </div>
          <div className="room__header-actions">
            <button type="button" className="room__header-icon-btn" aria-label="Copy room code">⎘</button>
            <button type="button" className="room__header-icon-btn" aria-label="Menu">⋮</button>
          </div>
        </header>
      </DsSection>
    </>
  );
}

function FooterSection(): ReactNode {
  return (
    <>
      <DsSection title="Room Footer Bar" description="Slim footer with red/black suit symbols, branding tagline, and decorative chip + card stack.">
        <div className="design-footer-shell">
          <div className="room__footer-bar">
            <span className="room__footer-suits room__footer-suits--red">♥ ♦</span>
            <span className="room__footer-tagline">Play smart. Play sharp. Win with Ganatri.</span>
            <span className="room__footer-suits">♠ ♣</span>
            <div className="room__footer-decor" aria-hidden="true">
              <div className="room__footer-cards">
                <span className="room__footer-card room__footer-card--hearts">A<span>♥</span></span>
                <span className="room__footer-card room__footer-card--spades">K<span>♠</span></span>
              </div>
              <div className="room__footer-chips">
                <span className="room__footer-chip room__footer-chip--red" />
                <span className="room__footer-chip room__footer-chip--blue" />
                <span className="room__footer-chip room__footer-chip--green" />
              </div>
            </div>
          </div>
        </div>
      </DsSection>

      <DsSection title="Decorative Chip Stack" description="Overlapping chip stack used as a decorative accent in footers and empty states.">
        <div className="design-footer-preview">
          <div className="design-footer-preview__chips">
            {(['gold', 'green', 'blue', 'red', 'gold'] as const).map((color, i) => (
              <span key={i} className={`design-chip design-chip--${color}`} />
            ))}
          </div>
          <p className="design-copy">Ganatri · v1</p>
        </div>
      </DsSection>
    </>
  );
}

function BackgroundsSection(): ReactNode {
  return (
    <>
      <DsSection title="Primary App Background" description="Main screen background with gold and blue radial lights on a deep green base.">
        <div className="design-background-sample" />
      </DsSection>

      <DsSection title="Card & Surface Background" description="Background used for card surfaces, modals, and sidebar panels.">
        <div className="design-background-sample design-background-sample--surface" />
      </DsSection>

      <DsSection title="Game Table Background" description="Felt-like dark-green background used for the active game board area.">
        <div className="design-background-sample design-background-sample--table" />
      </DsSection>

      <DsSection title="Room Felt Backdrop" description="Casino-style felt with crosshatch grain texture, vignette, and watermark crest — fixed behind the room screen.">
        <div className="design-felt-preview" aria-hidden="true">
          <svg className="design-felt-preview__crest" viewBox="0 0 240 280" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M68 178c-18-28-8-62 14-78 8-6 16-4 22 2M172 178c18-28 8-62-14-78-8-6-16-4-22 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M82 168c-6-18 2-36 16-46M158 168c6-18-2-36-16-46" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
            <circle cx="120" cy="158" r="54" stroke="currentColor" strokeWidth="2.4" />
            <circle cx="120" cy="158" r="46" stroke="currentColor" strokeWidth="1" opacity="0.45" />
            <path d="M120 118c-16.5 0-30 12.2-30 27.4 0 11.8 9.5 18.8 19 21.2-7.2 9.6-12 16.8-12 16.8h46s-4.8-7.2-12-16.8c9.5-2.4 19-9.4 19-21.2 0-15.2-13.5-27.4-30-27.4z" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M92 76h56l-10 18-12-14-10 16-10-16-12 14z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>
      </DsSection>
    </>
  );
}
