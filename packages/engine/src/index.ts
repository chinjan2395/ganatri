/**
 * @ganatri/engine — pure, deterministic Ganatri rules engine.
 * Public API per docs/ENGINE_API.md; rule semantics per docs/GAME_RULES.md
 * (including §7 Clarifications).
 */

export { cardId, summationValue } from './cards';
export type { Card, CardId, Rank, Suit } from './cards';

export type {
  GameEvent,
  GameState,
  Move,
  MoveError,
  MoveResult,
  Part1State,
  Part2State,
  Phase,
  PlayerId,
  PlayerView,
  TrickPlay,
} from './types';

export { applyMove, captureOptions, createGame, legalMoves, legalPart2Cards } from './game';
export { captureSetsFor } from './capture';
export { viewFor } from './view';
