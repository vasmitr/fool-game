import { describe, it, expect } from "vitest";
import { match } from "ts-pattern";
import * as rules from "./rules.js";
import type { TableState, Intent, Hand, ActionOutcome } from "./types.js";
import { refillHands } from "./transforms.js";
import { Card, Rank } from "./consts.js";

describe("Durak Rules Engine", () => {
  const getDummy = (id: string, rank: Rank = "6"): Card => ({
    id,
    rank,
    suit: "clubs",
    value: 6
  });

  const initialState: TableState = {
    deck: [{ id: "deck-dummy", rank: "A", suit: "hearts", value: 14 } as Card],
    trumps: { id: "t1", rank: "A", suit: "spades", value: 14 },
    players: [
      { id: 0, name: "P1" },
      { id: 1, name: "P2" },
      { id: 2, name: "P3" },
      { id: 3, name: "P4" }
    ],
    hands: [
      {
        playerId: 0,
        cards: [getDummy("h0-1"), getDummy("h0-2"), getDummy("h0-3")]
      },
      {
        playerId: 1,
        cards: [getDummy("h1-1"), getDummy("h1-2"), getDummy("h1-3")]
      },
      {
        playerId: 2,
        cards: [getDummy("h2-1"), getDummy("h2-2"), getDummy("h2-3")]
      },
      {
        playerId: 3,
        cards: [getDummy("h3-1"), getDummy("h3-2"), getDummy("h3-3")]
      }
    ],
    attack: [],
    defense: [],
    discardPile: [],
    currentTurnId: 0,
    currentDefendId: 1,
    isGameOver: false,
    winner: null
  };

  it("should allow first attack", () => {
    const state: TableState = { ...initialState };
    const intent: Intent = { action: "ATTACK", playerId: 0, cardId: "h0-1" };
    const outcome = rules.processIntent(state, intent);
    expect(outcome.type).toBe("SUCCESS");
  });

  it("should allow PASS (transfer) correctly", () => {
    const attackCard: Card = { id: "a1", rank: "6", suit: "hearts", value: 6 };
    const state: TableState = {
      ...initialState,
      attack: [attackCard],
      defense: [],
      currentTurnId: 0,
      currentDefendId: 1
    };
    const intent: Intent = { action: "PASS", playerId: 1, cardId: "h1-1" };
    const outcome = rules.processIntent(state, intent);
    expect(outcome.type).toBe("SUCCESS");
  });

  it("should fail DEFEND but succeed PASS for transfer on same rank", () => {
    const attackCard: Card = { id: "a1", rank: "6", suit: "clubs", value: 6 };
    const state: TableState = {
      ...initialState,
      attack: [attackCard],
      defense: [],
      currentTurnId: 0,
      currentDefendId: 1,
      hands: [
        ...initialState.hands.filter((h) => h.playerId !== 1),
        {
          playerId: 1,
          cards: [{ id: "h1-1", rank: "6", suit: "hearts", value: 6 }]
        }
      ]
    };

    const intentDefend: Intent = {
      action: "DEFEND",
      playerId: 1,
      cardId: "h1-1"
    };
    const outcomeDefend = rules.processIntent(state, intentDefend);
    expect(outcomeDefend.type).toBe("ERROR");
    expect(outcomeDefend.log).toContain("Cannot beat the card");

    const intentPass: Intent = { action: "PASS", playerId: 1, cardId: "h1-1" };
    const outcomePass = rules.processIntent(state, intentPass);
    expect(outcomePass.type).toBe("SUCCESS");
  });

  it("should detect GAME_OVER correctly", () => {
    const lastCard: Card = { id: "last", rank: "A", suit: "spades", value: 14 };
    const state: TableState = {
      ...initialState,
      deck: [],
      hands: [
        { playerId: 0, cards: [getDummy("h0")] },
        { playerId: 1, cards: [lastCard] },
        { playerId: 2, cards: [getDummy("h2")] },
        { playerId: 3, cards: [getDummy("h3")] }
      ],
      attack: [{ id: "a1", rank: "6", suit: "hearts", value: 6 } as Card],
      defense: [],
      currentTurnId: 0,
      currentDefendId: 1
    };
    const intent: Intent = { action: "DEFEND", playerId: 1, cardId: "last" };
    const outcome = rules.processIntent(state, intent);
    expect(outcome.type).toBe("GAME_OVER");
    return match(outcome)
      .with({ type: "GAME_OVER" }, (o) => {
        expect(o.table.winner).toBe("P2");
      })
      .otherwise(() => undefined);
  });

  function getSuccessTable(outcome: ActionOutcome): TableState {
    return match(outcome)
      .with({ type: "SUCCESS" }, (o) => o.table)
      .otherwise(() => {
        throw new Error("Step failed");
      });
  }

  function getRefillHand(h: Hand): Hand {
    const cards = Array(5).fill(getDummy("d"));
    return {
      playerId: h.playerId,
      cards
    };
  }

  it("should refill hands to 6 cards starting from the given player", () => {
    const table: TableState = {
      ...initialState,
      deck: [
        { id: "d1", rank: "6", suit: "clubs", value: 6 },
        { id: "d2", rank: "7", suit: "clubs", value: 7 },
        { id: "d3", rank: "8", suit: "clubs", value: 8 },
        { id: "d4", rank: "9", suit: "clubs", value: 9 },
        { id: "d5", rank: "10", suit: "clubs", value: 10 },
        { id: "d6", rank: "J", suit: "clubs", value: 11 }
      ],
      players: [{ id: 0, name: "P1" }],
      hands: [{ playerId: 0, cards: [{ id: "c1", rank: "A", suit: "spades", value: 14 } as Card] }]
    };
    const result = refillHands(table, 0);
    expect(result.hands[0]!.cards.length).toBe(6);
    expect(result.deck.length).toBe(1);
  });

  it("should handle partial hand refill", () => {
    const cardsInDeck: Card[] = [
      { id: "deck1", rank: "K", suit: "hearts", value: 13 },
      { id: "deck2", rank: "A", suit: "hearts", value: 14 }
    ];
    const state: TableState = {
      ...initialState,
      deck: [...cardsInDeck],
      hands: initialState.hands.map(getRefillHand),
      attack: [{ id: "a1", rank: "6", suit: "spades", value: 6 } as Card],
      defense: [{ id: "d1", rank: "7", suit: "spades", value: 7 } as Card],
      currentTurnId: 0,
      currentDefendId: 1
    };
    const intent: Intent = { action: "BEATEN", playerId: 0 };
    const outcome = rules.processIntent(state, intent);
    const table = getSuccessTable(outcome);
    expect(table.hands[0]!.cards.length).toBe(6);
    expect(table.hands[1]!.cards.length).toBe(6);
    expect(table.deck.length).toBe(0);
  });
});
