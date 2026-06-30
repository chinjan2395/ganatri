/**
 * Standalone visual preview harness for GameScreen.
 *
 * Renders the real <GameScreen /> with fabricated Part 1 / Part 2 views so the
 * layout can be screenshotted in isolation (no server / multiplayer flow).
 *
 *   /preview.html              → Part 1 (4 players, your turn)
 *   /preview.html?phase=part2  → Part 2 (trick in progress)
 *   /preview.html?players=2    → override player count (2..4)
 *
 * This file and preview.html are dev-only scaffolding.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { cardId, type Card, type Rank, type Suit, type GameEvent } from '@ganatri/engine';
import type { PlayerView } from '@ganatri/engine';
import {
  GameContext,
  GameSessionContext,
  GameRoomContext,
  GameViewContext,
  type GameContextValue,
  type LoggedEvent,
} from './state/GameProvider';
import { GameScreen } from './screens/GameScreen';
import './styles/theme.css';
import './styles/casino.css';

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit });

const PLAYERS = ['you-aa11bb', 'borislav-22', 'anastasia-3', 'dmitri-44cc'];
const NAMES: Record<string, string> = {
  'you-aa11bb': 'You',
  'borislav-22': 'Borislav',
  'anastasia-3': 'Anastasia',
  'dmitri-44cc': 'Dmitri',
};

const params = new URLSearchParams(window.location.search);
const phase = params.get('phase') === 'part2' ? 'PART_2' : 'PART_1';
const playerCount = Math.min(4, Math.max(2, Number(params.get('players') ?? '4')));
const seating = PLAYERS.slice(0, playerCount);
const you = seating[0]!;

const myHandP1: Card[] = [c('A', 'S'), c('7', 'H'), c('10', 'D'), c('3', 'C'), c('K', 'S'), c('5', 'H'), c('9', 'C')];
const tableP1: Card[] = [c('4', 'H'), c('6', 'S'), c('2', 'D'), c('8', 'C'), c('J', 'H')];

const myHandP2: Card[] = [c('A', 'S'), c('K', 'S'), c('9', 'S'), c('Q', 'H'), c('7', 'H'), c('10', 'D'), c('4', 'D'), c('3', 'C')];
const trickP2 = [
  { player: seating[1]!, card: c('6', 'S'), isCut: false },
  { player: seating[2]! ?? seating[0]!, card: c('J', 'S'), isCut: false },
];

const handCounts: Record<string, number> = {};
const captureCounts: Record<string, number> = {};
seating.forEach((p, i) => {
  handCounts[p] = p === you ? (phase === 'PART_2' ? myHandP2.length : myHandP1.length) : [9, 7, 5, 8][i] ?? 6;
  captureCounts[p] = [12, 32, 8, 16][i] ?? 0;
});

const view: PlayerView = {
  phase,
  you,
  seating,
  turn: you,
  hand: phase === 'PART_2' ? myHandP2 : myHandP1,
  handCounts,
  table: phase === 'PART_1' ? tableP1 : [],
  stockCount: phase === 'PART_1' ? 21 : 0,
  captureCounts,
  myCapturedCards: phase === 'PART_1'
    ? [c('Q', 'D'), c('5', 'D'), c('8', 'H'), c('2', 'C'), c('6', 'C'), c('K', 'C')]
    : [],
  trick: phase === 'PART_2' ? trickP2 : [],
  ledSuit: phase === 'PART_2' ? 'S' : null,
  safeOrder: phase === 'PART_2' && seating.length > 2 ? [seating[2]!] : [],
  rankings: null,
  removedCount: phase === 'PART_2' ? 6 : 0,
};

// Captured-card history (Part 1) so the CapturedPile shows content.
const eventLog: LoggedEvent[] = [
  { id: 1, event: { type: 'CAPTURED', player: you, cards: [c('Q', 'D'), c('5', 'D')] } as GameEvent },
  { id: 2, event: { type: 'CAPTURED', player: you, cards: [c('8', 'H'), c('2', 'C'), c('6', 'C')] } as GameEvent },
  { id: 3, event: { type: 'CAPTURED', player: you, cards: [c('K', 'C')] } as GameEvent },
];

void cardId; // keep import if unused after edits

const ctx = {
  connected: true,
  session: { playerId: you, guestToken: 'preview' },
  room: null,
  view,
  turnStartedAt: Date.now(),
  turnTimeoutMs: 10_000,
  eventLog: phase === 'PART_1' ? eventLog : [],
  lastEvent: null,
  disconnectedPlayers: new Set<string>(playerCount === 4 ? [seating[3]!] : []),
  playerNames: NAMES,
  error: null,
  clearError: () => undefined,
  createRoom: async () => ({}) as never,
  joinRoom: async () => ({}) as never,
  leaveRoom: async () => undefined,
  startGame: async () => ({}) as never,
  makeMove: async () => true,
} satisfies Partial<GameContextValue> as unknown as GameContextValue;

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <GameSessionContext.Provider value={{ connected: ctx.connected, session: ctx.session, account: null, guestName: null }}>
        <GameRoomContext.Provider value={{ room: ctx.room, disconnectedPlayers: ctx.disconnectedPlayers, playerNames: ctx.playerNames, playerAvatarUrls: {}, screen: 'main', setScreen: () => undefined }}>
          <GameViewContext.Provider value={{ view: ctx.view, turnStartedAt: ctx.turnStartedAt, turnTimeoutMs: ctx.turnTimeoutMs, eventLog: ctx.eventLog, lastEvent: ctx.lastEvent, latestMatchScoring: [] }}>
            <GameContext.Provider value={ctx}>
              <div className="app-shell">
                <GameScreen />
              </div>
            </GameContext.Provider>
          </GameViewContext.Provider>
        </GameRoomContext.Provider>
      </GameSessionContext.Provider>
    </MotionConfig>
  </StrictMode>,
);
