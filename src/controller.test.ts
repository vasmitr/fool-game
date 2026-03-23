import { describe, it, expect } from "vitest";
import { selectKS } from "./controller.js";
import type { KnowledgeSource } from "./store.js";
import type { TableState } from "./rules.js";
import type { Card } from "./consts.js";

const card = (id: string): Card => ({ id, rank: "6", suit: "clubs", value: 6 });

const baseState: TableState = {
  deck: [],
  trumps: card("trump"),
  players: [
    { id: 0, name: "Human" },
    { id: 1, name: "AI-1" },
    { id: 2, name: "AI-2" },
    { id: 3, name: "AI-3" },
  ],
  hands: [
    { playerId: 0, cards: [card("h0")] },
    { playerId: 1, cards: [card("h1")] },
    { playerId: 2, cards: [card("h2")] },
    { playerId: 3, cards: [card("h3")] },
  ],
  attack: [],
  defense: [],
  discardPile: [],
  currentTurnId: 0,
  currentDefendId: 1,
  isGameOver: false,
  winner: null,
};

const makeKS = (playerId: number, canAct = true): KnowledgeSource => ({
  playerId,
  canAct: () => canAct,
  propose: () => null,
});

describe("selectKS", () => {
  it("selects the AI defender first when there are undefended cards", () => {
    const state = { ...baseState, attack: [card("a1")], defense: [] };
    // currentDefendId = 1 (AI)
    const ks = [makeKS(0), makeKS(1), makeKS(2), makeKS(3)];
    expect(selectKS(state, ks)?.playerId).toBe(1);
  });

  it("never selects the human even when human is the defender", () => {
    // Human defends via intent$ directly — controller must not block waiting for them
    const state = {
      ...baseState,
      attack: [card("a1")],
      defense: [],
      currentTurnId: 1,
      currentDefendId: 0, // human defends
    };
    const ks = [makeKS(0), makeKS(1), makeKS(2), makeKS(3)];
    // No AI defender → falls through; AI-1 is primary attacker but not defender
    // AI-2, AI-3 are throw-ins but no undefended card context for them
    expect(selectKS(state, ks)?.playerId).not.toBe(0);
  });

  it("selects AI primary attacker when all attacks are defended", () => {
    const state = {
      ...baseState,
      attack: [card("a1")],
      defense: [card("d1")],
      currentTurnId: 2, // AI is primary attacker
    };
    const ks = [makeKS(0), makeKS(1), makeKS(2), makeKS(3)];
    expect(selectKS(state, ks)?.playerId).toBe(2);
  });

  it("selects AI throw-in when human is the primary attacker", () => {
    const state = {
      ...baseState,
      attack: [card("a1")],
      defense: [card("d1")],
      currentTurnId: 0, // human is primary attacker
    };
    const ks = [makeKS(0), makeKS(1, false), makeKS(2), makeKS(3, false)];
    expect(selectKS(state, ks)?.playerId).toBe(2);
  });

  it("returns undefined when no AI can act (human acts via intent$)", () => {
    const state = {
      ...baseState,
      attack: [card("a1")],
      defense: [card("d1")],
      currentTurnId: 0,
    };
    const ks = [makeKS(0), makeKS(1, false), makeKS(2, false), makeKS(3, false)];
    expect(selectKS(state, ks)).toBeUndefined();
  });

  it("returns undefined when nobody can act", () => {
    const ks = [makeKS(0, false), makeKS(1, false), makeKS(2, false), makeKS(3, false)];
    expect(selectKS(baseState, ks)).toBeUndefined();
  });
});
