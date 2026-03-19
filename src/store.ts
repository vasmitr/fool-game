import { BehaviorSubject, Subject } from "rxjs";
import { getDeck } from "./helpers";
import type { Card } from "./consts";
import type { Intent, TableState } from "./rules";

function getInitialState(): TableState {
  const initialDeck = getDeck();
  const hands = [0, 1, 2, 3].map((id) => ({
    playerId: id,
    cards: initialDeck.splice(0, 6) as Card[],
  }));
  
  return {
    currentTurnId: 0,
    currentDefendId: 1,
    deck: initialDeck as Card[],
    trumps: initialDeck[initialDeck.length - 1],
    players: [
      { id: 0, name: "Albert Einstein" },
      { id: 1, name: "Marie Curie" },
      { id: 2, name: "Isaac Newton" },
      { id: 3, name: "Nikola Tesla" },
    ],
    hands,
    attack: [] as Card[],
    defense: [] as Card[],
    beaten: [] as Card[],
    isGameOver: false,
    winner: null as string | null
  };
}

export const table$ = new BehaviorSubject<TableState>(getInitialState());
export const intent$ = new Subject<Intent>();
export const log$ = new Subject<string>();

export function resetGame() {
  table$.next(getInitialState());
  log$.next("🔄 GAME RESTARTED");
}

import * as rules from "./rules";

intent$.subscribe((intent) => {
  const table = table$.value;
  if (table.isGameOver) return; // Ignore inputs after game over

  const outcome = rules.processIntent(table, intent);

  if (outcome.type === 'GAME_OVER') {
      log$.next(`🏆 GAME OVER! ${outcome.winner} Wins!`);
      const nextTable = structuredClone(table);
      nextTable.isGameOver = true;
      nextTable.winner = outcome.winner;
      table$.next(nextTable);
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
