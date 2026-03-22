import { describe, it, expect } from "vitest";
import { getDeck, findBestDefense, findBestAttack, refillHands } from "./helpers";
import type { Card, Rank, Suit } from "./consts";

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

  it("should pass (transfer) on a fresh table", () => {
    const attackCards: Card[] = [{ id: "a1", rank: "10", suit: "spades", value: 10 }];
    const playerCards: Card[] = [{ id: "p1", rank: "10", suit: "clubs", value: 10 }];
    const action = findBestDefense(playerCards, attackCards, [], trumps, 36);
    expect(action).toEqual({ action: "PASS", cardId: "p1" });
  });

  it("should NOT pass (transfer) if table already has defense cards", () => {
    const attackCards: Card[] = [
      { id: "a1", rank: "6", suit: "spades", value: 6 },
      { id: "a2", rank: "10", suit: "diamonds", value: 10 }
    ];
    const defenseCards: Card[] = [
      { id: "d1", rank: "7", suit: "spades", value: 7 }
    ];
    const playerCards: Card[] = [
      { id: "p1", rank: "10", suit: "clubs", value: 10 }
    ];
    const action = findBestDefense(playerCards, attackCards, defenseCards, trumps, 36);
    expect(action).toEqual({ action: "TAKE", cardId: "a2" });
  });

  it("should defeat with a higher card", () => {
    const attackCards: Card[] = [{ id: "a1", rank: "10", suit: "spades", value: 10 }];
    const playerCards: Card[] = [{ id: "p1", rank: "J", suit: "spades", value: 11 }];
    const action = findBestDefense(playerCards, attackCards, [], trumps, 36);
    expect(action).toEqual({ action: "DEFEND", cardId: "p1" });
  });

  it("should take if no defense possible", () => {
    const attackCards: Card[] = [{ id: "a1", rank: "A", suit: "spades", value: 14 }];
    const playerCards: Card[] = [{ id: "p1", rank: "7", suit: "clubs", value: 7 }];
    const action = findBestDefense(playerCards, attackCards, [], trumps, 36);
    expect(action).toEqual({ action: "TAKE", cardId: "a1" });
  });

  it("should use the minimum sufficient card, not the first found", () => {
    const attackCards: Card[] = [{ id: "a1", rank: "8", suit: "spades", value: 8 }];
    const playerCards: Card[] = [
      { id: "p1", rank: "A", suit: "spades", value: 14 },
      { id: "p2", rank: "9", suit: "spades", value: 9 },
    ];
    // Both beat 8♠; 9♠ is cheaper — pick p2
    const action = findBestDefense(playerCards, attackCards, [], trumps, 36);
    expect(action).toEqual({ action: "DEFEND", cardId: "p2" });
  });

  it("early game: should prefer same-suit card over trump", () => {
    const attackCards: Card[] = [{ id: "a1", rank: "8", suit: "spades", value: 8 }];
    const playerCards: Card[] = [
      { id: "p1", rank: "7" as Rank, suit: "hearts" as Suit, value: 7 },  // trump 7 — beats non-trump
      { id: "p2", rank: "9" as Rank, suit: "spades" as Suit, value: 9 },  // same-suit 9
    ];
    // Full deck: score(trump 7) = 7 + 14 = 21 vs score(9♠) = 9 → pick p2
    const action = findBestDefense(playerCards, attackCards, [], trumps, 36);
    expect(action).toEqual({ action: "DEFEND", cardId: "p2" });
  });

  it("late game: should use trump when it is cheaper than the same-suit option", () => {
    const attackCards: Card[] = [{ id: "a1", rank: "8", suit: "spades", value: 8 }];
    const playerCards: Card[] = [
      { id: "p1", rank: "7", suit: "hearts", value: 7 },  // trump 7
      { id: "p2", rank: "K", suit: "spades", value: 13 }, // same-suit K
    ];
    // Empty deck: score(trump 7) = 7 vs score(K♠) = 13 → pick p1
    const action = findBestDefense(playerCards, attackCards, [], trumps, 0);
    expect(action).toEqual({ action: "DEFEND", cardId: "p1" });
  });
});

describe("findBestAttack", () => {
  const trumps: Card = { id: "t1", rank: "6", suit: "hearts", value: 6 };

  it("should pick lowest card for initial attack", () => {
    const playerCards: Card[] = [
      { id: "p1", rank: "A", suit: "spades", value: 14 },
      { id: "p2", rank: "6", suit: "clubs", value: 6 },
    ];
    const action = findBestAttack(playerCards, [], [], trumps, 6, 36);
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
    const action = findBestAttack(playerCards, tableCards, [], trumps, 6, 36);
    expect(action).toEqual({ action: "ATTACK", cardId: "p1" });
  });

  it("should avoid trumps if possible", () => {
    const playerCards: Card[] = [
      { id: "p1", rank: "6", suit: "hearts", value: 6 }, // trump
      { id: "p2", rank: "7", suit: "clubs", value: 7 },  // non-trump
    ];
    const action = findBestAttack(playerCards, [], [], trumps, 6, 36);
    expect(action).toEqual({ action: "ATTACK", cardId: "p2" });
  });

  it("should return null if no valid rank to throw", () => {
    const playerCards: Card[] = [
      { id: "p1", rank: "10", suit: "clubs", value: 10 },
    ];
    const tableCards: Card[] = [
      { id: "a1", rank: "J", suit: "spades", value: 11 },
    ];
    const action = findBestAttack(playerCards, tableCards, [], trumps, 6, 36);
    expect(action).toBeNull();
  });

  it("should respect defender hand limit", () => {
    const playerCards: Card[] = [
      { id: "p1", rank: "10", suit: "clubs", value: 10 },
    ];
    const attackCards: Card[] = [
      { id: "a1", rank: "J", suit: "spades", value: 11 },
    ];
    const action = findBestAttack(playerCards, attackCards, [], trumps, 1, 36);
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
      { id: "d1", rank: "A", suit: "hearts", value: 14 },
    ];
    const action = findBestAttack(playerCards, attackCards, defenseCards, trumps, 6, 36);
    expect(action).toEqual({ action: "ATTACK", cardId: "p1" });
  });

  it("should NOT throw a card if its rank is not on the table", () => {
    const playerCards: Card[] = [
      { id: "p1", rank: "K", suit: "clubs", value: 13 },
    ];
    const attackCards: Card[] = [
      { id: "a1", rank: "6", suit: "spades", value: 6 },
    ];
    const defenseCards: Card[] = [
      { id: "d1", rank: "7", suit: "spades", value: 7 },
    ];
    const action = findBestAttack(playerCards, attackCards, defenseCards, trumps, 6, 36);
    expect(action).toBeNull();
  });

  it("when defender is losing: should pile on with highest card", () => {
    const playerCards: Card[] = [
      { id: "p1", rank: "6", suit: "clubs", value: 6 },
      { id: "p2", rank: "K", suit: "clubs", value: 13 },
    ];
    const attackCards: Card[] = [
      { id: "a1", rank: "6", suit: "spades", value: 6 },   // undefended
      { id: "a2", rank: "K", suit: "spades", value: 13 },  // undefended
    ];
    // defenderIsLosing=true → dir=-1 → prefer highest; both non-trump
    // score(6♣)=-6, score(K♣)=-13 → pick K♣
    const action = findBestAttack(playerCards, attackCards, [], trumps, 6, 36);
    expect(action).toEqual({ action: "ATTACK", cardId: "p2" });
  });

  it("when defender is losing and only trumps available: should pile on with highest trump", () => {
    const playerCards: Card[] = [
      { id: "p1", rank: "6", suit: "hearts", value: 6 },  // trump 6
      { id: "p2", rank: "A", suit: "hearts", value: 14 }, // trump ace
    ];
    const attackCards: Card[] = [
      { id: "a1", rank: "6", suit: "spades", value: 6 },  // undefended — rank 6 valid
      { id: "a2", rank: "A", suit: "spades", value: 14 }, // undefended — rank A valid
    ];
    // defenderIsLosing=true → dir=-1, trumpPenalty=0
    // nonTrumps=[] → candidates=all trumps
    // score(6♥)=-6, score(A♥)=-14 → pick trump ace
    const action = findBestAttack(playerCards, attackCards, [], trumps, 6, 36);
    expect(action).toEqual({ action: "ATTACK", cardId: "p2" });
  });
});

describe("advanced rules", () => {
  it("should refill hands to 6 cards", () => {
    const hands: { playerId: number; cards: Card[] }[] = [
        { playerId: 0, cards: [{ id: "c1", rank: "A", suit: "spades", value: 14 }] },
    ];
    const deck: Card[] = [
        { id: "d1", rank: "6", suit: "clubs", value: 6 },
        { id: "d2", rank: "7", suit: "clubs", value: 7 },
        { id: "d3", rank: "8", suit: "clubs", value: 8 },
        { id: "d4", rank: "9", suit: "clubs", value: 9 },
        { id: "d5", rank: "10", suit: "clubs", value: 10 },
        { id: "d6", rank: "J", suit: "clubs", value: 11 },
    ];
    const result = refillHands(hands, deck);
    expect(result.hands[0]?.cards.length).toBe(6);
    expect(result.deck.length).toBe(1);
  });
});
