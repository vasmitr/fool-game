import { describe, it, expect } from "vitest";
import * as rules from "./rules";
import { TableState, Intent } from "./rules";
import { Card, Rank } from "./consts";

describe("Durak Rules Engine", () => {
  const getDummy = (id: string, rank: Rank = "6"): Card => ({ id, rank, suit: "clubs", value: 6 });
  
  const initialState: TableState = {
    deck: [{ id: "deck-dummy", rank: "A", suit: "hearts", value: 14 } as Card],
    trumps: { id: "t1", rank: "A", suit: "spades", value: 14 },
    players: [
      { id: 0, name: "P1" },
      { id: 1, name: "P2" },
      { id: 2, name: "P3" },
      { id: 3, name: "P4" },
    ],
    hands: [
      { playerId: 0, cards: [getDummy("h0-1"), getDummy("h0-2"), getDummy("h0-3")] },
      { playerId: 1, cards: [getDummy("h1-1"), getDummy("h1-2"), getDummy("h1-3")] },
      { playerId: 2, cards: [getDummy("h2-1"), getDummy("h2-2"), getDummy("h2-3")] },
      { playerId: 3, cards: [getDummy("h3-1"), getDummy("h3-2"), getDummy("h3-3")] },
    ],
    attack: [],
    defense: [],
    beaten: [],
    currentTurnId: 0,
    currentDefendId: 1,
    isGameOver: false,
    winner: null
  };

  it("should allow first attack", () => {
    const card: Card = { id: "c1", rank: "7", suit: "hearts", value: 7 };
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
    const intent: Intent = { action: "PASS", playerId: 1, cardId: "h1-1" }; // h1-1 is rank 6
    const outcome = rules.processIntent(state, intent);
    expect(outcome.type).toBe("SUCCESS");
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
    if (outcome.type === "GAME_OVER") {
        expect(outcome.winner).toBe("P2");
    }
  });

  it("should handle partial hand refill", () => {
      const cardsInDeck: Card[] = [
          { id: "deck1", rank: "K", suit: "hearts", value: 13 },
          { id: "deck2", rank: "A", suit: "hearts", value: 14 }
      ];
      const state: TableState = {
          ...initialState,
          deck: [...cardsInDeck],
          hands: initialState.hands.map(h => ({ ...h, cards: Array(5).fill(getDummy("d")) })),
          attack: [{ id: "a1", rank: "6", suit: "spades", value: 6 } as Card],
          defense: [{ id: "d1", rank: "7", suit: "spades", value: 7 } as Card],
          currentTurnId: 0,
          currentDefendId: 1
      };
      const intent: Intent = { action: "BEATEN", playerId: 0 };
      const outcome = rules.processIntent(state, intent);
      expect(outcome.type).toBe("SUCCESS");
      if (outcome.type === "SUCCESS") {
          expect(outcome.table.hands[0].cards.length).toBe(6);
          expect(outcome.table.hands[1].cards.length).toBe(6);
          expect(outcome.table.deck.length).toBe(0);
      }
  });
});
