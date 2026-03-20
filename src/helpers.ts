import { shuffle, uniqueId } from "underscore";
import { rankValues, suits, Card, Rank } from "./consts";

export function getDeck(): Card[] {
  const deck = (Object.entries(rankValues) as [Rank, number][]).flatMap(([rank, value]) =>
    suits.map((suit) => ({ rank, value, suit, id: uniqueId() })),
  ) as Card[];
  return shuffle(deck);
}

// dir=1: prefer lowest card (save strong ones).
// dir=-1: prefer highest card (pile on / spend freely).
// Trump penalty scales with deck fullness; disappears when dir=-1 (already spending).
function cardScore(c: Card, trumps: Card, deckSize: number, dir: number): number {
  const trumpPenalty = dir < 0 ? 0 : (deckSize / 36) * 14;
  return dir * c.value + (c.suit === trumps.suit ? trumpPenalty : 0);
}

export function findBestDefense(
  playerCards: Card[],
  attackCards: Card[],
  defenseCards: Card[],
  trumps: Card,
  deckSize: number,
) {
  const indexToDefend = defenseCards.length;
  if (indexToDefend >= attackCards.length) return null;

  const cardToDefend = attackCards[indexToDefend];

  const validDefenses = playerCards.filter(
    (c) =>
      (c.value > cardToDefend.value && c.suit === cardToDefend.suit) ||
      (c.suit === trumps.suit && cardToDefend.suit !== trumps.suit),
  );

  if (validDefenses.length > 0) {
    const bestDefense = validDefenses.reduce((prev, curr) =>
      cardScore(curr, trumps, deckSize, 1) < cardScore(prev, trumps, deckSize, 1)
        ? curr
        : prev,
    );
    return { action: "DEFEND", cardId: bestDefense.id };
  }

  const sameRankCards = playerCards.filter(
    (c) => c.rank === cardToDefend.rank,
  );
  if (sameRankCards.length > 0 && defenseCards.length === 0) {
    return { action: "PASS", cardId: sameRankCards[0].id };
  }

  return { action: "TAKE", cardId: cardToDefend.id };
}

export function findBestAttack(
  playerCards: Card[],
  attackCards: Card[],
  defenseCards: Card[],
  trumps: Card,
  defenderHandCount: number,
  deckSize: number,
) {
  if (playerCards.length === 0) return null;
  if (attackCards.length >= defenderHandCount) return null;

  // ALL cards on the table in this bout
  const boutCards = [...attackCards, ...defenseCards];
  const boutRanks = new Set(boutCards.map((c) => c.rank));

  // Valid cards we can throw
  const validCards =
    boutCards.length === 0
      ? playerCards // All cards are valid for initial attack
      : playerCards.filter((c) => boutRanks.has(c.rank));

  if (validCards.length === 0) return null;

  // When defender is losing (undefended cards exist), flip to highest card to
  // maximize what they take; otherwise preserve strong cards and avoid trumps.
  // dir=-1 when defender is losing: flip to highest card to maximize their take.
  const dir = attackCards.length > defenseCards.length ? -1 : 1;

  const nonTrumps = validCards.filter((c) => c.suit !== trumps.suit);
  const candidates = nonTrumps.length > 0 ? nonTrumps : validCards;

  const bestCard = candidates.reduce((prev, curr) =>
    cardScore(curr, trumps, deckSize, dir) < cardScore(prev, trumps, deckSize, dir)
      ? curr
      : prev,
  );

  return { action: "ATTACK", cardId: bestCard.id };
}

export function refillHands(
  hands: { playerId: number; cards: Card[] }[],
  deck: Card[],
) {
  const newHands = hands.map((h) => ({ ...h, cards: [...h.cards] }));
  const newDeck = [...deck];

  // Refill starting from anyone who has less than 6 cards
  // Note: Standard rule is to refill in order starting from attacker,
  // but here we just ensure everyone gets their 6.
  newHands.forEach((hand) => {
    while (hand.cards.length < 6 && newDeck.length > 0) {
      hand.cards.push(newDeck.shift()!);
    }
  });

  return { hands: newHands, deck: newDeck };
}
