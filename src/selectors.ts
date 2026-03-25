import { match, P } from "ts-pattern";
import type { TableState } from "./rules.js";
import type { Card } from "./consts.js";

export const getHand = (table: TableState, playerId: number): Card[] =>
  match(table.hands.find((h) => h.playerId === playerId))
    .with(P.nonNullable, (h) => h.cards)
    .otherwise(() => []);

export const getDefenderHandCount = (table: TableState): number =>
  getHand(table, table.currentDefendId).length;

export const getCard = (table: TableState, playerId: number, cardId: string) =>
  match(getHand(table, playerId).find((c) => c.id === cardId))
    .with(P.nonNullable, (c) => c)
    .otherwise(() => undefined);

export const getPlayerName = (table: TableState, playerId: number): string =>
  match(table.players.find((p) => p.id === playerId))
    .with(P.nonNullable, (p) => p.name)
    .otherwise(() => "Unknown");

export const isParticipant = (table: TableState, playerId: number): boolean =>
  table.hands.some((h) => h.playerId === playerId);

export const isDefender = (table: TableState, playerId: number): boolean =>
  table.currentDefendId === playerId;

export const isPrimaryAttacker = (table: TableState, playerId: number): boolean =>
  table.currentTurnId === playerId;

export const isAttacker = (table: TableState, playerId: number): boolean =>
  match({
    isPrimary: isPrimaryAttacker(table, playerId),
    len: table.attack.length,
    isPart: isParticipant(table, playerId),
    isDef: isDefender(table, playerId)
  })
    .with({ isPrimary: true }, () => true)
    .with({ len: P.number.gt(0), isPart: true, isDef: false }, () => true)
    .otherwise(() => false);

export const allDefended = (table: TableState): boolean =>
  table.attack.length === table.defense.length;

export const hasUndefendedCards = (table: TableState): boolean =>
  table.attack.length > table.defense.length;

export const canThrowIn = (table: TableState): boolean =>
  table.attack.length > 0 && table.attack.length < getDefenderHandCount(table);

export const getCardToDefend = (table: TableState) =>
  table.attack[table.defense.length];

export const canEndBout = (table: TableState): boolean =>
  table.attack.length > 0 && allDefended(table);

export const isBoutParticipant = (table: TableState, playerId: number): boolean =>
  match({ isAtt: isAttacker(table, playerId), isDef: isDefender(table, playerId), len: table.attack.length })
    .with({ isAtt: true }, () => true)
    .with({ isDef: true }, () => true)
    .with({ len: P.number.gt(0) }, () => true)
    .otherwise(() => false);

export const getTableRanks = (table: TableState): string[] => [
  ...new Set([...table.attack, ...table.defense].map((c) => c.rank)),
];

export const getNextPlayer = (table: TableState, afterPlayerId: number) =>
  table.players[
    (table.players.findIndex((p) => p.id === afterPlayerId) + 1) %
      table.players.length
  ];

export const canBeat = (card: Card, target: Card, trumpSuit: string): boolean =>
  match({ sameSuit: card.suit === target.suit, cardIsTrump: card.suit === trumpSuit, targetIsTrump: target.suit === trumpSuit })
    .with({ sameSuit: true }, () => card.value > target.value)
    .with({ cardIsTrump: true, targetIsTrump: false }, () => true)
    .otherwise(() => false);

export const getWinner = (table: TableState): string | undefined =>
  match(table.deck)
    .with([], () =>
      match(table.hands.find((h) => h.cards.length === 0))
        .with(P.nonNullable, (h) => getPlayerName(table, h.playerId))
        .otherwise(() => undefined)
    )
    .otherwise(() => undefined);
