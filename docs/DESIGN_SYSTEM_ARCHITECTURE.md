# Ganatri — Design System Architecture

**Status:** Approved for implementation  
**Goal:** Create a `packages/ds` monorepo package that is the single source of truth for every UI component in the app. No standalone components may be introduced in `packages/web/src/screens/` after this package exists. All components are developed, tested, and reviewed inside Storybook first, then consumed by the web app.

---

## 1. The Problem Being Solved

### Current state (before this phase)
- UI components are written inline, per-screen. `RoomScreen.tsx` contains `OvalTable`, `SeatSlot`, `ActivityPanel`, `VoiceChatPanel`, `RoomDetailsSidebar`, `FriendsOnlineSidebar`, `RoomHeaderDesktop`, `RoomHeaderMobile`, `RoomFooterDecor`, and more — none reusable.
- CSS lives in per-screen files (`RoomScreen.css`, `LobbyScreen.css`). The `room__*` class system is 2500+ lines of CSS with no isolation.
- Nine primitives exist in `packages/web/src/design-system/DesignSystemPrimitives.tsx` but they are not enforced — screens bypass them freely.
- A `/design` route at `/design` showcases components visually (access-gated by `VITE_DESIGN_SYSTEM_OWNER_EMAIL`), but it is a showroom, not an authoring environment.

### Target state (after this phase)
- Every component lives in `packages/ds`.
- Storybook runs against `packages/ds` in total isolation (no game state, no sockets, no server).
- `packages/web` imports components as `@ganatri/ds` workspace dependency — never re-implements them.
- An ESLint rule enforces the golden rule: no JSX or CSS class references in screen files that should be DS components.
- The `/design` route in the web app remains, but it composes DS components — it does not define them.

---

## 2. Two-Tool Philosophy

### Tool 1 — Storybook (`packages/ds/.storybook/`)
**Purpose:** Component workbench. Isolation, props exploration, accessibility audit, visual regression.  
**Audience:** Developer authoring or editing a component.  
**When to use:** Any time a component is created, modified, or reviewed. The story is the contract.

### Tool 2 — `/design` route (`packages/web/src/screens/DesignSystemScreen.tsx`)
**Purpose:** Product showroom. Static previews of how components compose inside the actual app shell (AdminLayout sidebar + content area). Shows real mock data, real CSS tokens.  
**Audience:** Designer or product owner reviewing how things look together.  
**When to use:** After a component is shipped to `packages/ds` and consumed by the web app. Composition smoke-check.

**These two tools are complementary, not competing.** A component is authored in Storybook, exported from `packages/ds`, imported into the web app, and then displayed in the `/design` showroom. The showroom does not drive development — Storybook does.

---

## 3. Monorepo Structure After This Phase

```
ganatri/
├── packages/
│   ├── engine/          # Pure rules engine — no change
│   ├── server/          # Socket.io server — no change
│   ├── db/              # Postgres/Drizzle layer — no change
│   ├── ds/              # NEW: design system package
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── .storybook/
│   │   │   ├── main.ts
│   │   │   └── preview.ts
│   │   └── src/
│   │       ├── tokens/
│   │       │   └── index.css          # All CSS custom properties
│   │       ├── components/
│   │       │   ├── Button/
│   │       │   │   ├── Button.tsx
│   │       │   │   ├── Button.css
│   │       │   │   ├── Button.stories.tsx
│   │       │   │   └── index.ts
│   │       │   ├── Badge/
│   │       │   │   ├── Badge.tsx
│   │       │   │   ├── Badge.css
│   │       │   │   ├── Badge.stories.tsx
│   │       │   │   └── index.ts
│   │       │   ├── ... (one directory per component)
│   │       └── index.ts               # Barrel export of every component
│   └── web/             # React Vite app — imports from @ganatri/ds
│       └── src/
│           ├── screens/  # Screen shells only — no component definitions
│           └── ...
├── package.json          # Workspace root
└── docs/
    └── DESIGN_SYSTEM_ARCHITECTURE.md  # This file
```

---

## 4. `packages/ds` Package Setup

### 4a — `package.json`

```json
{
  "name": "@ganatri/ds",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  },
  "devDependencies": {
    "@storybook/react-vite": "^8.x",
    "@storybook/react": "^8.x",
    "@storybook/addon-essentials": "^8.x",
    "@storybook/addon-a11y": "^8.x",
    "vite": "^5.x",
    "typescript": "^5.x"
  },
  "peerDependencies": {
    "react": "^18.x",
    "react-dom": "^18.x"
  }
}
```

### 4b — Workspace root `package.json` addition

```json
{
  "workspaces": [
    "packages/engine",
    "packages/db",
    "packages/server",
    "packages/ds",
    "packages/web"
  ]
}
```

### 4c — `packages/web/package.json` addition

```json
{
  "dependencies": {
    "@ganatri/ds": "workspace:*"
  }
}
```

### 4d — `tsconfig.json` for `packages/ds`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@ganatri/ds": ["./src/index.ts"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.stories.tsx", "node_modules"]
}
```

---

## 5. Storybook Setup

### 5a — `.storybook/main.ts`

```typescript
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',   // controls, actions, viewport, docs
    '@storybook/addon-a11y',         // accessibility audit per story
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
```

### 5b — `.storybook/preview.ts`

```typescript
import '../src/tokens/index.css';   // load design tokens globally

import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark-felt',
      values: [
        { name: 'dark-felt', value: '#010603' },   // casino background
        { name: 'panel',     value: '#0a1a10' },   // panel background
        { name: 'white',     value: '#ffffff' },
      ],
    },
  },
};

export default preview;
```

**Why dark background as default:** every Ganatri component is designed for the dark casino theme. Storybook's default white background would make components look broken and misrepresent their visual contract.

---

## 6. Design Token Strategy

### 6a — Token file: `packages/ds/src/tokens/index.css`

All CSS custom properties that currently live scattered in `RoomScreen.css`, `LobbyScreen.css`, and `theme.css` are extracted here. This file is imported once in Storybook's `preview.ts` and once in `packages/web/src/index.css` (replacing the current scattered declarations).

```css
/* ─── Colour palette ──────────────────────────────────────────────── */
:root {
  --gold:          #e7c34a;
  --gold-rim:      #c9a227;
  --gold-2:        #f0d060;
  --glow-gold:     0 0 18px rgba(231, 195, 74, 0.55);

  --safe:          #22c55e;
  --danger:        #ef4444;
  --info:          #3b82f6;
  --warning:       #f59e0b;

  --red-suit:      #e53e3e;
  --black-suit:    #e2e8f0;

  --chip-red:      #b91c1c;
  --chip-blue:     #1d4ed8;
  --chip-green:    #15803d;

  /* ─── Surfaces ───────────────────────────────────────────────────── */
  --panel:         rgba(10, 26, 16, 0.85);
  --panel-2:       rgba(18, 44, 28, 0.75);
  --border-gold:   rgba(231, 195, 74, 0.18);

  /* ─── Typography ─────────────────────────────────────────────────── */
  --font-display:  'Cinzel', serif;
  --font-body:     'Inter', system-ui, sans-serif;

  --text:          #e2e8f0;
  --text-dim:      rgba(226, 232, 240, 0.55);
  --text-gold:     #e7c34a;
}
```

**Principle:** tokens are CSS custom properties, not JS constants. They work in plain CSS, Storybook, and the web app without a build step.

### 6b — Migration steps for tokens
1. Audit `RoomScreen.css`, `LobbyScreen.css`, `AdminScreen.css` for hardcoded hex values.
2. Replace each hardcoded value with the equivalent token from `tokens/index.css`.
3. Remove duplicate `:root` blocks in per-screen CSS files.
4. Add `@import '@ganatri/ds/src/tokens/index.css'` (or equivalent Vite alias) to the web app's entry CSS.

---

## 7. Component File Convention

Every component lives in its own subdirectory of `packages/ds/src/components/`. The directory name is PascalCase, matching the component name.

### Required files per component

```
ComponentName/
├── ComponentName.tsx        # The React component
├── ComponentName.css        # Component-scoped styles (BEM: ds-component-name__)
├── ComponentName.stories.tsx # Storybook stories
└── index.ts                 # Re-exports the component (named + default)
```

### `index.ts` pattern

```typescript
export { Button } from './Button';
export type { ButtonProps } from './Button';
```

### `Button.tsx` example

```typescript
import './Button.css';

export interface ButtonProps {
  label: string;
  tone?: 'primary' | 'secondary' | 'danger' | 'ghost';
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({ label, tone = 'primary', compact, disabled, onClick }: ButtonProps) {
  return (
    <button
      className={[
        'ds-button',
        `ds-button--${tone}`,
        compact ? 'ds-button--compact' : '',
      ].filter(Boolean).join(' ')}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
```

### `Button.css` example

```css
.ds-button {
  font-family: var(--font-display);
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.ds-button--primary  { background: var(--gold);    color: #0a1a10; border: none; }
.ds-button--secondary{ background: transparent;    color: var(--gold); border: 1px solid var(--gold-rim); }
.ds-button--danger   { background: var(--danger);  color: #fff;    border: none; }
.ds-button--ghost    { background: transparent;    color: var(--text-dim); border: 1px solid rgba(255,255,255,0.1); }
.ds-button--compact  { padding: 4px 10px; font-size: 12px; }
.ds-button:disabled  { opacity: 0.4; cursor: not-allowed; }
```

---

## 8. Story Format

### `Button.stories.tsx` example

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Primitives/Button',
  argTypes: {
    tone:    { control: 'select', options: ['primary', 'secondary', 'danger', 'ghost'] },
    compact: { control: 'boolean' },
    disabled:{ control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story   = { args: { label: 'Start Game', tone: 'primary' } };
export const Secondary: Story = { args: { label: 'Copy Code',  tone: 'secondary' } };
export const Danger: Story    = { args: { label: 'Leave Room', tone: 'danger' } };
export const Ghost: Story     = { args: { label: 'Settings',   tone: 'ghost' } };
export const Compact: Story   = { args: { label: 'Invite',     tone: 'primary', compact: true } };
export const Disabled: Story  = { args: { label: 'Start',      tone: 'primary', disabled: true } };
```

**Story naming convention:**
- `title` uses Storybook's sidebar grouping: `'Category/ComponentName'`
- Categories mirror the `/design` sidebar sections: `Primitives`, `Navigation`, `Layout`, `Game`, `Feedback`

---

## 9. Complete Component Inventory to Migrate

### 9a — Existing primitives (source: `DesignSystemPrimitives.tsx`)
These already exist; they must be moved to `packages/ds` with proper story files.

| Component   | Props (key)                                              | DS class prefix   | Story category |
|-------------|----------------------------------------------------------|-------------------|----------------|
| `DsButton`  | `label`, `tone`, `compact`, `disabled`                   | `ds-button`       | Primitives     |
| `DsBadge`   | `label`, `tone`                                          | `ds-badge`        | Primitives     |
| `DsCard`    | `children`                                               | `ds-card`         | Primitives     |
| `DsField`   | `label`, `value`, `icon?`                                | `ds-field`        | Primitives     |
| `DsListRow` | `title`, `subtitle`, `trailing?`                         | `ds-list-row`     | Primitives     |
| `DsPageHeader`| `title`, `subtitle?`                                   | `ds-page-header`  | Layout         |
| `DsSection` | `title`, `children`                                      | `ds-section`      | Layout         |
| `DsStat`    | `label`, `value`, `delta?`                               | `ds-stat`         | Primitives     |
| `DsTabs`    | `items`, `active`                                        | `ds-tabs`         | Navigation     |
| `DsAlert`   | `tone`, `title`, `description`                           | `ds-alert`        | Feedback       |

### 9b — Room screen components (source: `RoomScreen.tsx`, CSS: `room__*`)
These are currently inline sub-components. Each becomes a standalone DS component with static props (no socket hooks).

| Component              | Key props (static)                                              | Story category |
|------------------------|-----------------------------------------------------------------|----------------|
| `RoomOvalTable`        | `seats: SeatData[]`                                            | Game           |
| `RoomSeatSlot`         | `playerId`, `name`, `isYou`, `isHost`, `isSpeaking`, `avatarUrl?`, `isEmpty` | Game |
| `RoomHeaderDesktop`    | `roomCode`, `playerCount`, `maxPlayers`                        | Layout         |
| `RoomHeaderMobile`     | `roomCode`, `onBack`, `onMenu`                                 | Layout         |
| `RoomDetailsSidebar`   | `roomCode`, `gameMode`, `maxPlayers`, `entryFee`, `hostName`, `voiceEnabled` | Layout |
| `RoomActivityPanel`    | `entries: ActivityEntry[]`, `activeTab: 'activity' | 'chat'` | Feedback       |
| `RoomFriendsPanel`     | `friends: FriendRow[]`                                         | Social         |
| `RoomFooterBar`        | (no required props — static suits/tagline + decorative chips)  | Layout         |
| `RoomPipRow`           | `filled: number`, `max: number`                                | Primitives     |
| `RoomDealerChip`       | (no props — pure decoration)                                   | Game           |
| `RoomRailLight`        | `position: 'tl' | 'tr' | 'bl' | 'br'`                        | Game           |

### 9c — Screen-local layout shells (stay in `packages/web`, do NOT migrate)
These wrap entire screens and depend on screen-level state or routing. They are not DS components.

| Shell                 | Where it lives                      | Why it stays in web       |
|-----------------------|-------------------------------------|---------------------------|
| `AdminLayout`         | `packages/web/src/admin/`           | Depends on admin nav state|
| `LobbyLayout`         | `LobbyScreen.tsx`                   | Depends on game context   |
| Screen root divs      | Each `*Screen.tsx`                  | Route-level containers    |

**Decision rule:** if a component needs `useGame()`, `useVoiceChatContext()`, `useNavigate()`, or any React context from the web app, it stays in `packages/web`. Everything else belongs in `packages/ds`.

---

## 10. The Golden Rule and ESLint Enforcement

### The rule
> **No component that will be reused across two or more screens may be defined inside `packages/web/src/screens/`.**  
> All reusable components live in `packages/ds` and are imported as `@ganatri/ds`.

### ESLint enforcement plan

Add a custom ESLint rule (or use `eslint-plugin-no-restricted-imports`) to `packages/web`:

```js
// packages/web/.eslintrc.cjs
module.exports = {
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          // Screens must not import components from other screens
          group: ['../screens/*', './screens/*'],
          message: 'Import from @ganatri/ds instead of cross-importing between screens.',
        },
      ],
    }],
  },
};
```

Additionally, add a project-convention comment at the top of every `*Screen.tsx`:

```typescript
// SCREEN SHELL: no reusable component definitions here.
// Components → packages/ds | Screens → packages/web/src/screens
```

---

## 11. Migration Path

### Phase A — Package scaffold (do first)
1. Create `packages/ds/` with `package.json`, `tsconfig.json`, `vite.config.ts`.
2. Install Storybook: `npx storybook@latest init` inside `packages/ds`.
3. Create `src/tokens/index.css` with all design tokens extracted from existing CSS.
4. Create `src/index.ts` barrel.
5. Wire `@ganatri/ds: workspace:*` into `packages/web/package.json`.
6. Run `npm install` at workspace root to link the packages.
7. Confirm `import { Button } from '@ganatri/ds'` resolves in `packages/web`.

### Phase B — Migrate existing primitives
For each of the 9 primitives in `DesignSystemPrimitives.tsx`:
1. Create the component directory in `packages/ds/src/components/`.
2. Copy component logic into `ComponentName.tsx`.
3. Move inline styles to `ComponentName.css`, replacing hardcoded values with token variables.
4. Write `ComponentName.stories.tsx` with at least 3 stories covering the main variants.
5. Export from `packages/ds/src/index.ts`.
6. Update `packages/web` imports from `'../design-system/DesignSystemPrimitives'` to `'@ganatri/ds'`.
7. Delete the primitive from `DesignSystemPrimitives.tsx`; when it is empty, delete the file.

### Phase C — Extract room components
For each room component listed in section 9b:
1. Study the component in `RoomScreen.tsx` — identify all props it needs if made static.
2. Create the component in `packages/ds/src/components/`.
3. Strip all React hook calls (`useGame`, `useVoiceChatContext`, etc.) — replace with plain props.
4. Copy the relevant `room__*` CSS classes into `ComponentName.css`, renaming them to `ds-*` BEM convention.
5. Write stories with mock data props.
6. Update `RoomScreen.tsx` to import from `@ganatri/ds` and pass live data as props.
7. Remove the inline sub-component from `RoomScreen.tsx`.

### Phase D — Update `/design` showroom
Update `DesignSystemScreen.tsx` to import from `@ganatri/ds` instead of using inline JSX + raw `room__*` classes. The showroom becomes a consumer of the package, not a definitions file.

### Phase E — ESLint rule + CI gate
Add the `no-restricted-imports` ESLint rule. Add `npm run lint` to CI. Fix any violations.

---

## 12. Storybook Sidebar Structure

The Storybook sidebar mirrors the `/design` page categories, making it easy to navigate between tools:

```
Primitives/
  Button
  Badge
  Alert
  Stat
  Field
  ListRow
  PipRow
Navigation/
  Tabs
  BottomNav
  TopNav
Layout/
  Card
  Section
  PageHeader
  RoomHeaderDesktop
  RoomHeaderMobile
  RoomDetailsSidebar
  RoomFooterBar
Game/
  OvalTable
  SeatSlot
  DealerChip
  RailLight
Feedback/
  ActivityPanel
  InviteToast
  ConnectionBanner
Social/
  FriendsPanel
  InviteRow
Tokens/
  Colours         (visual colour swatches)
  Typography      (type scale preview)
  Backgrounds     (felt, gradient, panel)
```

---

## 13. Development Workflow (After This Phase)

```
1. Product/designer asks for a new UI element.
   ↓
2. Create ComponentName/ in packages/ds/src/components/.
   ↓
3. Write the component (.tsx) + styles (.css using token variables).
   ↓
4. Write stories (.stories.tsx) — at least 3 variants.
   ↓
5. Run Storybook: `npm run storybook` inside packages/ds.
   ↓
6. Iterate on component in Storybook until all variants look correct
   and the a11y addon shows no violations.
   ↓
7. Export from packages/ds/src/index.ts.
   ↓
8. Import into the appropriate screen in packages/web:
   import { ComponentName } from '@ganatri/ds';
   ↓
9. Pass live data / callbacks as props.
   ↓
10. Update DesignSystemScreen.tsx to show the component in the showroom.
    ↓
11. Run `npx tsc --noEmit` + `npm run build` — both must pass.
```

**No step may be skipped.** Step 6 (Storybook approval) is the gate for step 8 (web integration). This is enforced by convention and, eventually, by visual regression CI.

---

## 14. What NOT to Do

| Anti-pattern                                        | Why it is wrong                                          | Correct approach                          |
|-----------------------------------------------------|----------------------------------------------------------|-------------------------------------------|
| Define a component in `*Screen.tsx`                 | Not reusable; no story; untestable in isolation          | Create in `packages/ds`                   |
| Import one screen's component into another screen   | Creates tight coupling between routes                   | Move to `packages/ds`, import from there  |
| Use `room__*` CSS classes in new code               | Those classes are being retired; they live only in the legacy migration period | Use DS component + `ds-*` BEM classes     |
| Use hardcoded hex/rgba in component CSS             | Breaks theming; hard to audit                            | Use `var(--token-name)` from tokens/index.css |
| Write a story with `import './RoomScreen.css'`      | Storybook must be isolated; it cannot depend on web-app CSS | Move needed CSS into the component's own `.css` file |
| Pass `useGame()` return value to a DS component prop| DS components must be dumb (data-in, render-out)        | Unwrap the context in the screen, pass scalars as props |

---

## 15. File Locations Quick Reference

| What                             | Path                                              |
|----------------------------------|---------------------------------------------------|
| DS package root                  | `packages/ds/`                                    |
| Design tokens                    | `packages/ds/src/tokens/index.css`                |
| Component source                 | `packages/ds/src/components/<Name>/<Name>.tsx`    |
| Component CSS                    | `packages/ds/src/components/<Name>/<Name>.css`    |
| Component stories                | `packages/ds/src/components/<Name>/<Name>.stories.tsx` |
| DS barrel export                 | `packages/ds/src/index.ts`                        |
| Storybook config                 | `packages/ds/.storybook/`                         |
| Web app import                   | `import { X } from '@ganatri/ds'`                 |
| Design showroom                  | `packages/web/src/screens/DesignSystemScreen.tsx` |
| Old primitives (to delete)       | `packages/web/src/design-system/DesignSystemPrimitives.tsx` |

---

## 16. Acceptance Criteria for Phase Completion

- [ ] `packages/ds` package exists and resolves as `@ganatri/ds` in the workspace.
- [ ] Storybook runs (`npm run storybook` in `packages/ds`) and shows all migrated components.
- [ ] All 9 existing primitives have stories with ≥3 variants.
- [ ] At least 5 room components have stories.
- [ ] `packages/web` imports all primitives from `@ganatri/ds`, not from `DesignSystemPrimitives.tsx`.
- [ ] `DesignSystemScreen.tsx` imports components from `@ganatri/ds`.
- [ ] `npx tsc --noEmit` passes in both `packages/ds` and `packages/web`.
- [ ] `npm run build -w @ganatri/web` passes.
- [ ] ESLint `no-restricted-imports` rule is active and lint passes.
- [ ] No component definition (function returning JSX) exists inside any `*Screen.tsx` file that is also consumed by another screen.

---

*Last updated: 2026-06-25*
