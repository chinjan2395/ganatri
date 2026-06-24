# Ganatri Scoring & Progression System

**Version:** 1.0  
**Status:** Approved Design Proposal

---

# Purpose

Ganatri's winner is determined exclusively by the game rules:

- First player to become safe ranks highest.
- Last player holding cards loses.
- Placement remains the primary measure of success.

The scoring system exists to:

1. Reward skilled play throughout both phases.
2. Provide meaningful post-match statistics.
3. Support progression and unlock systems.
4. Enable future competitive leaderboards and matchmaking.

To achieve this, Ganatri uses two separate systems:

- **Ranked Rating** (competitive)
- **Experience Points (XP)** (progression)

---

# 1. Ranked Rating

## Purpose

Ranked Rating measures player skill.

It is used for:

- Competitive leaderboard
- Future matchmaking
- Seasonal rankings

Ranked Rating is based only on final placement and not on in-game scoring events.

This prevents farming and keeps ranking focused on winning.

---

## 1.1 Rating Changes

### 2-Player Match

| Placement | Rating Change |
|------------|---------------|
| 1st | +20 |
| 2nd | -20 |

### 3-Player Match

| Placement | Rating Change |
|------------|---------------|
| 1st | +24 |
| 2nd | +4 |
| 3rd | -16 |

### 4-Player Match

| Placement | Rating Change |
|------------|---------------|
| 1st | +28 |
| 2nd | +10 |
| 3rd | -4 |
| 4th | -18 |

---

## 1.2 Abandonment Penalty

If a player disconnects, quits, or forfeits:

**Additional Rating Penalty:** `-15`

This penalty is applied on top of normal placement adjustment.

### Example

4-player match:

- Placement penalty: `-18`
- Abandon penalty: `-15`

**Final Rating Change:** `-33`

---

## 1.3 Rating Rules

Ranked Rating is never influenced by:

- Captures
- Same-rank captures
- Table clears
- Cuts
- Ghost bonus
- XP bonuses

Only placement affects rating.

---

# 2. Match Score

Match Score represents how well a player performed throughout a single game.

It rewards successful use of Ganatri's unique mechanics.

Match Score is shown:

- During gameplay
- On the Game Over screen
- In match history

Match Score does **not** affect who wins the game.

Placement still determines winners and losers.

---

# 3. Part 1 Scoring

## 3.1 Capture Points

Whenever cards are captured:

**+1 point per captured card**

Captured cards include:

- Summation captures
- Same-rank captures
- Final leftover table sweep

### Examples

Capture 2 cards:

```text
+2 points
```

Capture 5 cards:

```text
+5 points
```

---

## 3.2 Same-Rank Capture Bonus

When a move captures one or more same-rank cards:

**+2 bonus points**

Awarded once per move.

### Example

Play 8 and capture one table 8:

```text
Capture Points = +1
Same-Rank Bonus = +2

Total = +3
```

Play 8 and capture three table 8s:

```text
Capture Points = +3
Same-Rank Bonus = +2

Total = +5
```

---

## 3.3 Table Clear Bonus

If a capture move removes every card from the table:

**+5 bonus points**

Awarded once per move.

This rewards strategic board control.

---

# 4. Part 2 Scoring

## 4.1 Successful Cut Bonus

When a player successfully performs a cut:

**+3 points**

Definition:

- Player cannot follow suit.
- Plays another suit.
- Trick immediately ends.
- Cutter receives bonus.

Awarded once per cut.

---

## 4.2 No Cut Penalty

Receiving a cut does not cause negative points.

Reason:

Being forced to pick up cards is already a gameplay penalty.

No additional score punishment is necessary.

---

# 5. Placement Bonuses

Placement remains the most important scoring source.

Awarded when the game ends.

---

## 5.1 Standard Placement

### 4 Players

| Placement | Bonus |
|------------|--------|
| 1st | +30 |
| 2nd | +20 |
| 3rd | +10 |
| 4th | +0 |

### 3 Players

| Placement | Bonus |
|------------|--------|
| 1st | +30 |
| 2nd | +20 |
| 3rd | +0 |

### 2 Players

| Placement | Bonus |
|------------|--------|
| Winner | +30 |
| Loser | +0 |

---

## 5.2 Ghost Bonus

A player who:

- Captures zero cards during Part 1
- Starts Part 2 already safe

Receives:

**+5 Ghost Bonus**

Awarded at game end.

This recognizes a rare and unique Ganatri outcome.

---

# 6. Final Match Score Formula

```text
Final Match Score =
Capture Points
+ Same-Rank Bonuses
+ Table Clear Bonuses
+ Cut Bonuses
+ Placement Bonus
+ Ghost Bonus
```

---

# 7. Example Match

### Player Statistics

- Captured 14 cards
- 2 same-rank capture moves
- 1 table clear
- 1 successful cut
- Finished 2nd

### Calculation

```text
Capture Points     = 14
Same-Rank Bonuses  = 4
Table Clear Bonus  = 5
Cut Bonus          = 3
Placement Bonus    = 20

Final Score        = 46
```

---

# 8. Experience Points (XP)

XP is used for progression.

XP does not affect:

- Gameplay
- Rankings
- Match outcomes

XP is used for:

- Levels
- Cosmetics
- Avatar Frames
- Card Backs
- Seasonal Rewards
- Profile Badges

---

## XP Formula

```text
XP Earned = 10 + Match Score
```

### Examples

```text
Match Score = 32
XP Earned   = 42
```

```text
Match Score = 46
XP Earned   = 56
```

---

# 9. Player Levels

Player level is based on total accumulated XP.

## Recommended Formula

```text
Level = floor(sqrt(totalXp / 25)) + 1
```

Benefits:

- Fast early progression
- Slower long-term progression
- Easy to calculate
- Easy to explain

---

# 10. Data Model

## User Progression

```ts
interface PlayerProgression {
  rankedRating: number;
  totalXp: number;
  level: number;
}
```

## Lifetime Statistics

```ts
interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  captures: number;
  cutsGiven: number;
  ghostFinishes: number;
  highestMatchScore: number;
  totalMatchScore: number;
}
```

---

# 11. Server Authority

All calculations must occur server-side.

Clients may display score predictions but are never authoritative.

Server responsibilities:

- Determine placement
- Calculate Match Score
- Calculate XP
- Calculate Rating changes
- Persist progression
- Update statistics

---

# 12. Design Principles

Ganatri should reward:

- Winning
- Smart captures
- Strategic cuts
- Efficient play

Ganatri should not reward:

- Grinding weak opponents
- Farming card values
- Artificial score inflation

---

# Summary

## Ranked Rating

Used for:

- Leaderboards
- Matchmaking
- Competitive progression

Based only on final placement.

---

## Match Score

Used for:

- In-game score display
- Match summaries
- Performance tracking

Rewards:

- Captures
- Same-rank captures
- Table clears
- Cuts
- Placement

---

## XP

Used for:

- Levels
- Cosmetics
- Long-term progression

Calculated from Match Score.

---

**Core Philosophy**

> Placement determines who wins.
>
> Match Score rewards skillful play.
>
> Ranked Rating measures competitiveness.
>
> XP rewards long-term progression.