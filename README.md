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
| `src/controller.ts` | **Controller** | Orchestrates the game loop by merging proposals from all eligible Knowledge Sources |
| `src/player.ts` | **Knowledge Sources** | Both AI and Human players register `canAct` + `propose` functions |
| `src/rules.ts` | **Rule Engine** | Pure game logic, validates and transforms state |
| `src/helpers.ts` | **AI Strategy** | Best-attack and best-defense algorithms |

### Data Flow

```text
Human click → intent$ → Human KS (propose) ↘
                                           [merge] → applyOutcome → table$
AI Strategy → AI Delay → AI KS (propose)   ↗           (Blackboard)
```

### Concurrent Proposal Strategy

On each `table$` emission, the controller identifies **all** eligible Knowledge Sources (`canAct` returns `true`). It then **merges** their `propose` streams.

- **Race to the Table**: The first player to emit a valid `Intent` wins that turn.
- **Auto-Cancellation**: Once an intent is processed and the `table$` updates, all other pending proposals (like an AI still "thinking" during its delay) are automatically cancelled by `switchMap`.
- **Human Response**: The Human player is always eligible when it's their turn to attack, defend, or throw-in. Their `propose` stream simply waits for the next emission from `intent$`.

### RxJS Highlights

- **`BehaviorSubject`** — blackboard holds and replays current state to new subscribers.
- **`merge`** — allows multiple players (AI and Human) to "think" concurrently; the first one to act triggers the state change.
- **`switchMap`** — the engine of the game loop; it restarts the proposal phase every time the table state changes, ensuring nobody acts on stale data.
- **`first()`** — used by the Human KS to take exactly one UI intent per proposal request.

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
