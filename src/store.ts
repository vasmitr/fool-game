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

// The orchestrator that processes player intents and updates the table state
intent$.subscribe((intent) => {
  const table = { ...table$.value };

  // 1. Check if game is over
  if (table.deck.length === 0 && table.hands.some(h => h.cards.length === 0)) {
     const winner = table.hands.find(h => h.cards.length === 0);
     if (winner) {
        const winnerName = table.players.find(p => p.id === winner.playerId)?.name || `Player ${winner.playerId}`;
        log$.next(`🏆 GAME OVER! ${winnerName} Wins!`);
        table$.complete();
        return;
     }
  }

  const playerInfo = table.players.find(p => p.id === intent.playerId);
  const playerName = playerInfo?.name || `P${intent.playerId}`;
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
      const msg = `⚔️ ${playerName} plays ${card.rank}${card.suit[0]} (${intent.action})`;
      console.log(`[ACTION] ${msg}`);
      log$.next(msg);
      
      if (intent.action === "ATTACK") {
        // If not the first card, must match ranks on table
        if (table.attack.length > 0 || table.defense.length > 0) {
            const allRanks = [...table.attack, ...table.defense].map(c => c.rank);
            if (!allRanks.includes(card.rank)) {
                log$.next(`🚫 ${playerName}: ${card.rank}${card.suit[0]} is an invalid attack rank.`);
                playerHand.cards.push(card);
                table$.next(table);
                return;
            }
        }
        table.attack = [...table.attack, card];
      } else if (intent.action === "DEFEND") {
        table.defense = [...table.defense, card];
      } else if (intent.action === "PASS") {
        table.attack = [...table.attack, card];
        const oldDefenderId = table.currentDefendId;
        table.currentDefendId = (table.currentDefendId + 1) % table.players.length;
        // The person who was the original attacker should probably stay attacker?
        // Actually, in transfer, the person who transferred becomes an attacker.
        table.currentTurnId = oldDefenderId; 
        
        const newDefender = table.players.find(p => p.id === table.currentDefendId)?.name;
        log$.next(`🔄 ${playerName} transferred the attack to ${newDefender}`);
      }
      
      table$.next(table);
      return;
    }
  }

  // 3. Handle TAKE
  if (intent.action === "TAKE" && intent.playerId === table.currentDefendId) {
    log$.next(`📥 ${playerName} takes all cards (${table.attack.length + table.defense.length})`);
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

  // 4. Handle End of Bout
  if (intent.action === "BEATEN" && table.attack.length > 0 && table.attack.length === table.defense.length) {
     log$.next(`✅ ${playerName} closed the bout. Cards moved to discard.`);
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
