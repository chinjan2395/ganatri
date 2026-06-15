# Ganatri — Calculations & Flow Reference (Single Source of Truth)

> **Last updated:** 2026-06-15 (§4.5 outcome rule made explicit; §4.6 confirmed multi-player via sim)
>
> **Purpose.** This document is the **one place** that explains *how every calculation, flow
> decision, and rule resolution is actually computed* in Ganatri. When you need to change a
> rule, a calculation, or a flow, change it here first (or in lockstep), then update the code
> and tests it points to. Nothing about scoring, capturing, turn order, or win conditions
> should be "figured out from the code" — it should be readable here.
>
> **Relationship to other docs:**
> - `docs/GAME_RULES.md` — *what* the rules are (player-facing, authoritative for intent, incl. §7 Clarifications).
> - `docs/ENGINE_API.md` — the *public type/function contract* of the engine.
> - **`docs/CALCULATIONS.md` (this file)** — *how* the rules become deterministic computations, with the exact code locations and worked examples.
>
> **Golden rule:** all game math lives in `packages/engine`. The server (`packages/server`)
> and client (`packages/web`) never compute rules — they call the engine and render/relay its
> output. If you find rule logic outside `packages/engine`, that is a bug to fix here.

---

## 0. Code map — where each calculation lives

| Concern | File | Key symbol(s) |
|---|---|---|
| Card model, ids, summation value, deck | `packages/engine/src/cards.ts` | `SUITS`, `RANKS`, `cardId`, `parseCardId`, `summationValue`, `buildDeck` |
| Seeded RNG + shuffle | `packages/engine/src/rng.ts` | `createRng`, `shuffle` |
| Part 1 capture-set computation | `packages/engine/src/capture.ts` | `captureSetsFor`, `maxDisjointUnions` |
| Game creation, move application, Part 1/2 flow, win conditions, legality | `packages/engine/src/game.ts` | `createGame`, `applyMove`, `captureOptions`, `legalPart2Cards`, `legalMoves`, plus internal helpers |
| Per-player redaction (what clients see) | `packages/engine/src/view.ts` | `viewFor` |
| Public types | `packages/engine/src/types.ts` | `GameState`, `Part1State`, `Part2State`, `Move`, `GameEvent`, … |
| Client event processing, trick-reveal freeze | `packages/web/src/state/GameProvider.tsx` | `onGameEvent`, `onStateUpdate`, `makeMove`, `trickFreezeUntilRef` |

Tests that pin these behaviours live in `packages/engine/tests/` (see §9).

---

## 1. Card values & primitives

Defined in `cards.ts`.

- **Suits:** `S H D C` (♠ ♥ ♦ ♣). "Color" in the rules always means **suit**.
- **Ranks:** `A 2 3 4 5 6 7 8 9 10 J Q K`.
- **Card id:** `` `${rank}${suit}` `` — e.g. `10H`, `AS`, `KC`. Unique within one 52-card deck. This is the only identity used across engine/server/client.

### 1.1 Summation value (`summationValue`) — used in **Part 1 only**

```
A      → 1
2..10  → face value (Number(rank))
J,Q,K  → null   (no numeric value; never participate in sums)
```

- A *played* Ace is treated specially (rank-match only, never sums — see §3.3), but a *table* Ace still contributes **1** to other ranks' summation captures. `summationValue` returns `1` for Ace; the "played Ace doesn't sum" behaviour is enforced in `captureSetsFor`, not here.
- `null` means "cannot appear in any sum". J/Q/K on the table are inert for summation.

### 1.2 Part 2 rank order (`RANK_ORDER` in `game.ts`)

Trick strength: **A > K > Q > J > 10 > 9 > … > 3 > 2.**

```
2=2 3=3 4=4 5=5 6=6 7=7 8=8 9=9 10=10 J=11 Q=12 K=13 A=14
```

Higher number beats lower. This ordering is used **only** to decide trick winners and cut pick-up holders in Part 2. It is unrelated to `summationValue` (Part 1). Suit is irrelevant to strength except that only **led-suit** cards can win (§4.3).

---

## 2. Game creation, shuffle & determinism

`createGame(seating, seed)` in `game.ts`.

1. **Validate seating:** must be 2–4 players, all unique, else throw.
2. **Seeded RNG:** `createRng(seed)` (`rng.ts`) builds a deterministic stream via `xmur3(seed)` → `mulberry32`. **The same seed always replays the same game** (shuffle + first-player pick). This is what makes the engine reproducible and testable.
3. **Shuffle:** Fisher–Yates (`shuffle`) over `buildDeck()` (52 cards, fixed canonical pre-shuffle order), producing a new array (input untouched).
4. **Deal:** `HAND_SIZE = 5` cards to each player **in seating order** (player 0 gets cards `[0,5)`, player 1 `[5,10)`, …).
5. **Stock:** all remaining cards after dealing, face down.
   - 2 players → 42 in stock; 3 → 37; 4 → 32.
6. **First player:** `seating[floor(rng() * n)]` — drawn from the *same* seeded stream **after** the shuffle. **This player leads both Part 1 and Part 2** (`firstPlayer` field; see §4.1 for the Part 2 first-lead caveat).
7. Initial state: `phase = PART_1`, `turn = firstPlayer`, empty `table`, empty `capturePiles`, `lastCapturer = null`.

> **Determinism contract:** any change to `buildDeck` order, the shuffle, or the first-player draw will change every seeded test. Keep RNG draws in this exact order (shuffle first, then first-player).

---

## 3. Part 1 — Capture / Summation calculations

This is the most intricate calculation in the game. The authoritative algorithm is
`captureSetsFor(played, table)` in `capture.ts`; move legality and state changes are in
`applyMove` (`game.ts`).

### 3.1 What a "legal full capture set" is

For a played card, a legal full capture set =

```
ALL same-rank table cards (mandatory; outside the 3-card combo limit)
  ∪
one selection of disjoint summation combinations that achieves the
MAXIMUM possible NUMBER of combinations,
  where each combination is 2–3 table cards summing exactly to the played value.
```

(Rules: `GAME_RULES.md` §3 + §7 Clarifications 1–4.)

Key consequences baked into the code:
- A single table card equal to the played value is the **same-rank case**, never a "combination". Combinations are always **2 or 3 cards**.
- The same-rank cards do **not** count toward the 3-card combination limit (Clarification 1).
- **All** same-rank table cards are captured, not just one (Clarification 2).
- Maximality is measured in **number of combinations**, not number of cards (Clarification 3).

### 3.2 Algorithm walkthrough (`captureSetsFor`)

```
1. sameRankIds = every table card whose rank == played.rank          (mandatory)
2. v = summationValue(played)

3. If v is null (J/Q/K) OR played.rank == 'A':
       → rank-match only. Return [sameRankIds] if non-empty, else [].
       (Played A/J/Q/K NEVER sum — Clarifications 2 & 4.)

4. Otherwise (played is 2..10):
   pool = table cards that are NOT same-rank AND have a numeric value
          (table A counts as 1; table J/Q/K excluded because value is null)
   Enumerate every 2-card and 3-card subset of the pool summing exactly to v.
   If no combos exist → return [sameRankIds] if non-empty else [].
   Else compute maxDisjointUnions(combos) and prepend sameRankIds to each.
```

Notes:
- Same-rank cards are deliberately **excluded from the summation pool**: since each is worth `v`, `v + anything > v`, so they can never be part of a valid combination anyway. They are added back as the mandatory prefix.
- Output options are **deduplicated by resulting card set** (different partitions that yield the same set of cards collapse to one option).
- Empty result ⇒ no capture is possible; the only legal move is `capture: []` (card stays on the table).

### 3.3 Played A / J / Q / K (no summation)

- **J, Q, K:** `summationValue` is `null` → step 3 → capture same-rank table cards only.
- **Ace:** even though its value is 1, a *played* Ace is forced into the rank-match-only branch (`played.rank === 'A'` guard in step 3). It captures only table Ace(s), never sums.
- If no same-rank card is on the table, these cards capture nothing and stay on the table.

### 3.4 Maximal disjoint combination selection (`maxDisjointUnions`)

When the played card is numeric and combinations exist, we must take the **maximum number of
disjoint combinations** at once. `maxDisjointUnions` does a DFS over all combos:

- It tracks `chosenCount` (number of combos picked) and the union of their card indices.
- **Pruning:** `if (chosenCount + remainingCombos < best) return;` — abandon branches that cannot match the best count found so far.
- It records the union of card indices for every selection achieving `best` combinations.
- Finally it **dedupes unions by card-set** (different orderings/partitions of the same cards = one option).

**Player choice:** when several *distinct maximal sets* exist, each is returned as a separate
option and the **player chooses** (the UI highlights them). The engine does not pick for them.

### 3.5 Worked examples (mirrors GAME_RULES.md §3 / §7 #3)

| Table | Played | Result |
|---|---|---|
| 2,5,6,8,9 | 7 | one combo {2,5}. Captures 2+5 +7. |
| 2,5,6,8,9 | 8 (and no table 8) | {2,6}. (Same-rank rule would also force any table 8.) |
| 1,2,3,5,6,7,10 | 6 | three-card combo {1,2,3} is one option; {1,5} and others also sum to 6 → engine returns all maximal selections. |
| 1,2,3,4 | 6 | {1,2,3} or {2,4} — each is **one** combination, so both are maximal (count = 1). Player chooses. |
| has a 7, table also has another 7 | 7 | the table 7 is captured as **same-rank** (mandatory), *plus* any 2–3 card combos summing to 7, maximised. |

### 3.6 Applying a Part 1 move (`applyMove`, `PLAY_CAPTURE`)

Validation order (each failure returns `{ ok:false, error, message }`):

1. `WRONG_PHASE` — not Part 1.
2. `NOT_YOUR_TURN` — `state.turn !== player`.
3. `CARD_NOT_IN_HAND` — played card id not in the player's hand.
4. `INVALID_CAPTURE` — the `capture` array contains **duplicate ids**.
5. If `capture` is empty **but** at least one capture option exists → `CAPTURE_REQUIRED` (capturing is mandatory).
6. If `capture` is non-empty but doesn't exactly match one of `captureSetsFor`'s options (order-insensitive via `setKey`) → `INVALID_CAPTURE`.

On success:
- **Capture branch:** captured table cards + the played card go to `capturePiles[player]`; those cards leave the table; `lastCapturer = player`. Emits `CARD_PLAYED` + `CAPTURED`.
- **No-capture branch:** the played card is appended to the table. Emits `CARD_PLAYED` only.
- **Draw:** if `stock` is non-empty, draw 1 card (hand returns toward 5); emit `CARD_DRAWN` (identity redacted). When stock is empty, no draw.
- **Turn advance:** `nextWithCards` → next clockwise player whose hand is non-empty.
- If **all hands are empty** after the move → Part 1 ends (§3.7).

### 3.7 End of Part 1 (`endPart1`)

1. **Table sweep:** remaining table cards go to `lastCapturer`'s capture pile.
   - If `lastCapturer === null` (**nobody captured all game**, Clarification 5) → table cards are **discarded** (enter nobody's Part 2 hand).
   - Emits `PART1_ENDED` with `sweeper` (null ⇒ discarded) and `swept` cards.
2. **Build Part 2 hands:** each player's capture pile becomes their Part 2 hand.
3. **Determine safe-from-start players:** anyone with an empty pile (captured nothing) is immediately safe. They are added to `safeOrder` in **seating order starting from `firstPlayer`** (`rotateFrom`), and each gets a `PLAYER_SAFE` event (Clarifications 7→ranking, 9).
4. **Immediate game-over check:** let `holders` = players who hold cards (rotated order).
   - `holders.length === 1` → that player **loses immediately**; `rankings = [...safeOrder, loser]`.
   - `holders.length === 0` → **no loser**; `rankings = safeOrder`.
   - In both cases phase → `GAME_OVER`, emit `GAME_OVER`.
5. Otherwise phase → `PART_2`, and **first lead = `holders[0]`** — i.e. `firstPlayer` if they hold cards, else the next clockwise holder (Clarification 9; the rotation guarantees index 0 is correct).

---

## 4. Part 2 — Trick / Cut calculations

Authoritative logic: `applyTrick`, `resolveCut`, `resolveTrickWon`, `resolveGameOver` in
`game.ts`. Move type is `PLAY_TRICK`.

### 4.1 First lead

Set during `endPart1` (§3.7 step 5): `firstPlayer` if they captured cards, otherwise the next
clockwise player who holds cards. Players with zero captures are safe before a card is played.

### 4.2 Playing to a trick — follow-suit & cut detection

In `applyTrick`:

- **Leader** (`trick.length === 0`): any card is legal; the card's suit becomes `ledSuit`.
- **Follower:**
  - If the player **has** a led-suit card but plays a different suit → `MUST_FOLLOW_SUIT` (rejected).
  - If the player **has no** led-suit card → the played card is a **cut** (`isCut = true`), regardless of suit.
  - Otherwise (follows suit) → normal play.

`legalPart2Cards` exposes the same filter for UI highlighting and server validation: led-suit
cards only if you hold any, else your whole hand (cut allowed).

### 4.3 Trick won — all active players followed suit (`resolveTrickWon`)

Triggered when every **active** (non-safe) player has played to the trick and **no cut occurred**.

- **Winner:** the **highest** `RANK_ORDER` card **among led-suit cards** in the trick. (Off-suit cards cannot win; in a no-cut trick everyone followed suit anyway.)
- **Cancellation:** all played cards leave play. **Today** they are removed permanently; **once §4.6 ships** they move to the Part 2 `removedPool` (recoverable only via stalemate redistribution) and `cutStreak` resets to 0. Emit `TRICK_WON { winner, cancelled }`.
- **Safe tracking:** any player whose hand became empty *on this trick* is added to `safeOrder`, **in the order they played in the trick** (Clarification 10). Each emits `PLAYER_SAFE`.
- **Next lead:** the winner leads. If the winner just emptied their hand (now safe), the lead passes **clockwise to the next non-safe player** (`nextNonSafeClockwise`; Clarification 8).
- Then the game-over check (§4.5) runs.

> Single-active-player edge: if the leader is the *only* active player, the trick completes
> immediately as "won" (nobody else to follow).

### 4.4 Cut — a follower has no led-suit card (`resolveCut`)

A cut **ends the trick immediately** — players after the cutter do **not** play (so at most one
cut per trick; Clarification 7).

- **Picker-upper:** the holder of the **highest led-suit card currently on the table** (max `RANK_ORDER` among `ledSuit` cards in the trick). That player **picks up ALL trick cards** into their hand. Emit `CUT { cutter, pickerUpper, pickedUp }`.
  - Defensive guard: if somehow no led-suit card is present (cannot happen in a valid game — the leader always sets the led suit), the cutter keeps the cards.
- **Safe tracking:** trick participants (excluding the picker-upper, who just *gained* cards) whose hands are now empty are added to `safeOrder`. Each emits `PLAYER_SAFE`.
- **Trick reset:** `trick = []`, `ledSuit = null`.
- **Next lead:** the **cutter** leads next. If the cutter just emptied their hand, lead passes clockwise to the next non-safe player (`nextNonSafeClockwise`; Clarification 8).
- Then the game-over check (§4.5) runs.

### 4.5 Game-over & rankings (`resolveGameOver`)

> **The core outcome rule (all player counts, 2–4):** play **continues** until **exactly one
> player still holds cards** — that player is the **loser** (ranked last). Everyone else is
> ranked by the **order they emptied their hands** (earliest = best). The game is **never**
> decided when only the *first* player empties; with 3–4 players it keeps going through the
> middle finishers. Termination is guaranteed *except* in a no-cancellation stalemate among the
> surviving active players — see §4.6 (confirmed to occur in 3–4 player games too, not only
> standalone 2-player games).

Checked after every resolved trick or cut. Let `activeAfter` = players not in `safeOrder`.

- `activeAfter.length === 1` → that player is the **loser**; `rankings = [...safeOrder, loser]`.
- `activeAfter.length === 0` → **no loser** (the final players emptied simultaneously); `rankings = [...safeOrder]`.
- Phase → `GAME_OVER`, `turn = null`, emit `GAME_OVER { rankings }`.

**Ranking semantics (`rankings` array = best → worst):**
- Players safe from the start of Part 2 (zero captures) rank first, ordered by seating from `firstPlayer`.
- Then players in the order they emptied their hands (`safeOrder`).
- The single remaining holder (if any) is last = **the loser**.
- Simultaneous finishes on one trick are ordered by play order within that trick; if the **final two** empty together, there is **no loser** (Clarification 10).

---

## 4.6 Part 2 stalemate redistribution — **PLANNED (not yet implemented)**

> **Status:** designed, **not yet built**. This section is the authoritative spec; the engine,
> types, events, and tests in §0/§8/§9 must be added to match it. Defaults marked **(tunable)**
> are engineering decisions open to confirmation; everything else is fixed rule intent.

### The gap this closes

A cut never cancels cards — cancellation requires **every** active player to follow suit
(§4.3). In a **2-player** Part 2 where the two hands share **no suit**, *every* trick resolves
as a cut: the leader plays the led suit, the other player has none of it and cuts, and the
highest led-suit holder picks the cards back up. Cards only shuffle between the two hands and no
hand is guaranteed to ever reach empty, so the round can **loop forever** — neither
`resolveTrickWon` (never reached) nor `resolveGameOver` (never reached) terminates it.
**This is confirmed to also occur in 3–4 player games**, not only standalone 2-player ones:
once the earlier finishers go safe and the table reduces to a non-cancelling active subset
(e.g. 3-player seed `s5` reduces to two players who keep cutting), the same loop appears and the
game never reaches `GAME_OVER` to declare the loser. The mechanic below is therefore defined
over the **currently-active player subset**, for any starting player count. Note the loop can
arise even when the survivors *nominally share a suit* (unlucky/greedy play), which is why the
trigger below counts **consecutive cuts** rather than testing for a shared suit — a
shared-suit test would miss seed `s5`.

### The fix (rule)

When the table detects a run of cuts with no cancellation (a stalemate), **top every active
player's hand back up to 5 cards** from a reshuffled pool of the cards that have left play, then
resume. Example (the owner's wording): a player holding 2 cards receives 3; a player holding 3
receives 2 — both end at 5.

### Trigger — consecutive no-cancel cuts (owner's choice)

A counter `cutStreak` (new `Part2State` field, see below) tracks **consecutive tricks that
resolved as a cut with no cancellation**:

- `resolveCut` increments `cutStreak`.
- `resolveTrickWon` (a cancellation happened) resets `cutStreak = 0`.

When `cutStreak` reaches `CUT_STALEMATE_THRESHOLD`, redistribution fires **before** the next
lead. **(tunable)** Default `CUT_STALEMATE_THRESHOLD = number of currently-active players,
minimum 2` (so for the canonical 2-player case it fires after **2** back-to-back cuts). Set high
enough that ordinary cut-and-recover sequences — where a cutter's hand actually shrinks toward
empty — still reach a natural game-over first.

Redistribution only proceeds if it can make progress: **≥ 2 active players** still hold cards
and the source pool is non-empty (see exhaustion fallback below).

### Source of the top-up cards — the removed pool (owner's choice)

Part 2 has no stock, so top-up cards come from a **reshuffled pool of cards that have left
play**, kept in a new field `removedPool` (new `Part2State` field):

- Seeded at Part 1 end with any **discarded** cards (the no-capturer case, §3.7 — these enter
  nobody's hand).
- Appended with **every cancelled trick's cards** (§4.3). 

> **This changes the §4.3 "permanently removed" semantics.** Cancelled cards are no longer gone
> forever — they move to `removedPool` and can re-enter play **only** via a redistribution.
> Update §4.3's wording when this ships: "cancelled → moved to `removedPool`" rather than
> "removed permanently." Everything stays inside a single 52-card deck; no new/duplicate cards
> are ever introduced.

### Redistribution algorithm (`redistributeHands`, new in `game.ts`)

```
1. Reshuffle removedPool with a SEEDED RNG (determinism — see note below).
2. Deal round-robin, one card at a time, clockwise starting from the current leader,
   to each active (non-safe) player whose hand size < 5, until either:
     - every active player has 5 cards, or
     - the pool is exhausted.
   Players already holding ≥ 5 cards are skipped and NOT trimmed
   ("make total = 5" is a floor/top-up, not a cap). (tunable interpretation)
3. Reset cutStreak = 0, trick = [], ledSuit = null.
4. The CURRENT leader continues (owner's choice): they lead a fresh trick.
   safeOrder and rankings are unchanged.
5. Emit HANDS_REDISTRIBUTED (new event).
```

**Pool-exhaustion fallback:** if `removedPool` cannot bring everyone to 5, deal round-robin
until it is empty (best-effort top-up). If the pool is entirely empty when the stalemate fires
(nothing was ever discarded or cancelled — possible only if no cancellation has ever occurred),
no redistribution is possible: declare the deadlocked active players a **draw** — `rankings =
[...safeOrder]` with **no loser**, phase → `GAME_OVER` (consistent with §4.5's
zero-active outcome). **(tunable)**

### Determinism requirement

`applyMove` is currently pure with no access to the seed, but redistribution must shuffle
deterministically (the determinism contract, §2). Required state additions to support this:

- Thread the game `seed` through to Part 2 (e.g. store it on `GameState`), and
- Keep a `redistributionCount` (new `Part2State` field, starts 0, increments per redistribution)
  so each redistribution derives a distinct sub-seed, e.g. `createRng(`${seed}#redeal${n}`)`.

Same seed + same moves ⇒ same redistributions, so all seeded tests stay reproducible.

### Required additions (must land together)

- **`types.ts`** — `Part2State` gains `removedPool: readonly Card[]`, `cutStreak: number`,
  `redistributionCount: number`; `GameState` gains `seed` (or equivalent); new `GameEvent`
  `HANDS_REDISTRIBUTED` (see §8).
- **`game.ts`** — seed `removedPool` in `endPart1`; append cancelled cards in `resolveTrickWon`;
  increment/reset `cutStreak`; new `redistributeHands`; threshold check after `resolveCut`.
- **`view.ts`** — expose `removedPool` as a **count only** (`removedCount`), never identities
  (§7). A client may see card identities only for cards dealt **into its own** hand.
- **Tests** — new `redistribution.test.ts` (see §9).
- **`GAME_RULES.md`** — add as §7 Clarification #11 (player-facing rule), and **`ENGINE_API.md`**
  for the new types/event.

---

## 5. Turn-order helper functions (`game.ts`)

| Helper | Used by | Behaviour |
|---|---|---|
| `nextWithCards(seating, from, hands)` | Part 1 turn advance | Next clockwise player with a non-empty hand. Throws if all empty (caller must have handled end-of-part). |
| `rotateFrom(seating, from)` | `endPart1` | Seating rotated so `from` is index 0 — used to order safe-from-start players and pick the first Part 2 lead. |
| `nextActivePart2(seating, from, safeOrder)` | Part 2 follower/leader advance | Next clockwise non-safe player; returns `from` if it's the only active player. |
| `nextNonSafeClockwise(seating, from, safeOrder)` | After a winner/cutter goes safe | First non-safe player strictly **after** `from`. Throws if all safe (game-over must be checked first). |

All turn movement is **clockwise** = increasing index in `seating` (mod n).

---

## 6. Legality helpers (validation + UI)

- `captureOptions(state, card)` — thin wrapper over `captureSetsFor` for the current Part 1 table. Returns `[]` outside Part 1 or for unparseable ids. The UI uses it to highlight selectable combinations; the server uses it to validate `PLAY_CAPTURE.capture`.
- `legalPart2Cards(state, player)` — follow-suit filter (§4.2). `[]` if not this player's turn / not active / wrong phase.
- `legalMoves(state, player)` — exhaustive list of every legal `Move` right now (used by tests/bots and server validation). Empty unless it's the player's turn.

> The **client submits its chosen capture set explicitly**; the server re-validates against the
> same `captureOptions` the UI used. The engine is authoritative — the client never decides
> legality.

---

## 7. Redaction — what each client may see (`viewFor`)

`viewFor(state, player)` builds the only object the server is allowed to send a client:

- **Visible:** your own hand; `seating`; `turn`; the Part 1 `table`; `ledSuit`; current `trick`; `safeOrder`; `rankings`; `phase`.
- **Counts only (never identities):** opponents' hand sizes (`handCounts`), Part 1 capture-pile sizes (`captureCounts`), `stockCount`.
- `myCapturedCards` exposes only **your own** Part 1 capture pile (opponents see counts only).
- Hidden entirely: other players' cards, the stock contents, the full `GameState`.

> **Security/integrity rule:** never send `GameState` to a client. Always go through `viewFor`.
> `CARD_DRAWN` events deliberately redact the drawn card's identity.

---

## 8. Events (engine → server → client), for reference

`applyMove` returns `events` for the client to animate. They are descriptive, **not** a second
source of truth — state is. See `types.ts` `GameEvent`:

`CARD_PLAYED`, `CAPTURED` (includes the played card), `CARD_DRAWN` (identity redacted),
`PART1_ENDED` (`sweeper` null ⇒ discarded), `TRICK_WON`, `CUT`, `PLAYER_SAFE`, `GAME_OVER`.

**Planned (with §4.6):** `HANDS_REDISTRIBUTED { dealt: Record<PlayerId, number>; poolRemaining: number }`
— announces a stalemate top-up. Per-player **counts only**; a client learns the identities of
cards dealt to it via the next `viewFor` (its own hand), never opponents' or pool cards (§7).

### 8.1 Client-side trick-reveal freeze (`GameProvider.tsx`)

When the last player in a Part 2 trick plays their card, the engine clears `trick` immediately in
the returned state. Without intervention, `STATE_UPDATE` would arrive alongside `TRICK_WON` / `CUT`
and clear the board before players could see the completed trick.

`GameProvider` applies two mitigations:

1. **Optimistic trick display.** On every `CARD_PLAYED` event while `phase === 'PART_2'`, the client
   immediately appends `{ player, card, isCut: false }` to `view.trick`. This ensures the card
   appears on all clients' boards the instant it is played, regardless of network latency for the
   `STATE_UPDATE`. A duplicate guard prevents double-insertion if `STATE_UPDATE` arrives first.

2. **Trick-reveal freeze.** When `TRICK_WON` or `CUT` is received, `trickFreezeUntilRef` is set
   for a short window (1 500 ms for `TRICK_WON`; 2 000 ms for `CUT`, matching the cut animation).
   Any `STATE_UPDATE` that arrives during the freeze — including the mover's ack view — is queued
   in `pendingStateUpdateRef` rather than applied immediately. A `setTimeout` fires at the end of
   the freeze to apply the queued update, clearing the trick and advancing to the next state.

The freeze is cancelled (and any pending update discarded) when the room transitions back to LOBBY,
and the freeze timer is cleared on socket-event teardown.

---

## 9. Tests that pin these calculations

Located in `packages/engine/tests/`:

| Test file | Pins |
|---|---|
| `cards.test.ts` | summation values, ids, deck build |
| `createGame.test.ts` | deal sizes, stock counts, seeded determinism, first-player pick |
| `captureOptions.test.ts` | capture-set enumeration, maximal disjoint selection, same-rank rule, A/J/Q/K behaviour |
| `applyMove.test.ts` | Part 1 move validation, capture/draw/turn advance |
| `transition.test.ts` | Part 1 → Part 2 transition, sweep/discard, immediate game-over |
| `part2.test.ts` | follow-suit, trick won, cut resolution, safe tracking, rankings |
| `legalMoves.test.ts` | exhaustive legal-move generation |
| `viewFor.test.ts` | redaction guarantees |
| `smoke.test.ts` | full game playthrough |
| `redistribution.test.ts` *(planned, §4.6)* | 2-player no-shared-suit stalemate detection, `cutStreak` increment/reset, seeded redistribution top-up to 5, current-leader-continues, pool-exhaustion draw fallback, `removedPool` redaction |

**When you change a rule:** update this doc, change the relevant engine file, and update the
matching test(s). Show `npm test` passing before declaring the change done (per `CLAUDE.md`
build protocol).

---

## 10. Change protocol (how to use this doc)

To change *any* calculation, flow step, or rule:

1. **Decide intent in `GAME_RULES.md`** (and §7 Clarifications if it resolves an ambiguity). Never guess rules — ask the game owner.
2. **Update this file** — the section(s) above describing the calculation, including worked examples.
3. **Change the single engine location** named in §0 (all rule math is in `packages/engine`; never add rule logic to server/client).
4. **Update/extend the pinning test(s)** in §9 and run `npm test`.
5. **Update `docs/ENGINE_API.md`** only if a public signature/type changed.
6. **Update `docs/DEVELOPMENT_PLAN.md`** status + test counts per the project protocol.

If code and this document ever disagree, treat it as a bug: reconcile them and add a test so the
gap can't reopen.
