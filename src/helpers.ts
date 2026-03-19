import { shuffle, uniqueId } from "underscore";
import { rankValues, suits } from "./consts";

export function getDeck() {
  const deck = Object.entries(rankValues).flatMap(([rank, value]) =>
    suits.map((suit) => ({ rank, value, suit, id: uniqueId() })),
  ) as Card[];
  return shuffle(deck);
}

export function findBestDefense(
  playerCards: Card[],
  attackCards: Card[],
  defenseCards: Card[],
  trumps: Card,
) {
  const indexToDefend = defenseCards.length;
  if (indexToDefend >= attackCards.length) return null;

  const cardToDefend = attackCards[indexToDefend];

  const sameRankCards = playerCards.filter(
    (playerCard) => playerCard.rank === cardToDefend.rank,
  );

  const higherCard = playerCards.find(
    (playerCard) =>
      (playerCard.value > cardToDefend.value &&
        playerCard.suit === cardToDefend.suit) ||
      (playerCard.suit === trumps.suit && cardToDefend.suit !== trumps.suit),
  );

  if (higherCard) {
    return { action: "DEFEND", cardId: higherCard.id };
  }

  if (sameRankCards.length > 0) {
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

  // Strategy: Play lowest non-trump card first
  const nonTrumps = validCards.filter((c) => c.suit !== trumps.suit);
  const candidates = nonTrumps.length > 0 ? nonTrumps : validCards;

  const bestCard = candidates.reduce((prev, curr) =>
    curr.value < prev.value ? curr : prev,
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
