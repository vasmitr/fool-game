import { Card } from "./consts";

export interface TableState {
  deck: Card[];
  trumps: Card;
  players: { id: number; name: string }[];
  hands: { playerId: number; cards: Card[] }[];
  attack: Card[];
  defense: Card[];
  beaten: Card[];
  currentTurnId: number;
  currentDefendId: number;
}

export function canAttack(card: Card, table: TableState, playerId: number): boolean {
  const isTurn = table.currentTurnId === playerId;
  const isNotDefender = table.currentDefendId !== playerId;
  
  if (!isTurn && !isNotDefender) return false;

  // Initial attack
  if (table.attack.length === 0) {
      return isTurn;
  }

  // Subsequent attack/throw-in: rank must match table
  const allRanks = [...table.attack, ...table.defense].map(c => c.rank);
  return allRanks.includes(card.rank) && table.attack.length < 6;
}

export function canDefend(card: Card, table: TableState, playerId: number): boolean {
  if (table.currentDefendId !== playerId) return false;
  
  const cardToDefend = table.attack[table.defense.length];
  if (!cardToDefend) return false;

  const isTrump = card.suit === table.trumps.suit;
  const targetIsTrump = cardToDefend.suit === table.trumps.suit;

  return (card.suit === cardToDefend.suit && card.value > cardToDefend.value) ||
         (isTrump && !targetIsTrump);
}

export function canEndBout(table: TableState): boolean {
    return table.attack.length > 0 && table.attack.length === table.defense.length;
}

export type ActionOutcome = 
  | { type: 'SUCCESS'; table: TableState; log: string }
  | { type: 'ERROR'; log: string }
  | { type: 'GAME_OVER'; winner: string };

export function processIntent(table: TableState, intent: any): ActionOutcome {
  const playerHand = table.hands.find((h) => h.playerId === intent.playerId);
  if (!playerHand) return { type: 'ERROR', log: 'Player not found' };

  const playerInfo = table.players.find(p => p.id === intent.playerId);
  const playerName = playerInfo?.name || `P${intent.playerId}`;

  // Check Game Over
  if (table.deck.length === 0 && table.hands.some(h => h.cards.length === 0)) {
     const winner = table.hands.find(h => h.cards.length === 0);
     const winnerName = table.players.find(p => p.id === winner?.playerId)?.name || "Unknown";
     return { type: 'GAME_OVER', winner: winnerName };
  }

  // Helper for refilling
  const refill = (st: TableState) => {
      const newHands = st.hands.map(h => ({ ...h, cards: [...h.cards] }));
      const newDeck = [...st.deck];
      
      // Starting from attacker, everyone gets up to 6 cards
      for (let i = 0; i < st.players.length; i++) {
          const idx = (st.currentTurnId + i) % st.players.length;
          const hand = newHands.find(h => h.playerId === st.players[idx].id);
          if (hand) {
              while (hand.cards.length < 6 && newDeck.length > 0) {
                  const card = newDeck.pop();
                  if (card) hand.cards.push(card);
              }
          }
      }
      return { hands: newHands, deck: newDeck };
  };

  if (intent.action === "ATTACK" || intent.action === "DEFEND" || intent.action === "PASS") {
      const card = playerHand.cards.find(c => c.id === intent.cardId);
      if (!card) return { type: 'ERROR', log: 'Card not in hand' };

      if (intent.action === "ATTACK") {
          if (!canAttack(card, table, intent.playerId)) return { type: 'ERROR', log: `🚫 ${playerName}: Invalid attack.` };
          
          const newTable = JSON.parse(JSON.stringify(table));
          const newHand = newTable.hands.find((h: any) => h.playerId === intent.playerId);
          newHand.cards = newHand.cards.filter((c: any) => c.id !== intent.cardId);
          newTable.attack.push(card);
          return { type: 'SUCCESS', table: newTable, log: `⚔️ ${playerName} plays ${card.rank}${card.suit[0]} (ATTACK)` };
      }

      if (intent.action === "DEFEND") {
          if (!canDefend(card, table, intent.playerId)) return { type: 'ERROR', log: `🚫 ${playerName}: Cannot beat the card.` };
          
          const newTable = JSON.parse(JSON.stringify(table));
          const newHand = newTable.hands.find((h: any) => h.playerId === intent.playerId);
          newHand.cards = newHand.cards.filter((c: any) => c.id !== intent.cardId);
          newTable.defense.push(card);
          return { type: 'SUCCESS', table: newTable, log: `🛡️ ${playerName} plays ${card.rank}${card.suit[0]} (DEFEND)` };
      }

      if (intent.action === "PASS") {
          // Transfer is allowed if:
          // 1. No cards have been defended yet
          // 2. Rank matchescards already on table
          const allRanks = [...table.attack, ...table.defense].map(c => c.rank);
          const isRankValid = allRanks.includes(card.rank);
          
          if (table.defense.length > 0 || !isRankValid) {
              return { type: 'ERROR', log: `🚫 ${playerName}: Cannot transfer.` };
          }
          
          const newTable = JSON.parse(JSON.stringify(table));
          const newHand = newTable.hands.find((h: any) => h.playerId === intent.playerId);
          newHand.cards = newHand.cards.filter((c: any) => c.id !== intent.cardId);
          newTable.attack.push(card);
          newTable.currentDefendId = (table.currentDefendId + 1) % table.players.length;
          newTable.currentTurnId = table.currentDefendId;
          const newDefender = table.players.find(p => p.id === newTable.currentDefendId)?.name;
          return { type: 'SUCCESS', table: newTable, log: `🔄 ${playerName} transferred to ${newDefender}` };
      }
  }

  if (intent.action === "TAKE") {
      if (table.currentDefendId !== intent.playerId) return { type: 'ERROR', log: 'Not your turn to take' };
      
      const newTable = JSON.parse(JSON.stringify(table));
      const targetHand = newTable.hands.find((h: any) => h.playerId === intent.playerId);
      targetHand.cards.push(...newTable.attack, ...newTable.defense);
      newTable.attack = [];
      newTable.defense = [];
      
      const nextAttackerId = (newTable.currentDefendId + 1) % newTable.players.length;
      newTable.currentTurnId = nextAttackerId;
      newTable.currentDefendId = (nextAttackerId + 1) % newTable.players.length;
      
      const r = refill(newTable);
      newTable.hands = r.hands;
      newTable.deck = r.deck;
      
      return { type: 'SUCCESS', table: newTable, log: `📥 ${playerName} takes all cards` };
  }

  if (intent.action === "BEATEN") {
      if (table.currentTurnId !== intent.playerId || !canEndBout(table)) return { type: 'ERROR', log: 'Cannot end bout' };
      
      const newTable = JSON.parse(JSON.stringify(table));
      newTable.beaten.push(...newTable.attack, ...newTable.defense);
      newTable.attack = [];
      newTable.defense = [];
      
      newTable.currentTurnId = newTable.currentDefendId;
      newTable.currentDefendId = (newTable.currentDefendId + 1) % newTable.players.length;
      
      const r = refill(newTable);
      newTable.hands = r.hands;
      newTable.deck = r.deck;
      
      return { type: 'SUCCESS', table: newTable, log: `✅ ${playerName} closed the bout.` };
  }

  return { type: 'ERROR', log: 'Unknown action' };
}
