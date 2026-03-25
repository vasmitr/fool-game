import { describe, it, expect } from "vitest";
import _ from "underscore";
import { match, P } from "ts-pattern";
import type { TableState, Hand, ActionOutcome } from "./types.js";
import { processIntent } from "./rules.js";
import { getDeck } from "./helpers.js";
import { Card, suits } from "./consts.js";
import { canBeat, getHand } from "./selectors.js";

describe("Game Integrity Tests", () => {
  const getAllCards = (table: TableState): Card[] => [
    ...table.deck,
    ...table.hands.flatMap((h) => h.cards),
    ...table.attack,
    ...table.defense,
    ...table.discardPile
  ];

  const checkIntegrity = (table: TableState) => {
    const allCards = getAllCards(table);
    expect(allCards.length).toBe(36);

    const uniqueIds = new Set(allCards.map((c) => c.id));
    expect(uniqueIds.size).toBe(36);

    const uniqueKeys = new Set(allCards.map((c) => `${c.rank}-${c.suit}`));
    expect(uniqueKeys.size).toBe(36);

    expect(table.hands.length).toBe(table.players.length);
    _.chain(table.hands).each((hand) => {
      expect(table.players.some((p) => p.id === hand.playerId)).toBe(true);
    });
  };

  const isPresentInPrevState = (
    card: Card,
    prevHand: Hand | undefined,
    tableCards: Card[],
    deckCards: Card[]
  ) => {
    const inPrevHand = match(prevHand)
      .with(P.nonNullable, (h) => h.cards.some((c) => c.id === card.id))
      .otherwise(() => false);
    const inTable = tableCards.some((c) => c.id === card.id);
    const inDeck = deckCards.some((c) => c.id === card.id);

    return match({ inPrevHand, inTable, inDeck })
      .with({ inPrevHand: true }, () => true)
      .with({ inTable: true }, () => true)
      .with({ inDeck: true }, () => true)
      .otherwise(() => false);
  };

  const validateCardPresence = (
    card: Card,
    prevHand: Hand | undefined,
    tableCards: Card[],
    deckCards: Card[]
  ) => {
    return match(isPresentInPrevState(card, prevHand, tableCards, deckCards))
      .with(true, () => true)
      .otherwise(() => {
        throw new Error(`Illegal card transfer: Card ${card.id}`);
      });
  };

  const checkNoIllegalTransfers = (prev: TableState, next: TableState) => {
    const tableCards = [...prev.attack, ...prev.defense];
    const deckCards = prev.deck;

    _.chain(next.hands).each((nextHand) => {
      const prevHand = prev.hands.find((h) => h.playerId === nextHand.playerId);
      _.chain(nextHand.cards).each((card) => {
        validateCardPresence(card, prevHand, tableCards, deckCards);
      });
    });
  };

  it("should maintain integrity after initial deal", () => {
    const deck = getDeck();
    const trumps = deck[deck.length - 1]!;
    const players = [
      { id: 0, name: "Player 1" },
      { id: 1, name: "Player 2" }
    ];

    const state: TableState = {
      deck: deck.slice(12),
      trumps,
      players,
      hands: [
        { playerId: 0, cards: deck.slice(0, 6) } as Hand,
        { playerId: 1, cards: deck.slice(6, 12) } as Hand
      ],
      attack: [],
      defense: [],
      discardPile: [],
      currentTurnId: 0,
      currentDefendId: 1,
      isGameOver: false,
      winner: null
    };

    checkIntegrity(state);
  });

  function getDefCard(cards: Card[], target: Card, trump: string) {
    return cards.find((c) => canBeat(c, target, trump));
  }

  function runDefenseStep(midTable: TableState, dc: Card) {
    const outcome2 = processIntent(midTable, {
      action: "DEFEND",
      playerId: 1,
      cardId: dc.id
    });
    return match(outcome2)
      .with({ type: "SUCCESS" }, (o2) => {
        checkIntegrity(o2.table);
        checkNoIllegalTransfers(midTable, o2.table);
      })
      .otherwise(() => undefined);
  }

  function runAttackAndDefend(table: TableState, card: Card) {
    const outcome = processIntent(table, {
      action: "ATTACK",
      playerId: 0,
      cardId: card.id
    });
    const midTable = getSuccessTable(outcome);
    checkIntegrity(midTable);
    checkNoIllegalTransfers(table, midTable);

    const defHand = getHand(midTable, 1);
    const trumpSuit = midTable.trumps.suit;
    const dc = match(midTable.attack[0])
      .with(P.nonNullable, (t) => getDefCard(defHand, t, trumpSuit))
      .otherwise(() => undefined);

    return match(dc)
      .with(P.nonNullable, (defenseCard) => runDefenseStep(midTable, defenseCard))
      .otherwise(() => undefined);
  }

  it("should maintain integrity through attack and defend", () => {
    const deck = getDeck();
    const trumps = deck[deck.length - 1]!;
    const players = [
      { id: 0, name: "P1" },
      { id: 1, name: "P2" }
    ];

    const table: TableState = {
      deck: deck.slice(12),
      trumps,
      players,
      hands: [
        { playerId: 0, cards: deck.slice(0, 6) } as Hand,
        { playerId: 1, cards: deck.slice(6, 12) } as Hand
      ],
      attack: [],
      defense: [],
      discardPile: [],
      currentTurnId: 0,
      currentDefendId: 1,
      isGameOver: false,
      winner: null
    };

    checkIntegrity(table);

    const hand = getHand(table, 0);
    const cardToAttack = hand[0]!;
    return runAttackAndDefend(table, cardToAttack);
  });

  it("should correctly handle beaten and refill", () => {
    const deck = getDeck();
    const trumps = deck[deck.length - 1]!;
    const players = [
      { id: 0, name: "P1" },
      { id: 1, name: "P2" }
    ];

    const table: TableState = {
      deck: deck.slice(12),
      trumps,
      players,
      hands: [
        { playerId: 0, cards: deck.slice(0, 5) } as Hand,
        { playerId: 1, cards: deck.slice(5, 10) } as Hand
      ],
      attack: [deck[10]!],
      defense: [deck[11]!],
      discardPile: [],
      currentTurnId: 0,
      currentDefendId: 1,
      isGameOver: false,
      winner: null
    };

    const outcome = processIntent(table, { action: "BEATEN", playerId: 0 });
    const t = getSuccessTable(outcome);
    checkIntegrity(t);
    checkNoIllegalTransfers(table, t);
    expect(t.discardPile.length).toBe(2);
  });

  const getSuccessTable = (outcome: ActionOutcome): TableState =>
    match(outcome)
      .with({ type: "SUCCESS" }, (o) => o.table)
      .otherwise(() => {
        throw new Error("Step failed");
      });

  it("should handle multi-card bout beaten count", () => {
    const deck = getDeck();
    const trumps = deck[deck.length - 1]!;
    const players = [
      { id: 0, name: "P1" },
      { id: 1, name: "P2" }
    ];
    const attackSuit = _.find(suits, (s) => s !== trumps.suit)!;
    const otherSuit = _.chain(suits)
      .filter((s) => s !== trumps.suit)
      .find((s) => s !== attackSuit)
      .value()!;

    const a1 = _.chain(deck)
      .filter((c) => c.suit === attackSuit)
      .find((c) => c.rank === "6")
      .value()!;
    const d1 = _.chain(deck)
      .filter((c) => c.suit === attackSuit)
      .find((c) => c.rank === "7")
      .value()!;
    const a2 = _.chain(deck)
      .filter((c) => c.suit === otherSuit)
      .find((c) => c.rank === a1.rank)
      .value()!;
    const d2 = _.chain(deck)
      .filter((c) => c.suit === otherSuit)
      .find((c) => c.rank === d1.rank)
      .value()!;

    const table: TableState = {
      deck: deck.filter((c) => ![a1.id, a2.id, d1.id, d2.id].includes(c.id)),
      trumps,
      players,
      hands: [
        { playerId: 0, cards: [a1, a2] } as Hand,
        { playerId: 1, cards: [d1, d2] } as Hand
      ],
      attack: [],
      defense: [],
      discardPile: [],
      currentTurnId: 0,
      currentDefendId: 1,
      isGameOver: false,
      winner: null
    };

    const o1 = processIntent(table, { action: "ATTACK", playerId: 0, cardId: a1.id });
    const o2 = processIntent(getSuccessTable(o1), { action: "DEFEND", playerId: 1, cardId: d1.id });
    const o3 = processIntent(getSuccessTable(o2), { action: "ATTACK", playerId: 0, cardId: a2.id });
    const o4 = processIntent(getSuccessTable(o3), { action: "DEFEND", playerId: 1, cardId: d2.id });

    const final = getSuccessTable(o4);
    const outcome = processIntent(final, { action: "BEATEN", playerId: 0 });
    const t = getSuccessTable(outcome);
    expect(t.discardPile.length).toBe(4);
    checkIntegrity(t);
  });

  it("should handle 3 players adding cards", () => {
    const deck = getDeck();
    const trumps = deck[deck.length - 1]!;
    const players = [
      { id: 0, name: "P1" },
      { id: 1, name: "P2" },
      { id: 2, name: "P3" }
    ];

    const a1 = _.chain(deck)
      .filter((c) => c.rank === "6")
      .find((c) => c.suit !== trumps.suit)
      .value()!;
    const d1 = _.chain(deck)
      .filter((c) => c.rank === "7")
      .find((c) => c.suit === a1.suit)
      .value()!;
    const a2 = _.chain(deck)
      .filter((c) => c.rank === "7")
      .filter((c) => c.id !== d1.id)
      .find((c) => c.suit !== trumps.suit)
      .value()!;
    const d2 = _.chain(deck)
      .filter((c) => c.rank === "8")
      .find((c) => c.suit === a2.suit)
      .value()!;

    const table: TableState = {
      deck: deck.filter((c) => ![a1.id, a2.id, d1.id, d2.id].includes(c.id)),
      trumps,
      players,
      hands: [
        { playerId: 0, cards: [a1] } as Hand,
        { playerId: 1, cards: [d1, d2] } as Hand,
        { playerId: 2, cards: [a2] } as Hand
      ],
      attack: [],
      defense: [],
      discardPile: [],
      currentTurnId: 0,
      currentDefendId: 1,
      isGameOver: false,
      winner: null
    };

    const o1 = processIntent(table, { action: "ATTACK", playerId: 0, cardId: a1.id });
    const o2 = processIntent(getSuccessTable(o1), { action: "DEFEND", playerId: 1, cardId: d1.id });
    const o3 = processIntent(getSuccessTable(o2), { action: "ATTACK", playerId: 2, cardId: a2.id });
    const o4 = processIntent(getSuccessTable(o3), { action: "DEFEND", playerId: 1, cardId: d2.id });

    const final = getSuccessTable(o4);
    const outcome = processIntent(final, { action: "BEATEN", playerId: 2 });
    const t = getSuccessTable(outcome);
    expect(t.discardPile.length).toBe(4);
    checkIntegrity(t);
  });

  it("should maintain integrity during PASS (transfer)", () => {
    const deck = getDeck();
    const trumps = deck[deck.length - 1]!;
    const players = [
      { id: 0, name: "P1" },
      { id: 1, name: "P2" },
      { id: 2, name: "P3" }
    ];

    const attackCard = deck.find((c) => c.rank === "J" && c.suit !== trumps.suit)!;
    const transferCard = deck.find((c) => c.rank === "J" && c.id !== attackCard.id)!;

    const excludeIds = new Set([attackCard.id, transferCard.id]);
    function isExc(c: Card) { return excludeIds.has(c.id); }
    const deckCards = deck.filter((c) => !isExc(c));

    const table: TableState = {
      deck: deckCards,
      trumps,
      players,
      hands: [
        { playerId: 0, cards: [attackCard] } as Hand,
        { playerId: 1, cards: [transferCard] } as Hand,
        { playerId: 2, cards: [] } as Hand
      ],
      attack: [],
      defense: [],
      discardPile: [],
      currentTurnId: 0,
      currentDefendId: 1,
      isGameOver: false,
      winner: null
    };

    const o1 = processIntent(table, { action: "ATTACK", playerId: 0, cardId: attackCard.id });
    const t1 = getSuccessTable(o1);
    const o2 = processIntent(t1, { action: "PASS", playerId: 1, cardId: transferCard.id });
    const t2 = getSuccessTable(o2);
    checkIntegrity(t2);
    expect(t2.attack.length).toBe(2);
    expect(t2.currentDefendId).toBe(2);
  });

  it("should maintain integrity when player takes cards", () => {
    const deck = getDeck();
    const trumps = deck[deck.length - 1]!;
    const players = [
      { id: 0, name: "P1" },
      { id: 1, name: "P2" }
    ];

    const table: TableState = {
      deck: deck.slice(12),
      trumps,
      players,
      hands: [
        { playerId: 0, cards: deck.slice(0, 6) } as Hand,
        { playerId: 1, cards: deck.slice(6, 12) } as Hand
      ],
      attack: [],
      defense: [],
      discardPile: [],
      currentTurnId: 0,
      currentDefendId: 1,
      isGameOver: false,
      winner: null
    };

    const hand = getHand(table, 0);
    const card = hand[0]!;
    const o1 = processIntent(table, { action: "ATTACK", playerId: 0, cardId: card.id });
    const t1 = getSuccessTable(o1);
    const oTake = processIntent(t1, { action: "TAKE", playerId: 1 });
    const t2 = getSuccessTable(oTake);
    checkIntegrity(t2);
  });
});
