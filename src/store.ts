import { BehaviorSubject, Subject } from "rxjs";
import { getDeck } from "./helpers";
import type { Card } from "./consts";
import type { Intent, TableState, ActionOutcome } from "./rules";

function getInitialState(): TableState {
  const initialDeck = getDeck();
  const hands = [0, 1, 2, 3].map((id) => ({
    playerId: id,
    cards: initialDeck.splice(0, 6) as Card[],
  }));

  return {
    currentTurnId: 0,
    currentDefendId: 1,
    deck: initialDeck,
    trumps: initialDeck[initialDeck.length - 1] || initialDeck[0],
    players: [
      { id: 0, name: "Albert Einstein" },
      { id: 1, name: "Marie Curie" },
      { id: 2, name: "Isaac Newton" },
      { id: 3, name: "Nikola Tesla" },
    ],
    hands,
    attack: [] as Card[],
    defense: [] as Card[],
    discardPile: [] as Card[],
    isGameOver: false,
    winner: null as string | null,
  };
}

// --- Blackboard ---
export const table$ = new BehaviorSubject<TableState>(getInitialState());
export const intent$ = new Subject<Intent>(); // human player input
export const log$ = new Subject<string>();

export function resetGame() {
  table$.next(getInitialState());
  log$.next("🔄 GAME RESTARTED");
}

// --- Write API ---
export function applyOutcome(table: TableState, outcome: ActionOutcome): void {
  if (outcome.type === "GAME_OVER") {
    log$.next(`🏆 GAME OVER! ${outcome.winner} Wins!`);
    const next = structuredClone(table);
    next.isGameOver = true;
    next.winner = outcome.winner;
    table$.next(next);
    return;
  }
  if (outcome.type === "ERROR") {
    log$.next(outcome.log);
    return;
  }
  log$.next(outcome.log);
  table$.next(outcome.table);
}

// --- Knowledge Source registry ---
export type KnowledgeSource = {
  playerId: number;
  canAct: (table: TableState) => boolean;
  propose: (table: TableState) => Intent | null;
};

export const knowledgeSources: KnowledgeSource[] = [];
export const registerKS = (ks: KnowledgeSource) => knowledgeSources.push(ks);
