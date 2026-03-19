import { Card } from "./consts";
import _ from "underscore";

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
  isGameOver: boolean;
  winner: string | null;
}

// 1. Pure Predicates
export const isTrump = (trumps: Card) => (card: Card) => card.suit === trumps.suit;
export const canBeatSameSuit = (attack: Card) => (defense: Card) => 
  attack.suit === defense.suit && defense.value > attack.value;

export const canBeat = (trumps: Card) => (attack: Card) => (defense: Card) => 
  canBeatSameSuit(attack)(defense) || (isTrump(trumps)(defense) && !isTrump(trumps)(attack));

export const getTableRanks = (table: TableState) => 
  _.uniq([...table.attack, ...table.defense].map(c => c.rank));

export const isValidAttackRank = (table: TableState) => (card: Card) => 
  table.attack.length === 0 || getTableRanks(table).includes(card.rank);

export const canAttack = (table: TableState) => (playerId: number) => (card: Card) => 
  (table.currentTurnId === playerId || table.currentDefendId !== playerId) && 
  isValidAttackRank(table)(card) && 
  table.attack.length < 6;

export const canDefend = (table: TableState) => (playerId: number) => (card: Card) => {
  if (table.currentDefendId !== playerId) return false;
  const target = table.attack[table.defense.length];
  return target ? canBeat(table.trumps)(target)(card) : false;
};

export const canEndBout = (table: TableState) => 
  table.attack.length > 0 && table.attack.length === table.defense.length;

// 2. Pure State Modifiers (Transformations)
const updateHand = (playerId: number, updater: (cards: Card[]) => Card[]) => (table: TableState): TableState => ({
  ...table,
  hands: table.hands.map(h => h.playerId === playerId ? { ...h, cards: updater(h.cards) } : h)
});

const refillPlayerHand = (deck: Card[], hand: Card[]): { deck: Card[], hand: Card[] } => {
  if (hand.length >= 6 || deck.length === 0) return { deck, hand };
  const [card, ...rest] = deck;
  return refillPlayerHand(rest, [...hand, card]);
};

const refillHands = (table: TableState): TableState => {
  // Ordered player indices starting from attacker
  const playerOrder = _.range(table.players.length)
    .map(i => (table.currentTurnId + i) % table.players.length);

  const initialAcc = { deck: [...table.deck].reverse(), hands: table.hands };
  
  const result = playerOrder.reduce((acc, idx) => {
    const playerId = table.players[idx].id;
    const playerHand = acc.hands.find(h => h.playerId === playerId)?.cards || [];
    
    const { deck: newDeck, hand: newHand } = refillPlayerHand(acc.deck, playerHand);
    
    return {
      deck: newDeck,
      hands: acc.hands.map(h => h.playerId === playerId ? { ...h, cards: newHand } : h)
    };
  }, initialAcc);

  return { ...table, deck: result.deck.reverse(), hands: result.hands };
};

// 3. Action Handlers (High-level pure transforms)
export type ActionOutcome = 
  | { type: 'SUCCESS'; table: TableState; log: string }
  | { type: 'ERROR'; log: string }
  | { type: 'GAME_OVER'; winner: string };

const handleAttack = (table: TableState, playerId: number, cardId: string): ActionOutcome => {
  const playerHand = table.hands.find(h => h.playerId === playerId);
  const card = playerHand?.cards.find(c => c.id === cardId);
  if (!card || !canAttack(table)(playerId)(card)) return { type: 'ERROR', log: '🚫 Invalid attack.' };

  const log = `⚔️ ${table.players.find(p => p.id === playerId)?.name} plays ${card.rank}${card.suit[0]} (ATTACK)`;
  const postAttack = updateHand(playerId, cards => cards.filter(c => c.id !== cardId))(table);
  return { type: 'SUCCESS', table: { ...postAttack, attack: [...postAttack.attack, card] }, log };
};

const handleDefend = (table: TableState, playerId: number, cardId: string): ActionOutcome => {
  const playerHand = table.hands.find(h => h.playerId === playerId);
  const card = playerHand?.cards.find(c => c.id === cardId);
  if (!card || !canDefend(table)(playerId)(card)) return { type: 'ERROR', log: '🚫 Cannot beat the card.' };

  const log = `🛡️ ${table.players.find(p => p.id === playerId)?.name} plays ${card.rank}${card.suit[0]} (DEFEND)`;
  const postDefend = updateHand(playerId, cards => cards.filter(c => c.id !== cardId))(table);
  return { type: 'SUCCESS', table: { ...postDefend, defense: [...postDefend.defense, card] }, log };
};

const handlePass = (table: TableState, playerId: number, cardId: string): ActionOutcome => {
  if (table.currentDefendId !== playerId) return { type: 'ERROR', log: '🚫 Only the defender can transfer.' };
  
  const playerHand = table.hands.find(h => h.playerId === playerId);
  const card = playerHand?.cards.find(c => c.id === cardId);
  const allRanks = getTableRanks(table);
  
  if (!card || table.defense.length > 0 || !allRanks.includes(card.rank)) return { type: 'ERROR', log: '🚫 Cannot transfer.' };

  const nextDefendId = (table.currentDefendId + 1) % table.players.length;
  const postPass = updateHand(playerId, cards => cards.filter(c => c.id !== cardId))(table);
  return { 
    type: 'SUCCESS', 
    table: { ...postPass, attack: [...postPass.attack, card], currentDefendId: nextDefendId, currentTurnId: table.currentDefendId }, 
    log: `🔄 ${table.players.find(p => p.id === playerId)?.name} transferred to ${table.players.find(p => p.id === nextDefendId)?.name}` 
  };
};

const handleTake = (table: TableState, playerId: number): ActionOutcome => {
  if (table.currentDefendId !== playerId) return { type: 'ERROR', log: 'Not your turn to take' };
  
  const postTake = updateHand(playerId, cards => [...cards, ...table.attack, ...table.defense])(table);
  const nextAttacker = (table.currentDefendId + 1) % table.players.length;
  const nextState = refillHands({ 
    ...postTake, attack: [], defense: [], currentTurnId: nextAttacker, currentDefendId: (nextAttacker + 1) % table.players.length 
  });
  return { type: 'SUCCESS', table: nextState, log: `📥 ${table.players.find(p => p.id === playerId)?.name} takes all cards.` };
};

const handleBeaten = (table: TableState, playerId: number): ActionOutcome => {
  const isParticipant = table.currentTurnId === playerId || table.currentDefendId === playerId;
  if (!isParticipant || !canEndBout(table)) return { type: 'ERROR', log: 'Cannot end bout' };
  
  const nextState = refillHands({
    ...table,
    beaten: [...table.beaten, ...table.attack, ...table.defense],
    attack: [],
    defense: [],
    currentTurnId: table.currentDefendId,
    currentDefendId: (table.currentDefendId + 1) % table.players.length
  });
  return { type: 'SUCCESS', table: nextState, log: `✅ ${table.players.find(p => p.id === playerId)?.name} closed the bout.` };
};

// 4. Main Entry (Reducer-like)
export function processIntent(table: TableState, intent: any): ActionOutcome {
  if (table.deck.length === 0 && table.hands.some(h => h.cards.length === 0)) {
    const winner = table.hands.find(h => h.cards.length === 0);
    const winnerName = table.players.find(p => p.id === winner?.playerId)?.name || "Unknown";
    return { type: 'GAME_OVER', winner: winnerName };
  }

  switch (intent.action) {
    case "ATTACK": return handleAttack(table, intent.playerId, intent.cardId);
    case "DEFEND": return handleDefend(table, intent.playerId, intent.cardId);
    case "PASS": return handlePass(table, intent.playerId, intent.cardId);
    case "TAKE": return handleTake(table, intent.playerId);
    case "BEATEN": return handleBeaten(table, intent.playerId);
    default: return { type: 'ERROR', log: 'Unknown action' };
  }
}
