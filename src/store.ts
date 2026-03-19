import { BehaviorSubject, Subject } from "rxjs";
import { getDeck, refillHands } from "./helpers";
import type { Card } from "./consts";

const initialDeck = getDeck();
const initialHands = [0, 1, 2, 3].map((id) => ({
  playerId: id,
  cards: initialDeck.splice(0, 6),
}));

export const table$ = new BehaviorSubject({
  currentTurnId: 0,
  currentDefendId: 1,
  deck: initialDeck as Card[],
  trumps: initialDeck[initialDeck.length - 1], // Last card is trumps
  players: [
    { id: 0, name: "Albert Einstein" },
    { id: 1, name: "Marie Curie" },
    { id: 2, name: "Isaac Newton" },
    { id: 3, name: "Nikola Tesla" },
  ],
  hands: initialHands,
  attack: [] as Card[],
  defense: [] as Card[],
  beaten: [] as Card[],
});

export const intent$ = new Subject<{
  type: string;
  playerId: number;
  cardId?: string;
  action?: string;
}>();

// A stream for game events (logs)
export const log$ = new Subject<string>();

// A separate stream for active suggestions from all players
export const suggestion$ = new BehaviorSubject<{
  [playerId: number]: { action: string; cardId: string };
}>({});

import * as rules from "./rules";

// ... (keep previous Subjects)

intent$.subscribe((intent) => {
  const table = table$.value;
  const outcome = rules.processIntent(table as rules.TableState, intent);

  if (outcome.type === 'GAME_OVER') {
      log$.next(`🏆 GAME OVER! ${outcome.winner} Wins!`);
      table$.complete();
      return;
  }

  if (outcome.type === 'ERROR') {
      log$.next(outcome.log);
      return;
  }

  if (outcome.type === 'SUCCESS') {
      log$.next(outcome.log);
      table$.next(outcome.table);
  }
});
