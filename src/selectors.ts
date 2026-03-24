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

export const isDefender = (table: TableState, playerId: number): boolean =>
  table.currentDefendId === playerId;

export const isPrimaryAttacker = (table: TableState, playerId: number): boolean =>
  table.currentTurnId === playerId;

export const allDefended = (table: TableState): boolean =>
  table.attack.length === table.defense.length;

export const hasUndefendedCards = (table: TableState): boolean =>
  table.attack.length > table.defense.length;

export const canEndBout = (table: TableState): boolean =>
  table.attack.length > 0 && allDefended(table);

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
  match(table.deck.length === 0)
    .with(true, () =>
      match(table.hands.find((h) => h.cards.length === 0))
        .with(P.nonNullable, (h) => getPlayerName(table, h.playerId))
        .otherwise(() => undefined)
    )
    .otherwise(() => undefined);
