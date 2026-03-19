import { Card } from "./consts";

export interface Hand {
  playerId: number;
  cards: Card[];
}

export interface Player {
  id: number;
  name: string;
}

export interface TableState {
  deck: Card[];
  trumps: Card;
  players: Player[];
  hands: Hand[];
  attack: Card[];
  defense: Card[];
  beaten: Card[];
  currentTurnId: number;
  currentDefendId: number;
  isGameOver: boolean;
  winner: string | null;
}

export type GameAction = "ATTACK" | "DEFEND" | "PASS" | "TAKE" | "BEATEN";

export interface Intent {
  type?: string;
  action: GameAction;
  playerId: number;
  cardId?: string;
}

export type ActionOutcome = 
  | { type: 'SUCCESS', table: TableState, log: string }
  | { type: 'ERROR', log: string }
  | { type: 'GAME_OVER', winner: string };

// --- HELPERS ---

export const getTableRanks = (table: TableState) => 
  [...new Set([...table.attack, ...table.defense].map(c => c.rank))];

const updateHand = (playerId: number, updater: (cards: Card[]) => Card[]) => (table: TableState): TableState => {
  return {
    ...table,
    hands: table.hands.map(h => h.playerId === playerId ? { ...h, cards: updater(h.cards) } : h)
  };
};

const refillPlayerHand = (deck: Card[], hand: Card[]): { deck: Card[], hand: Card[] } => {
  const needed = Math.max(0, 6 - hand.length);
  if (needed === 0 || deck.length === 0) return { deck, hand };
  
  const draw = deck.slice(0, needed);
  const remaining = deck.slice(needed);
  return { deck: remaining, hand: [...hand, ...draw] };
};

const refillHands = (table: TableState, startingPlayerId: number): TableState => {
  // Ordered player ids starting from startingPlayerId
  const startIndex = table.players.findIndex(p => p.id === startingPlayerId);
  const playerOrderIds = Array.from({ length: table.players.length }, (_, i) => {
      const idx = (startIndex + i) % table.players.length;
      return table.players[idx].id;
  });

  let currentDeck = [...table.deck].reverse(); // Draw from "top" (end of deck array)
  let currentHands = [...table.hands];

  for (const pid of playerOrderIds) {
    const hIdx = currentHands.findIndex(h => h.playerId === pid);
    const { deck, hand } = refillPlayerHand(currentDeck, currentHands[hIdx].cards);
    currentDeck = deck;
    currentHands[hIdx] = { ...currentHands[hIdx], cards: hand };
  }

  return { ...table, deck: currentDeck.reverse(), hands: currentHands };
};

const canEndBout = (table: TableState) => 
  table.attack.length > 0 && table.attack.length === table.defense.length;

// --- HANDLERS ---

const handleAttack = (table: TableState, playerId: number, cardId: string): ActionOutcome => {
  const playerHand = table.hands.find(h => h.playerId === playerId);
  const card = playerHand?.cards.find(c => c.id === cardId);

  // First attacker or someone else adding cards
  const isCurrentAttacker = table.currentTurnId === playerId;
  const isParticipant = table.hands.some(h => h.playerId === playerId);
  const isAllowedToAdd = table.attack.length > 0 && isParticipant && playerId !== table.currentDefendId;

  if (!isCurrentAttacker && !isAllowedToAdd) return { type: 'ERROR', log: '🚫 Not your turn to attack.' };
  if (!card) return { type: 'ERROR', log: '🚫 Card not found.' };

  const validRanks = getTableRanks(table);
  if (table.attack.length > 0 && !validRanks.includes(card.rank)) return { type: 'ERROR', log: '🚫 Invalid rank for attack.' };

  const nextTable = updateHand(playerId, cards => cards.filter(c => c.id !== cardId))({
      ...table,
      attack: [...table.attack, card]
  });

  return { 
    type: 'SUCCESS', 
    table: nextTable, 
    log: `⚔️ ${table.players.find(p => p.id === playerId)?.name} plays ${card.rank}${card.suit[0]} (ATTACK)` 
  };
};

const handleDefend = (table: TableState, playerId: number, cardId: string): ActionOutcome => {
  if (table.currentDefendId !== playerId) return { type: 'ERROR', log: '🚫 Not your turn to defend.' };
  
  const playerHand = table.hands.find(h => h.playerId === playerId);
  const card = playerHand?.cards.find(c => c.id === cardId);
  if (!card) return { type: 'ERROR', log: '🚫 Card not found.' };

  const target = table.attack[table.defense.length];
  if (!target) return { type: 'ERROR', log: '🚫 No card to beat.' };

  const isTrump = card.suit === table.trumps.suit;
  const sameSuit = card.suit === target.suit;
  const beatsByValue = sameSuit && card.value > target.value;
  const beatsByTrump = isTrump && target.suit !== table.trumps.suit;

  if (!beatsByValue && !beatsByTrump) return { type: 'ERROR', log: '🚫 Cannot beat the card.' };

  const nextTable = updateHand(playerId, cards => cards.filter(c => c.id !== cardId))({
      ...table,
      defense: [...table.defense, card]
  });

  return { 
    type: 'SUCCESS', 
    table: nextTable, 
    log: `🛡️ ${table.players.find(p => p.id === playerId)?.name} plays ${card.rank}${card.suit[0]} (DEFEND)` 
  };
};

const handlePass = (table: TableState, playerId: number, cardId: string): ActionOutcome => {
  if (table.currentDefendId !== playerId) return { type: 'ERROR', log: '🚫 Only the defender can transfer.' };
  
  const playerHand = table.hands.find(h => h.playerId === playerId);
  const card = playerHand?.cards.find(c => c.id === cardId);
  const allRanks = getTableRanks(table);
  
  if (!card || table.defense.length > 0 || !allRanks.includes(card.rank)) {
      return { type: 'ERROR', log: '🚫 Cannot transfer.' };
  }

  const nextDefendId = (table.currentDefendId + 1) % table.players.length;
  const postPass = updateHand(playerId, cards => cards.filter(c => c.id !== cardId))(table);
  
  return { 
    type: 'SUCCESS', 
    table: { ...postPass, attack: [...postPass.attack, card], currentDefendId: nextDefendId, currentTurnId: playerId }, 
    log: `🔄 ${table.players.find(p => p.id === playerId)?.name} transfers the bout.` 
  };
};

const handleTake = (table: TableState, playerId: number): ActionOutcome => {
  if (table.currentDefendId !== playerId) return { type: 'ERROR', log: '🚫 Only defender can take cards.' };
  
  const allCards = [...table.attack, ...table.defense];
  const postTake = updateHand(playerId, cards => [...cards, ...allCards])(table);
  const nextAttacker = (table.currentDefendId + 1) % table.players.length;
  
  const nextState = refillHands({ 
    ...postTake, attack: [], defense: [], currentTurnId: nextAttacker, currentDefendId: (nextAttacker + 1) % table.players.length 
  }, table.currentTurnId);
  
  return { type: 'SUCCESS', table: nextState, log: `📥 ${table.players.find(p => p.id === playerId)?.name} takes all cards.` };
};

const handleBeaten = (table: TableState, playerId: number): ActionOutcome => {
  const isParticipant = table.currentTurnId === playerId || table.currentDefendId === playerId || table.attack.length > 0;
  if (!isParticipant || !canEndBout(table)) return { type: 'ERROR', log: 'Cannot end bout' };
  
  const nextAttacker = table.currentDefendId;
  const nextState = refillHands({
    ...table,
    beaten: [...table.beaten, ...table.attack, ...table.defense],
    attack: [],
    defense: [],
    currentTurnId: nextAttacker,
    currentDefendId: (nextAttacker + 1) % table.players.length
  }, table.currentTurnId);

  return { type: 'SUCCESS', table: nextState, log: `✅ ${table.players.find(p => p.id === playerId)?.name} closed the bout.` };
};

export function processIntent(table: TableState, intent: Intent): ActionOutcome {
  const clone: TableState = JSON.parse(JSON.stringify(table));
  let result: ActionOutcome;

  switch (intent.action) {
    case "ATTACK": result = handleAttack(clone, intent.playerId, intent.cardId || ""); break;
    case "DEFEND": result = handleDefend(clone, intent.playerId, intent.cardId || ""); break;
    case "PASS": result = handlePass(clone, intent.playerId, intent.cardId || ""); break;
    case "TAKE": result = handleTake(clone, intent.playerId); break;
    case "BEATEN": result = handleBeaten(clone, intent.playerId); break;
    default: result = { type: 'ERROR', log: 'Unknown action' };
  }

  if (result.type === 'SUCCESS') {
    const nextTable = result.table;
    if (nextTable.deck.length === 0 && nextTable.hands.some(h => h.cards.length === 0)) {
        const winner = nextTable.hands.find(h => h.cards.length === 0);
        const winnerName = nextTable.players.find(p => p.id === winner?.playerId)?.name || "Unknown";
        return { type: 'GAME_OVER', winner: winnerName };
    }
  }

  return result;
}
