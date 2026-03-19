import { describe, it, expect } from "vitest";
import { getDeck, findBestDefense, findBestAttack, refillHands } from "./helpers";
import type { Card } from "./consts";

describe("getDeck", () => {
  it("should return a deck of 36 cards", () => {
    const deck = getDeck();
    expect(deck.length).toBe(36);
  });

  it("should return a shuffled deck", () => {
    const deck1 = getDeck();
    const deck2 = getDeck();
    expect(deck1).not.toEqual(deck2);
  });
});

describe("findBestDefense", () => {
  const trumps: Card = { id: "t1", rank: "6", suit: "hearts", value: 6 };

  it("should pass", () => {
    const attackCards: Card[] = [{ id: "a1", rank: "10", suit: "spades", value: 10 }];
    const playerCards: Card[] = [{ id: "p1", rank: "10", suit: "clubs", value: 10 }];
    const action = findBestDefense(playerCards, attackCards, [], trumps);
    expect(action).toEqual({ action: "PASS", cardId: "p1" });
  });

  it("should defeat", () => {
    const attackCards: Card[] = [{ id: "a1", rank: "10", suit: "spades", value: 10 }];
    const playerCards: Card[] = [{ id: "p1", rank: "J", suit: "spades", value: 11 }];
    const action = findBestDefense(playerCards, attackCards, [], trumps);
    expect(action).toEqual({ action: "DEFEND", cardId: "p1" });
  });

  it("should take", () => {
    const attackCards: Card[] = [{ id: "a1", rank: "A", suit: "spades", value: 14 }];
    const playerCards: Card[] = [{ id: "p1", rank: "7", suit: "clubs", value: 7 }];
    const action = findBestDefense(playerCards, attackCards, [], trumps);
    expect(action).toEqual({ action: "TAKE", cardId: "a1" });
  });
});

describe("findBestAttack", () => {
  const trumps: Card = { id: "t1", rank: "6", suit: "hearts", value: 6 };

  it("should pick lowest card for initial attack", () => {
    const playerCards: Card[] = [
      { id: "p1", rank: "A", suit: "spades", value: 14 },
      { id: "p2", rank: "6", suit: "clubs", value: 6 },
    ];
    const action = findBestAttack(playerCards, [], [], trumps, 6);
    expect(action).toEqual({ action: "ATTACK", cardId: "p2" });
  });

  it("should pick lowest card among valid ranks", () => {
    const playerCards: Card[] = [
      { id: "p1", rank: "A", suit: "spades", value: 14 },
      { id: "p2", rank: "6", suit: "clubs", value: 6 },
    ];
    const tableCards: Card[] = [
      { id: "a1", rank: "A", suit: "diamonds", value: 14 },
    ];
    const action = findBestAttack(playerCards, tableCards, [], trumps, 6);
    expect(action).toEqual({ action: "ATTACK", cardId: "p1" });
  });

  it("should avoid trumps if possible", () => {
    const playerCards: Card[] = [
      { id: "p1", rank: "6", suit: "hearts", value: 6 }, // trump
      { id: "p2", rank: "7", suit: "clubs", value: 7 }, // non-trump
    ];
    const action = findBestAttack(playerCards, [], [], trumps, 6);
    expect(action).toEqual({ action: "ATTACK", cardId: "p2" });
  });

  it("should return null if no valid rank to throw", () => {
    const playerCards: Card[] = [
      { id: "p1", rank: "10", suit: "clubs", value: 10 },
    ];
    const tableCards: Card[] = [
      { id: "a1", rank: "J", suit: "spades", value: 11 },
    ];
    const action = findBestAttack(playerCards, tableCards, [], trumps, 6);
    expect(action).toBeNull();
  });

  it("should respect defender hand limit", () => {
    const playerCards: Card[] = [
      { id: "p1", rank: "10", suit: "clubs", value: 10 },
    ];
    const attackCards: Card[] = [
        { id: "a1", rank: "J", suit: "spades", value: 11 },
    ];
    // Defender has only 1 card, and there's already 1 card on the table
    const action = findBestAttack(playerCards, attackCards, [], trumps, 1);
    expect(action).toBeNull();
  });

  it("should match ranks from defense pool", () => {
    const playerCards: Card[] = [
      { id: "p1", rank: "A", suit: "clubs", value: 14 },
    ];
    const attackCards: Card[] = [
      { id: "a1", rank: "6", suit: "spades", value: 6 },
    ];
    const defenseCards: Card[] = [
      { id: "d1", rank: "A", suit: "hearts", value: 14 }, // rank A
    ];
    const action = findBestAttack(playerCards, attackCards, defenseCards, trumps, 6);
    expect(action).toEqual({ action: "ATTACK", cardId: "p1" });
  });
});

describe("advanced rules", () => {
  const trumps: Card = { id: "t1", rank: "6", suit: "hearts", value: 6 };

  it("should refill hands to 6 cards", () => {
    const hands = [
        { playerId: 0, cards: [{ id: "c1", rank: "A", suit: "spades", value: 14 }] },
    ];
    const deck = [
        { id: "d1", rank: "6", suit: "clubs", value: 6 },
        { id: "d2", rank: "7", suit: "clubs", value: 7 },
        { id: "d3", rank: "8", suit: "clubs", value: 8 },
        { id: "d4", rank: "9", suit: "clubs", value: 9 },
        { id: "d5", rank: "10", suit: "clubs", value: 10 },
        { id: "d6", rank: "J", suit: "clubs", value: 11 },
    ];
    const result = refillHands(hands, deck);
    expect(result.hands[0].cards.length).toBe(6);
    expect(result.deck.length).toBe(1);
  });
});
