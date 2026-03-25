import _ from "underscore";
import { match, P } from "ts-pattern";

import { Card } from "./consts.js";
import {
  getCard,
  getCardToDefend,
  getNextPlayer,
  getPlayerName,
  getTableRanks,
  getWinner,
  isDefender,
  isAttacker,
  isBoutParticipant,
  canEndBout,
  canBeat
} from "./selectors.js";

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

const updateHand =
  (playerId: number, updater: (cards: Card[]) => Card[]) =>
  (table: TableState): TableState => ({
    ...table,
    hands: table.hands.map((h) =>
      match(h.playerId)
        .with(playerId, () => ({ ...h, cards: updater(h.cards) }))
        .otherwise(() => h)
    )
  });

type RefillAcc = { deck: Card[]; updates: Record<number, Card[]> };

const refillPlayerHand = (acc: RefillAcc, hand: Hand): RefillAcc => {
  const needed = Math.max(0, 6 - hand.cards.length);
  const draw = acc.deck.slice(0, needed);
  return {
    deck: acc.deck.slice(needed),
    updates: { ...acc.updates, [hand.playerId]: [...hand.cards, ...draw] }
  };
};

export const refillHands = (
  table: TableState,
  startingPlayerId: number
): TableState => {
  const startIndex = table.hands.findIndex(
    (h) => h.playerId === startingPlayerId
  );
  return match(startIndex)
    .with(-1, () => table)
    .otherwise(() => {
      const n = table.hands.length;
      const { deck, updates } = _.chain(table.hands)
        .sortBy((_, i) => (i - startIndex + n) % n)
        .reduce(refillPlayerHand, {
          deck: table.deck,
          updates: {} as Record<number, Card[]>
        })
        .value();

      return {
        ...table,
        deck,
        hands: table.hands.map((h) => ({
          ...h,
          cards: match(updates[h.playerId])
            .with(P.nonNullable, (c) => c)
            .otherwise(() => h.cards)
        }))
      };
    });
};

const err = (log: string, table: TableState): ActionOutcome => ({
  type: "ERROR",
  log,
  table: { ...table }
});

// --- HANDLERS ---

const handleAttack = (
  table: TableState,
  playerId: number,
  cardId: string
): ActionOutcome => {
  const card = getCard(table, playerId, cardId);
  return match({ isAtt: isAttacker(table, playerId), card })
    .with({ isAtt: false }, () =>
      err(
        `🚫 ${getPlayerName(table, playerId)}: Not your turn to attack (Current Turn: ${getPlayerName(table, table.currentTurnId)}).`,
        table
      )
    )
    .with({ card: P.nullish }, () => err("🚫 Card not found.", table))
    .with(
      { card: P.nonNullable },
      ({ card }) => table.attack.length > 0 && !getTableRanks(table).includes(card.rank),
      () => err("🚫 Invalid rank for attack.", table)
    )
    .with({ card: P.nonNullable }, ({ card }) => ({
      type: "SUCCESS" as const,
      table: updateHand(playerId, (cards) =>
        cards.filter((c) => c.id !== cardId)
      )({ ...table, attack: [...table.attack, card] }),
      log: `⚔️ ${getPlayerName(table, playerId)} plays ${card.rank}${card.suit[0]} (ATTACK)`
    }))
    .exhaustive();
};

const handleDefend = (
  table: TableState,
  playerId: number,
  cardId: string
): ActionOutcome => {
  const card = getCard(table, playerId, cardId);
  const target = getCardToDefend(table);
  return match({ isDef: isDefender(table, playerId), card, target })
    .with({ isDef: false }, () => err("🚫 Not your turn to defend.", table))
    .with({ card: P.nullish }, () => err("🚫 Card not found.", table))
    .with({ target: P.nullish }, () => err("🚫 No card to beat.", table))
    .with(
      { card: P.nonNullable, target: P.nonNullable },
      ({ card, target }) => !canBeat(card, target, table.trumps.suit),
      () => err("🚫 Cannot beat the card.", table)
    )
    .with({ card: P.nonNullable, target: P.nonNullable }, ({ card }) => ({
      type: "SUCCESS" as const,
      table: updateHand(playerId, (cards) =>
        cards.filter((c) => c.id !== cardId)
      )({ ...table, defense: [...table.defense, card] }),
      log: `🛡️ ${getPlayerName(table, playerId)} plays ${card.rank}${card.suit[0]} (DEFEND)`
    }))
    .exhaustive();
};

const handlePass = (
  table: TableState,
  playerId: number,
  cardId: string
): ActionOutcome => {
  const card = getCard(table, playerId, cardId);
  const nextDefender = getNextPlayer(table, table.currentDefendId);
  return match({ isDef: isDefender(table, playerId), card, nextDefender })
    .with({ isDef: false }, () => err("🚫 Only the defender can transfer.", table))
    .with({ card: P.nullish }, () => err("🚫 Cannot transfer.", table))
    .with({ nextDefender: P.nullish }, () => err("🚫 Cannot transfer.", table))
    .with(
      { card: P.nonNullable, nextDefender: P.nonNullable },
      ({ card }) => table.defense.length > 0 || !getTableRanks(table).includes(card.rank),
      () => err("🚫 Cannot transfer.", table)
    )
    .with({ card: P.nonNullable, nextDefender: P.nonNullable }, ({ card, nextDefender }) => {
      const postPass = updateHand(playerId, (cards) =>
        cards.filter((c) => c.id !== cardId)
      )(table);
      return {
        type: "SUCCESS" as const,
        table: {
          ...postPass,
          attack: [...postPass.attack, card],
          currentDefendId: nextDefender.id,
          currentTurnId: playerId
        },
        log: `🔄 ${getPlayerName(table, playerId)} transfers the bout.`
      };
    })
    .exhaustive();
};

const handleTake = (table: TableState, playerId: number): ActionOutcome => {
  const nextAttacker = getNextPlayer(table, table.currentDefendId);
  const nextDefender = match(nextAttacker)
    .with(P.nonNullable, (a) => getNextPlayer(table, a.id))
    .otherwise(() => undefined);
  return match({ isDef: isDefender(table, playerId), nextAttacker, nextDefender })
    .with({ isDef: false }, () => err("🚫 Only defender can take cards.", table))
    .with({ nextAttacker: P.nonNullable, nextDefender: P.nonNullable }, ({ nextAttacker, nextDefender }) => {
      const allCards = [...table.attack, ...table.defense];
      const postTake = updateHand(playerId, (cards) => [...cards, ...allCards])(table);
      return {
        type: "SUCCESS" as const,
        table: refillHands(
          { ...postTake, attack: [], defense: [], currentTurnId: nextAttacker.id, currentDefendId: nextDefender.id },
          table.currentTurnId
        ),
        log: `📥 ${getPlayerName(table, playerId)} takes all cards.`
      };
    })
    .otherwise(() => err("🚫 Player rotation failed.", table));
};

const handleBeaten = (table: TableState, playerId: number): ActionOutcome => {
  const nextAttacker = table.players.find((p) => p.id === table.currentDefendId);
  const nextDefender = match(nextAttacker)
    .with(P.nonNullable, (a) => getNextPlayer(table, a.id))
    .otherwise(() => undefined);
  return match({
    isPart: isBoutParticipant(table, playerId),
    canEnd: canEndBout(table),
    nextAttacker,
    nextDefender
  })
    .with({ isPart: false }, () => err("Cannot end bout", table))
    .with({ canEnd: false }, () => err("Cannot end bout", table))
    .with({ nextAttacker: P.nonNullable, nextDefender: P.nonNullable }, ({ nextAttacker, nextDefender }) => ({
      type: "SUCCESS" as const,
      table: refillHands(
        {
          ...table,
          discardPile: [...table.discardPile, ...table.attack, ...table.defense],
          attack: [],
          defense: [],
          currentTurnId: nextAttacker.id,
          currentDefendId: nextDefender.id
        },
        table.currentTurnId
      ),
      log: `✅ ${getPlayerName(table, playerId)} closed the bout.`
    }))
    .otherwise(() => err("🚫 Player rotation failed.", table));
};

export function processIntent(
  table: TableState,
  intent: Intent
): ActionOutcome {
  const clone: TableState = structuredClone(table);

  const result = match(intent)
    .with({ action: "ATTACK" }, (i) =>
      handleAttack(clone, i.playerId, i.cardId ?? "")
    )
    .with({ action: "DEFEND" }, (i) =>
      handleDefend(clone, i.playerId, i.cardId ?? "")
    )
    .with({ action: "PASS" }, (i) =>
      handlePass(clone, i.playerId, i.cardId ?? "")
    )
    .with({ action: "TAKE" }, (i) => handleTake(clone, i.playerId))
    .with({ action: "BEATEN" }, (i) => handleBeaten(clone, i.playerId))
    .exhaustive();

  return match(result)
    .with({ type: "SUCCESS" }, (r) =>
      match(getWinner(r.table))
        .with(P.nonNullable, (winner) => ({
          type: "GAME_OVER" as const,
          log: `🏆 GAME OVER! ${winner} Wins!`,
          table: { ...r.table, winner, isGameOver: true }
        }))
        .otherwise(() => r)
    )
    .otherwise((r) => r);
}
