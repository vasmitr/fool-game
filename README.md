# Fool (Durak) Game - Reactive Blackboard Engine

A fully playable implementation of the classic Russian card game **Fool** (Durak), built as an exploration of the **Blackboard architectural pattern** using RxJS and TypeScript.

## 🃏 Game Features

- **Intelligent AI Bots**: Marie Curie, Isaac Newton, and Nikola Tesla each observe the blackboard and make tactical moves.
- **Human Player Interface**: Take control of Albert Einstein and challenge the AI scientists.
- **Autonomous Mode**: Bots play against each other in a fully automated simulation (`src/index.ts`).
- **Modern UI**: Dark-themed dashboard with real-time game log (via Vite).

## 🏗️ Architecture: Blackboard Pattern

The project implements the **Blackboard** architectural pattern, where independent agents (Knowledge Sources) observe a shared state and contribute solutions.

### Components

| File | Blackboard Role | Responsibility |
|------|----------------|----------------|
| `src/store.ts` | **Blackboard** | Shared game state (`table$`), write API (`applyOutcome`), KS registry |
| `src/controller.ts` | **Controller** | Selects one eligible KS per state change, routes human intents, auto-passes on timeout |
| `src/player.ts` | **Knowledge Sources** | AI bots register `canAct` + `propose` functions |
| `src/rules.ts` | **Rule Engine** | Pure game logic, validates and transforms state |
| `src/helpers.ts` | **AI Strategy** | Best-attack and best-defense algorithms |

### Data Flow

```
Human click → intent$ → Controller → applyOutcome → table$ (Blackboard)
                                                         ↓
                                          Controller selects eligible KS
                                                         ↓
                                          timer(AI_DELAY_MS) → KS.propose()
                                                         ↓
                                                    applyOutcome → table$
```

### Controller Selection Priority

On each `table$` emission, the controller picks **one** eligible KS:

1. **Defender** — when there are undefended cards on the table
2. **Primary attacker** — when all attacks are defended
3. **Throw-in players** — other non-defenders with matching-rank cards

If no KS is eligible and the bout is fully defended (human's decision time), an auto-pass fires after `AUTO_PASS_MS`. `switchMap` ensures only one pending action exists at a time — cancelling stale timers when state changes.

### RxJS Highlights

- `BehaviorSubject` — blackboard holds and replays current state to new subscribers
- `switchMap` — cancels pending AI timers on new state, preventing race conditions
- `timer` — non-blocking AI delay; replaced original `of(null).pipe(delay(...))`
- Pure `canAct`/`propose` functions replace the original self-initiating RxJS streams per bot

## 🛠️ Tech Stack

- **Language**: TypeScript
- **Reactive Programming**: [RxJS v7+](https://rxjs.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Testing**: [Vitest](https://vitest.dev/)
- **Utilities**: Underscore.js (deck shuffling)

## 🚀 Getting Started

```bash
pnpm install
```

**Interactive UI:**
```bash
pnpm dev
```
Open `http://localhost:5173/` in your browser.

**Autonomous CLI simulation:**
```bash
pnpm tsx src/index.ts
```

**Tests:**
```bash
pnpm test
```
