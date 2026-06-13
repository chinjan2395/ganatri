import { useEffect, useState } from 'react';
import type { GameEvent } from '@ganatri/engine';
import { useGame } from '../state/GameProvider';
import { OpponentSeat } from '../components/OpponentSeat';
import { Part1Board } from '../components/Part1Board';
import { Part2Board } from '../components/Part2Board';
import { EndScreen } from '../components/EndScreen';
import './GameScreen.css';

function shortId(id: string): string {
  return id.length <= 6 ? id : id.slice(0, 6);
}

type Flash = { kind: 'cut' | 'won' | 'safe'; text: string };

function flashFor(event: GameEvent): Flash | null {
  switch (event.type) {
    case 'CUT':
      return { kind: 'cut', text: `CUT! ${shortId(event.pickerUpper)} picks up ${event.pickedUp.length} cards` };
    case 'TRICK_WON':
      return { kind: 'won', text: `${shortId(event.winner)} wins the trick` };
    case 'PLAYER_SAFE':
      return { kind: 'safe', text: `${shortId(event.player)} is safe` };
    default:
      return null;
  }
}

export function GameScreen(): React.ReactNode {
  const { view, room, session, lastEvent, disconnectedPlayers, makeMove, startGame, leaveRoom } = useGame();
  const [flash, setFlash] = useState<Flash | null>(null);

  // Drive transient Part 2 feedback from the game-event stream.
  useEffect(() => {
    if (!lastEvent) return;
    const f = flashFor(lastEvent);
    if (!f) return;
    setFlash(f);
    const t = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(t);
  }, [lastEvent]);

  if (!view || !session) {
    return (
      <div className="center-screen">
        <div className="spinner" />
        <p className="muted">Loading game…</p>
      </div>
    );
  }

  const isHost = room?.hostId === session.playerId;

  if (view.phase === 'GAME_OVER') {
    return (
      <div className="game">
        <EndScreen
          rankings={view.rankings}
          you={view.you}
          isHost={Boolean(isHost)}
          onPlayAgain={() => {
            void startGame();
          }}
          onLeave={() => {
            void leaveRoom();
          }}
        />
      </div>
    );
  }

  const opponents = view.seating.filter((pid) => pid !== view.you);
  const turnName = view.turn ? (view.turn === view.you ? 'You' : shortId(view.turn)) : '—';

  return (
    <div className="game">
      <header className="game__header">
        <div className="game__phase">{view.phase === 'PART_1' ? 'Part 1 · Capture' : 'Part 2 · Cut'}</div>
        <div className="game__turn">
          Turn: <strong>{turnName}</strong>
        </div>
        {view.phase === 'PART_1' && <div className="game__stock">Stock: {view.stockCount}</div>}
        <button
          className="secondary game__leave"
          onClick={() => {
            void leaveRoom();
          }}
        >
          Leave
        </button>
      </header>

      <section className="game__seats">
        {opponents.map((pid) => {
          const handCount = view.handCounts[pid] ?? 0;
          const captureCount = view.phase === 'PART_1' ? view.captureCounts[pid] ?? 0 : undefined;
          const safeIndex = view.safeOrder.indexOf(pid);
          return (
            <OpponentSeat
              key={pid}
              playerId={pid}
              isYou={false}
              handCount={handCount}
              captureCount={captureCount}
              isTurn={view.turn === pid}
              isSafe={safeIndex >= 0}
              safeRank={safeIndex >= 0 ? safeIndex + 1 : undefined}
              disconnected={disconnectedPlayers.has(pid)}
            />
          );
        })}
      </section>

      <main className="game__board">
        {view.phase === 'PART_1' ? (
          <Part1Board view={view} onMove={makeMove} />
        ) : (
          <Part2Board view={view} flash={flash} onMove={makeMove} />
        )}
      </main>

      <footer className="game__self">
        <OpponentSeat
          playerId={view.you}
          isYou
          handCount={view.handCounts[view.you] ?? view.hand.length}
          captureCount={view.phase === 'PART_1' ? view.captureCounts[view.you] ?? 0 : undefined}
          isTurn={view.turn === view.you}
          isSafe={view.safeOrder.includes(view.you)}
          safeRank={
            view.safeOrder.indexOf(view.you) >= 0 ? view.safeOrder.indexOf(view.you) + 1 : undefined
          }
          disconnected={false}
        />
      </footer>
    </div>
  );
}
