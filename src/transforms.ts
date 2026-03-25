import _ from "underscore";
import { match, P } from "ts-pattern";
import { getDeck } from "./helpers.js";
import type { Card } from "./consts.js";
import type { Hand, TableState } from "./types.js";

type RefillAcc = { deck: Card[]; updates: Record<number, Card[]> };

const refillPlayerHand = (acc: RefillAcc, hand: Hand): RefillAcc => {
  const needed = Math.max(0, 6 - hand.cards.length);
  const draw = acc.deck.slice(0, needed);
  return {
    deck: acc.deck.slice(needed),
    updates: { ...acc.updates, [hand.playerId]: [...hand.cards, ...draw] }
  };
};

export const updateHand = (table: TableState, playerId: number, updater: (cards: Card[]) => Card[]): TableState => ({
  ...table,
  hands: table.hands.map((h) =>
    match(h.playerId)
      .with(playerId, () => ({ ...h, cards: updater(h.cards) }))
      .otherwise(() => h)
  )
});

export const refillHands = (table: TableState, startingPlayerId: number): TableState => {
  const startIndex = table.hands.findIndex((h) => h.playerId === startingPlayerId);
  return match(startIndex)
    .with(-1, () => table)
    .otherwise(() => {
      const n = table.hands.length;
      const { deck, updates } = _.chain(table.hands)
        .sortBy((_, i) => (i - startIndex + n) % n)
        .reduce(refillPlayerHand, { deck: table.deck, updates: {} as Record<number, Card[]> })
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

export function getInitialState(): TableState {
  const deckForHands = getDeck();
  const hands = [0, 1, 2, 3].map((id) => ({
    playerId: id,
    cards: deckForHands.splice(0, 6) as Card[]
  }));
  const trumps = deckForHands.pop() ?? getDeck()[0]!;

  return {
    currentTurnId: 0,
    currentDefendId: 1,
    deck: deckForHands,
    trumps,
    players: [
      { id: 0, name: "Albert Einstein" },
      { id: 1, name: "Marie Curie" },
      { id: 2, name: "Isaac Newton" },
      { id: 3, name: "Nikola Tesla" }
    ],
    hands,
    attack: [],
    defense: [],
    discardPile: [],
    isGameOver: false,
    winner: null
  };
}
