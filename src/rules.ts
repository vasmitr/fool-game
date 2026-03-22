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
  discardPile: Card[];
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

export type ActionOutcome = {
  type: "SUCCESS" | "ERROR" | "GAME_OVER";
  table: TableState;
  log: string;
};

// --- HELPERS ---

export const getTableRanks = (table: TableState) => [
  ...new Set([...table.attack, ...table.defense].map((c) => c.rank))
];

const updateHand =
  (playerId: number, updater: (cards: Card[]) => Card[]) =>
  (table: TableState): TableState => {
    return {
      ...table,
      hands: table.hands.map((h) =>
        h.playerId === playerId ? { ...h, cards: updater(h.cards) } : h
      )
    };
  };

const refillPlayerHand = (
  deck: Card[],
  hand: Card[]
): { deck: Card[]; hand: Card[] } => {
  const needed = Math.max(0, 6 - hand.length);
  if (needed === 0 || deck.length === 0) return { deck, hand };

  const draw = deck.slice(0, needed);
  const remaining = deck.slice(needed);
  return { deck: remaining, hand: [...hand, ...draw] };
};

const refillHands = (
  table: TableState,
  startingPlayerId: number
): TableState => {
  // Ordered player ids starting from startingPlayerId
  const startIndex = table.players.findIndex((p) => p.id === startingPlayerId);
  if (startIndex === -1) return table;

  const playerOrderIds = Array.from(
    { length: table.players.length },
    (_, i) => {
      const idx = (startIndex + i) % table.players.length;
      const p = table.players[idx];
      return p ? p.id : -1;
    }
  ).filter((id) => id !== -1);

  let currentDeck = [...table.deck].reverse(); // Draw from "top" (end of deck array)
  const currentHands = [...table.hands];

  for (const pid of playerOrderIds) {
    const hIdx = currentHands.findIndex((h) => h.playerId === pid);
    if (hIdx === -1) continue;

    const existingHand = currentHands[hIdx];
    if (!existingHand) continue;

    const { deck, hand } = refillPlayerHand(currentDeck, existingHand.cards);
    currentDeck = deck;
    currentHands[hIdx] = { ...existingHand, cards: hand };
  }

  return { ...table, deck: currentDeck.reverse(), hands: currentHands };
};

const canEndBout = (table: TableState) =>
  table.attack.length > 0 && table.attack.length === table.defense.length;

// --- HANDLERS ---

const handleAttack = (
  table: TableState,
  playerId: number,
  cardId: string
): ActionOutcome => {
  const playerHand = table.hands.find((h) => h.playerId === playerId);
  const card = playerHand?.cards.find((c) => c.id === cardId);

  // First attacker or someone else adding cards
  const isCurrentAttacker = table.currentTurnId === playerId;
  const isParticipant = table.hands.some((h) => h.playerId === playerId);
  const isAllowedToAdd =
    table.attack.length > 0 &&
    isParticipant &&
    playerId !== table.currentDefendId;

  const validRanks = getTableRanks(table);

  if (!isCurrentAttacker && !isAllowedToAdd) {
    return {
      type: "ERROR",
      log: "🚫 Not your turn to attack.",
      table: { ...table }
    };
  }

  if (!card) {
    return {
      type: "ERROR",
      log: "🚫 Card not found.",
      table: { ...table }
    };
  }

  if (table.attack.length > 0 && !validRanks.includes(card.rank)) {
    return {
      type: "ERROR",
      log: "🚫 Invalid rank for attack.",
      table: { ...table }
    };
  }

  const nextTable = updateHand(playerId, (cards) =>
    cards.filter((c) => c.id !== cardId)
  )({
    ...table,
    attack: [...table.attack, card]
  });

  return {
    type: "SUCCESS",
    table: nextTable,
    log: `⚔️ ${table.players.find((p) => p.id === playerId)?.name} plays ${card.rank}${card.suit[0]} (ATTACK)`
  };
};

const handleDefend = (
  table: TableState,
  playerId: number,
  cardId: string
): ActionOutcome => {
  const playerHand = table.hands.find((h) => h.playerId === playerId);
  const card = playerHand?.cards.find((c) => c.id === cardId);
  const target = table.attack[table.defense.length];

  if (!card) {
    return { type: "ERROR", log: "🚫 Card not found.", table: { ...table } };
  }

  if (!target) {
    return { type: "ERROR", log: "🚫 No card to beat.", table: { ...table } };
  }

  const isTrump = card.suit === table.trumps.suit;
  const sameSuit = card.suit === target.suit;
  const beatsByValue = sameSuit && card.value > target.value;
  const beatsByTrump = isTrump && target.suit !== table.trumps.suit;

  if (table.currentDefendId !== playerId) {
    return {
      type: "ERROR",
      log: "🚫 Not your turn to defend.",
      table: { ...table }
    };
  }

  if (!beatsByValue && !beatsByTrump) {
    return {
      type: "ERROR",
      log: "🚫 Cannot beat the card.",
      table: { ...table }
    };
  }

  const nextTable = updateHand(playerId, (cards) =>
    cards.filter((c) => c.id !== cardId)
  )({
    ...table,
    defense: [...table.defense, card]
  });

  return {
    type: "SUCCESS",
    table: nextTable,
    log: `🛡️ ${table.players.find((p) => p.id === playerId)?.name} plays ${card.rank}${card.suit[0]} (DEFEND)`
  };
};

const handlePass = (
  table: TableState,
  playerId: number,
  cardId: string
): ActionOutcome => {
  const playerHand = table.hands.find((h) => h.playerId === playerId);
  const card = playerHand?.cards.find((c) => c.id === cardId);
  const allRanks = getTableRanks(table);

  const nextDefendId = (table.currentDefendId + 1) % table.players.length;
  const postPass = updateHand(playerId, (cards) =>
    cards.filter((c) => c.id !== cardId)
  )(table);

  if (table.currentDefendId !== playerId) {
    return {
      type: "ERROR",
      log: "🚫 Only the defender can transfer.",
      table: { ...table }
    };
  }

  if (!card || table.defense.length > 0 || !allRanks.includes(card.rank)) {
    return { type: "ERROR", log: "🚫 Cannot transfer.", table: { ...table } };
  }

  return {
    type: "SUCCESS",
    table: {
      ...postPass,
      attack: [...postPass.attack, card],
      currentDefendId: nextDefendId,
      currentTurnId: playerId
    },
    log: `🔄 ${table.players.find((p) => p.id === playerId)?.name} transfers the bout.`
  };
};

const handleTake = (table: TableState, playerId: number): ActionOutcome => {
  if (table.currentDefendId !== playerId) {
    return {
      type: "ERROR",
      log: "🚫 Only defender can take cards.",
      table: { ...table }
    };
  }

  const allCards = [...table.attack, ...table.defense];
  const postTake = updateHand(playerId, (cards) => [...cards, ...allCards])(
    table
  );

  const defenderIndex = table.players.findIndex(
    (p) => p.id === table.currentDefendId
  );
  const nextAttackerIndex = (defenderIndex + 1) % table.players.length;
  const nextAttacker = table.players[nextAttackerIndex];

  const nextDefenderIndex = (nextAttackerIndex + 1) % table.players.length;
  const nextDefender = table.players[nextDefenderIndex];

  if (!nextAttacker) {
    return {
      type: "ERROR",
      log: "🚫 Next attacker not found.",
      table: { ...table }
    };
  }

  if (!nextDefender) {
    return {
      type: "ERROR",
      log: "🚫 Next defender not found.",
      table: { ...table }
    };
  }

  const nextState = refillHands(
    {
      ...postTake,
      attack: [],
      defense: [],
      currentTurnId: nextAttacker.id,
      currentDefendId: nextDefender.id
    },
    table.currentTurnId
  );

  return {
    type: "SUCCESS",
    table: nextState,
    log: `📥 ${table.players.find((p) => p.id === playerId)?.name} takes all cards.`
  };
};

const handleBeaten = (table: TableState, playerId: number): ActionOutcome => {
  const isParticipant =
    table.currentTurnId === playerId ||
    table.currentDefendId === playerId ||
    table.attack.length > 0;

  if (!isParticipant || !canEndBout(table)) {
    return { type: "ERROR", log: "Cannot end bout", table: { ...table } };
  }

  const nextAttackerId = table.currentDefendId;
  const defenderIndex = table.players.findIndex((p) => p.id === nextAttackerId);
  const nextDefenderIndex = (defenderIndex + 1) % table.players.length;
  const nextDefender = table.players[nextDefenderIndex];
  if (!nextDefender)
    return {
      type: "ERROR",
      log: "🚫 Next defender not found.",
      table: { ...table }
    };

  const nextState = refillHands(
    {
      ...table,
      discardPile: [...table.discardPile, ...table.attack, ...table.defense],
      attack: [],
      defense: [],
      currentTurnId: nextAttackerId,
      currentDefendId: nextDefender.id
    },
    table.currentTurnId
  );

  return {
    type: "SUCCESS",
    table: nextState,
    log: `✅ ${table.players.find((p) => p.id === playerId)?.name} closed the bout.`
  };
};

export function processIntent(
  table: TableState,
  intent: Intent
): ActionOutcome {
  const clone: TableState = structuredClone(table);
  let result: ActionOutcome;

  switch (intent.action) {
    case "ATTACK":
      result = handleAttack(clone, intent.playerId, intent.cardId || "");
      break;
    case "DEFEND":
      result = handleDefend(clone, intent.playerId, intent.cardId || "");
      break;
    case "PASS":
      result = handlePass(clone, intent.playerId, intent.cardId || "");
      break;
    case "TAKE":
      result = handleTake(clone, intent.playerId);
      break;
    case "BEATEN":
      result = handleBeaten(clone, intent.playerId);
      break;
    default:
      result = { type: "ERROR", log: "Unknown action", table: { ...table } };
  }

  const nextTable = result.table;

  const noCardsLeft =
    nextTable.deck.length === 0 &&
    nextTable.hands.some((h) => h.cards.length === 0);

  if (result.type === "SUCCESS" && noCardsLeft) {
    const winnerHand = nextTable.hands.find((h) => h.cards.length === 0);

    const winnerPlayer = winnerHand
      ? nextTable.players.find((p) => p.id === winnerHand.playerId)
      : undefined;
    const winnerName = winnerPlayer?.name || "Unknown";

    return {
      type: "GAME_OVER",
      log: `🏆 GAME OVER! ${winnerName} Wins!`,
      table: { ...nextTable, winner: winnerName, isGameOver: true }
    };
  }

  return result;
}
