# Game Screen Redesign — Implementation Plan

**Based on:** Mobile mockup (4-player) + Desktop mockup (2-player)  
**Core principle:** Oval felt table is the visual anchor; everything else orbits it.

---

## What Changes vs. Current

| Area | Current | Target |
|---|---|---|
| Layout | 4-row grid (HUD → players → board → hand) | Table-centric: oval fills center, sidebars flank |
| Table | Flat flex container | CSS oval with gold rim, watermark, dealer chip |
| Opponents | Horizontal row of seat cards | Positioned top-left / top-center / top-right around table |
| Your hand | Fan overlap (Part 1) / drag grid (Part 2) | Two stacked rows, ~65% overlap — handles 20+ cards |
| Deck | Inside HUD pill | Left mini-sidebar beside table |
| Cuts / Claim Capture | Action bar at bottom | Right mini-sidebar beside table |
| Bottom nav | None | Chat / Score / History / More tabs (mobile) |
| Desktop layout | Same as mobile | 3-column: left panel + center + right panel |

---

## Phase 1 — `GameTable` Oval Component *(new)*

**Files:** `components/GameTable.tsx`, `components/GameTable.css`

### Shape & Style
- Wide oval: `border-radius: 48%` on a container `~90vw` wide, `~48vw` tall on mobile
- **Border:** 4px gold rim (`var(--gold)`) + inner glow shadow
- **Felt interior:** Radial gradient (`#1a6b3a` center → `#0d3d20` edges)
- **Watermark:** Ganatri spade/crest SVG at 8% opacity, vertically centered
- **Label:** `"Opponent's cards"` dark pill floating at top-center inside oval
- **Dealer chip:** Gold `"D"` circle pinned to bottom-center inside oval
- **Status pill:** `"Your turn ●"` positioned just below the oval (outside)

### What Goes Inside
Part1Board and Part2Board render inside unchanged — no modifications to board components needed.

---

## Phase 2 — Stacked Hand for 20+ Cards *(modify existing)*

**Files:** `components/Hand.tsx`, `components/Hand.css`

### Two-Row Stacked Layout

Cards sorted by suit color, split into two rows:
```
Row 1: ♣ Clubs + ♠ Spades  (sorted A→2 or 2→A)
Row 2: ♥ Hearts + ♦ Diamonds (sorted A→2 or 2→A)
```

**Overlap logic:**
- Each card peeks: `--card-stack-peek: clamp(18px, 5vw, 24px)`
- Overlap = ~65% of card width — rank numeral + suit pip in top-left corner remain visible
- Last card in each row shows fully
- Hover: `translateY(-14px)` lift on hovered card and those after it

**New CSS variables:**
```css
--card-stack-peek: clamp(18px, 5vw, 24px);
--card-stack-hover-lift: -14px;
```

### Arc Decoration (mobile only)
3 face-down cards on each side of the player avatar, purely decorative:
- Angles: `±15°`, `±30°`, `±45°` via CSS `rotate()`
- No JS, no interactivity — just `opacity: 0.7` card backs

### Activation
- Always use stacked rows when `hand.length > 12` OR in Part 2
- Keep existing fan for `hand.length ≤ 12` in Part 1

---

## Phase 3 — Player Positioning Around the Table *(modify existing)*

**Files:** `GameScreen.tsx`, `GameScreen.css`, `OpponentSeat.tsx`, `OpponentSeat.css`

### Mobile — Opponents Ring the Table

| Player count | Layout |
|---|---|
| 1 opponent | top-center |
| 2 opponents | top-left, top-right |
| 3 opponents | top-left, top-center, top-right |

Each opponent seat gets a **card fan decoration** — 3–5 face-down mini cards behind the avatar in CSS:
```css
.seat__fan-card:nth-child(1) { transform: rotate(-20deg) translateY(4px); }
.seat__fan-card:nth-child(2) { transform: rotate(-10deg) translateY(2px); }
/* etc. */
```
The actual hand count number still shows as a badge.

### Your Avatar
- Moves from inside the seat row to a **centered position between table and hand rows**
- Gold glow ring: `box-shadow: 0 0 0 3px var(--gold), 0 0 20px rgba(231,195,74,0.4)`
- Size: 64px circle
- Shows "YOU" label + card count below

---

## Phase 4 — New `GameScreen` Layout Shell *(modify existing)*

**Files:** `GameScreen.tsx`, `GameScreen.css`

### Mobile Layout (< 768px)

```
┌────────────────────────────────────────┐
│  ≡  │  PART 2 CAPTURE  │ GANATRI │ ← Leave  │  TopBar (auto)
├──────┬──────────────────────────┬───────┤
│DECK  │ ┌────── Oval ──────┐    │ CUTS  │
│ 68   │ │ Opponent's cards │    │ 0/3   │  Game area (1fr)
│[Auto]│ │  [table cards]   │    │[Claim]│
│[Sort]│ │  watermark  D    │    │       │
│      │ └──────────────────┘    │       │
├──────┴────── your avatar ──────┴───────┤
│         arc decor  YOU  arc decor      │  Hand section (auto)
│      ──── stacked hand row 1 ────      │
│      ──── stacked hand row 2 ────      │
├────────────────────────────────────────┤
│  Chat  │  Score  │  History  │  More   │  BottomNav (auto)
└────────────────────────────────────────┘
```

- Left sidebar: `64px` fixed width — Deck + Auto Arrange + Sort
- Right sidebar: `64px` fixed width — Cuts counter + Claim Capture
- Table oval: `flex: 1` fills center

### Desktop Layout (≥ 768px)

```
┌─────────────┬────────────────────────────┬─────────────┐
│ Left Panel  │  TopBar                    │ Right Panel │
│  (240px)    ├────────────────────────────┤  (240px)    │
│             │  Opponent seats row        │             │
│  Room Info  │  ┌──── Oval Table ────┐   │ Current     │
│  Players    │  │  opponent cards    │   │ Turn        │
│  Chat       │  │  watermark   D     │   │ ──────────  │
│             │  └────────────────────┘   │ Deck        │
│             │  Your avatar + name        │ ──────────  │
│             │  Stacked hand rows         │ Actions     │
│             │                            │ ──────────  │
│             │                            │ Voice Chat  │
│             │                            │ ──────────  │
│             │                            │ History     │
└─────────────┴────────────────────────────┴─────────────┘
```

Left panel collapsible via hamburger (slides off-canvas).

---

## Phase 5 — Mobile Sidebar Panels *(new)*

**Files:** `components/MobileLeftPanel.tsx`, `components/MobileRightPanel.tsx`

### Left Panel (beside oval, 64px wide)
- Deck: face-down card back image + count number
- Auto Arrange: toggle pill (green = ON)
- Sort: small button with filter icon

### Right Panel (beside oval, 64px wide)
- Cuts counter: `X / 3` with label
- Claim Capture button (disabled when not eligible; Part 1 only)

---

## Phase 6 — Desktop Right Sidebar *(new)*

**File:** `components/RightSidebar.tsx`

Collapsible sections:
1. **Current Turn** — avatar + name + `YOU` badge
2. **Deck** — card back + count
3. **Actions** — Sort Hand toggle, Auto Arrange toggle, Claim Capture button
4. **Voice Chat** — mic/speaker/PTT + volume slider
5. **Game History** — scrollable log, 10 entries visible

---

## Phase 7 — Bottom Nav (Mobile) *(new)*

**File:** `components/BottomNav.tsx`

```
│  💬 Chat  │  🏆 Score  │  🕐 History  │  ••• More  │
```

- Fixed bottom, dark background with gold top border + blur backdrop
- Each tab opens a **slide-up sheet** (`transform: translateY(0) ↔ translateY(100%)`)
- Chat sheet: message list + input
- Score sheet: current round scores per player
- History sheet: game event log
- More sheet: settings, leave room

---

## Phase 8 — Top Bar Redesign *(modify existing)*

**New file:** `components/TopBar.tsx` (extracted from GameScreen HUD)

### Mobile
```
[ ≡ ]  [ PART 2 CAPTURE ]  [ GANATRI logo ]  [ → Leave Room ]
```

### Desktop
```
[ PART 1 CAPTURE ]  [ ████ 8s ]  [ 🎤 ] [ 🔊 ] [ PTT ]          [ → Leave Room ] [ ⚙ ]
```

---

## Build Order & Parallelism

```
Phase 1: GameTable oval       ─┐
Phase 2: Stacked hand          ├─ PARALLEL (independent)
Phase 8: TopBar extract        ─┘

Phase 3: Player positions      ← needs Phase 1 done
Phase 4: Layout shell          ← needs Phases 1 + 2 + 3
Phase 5: Mobile sidebars       ← needs Phase 4
Phase 6: Desktop right panel   ← needs Phase 4
Phase 7: Bottom nav            ← needs Phase 4
```

---

## Design Token Additions

```css
/* Add to theme.css */
--oval-border: 4px solid var(--gold);
--oval-glow: 0 0 24px rgba(231,195,74,0.25), inset 0 0 40px rgba(0,0,0,0.3);
--card-stack-peek: clamp(18px, 5vw, 24px);
--card-stack-hover-lift: -14px;
--sidebar-mobile-w: 64px;
--sidebar-desktop-w: 240px;
--bottom-nav-h: 56px;
```

---

## Files Touched Summary

| File | Change type |
|---|---|
| `screens/GameScreen.tsx` | Modify — new layout, extract TopBar, add sidebars |
| `screens/GameScreen.css` | Modify — new grid, mobile/desktop breakpoints |
| `components/Hand.tsx` | Modify — add stacked rows mode, arc decoration |
| `components/Hand.css` | Modify — stack peek variables, row layout |
| `components/OpponentSeat.tsx` | Modify — add card fan decoration prop |
| `components/OpponentSeat.css` | Modify — fan card styles |
| `components/GameTable.tsx` | **New** — oval table wrapper |
| `components/GameTable.css` | **New** |
| `components/TopBar.tsx` | **New** — extracted + redesigned HUD |
| `components/MobileLeftPanel.tsx` | **New** — deck/auto-arrange/sort |
| `components/MobileRightPanel.tsx` | **New** — cuts/claim |
| `components/RightSidebar.tsx` | **New** — desktop right panel |
| `components/BottomNav.tsx` | **New** — mobile tab nav |
| `styles/theme.css` | Modify — new design tokens |
