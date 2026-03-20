import { describe, it, expect } from "vitest";
import { TableState, processIntent, Hand } from "./rules";
import { getDeck } from "./helpers";
import { Card, Rank, suits } from "./consts";

describe("Game Integrity Tests", () => {
  const checkIntegrity = (table: TableState) => {
    const allCards: Card[] = [
      ...table.deck,
      ...table.hands.flatMap(h => h.cards),
      ...table.attack,
      ...table.defense,
      ...table.beaten
    ];

    // 1. Exactly 36 cards exist
    expect(allCards.length).toBe(36);

    // 2. No card duplicates (by ID)
    const cardIds = allCards.map(c => c.id);
    const uniqueIds = new Set(cardIds);
    expect(uniqueIds.size).toBe(36);

    // 3. No card duplicates (by Suit/Rank)
    const cardKeys = allCards.map(c => `${c.rank}-${c.suit}`);
    const uniqueKeys = new Set(cardKeys);
    expect(uniqueKeys.size).toBe(36);

    // 4. Hands are consistent (playerId matches expectations)
    expect(table.hands.length).toBe(table.players.length);
    table.hands.forEach(hand => {
        expect(table.players.some(p => p.id === hand.playerId)).toBe(true);
    });
  };

  const checkNoIllegalTransfers = (prev: TableState, next: TableState) => {
      const tableCards = [...prev.attack, ...prev.defense];
      const deckCards = prev.deck;
      
      next.hands.forEach(nextHand => {
          const prevHand = prev.hands.find(h => h.playerId === nextHand.playerId);
          nextHand.cards.forEach(card => {
              const inPrevHand = prevHand?.cards.some(c => c.id === card.id);
              const inTable = tableCards.some(c => c.id === card.id);
              const inDeck = deckCards.some(c => c.id === card.id);
              
              const isAllowed = inPrevHand || inTable || inDeck;
              if (!isAllowed) {
                  throw new Error(`Illegal card transfer: Card ${card.id} found in player ${nextHand.playerId}'s hand was not in their hand, the deck, or on the table in the previous state.`);
              }
          });
      });
  }

  it("should maintain integrity after initial deal", () => {
    const deck = getDeck();
    const trumps = deck[deck.length - 1];
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
        beaten: [],
        currentTurnId: 0,
        currentDefendId: 1,
        isGameOver: false,
        winner: null
    };

    checkIntegrity(state);
  });

  it("should maintain integrity through various game actions", () => {
    const deck = getDeck();
    const trumps = deck[deck.length - 1];
    const players = [{ id: 0, name: "P1" }, { id: 1, name: "P2" }];
    
    let table: TableState = {
        deck: deck.slice(12),
        trumps,
        players,
        hands: [
            { playerId: 0, cards: deck.slice(0, 6) } as Hand,
            { playerId: 1, cards: deck.slice(6, 12) } as Hand
        ],
        attack: [],
        defense: [],
        beaten: [],
        currentTurnId: 0,
        currentDefendId: 1,
        isGameOver: false,
        winner: null
    };

    checkIntegrity(table);

    // 1. Attack
    const cardToAttack = table.hands[0].cards[0];
    const outcome1 = processIntent(table, { action: "ATTACK", playerId: 0, cardId: cardToAttack.id });
    expect(outcome1.type).toBe("SUCCESS");
    if (outcome1.type === "SUCCESS") {
        const nextTable = outcome1.table;
        checkIntegrity(nextTable);
        checkNoIllegalTransfers(table, nextTable);
        table = nextTable;
    }

    // 2. Defend
    const trumpsSuit = table.trumps.suit;
    let tableAfterDefend: TableState | null = null;
    
    for (const attackerCard of table.attack) {
        const defenderCards = table.hands[1].cards;
        const defenseCard = defenderCards.find(c => 
            (c.suit === attackerCard.suit && c.value > attackerCard.value) || 
            (c.suit === trumpsSuit && attackerCard.suit !== trumpsSuit)
        );

        if (defenseCard) {
            const outcome2 = processIntent(table, { action: "DEFEND", playerId: 1, cardId: defenseCard.id });
            if (outcome2.type === "SUCCESS") {
                tableAfterDefend = outcome2.table;
                checkIntegrity(tableAfterDefend);
                checkNoIllegalTransfers(table, tableAfterDefend);
                break;
            }
        }
    }

    if (tableAfterDefend) {
        const prevBeatenCount = table.beaten.length;
        const attackCount = tableAfterDefend.attack.length;
        const defenseCount = tableAfterDefend.defense.length;
        
        table = tableAfterDefend;
        // 3. Beaten (triggers refill)
        const outcome3 = processIntent(table, { action: "BEATEN", playerId: 0 });
        expect(outcome3.type).toBe("SUCCESS");
        if (outcome3.type === "SUCCESS") {
            const nextTable = outcome3.table;
            checkIntegrity(nextTable);
            checkNoIllegalTransfers(table, nextTable);
            
            // Verify beaten count
            expect(nextTable.beaten.length).toBe(prevBeatenCount + attackCount + defenseCount);
            table = nextTable;
        }
    }
  });

  it("should correctly increment beaten count with multiple cards in a bout", () => {
      const deck = getDeck();
      const trumps = deck[deck.length - 1];
      const players = [{ id: 0, name: "P1" }, { id: 1, name: "P2" }];
      // Pick a non-trump suit for attack
      const trumpsSuit = trumps.suit;
      const attackSuit = suits.find(s => s !== trumpsSuit)!;
      const otherSuit = suits.find(s => s !== trumpsSuit && s !== attackSuit)!;
      
      const a1 = deck.find(c => c.suit === attackSuit && c.rank === "6")!;
      const d1 = deck.find(c => c.suit === attackSuit && c.rank === "7")!;
      
      // a2 must have the same rank as a1 or d1 to be allowed as a follow-up attack
      const a2 = deck.find(c => c.suit === otherSuit && c.rank === a1.rank)!;
      const d2 = deck.find(c => c.suit === otherSuit && c.rank === d1.rank)!;
      
      const specialIds = new Set([a1.id, a2.id, d1.id, d2.id]);
      const otherCards = deck.filter(c => !specialIds.has(c.id));

      let table: TableState = {
          deck: otherCards.slice(8),
          trumps,
          players,
          hands: [
              { playerId: 0, cards: [a1, a2, ...otherCards.slice(0, 4)] } as Hand,
              { playerId: 1, cards: [d1, d2, ...otherCards.slice(4, 8)] } as Hand
          ],
          attack: [],
          defense: [],
          beaten: [],
          currentTurnId: 0,
          currentDefendId: 1,
          isGameOver: false,
          winner: null
      };

      const step = (t: TableState, intent: any) => {
          const outcome = processIntent(t, intent);
          if (outcome.type !== "SUCCESS") throw new Error(`Step failed: ${outcome.type === "ERROR" ? outcome.log : "GAME_OVER"}`);
          return outcome.table;
      };

      // 1. First Attack
      table = step(table, { action: "ATTACK", playerId: 0, cardId: a1.id });
      // 2. First Defend
      table = step(table, { action: "DEFEND", playerId: 1, cardId: d1.id });
      // 3. Second Attack
      table = step(table, { action: "ATTACK", playerId: 0, cardId: a2.id });
      // 4. Second Defend
      table = step(table, { action: "DEFEND", playerId: 1, cardId: d2.id });

      expect(table.attack.length).toBe(2);
      expect(table.defense.length).toBe(2);

      // 5. Beaten
      const outcome = processIntent(table, { action: "BEATEN", playerId: 0 });
      expect(outcome.type).toBe("SUCCESS");
      if (outcome.type === "SUCCESS") {
          expect(outcome.table.beaten.length).toBe(4);
          checkIntegrity(outcome.table);
      }
  });

  it("should correctly increment beaten count with 3 players adding cards", () => {
      const deck = getDeck();
      const players = [{ id: 0, name: "P1" }, { id: 1, name: "P2" }, { id: 2, name: "P3" }];
      
      const a1 = deck.find(c => c.rank === "6" && c.suit !== deck[deck.length-1].suit)!;
      const d1 = deck.find(c => c.rank === "7" && c.suit === a1.suit)!;
      const a2 = deck.find(c => c.rank === "7" && c.id !== d1.id && c.suit !== deck[deck.length-1].suit)!; // another 7
      const d2 = deck.find(c => c.rank === "8" && c.suit === a2.suit)!;

      const specialIds = new Set([a1.id, a2.id, d1.id, d2.id]);
      const otherCards = deck.filter(c => !specialIds.has(c.id));

      let table: TableState = {
          deck: otherCards.slice(14),
          trumps: deck[deck.length - 1],
          players,
          hands: [
              { playerId: 0, cards: [a1, ...otherCards.slice(0, 5)] } as Hand,
              { playerId: 1, cards: [d1, d2, ...otherCards.slice(5, 9)] } as Hand,
              { playerId: 2, cards: [a2, ...otherCards.slice(9, 14)] } as Hand
          ],
          attack: [],
          defense: [],
          beaten: [],
          currentTurnId: 0,
          currentDefendId: 1,
          isGameOver: false,
          winner: null
      };
      
      // Fix deck reference
      table.deck = otherCards.slice(14);

      const step = (t: TableState, intent: any) => {
          const outcome = processIntent(t, intent);
          if (outcome.type !== "SUCCESS") throw new Error(`Step failed: ${outcome.type === "ERROR" ? outcome.log : "GAME_OVER"}`);
          return outcome.table;
      };

      // 1. P0 attacks P1
      table = step(table, { action: "ATTACK", playerId: 0, cardId: a1.id });
      // 2. P1 defends
      table = step(table, { action: "DEFEND", playerId: 1, cardId: d1.id });
      // 3. P2 (non-defender) adds card a2 (a 7)
      table = step(table, { action: "ATTACK", playerId: 2, cardId: a2.id });
      // 4. P1 defends again
      table = step(table, { action: "DEFEND", playerId: 1, cardId: d2.id });

      expect(table.attack.length).toBe(2);
      expect(table.defense.length).toBe(2);

      // 5. Beaten
      const outcome = processIntent(table, { action: "BEATEN", playerId: 2 }); // P2 can close if they added cards?
      expect(outcome.type).toBe("SUCCESS");
      if (outcome.type === "SUCCESS") {
          expect(outcome.table.beaten.length).toBe(4);
          checkIntegrity(outcome.table);
      }
  });

  it("should maintain integrity during PASS (transfer)", () => {
    const deck = getDeck();
    const players = [{ id: 0, name: "P1" }, { id: 1, name: "P2" }, { id: 2, name: "P3" }];
    
    const rank: Rank = "J";
    const attackCard = deck.find(c => (c.rank as string) === (rank as string))!;
    const transferCard = deck.filter(c => (c.rank as string) === (rank as string))[1]!;
    
    const otherCards = deck.filter(c => c.id !== attackCard.id && c.id !== transferCard.id);

    let table: TableState = {
        deck: otherCards.slice(5),
        trumps: deck[deck.length - 1],
        players,
        hands: [
            { playerId: 0, cards: [attackCard] } as Hand,
            { playerId: 1, cards: [transferCard] } as Hand,
            { playerId: 2, cards: otherCards.slice(0, 5) } as Hand
        ],
        attack: [],
        defense: [],
        beaten: [],
        currentTurnId: 0,
        currentDefendId: 1,
        isGameOver: false,
        winner: null
    };

    checkIntegrity(table);

    // P1 attacks
    const o1 = processIntent(table, { action: "ATTACK", playerId: 0, cardId: attackCard.id });
    expect(o1.type).toBe("SUCCESS");
    if (o1.type === "SUCCESS") {
        const nextTable = o1.table;
        checkIntegrity(nextTable);
        checkNoIllegalTransfers(table, nextTable);
        table = nextTable;

        // P2 transfers
        const o2 = processIntent(table, { action: "PASS", playerId: 1, cardId: transferCard.id });
        expect(o2.type).toBe("SUCCESS");
        if (o2.type === "SUCCESS") {
            const finalTable = o2.table;
            checkIntegrity(finalTable);
            checkNoIllegalTransfers(table, finalTable);
            
            expect(finalTable.attack.length).toBe(2);
            expect(finalTable.currentDefendId).toBe(2);
        }
    }
  });

  it("should maintain integrity when player takes cards", () => {
      const deck = getDeck();
      const players = [{ id: 0, name: "P1" }, { id: 1, name: "P2" }];
      
      let table: TableState = {
          deck: deck.slice(12),
          trumps: deck[deck.length - 1],
          players,
          hands: [
              { playerId: 0, cards: deck.slice(0, 6) } as Hand,
              { playerId: 1, cards: deck.slice(6, 12) } as Hand
          ],
          attack: [],
          defense: [],
          beaten: [],
          currentTurnId: 0,
          currentDefendId: 1,
          isGameOver: false,
          winner: null
      };

      // P1 attacks
      const cardId = table.hands[0].cards[0].id;
      const o1 = processIntent(table, { action: "ATTACK", playerId: 0, cardId });
      if (o1.type === "SUCCESS") {
          const midTable = o1.table;
          checkIntegrity(midTable);
          checkNoIllegalTransfers(table, midTable);

          // P2 takes
          const oTake = processIntent(midTable, { action: "TAKE", playerId: 1 });
          expect(oTake.type).toBe("SUCCESS");
          if (oTake.type === "SUCCESS") {
              const finalTable = oTake.table;
              checkIntegrity(finalTable);
              checkNoIllegalTransfers(midTable, finalTable);
          }
      }
  });
});
