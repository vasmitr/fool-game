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
    { id: 0, name: "Player 1" },
    { id: 1, name: "Player 2" },
    { id: 2, name: "Player 3" },
    { id: 3, name: "Player 4" },
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

// A separate stream for active suggestions from all players
export const suggestion$ = new BehaviorSubject<{
  [playerId: number]: { action: string; cardId: string };
}>({});

// The orchestrator that processes player intents and updates the table state
intent$.subscribe((intent) => {
  const table = { ...table$.value };

  // 1. Check if game is over
  if (table.deck.length === 0 && table.hands.some(h => h.cards.length === 0)) {
     const winner = table.hands.find(h => h.cards.length === 0);
     if (winner) {
        console.log(`--- GAME OVER! Player ${winner.playerId} Wins! ---`);
        table$.complete();
        return;
     }
  }

  const playerHand = table.hands.find((h) => h.playerId === intent.playerId);
  if (!playerHand) return;

  // 2. Handle Card Placement (Attack/Defense)
  if ((intent.type === "ATTACK_INTENT" || intent.type === "DEFENSE_INTENT") && intent.cardId) {
    const cardIndex = playerHand.cards.findIndex((c) => c.id === intent.cardId);
    if (cardIndex !== -1) {
      if (intent.type === "DEFENSE_INTENT" && table.defense.length >= table.attack.length) {
          return; // Nothing to defend right now
      }

      const [card] = playerHand.cards.splice(cardIndex, 1);
      console.log(`[ACTION] Player ${intent.playerId} plays ${card.rank}${card.suit[0]} (${intent.action})`);
      
      if (intent.action === "ATTACK") {
        table.attack = [...table.attack, card];
      } else if (intent.action === "DEFEND") {
        table.defense = [...table.defense, card];
      } else if (intent.action === "PASS") {
        table.attack = [...table.attack, card];
        table.currentTurnId = table.currentDefendId;
        table.currentDefendId = (table.currentDefendId + 1) % table.players.length;
      }
      
      table$.next(table);
      return;
    }
  }

  // 3. Handle TAKE
  if (intent.action === "TAKE" && intent.playerId === table.currentDefendId) {
    console.log(`[ACTION] Player ${intent.playerId} TAKES the table`);
    const allBoutCards = [...table.attack, ...table.defense];
    playerHand.cards.push(...allBoutCards);

    const refilled = refillHands(table.hands, table.deck);
    const nextAttackerId = (table.currentDefendId + 1) % table.players.length;

    table$.next({
      ...table,
      attack: [],
      defense: [],
      hands: refilled.hands,
      deck: refilled.deck,
      currentTurnId: nextAttackerId,
      currentDefendId: (nextAttackerId + 1) % table.players.length,
    });
    return;
  }

  // 4. Handle End of Bout (if everything defended and no one else wants to throw)
  // To keep it autonomous, we'll auto-beat if all cards are defended
  // (In a real game, this would wait for everyone to say "Pass")
  if (table.attack.length > 0 && table.attack.length === table.defense.length) {
     console.log(`[ACTION] Bout is successful. Moving to discard.`);
     const refilled = refillHands(table.hands, table.deck);
     table$.next({
       ...table,
       beaten: [...table.beaten, ...table.attack, ...table.defense],
       attack: [],
       defense: [],
       hands: refilled.hands,
       deck: refilled.deck,
       currentTurnId: table.currentDefendId,
       currentDefendId: (table.currentDefendId + 1) % table.players.length,
     });
  }
});
