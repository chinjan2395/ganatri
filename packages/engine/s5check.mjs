import { createGame, applyMove, legalMoves } from './src/game.ts';
let state = createGame(['a','b','c'], 's5');
let n=0;
while (state.phase !== 'GAME_OVER') {
  if (++n > 5000) { console.log('LOOP DETECTED, phase=', state.phase, 'safe=', JSON.stringify(state.part2?.safeOrder)); break; }
  const moves = legalMoves(state, state.turn);
  const res = applyMove(state, state.turn, moves[0]);
  if (!res.ok) throw new Error(res.error);
  state = res.state;
}
console.log('done in', n, 'moves, phase=', state.phase);
