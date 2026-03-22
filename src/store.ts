import { BehaviorSubject, Subject } from "rxjs";
import { getDeck } from "./helpers";
import type { Card } from "./consts";
import type { Intent, TableState, ActionOutcome } from "./rules";

function getInitialState(): TableState {
  const deckForHands = getDeck();
  const hands = [0, 1, 2, 3].map((id) => ({
    playerId: id,
    cards: deckForHands.splice(0, 6) as Card[] // Removes cards from deckForHands
  }));

  // Use pop() to get the trump card and remove it from the deck.
  // Provide a fallback if the deck is empty.
  const trumpCard = deckForHands.pop() || getDeck()[0]!;
  const trumps = trumpCard;

  return {
    currentTurnId: 0,
    currentDefendId: 1,
    deck: deckForHands, // The remaining cards in the deck
    trumps: trumps,
    players: [
      { id: 0, name: "Albert Einstein" },
      { id: 1, name: "Marie Curie" },
      { id: 2, name: "Isaac Newton" },
      { id: 3, name: "Nikola Tesla" }
    ],
    hands,
    attack: [] as Card[],
    defense: [] as Card[],
    discardPile: [] as Card[],
    isGameOver: false,
    winner: null as string | null
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
