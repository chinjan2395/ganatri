# Project: Ganatri — Multiplayer Card Game (Web Version)

You are building **Ganatri**, a 2-part card game playable in the browser with multiplayer support. Build the **web version only** for now, but architect the networking layer so it can later support mobile and LAN/offline play.

---

## 1. Tech & Architecture Requirements

- **Frontend:** React (single-page app), responsive layout (desktop + mobile browser).
- **Backend:** Node.js with Socket.io (WebSockets) for real-time multiplayer.
- **Game logic:** Implement the rules engine as a **pure, framework-agnostic module** (no UI or network code inside it) so it can be unit-tested and reused.
- **Multiplayer modes:**
  - **Online mode (build now — this is the only mode for v1):** Host creates a room → gets a 6-character room code → others join with the code. Server is authoritative (all moves validated server-side).
  - **One game per player:** A player can be in only **one active game at a time**. If they try to create or join a room while already in a game, block it and offer to rejoin or leave their current game. Tie identity to a simple session (e.g., session token stored in the browser) — no full auth system needed yet.
  - **Offline / same-WiFi mode (do NOT build now):** Will be added later. For now, just keep the transport layer abstracted behind an interface (e.g., `GameTransport` with `send/receive/onPlayerJoin`) so a LAN/local transport can be slotted in later without rewriting game logic.
- **Players:** Support 2–4 players. Use one standard 52-card deck (no jokers).
- Include a **game state machine**: `LOBBY → PART_1 → PART_2 → GAME_OVER`.
- Write **unit tests for the rules engine**, especially the capture/summation logic.

---

## 2. Card Values

- Number cards: Ace = 1, then 2–10 at face value.
- Face cards: J, Q, K have **no numeric value** for summation.
- "Color" in Part 2 means **suit** (♠ ♥ ♦ ♣).

---

## 3. Part 1 — Capture Phase (Summation)

**Setup:**
1. Shuffle the deck. Deal **5 cards to each player**. The remaining deck becomes the **stock pile** (face down).
2. The table starts **empty**. Cards accumulate on the table as players play cards that capture nothing.
3. A randomly chosen player goes first. **Remember this player — they also lead Part 2.**

**Turn sequence (repeat clockwise):**
1. Player plays exactly **one card** from their hand face-up.
2. **Capture check** (numeric cards 1–10):
   - The player captures any combination of table cards whose values **sum exactly to the played card's value**, using **at most 3 table cards** in the combination.
     - Example: table has 2, 5, 6, 8, 9. Player plays 7 → captures 2+5. Plays 8 → captures 2+6. Plays 10 → captures 2+8.
     - Example: table has 1, 2, 3, 5, 6, 7, 10. Player plays 6 → may capture 1+2+3 (three cards).
   - **Same-rank rule:** If the table contains a card of the **same rank** as the played card, that card **must also be captured** in the same move, in addition to any summation capture.
   - The capture must take the **maximum number of disjoint valid combinations** at once; if several different maximal sets exist, the player **chooses** which set to take (UI must let them select). See Clarifications #1–#3.
   - Capturing is **mandatory** if any valid capture exists. If no capture is possible, the played card **stays on the table**.
   - Captured cards + the played card go into the player's personal **capture pile** (this becomes their Part 2 hand).
3. **Face cards & Ace played:** K, Q, J, and Ace do **not** use summation. They only capture a same-rank card from the table (K captures K, Q captures Q, J captures J, A captures A). If no matching card is on the table, the played card stays on the table.
   - Note: Aces on the **table** still count as value 1 inside other players' summation captures.
4. **Draw:** After playing, the player draws **one card from the stock pile** (so hand returns to 5, while stock lasts).

**End of Part 1:**
- When the stock pile is empty, players continue playing out the cards remaining in their hands (no more drawing).
- When all hands are empty, Part 1 ends. Any cards left on the table go to the **player who made the last capture**.
- Each player's capture pile becomes their hand for Part 2.

---

## 4. Part 2 — Trick/Cut Phase (Suit Rules)

Players now play with the cards they captured in Part 1. Suits matter; card ranking for "greater value": **A > K > Q > J > 10 > … > 3 > 2** (Ace highest, 2 lowest).

**Rules:**
1. The player who went **first in Part 1 leads** the first trick by playing any card.
2. Going clockwise, every player **must follow suit** if they can (play a card of the same suit).
3. **If everyone followed suit:** the highest card of that suit wins the trick. All played cards are **cancelled** (removed from the game permanently). The trick winner **leads the next trick**.
4. **Cutting:** If a player has **no card of the led suit**, they play any other-suit card. This is a "cut":
   - The trick **ends immediately** — players after the cutter do not play to it, so at most one cut can occur per trick. The player holding the **highest card of the led suit on the table** must **pick up ALL cards on the table** into their hand.
   - The **cutter leads the next trick** (fresh turn). See Clarifications #7–#8.
5. A player who runs out of cards is **out of the round** (safe) and is skipped.
6. The game continues until **one player is left holding cards** — that player **loses**. Everyone else finished safely (rank players by the order they emptied their hands; first to empty = winner).
7. Edge case: a player who captured zero cards in Part 1 is immediately safe at the start of Part 2.

---

## 5. UI Requirements

- Lobby screen: create room / join with code. If the player is already in an active game, show a "rejoin current game" prompt instead.
- Game table view: center table cards, your hand (face-up), opponents shown with card counts, stock pile counter, whose-turn indicator.
- Part 1: when a capture choice exists, highlight valid combinations and let the player tap/click to choose.
- Part 2: highlight legal cards (must-follow-suit enforcement); animate "cut" pickups clearly.
- Show capture pile counts in Part 1 and remaining-card counts in Part 2.
- Simple end screen with rankings and a "play again" option.
- Handle disconnects gracefully in online mode (allow reconnect to the same room within a grace period).

---

## 6. Development Plan (work in this order)

1. **Rules engine + unit tests** (pure TypeScript/JavaScript module, no UI).
2. **Online mode** with Socket.io rooms, server-authoritative state, and the one-active-game-per-player rule.
3. **Game UI** for Part 1 and Part 2 on top of the online layer.
4. Polish: animations, reconnect handling, mobile responsiveness.

Before writing code, restate the rules back to me briefly and ask about anything ambiguous. Then proceed phase by phase, showing me the rules-engine test results before building UI.

---

## 7. Rule Clarifications (authoritative — confirmed by the game owner, 2026-06-13)

These rulings resolve ambiguities in the sections above and **override them where they conflict**.

### Part 1
1. **Same-rank + summation:** if the table holds both a same-rank card and valid summation combination(s), the player must capture the same-rank card **and** the summation capture. The same-rank card is taken *in addition to* the combinations and does **not** count toward the 3-table-card limit. (A combination is always 2–3 cards: a single table card equal to the played value is the same-rank case, never a "combination".)
2. **Multiple same-rank cards:** **all** same-rank table cards are mandatorily captured in the move, not just one.
3. **Maximal capture:** the player must capture the **maximum possible number of disjoint summation combinations** in one move (each combination 2–3 cards summing exactly to the played value). When several different maximal sets exist (e.g., play 6 onto 1, 2, 3, 4 — {1+2+3} or {2+4}, one combination either way), the player **chooses** which set to take. Maximality is measured in *number of combinations*, not number of cards.
4. **Aces:** a *played* Ace never uses summation — it captures only table Ace(s). A *table* Ace counts as value 1 inside other players' summation captures.
5. **No capturer:** if no player made any capture during all of Part 1, leftover table cards are **discarded** — they enter nobody's Part 2 hand.
6. **Uneven stock:** when the stock empties mid-rotation, players simply stop drawing (later players in the rotation may hold one fewer card). Players whose hands empty early are skipped while the others play out their cards.

### Part 2
7. **A cut ends the trick immediately:** players after the cutter do not play to the trick, so at most one cut can occur per trick. The holder of the highest led-suit card on the table at that moment picks up all table cards; the cutter leads next. (The original "more than one player cuts in the same trick" clause is void.)
8. **Lead with an empty hand:** if the player who should lead next (the cutter, or a trick winner) just played their last card, the lead passes **clockwise to the next non-safe player**.
9. **Part 2 first lead:** if the Part 1 first player is immediately safe (captured zero cards), the first lead passes clockwise to the next player actually holding cards.
10. **Simultaneous finishes:** players who empty their hands on the same cancelled trick are ranked by the **order they played in that trick**. If the *final two* players empty simultaneously on a cancelled trick, the round ends with **no loser** — everyone is safe. Players safe from the start of Part 2 (zero captures) rank ahead of everyone, ordered by seating from the first player.
