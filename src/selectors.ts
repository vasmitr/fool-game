import type { TableState } from "./rules.js";
import type { Card } from "./consts.js";

export const getHand = (table: TableState, playerId: number): Card[] =>
  table.hands.find((h) => h.playerId === playerId)?.cards ?? [];

export const getDefenderHandCount = (table: TableState): number =>
  getHand(table, table.currentDefendId).length;

export const getCard = (table: TableState, playerId: number, cardId: string) =>
  getHand(table, playerId).find((c) => c.id === cardId);

export const getPlayerName = (table: TableState, playerId: number): string =>
  table.players.find((p) => p.id === playerId)?.name ?? "Unknown";

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
  table.players[(table.players.findIndex((p) => p.id === afterPlayerId) + 1) % table.players.length];

export const getWinner = (table: TableState): string | undefined => {
  if (table.deck.length > 0) return undefined;
  const winnerHand = table.hands.find((h) => h.cards.length === 0);
  return winnerHand
    ? table.players.find((p) => p.id === winnerHand.playerId)?.name
    : undefined;
};
