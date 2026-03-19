import { describe, it, expect } from "vitest";
import * as rules from "./rules";
import { Card } from "./consts";

describe("rules.processIntent", () => {
  const trumps: Card = { id: "t1", rank: "6", suit: "hearts", value: 6 };
  const players = [
    { id: 0, name: "Einstein" },
    { id: 1, name: "Curie" }
  ];
  
  const initialState: rules.TableState = {
    deck: [],
    trumps,
    players,
    hands: [
      { playerId: 0, cards: [{ id: "c1", rank: "6", suit: "spades", value: 6 }, { id: "c2", rank: "10", suit: "spades", value: 10 }] },
      { playerId: 1, cards: [{ id: "c3", rank: "7", suit: "spades", value: 7 }] }
    ],
    attack: [],
    defense: [],
    beaten: [],
    currentTurnId: 0,
    currentDefendId: 1
  };

  it("should allow first attack", () => {
    const intent = { action: "ATTACK", playerId: 0, cardId: "c1" };
    const outcome = rules.processIntent(initialState, intent);
    expect(outcome.type).toBe("SUCCESS");
    if (outcome.type === "SUCCESS") {
      expect(outcome.table.attack.length).toBe(1);
      expect(outcome.table.attack[0].id).toBe("c1");
    }
  });

  it("should reject attack with invalid rank", () => {
    const stateWithAttack = { ...initialState, attack: [{ id: "a1", rank: "A", suit: "clubs", value: 14 }] };
    const intent = { action: "ATTACK", playerId: 0, cardId: "c2" }; // Rank 10 vs Rank A
    const outcome = rules.processIntent(stateWithAttack, intent);
    expect(outcome.type).toBe("ERROR");
    if (outcome.type === "ERROR") {
      expect(outcome.log).toContain("Invalid attack");
    }
  });

  it("should allow valid defense", () => {
    const stateToDefend = { ...initialState, attack: [{ id: "a1", rank: "6", suit: "spades", value: 6 }] };
    const intent = { action: "DEFEND", playerId: 1, cardId: "c3" }; // 7s beats 6s
    const outcome = rules.processIntent(stateToDefend, intent);
    expect(outcome.type).toBe("SUCCESS");
  });

  it("should reject invalid defense", () => {
    const stateToDefend = { ...initialState, attack: [{ id: "a1", rank: "10", suit: "spades", value: 10 }] };
    const intent = { action: "DEFEND", playerId: 1, cardId: "c3" }; // 7s cannot beat 10s
    const outcome = rules.processIntent(stateToDefend, intent);
    expect(outcome.type).toBe("ERROR");
  });

  it("should allow transfer (PASS) on fresh table", () => {
    const stateToPassCorrect: rules.TableState = { 
        ...initialState, 
        deck: [{ id: "d-deck", rank: "A", suit: "clubs", value: 14 }],
        attack: [{ id: "a0", rank: "7", suit: "diamonds", value: 7 }],
        hands: [
            { playerId: 0, cards: [{ id: "p0c1", rank: "K", suit: "hearts", value: 13 }] },
            { playerId: 1, cards: [{ id: "c3", rank: "7", suit: "spades", value: 7 }] }
        ]
    };
    const intentCorrect = { action: "PASS", playerId: 1, cardId: "c3" };
    const outcome = rules.processIntent(stateToPassCorrect, intentCorrect);
    expect(outcome.type).toBe("SUCCESS");
    if (outcome.type === "SUCCESS") {
        expect(outcome.table.currentDefendId).toBe(0); // Rotated
    }
  });

  it("should allow TAKE", () => {
    const state = { ...initialState, attack: [{ id: "a1", rank: "A", suit: "spades", value: 14 }] };
    const intent = { action: "TAKE", playerId: 1 };
    const outcome = rules.processIntent(state, intent);
    expect(outcome.type).toBe("SUCCESS");
    if (outcome.type === "SUCCESS") {
        expect(outcome.table.attack.length).toBe(0);
        expect(outcome.table.hands.find(h => h.playerId === 1)?.cards.length).toBe(2); // Got the A
    }
  });

  it("should allow BEATEN", () => {
    const state = { 
        ...initialState, 
        attack: [{ id: "a1", rank: "6", suit: "spades", value: 6 }],
        defense: [{ id: "d1", rank: "7", suit: "spades", value: 7 }]
    };
    const intent = { action: "BEATEN", playerId: 0 };
    const outcome = rules.processIntent(state, intent);
    expect(outcome.type).toBe("SUCCESS");
    if (outcome.type === "SUCCESS") {
        expect(outcome.table.beaten.length).toBe(2);
        expect(outcome.table.attack.length).toBe(0);
    }
  });

  it("should detect GAME_OVER", () => {
    const emptyState = { 
        ...initialState, 
        deck: [], 
        hands: [
            { playerId: 0, cards: [] },
            { playerId: 1, cards: [{ id: "c3", rank: "7", suit: "spades", value: 7 }] }
        ]
    };
    const intent = { action: "ATTACK", playerId: 1, cardId: "c3" };
    const outcome = rules.processIntent(emptyState, intent);
    expect(outcome.type).toBe("GAME_OVER");
    if (outcome.type === "GAME_OVER") {
        expect(outcome.winner).toBe("Einstein");
    }
  });
});
