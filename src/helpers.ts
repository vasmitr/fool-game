import { shuffle, uniqueId } from "underscore";
import _ from "underscore";
import { match, P } from "ts-pattern";
import { rankValues, suits, Card, Rank } from "./consts.js";

export function getDeck(): Card[] {
  return shuffle(
    (Object.entries(rankValues) as [Rank, number][]).flatMap(([rank, value]) =>
      suits.map((suit) => ({ rank, value, suit, id: uniqueId() }))
    ) as Card[]
  );
}

export function cardScore(
  c: Card,
  trumps: Card,
  deckSize: number,
  dir: number
): number {
  const trumpPenalty = match(dir < 0)
    .with(true, () => 0)
    .otherwise(() => (deckSize / 36) * 14);

  const isTrump = match(c.suit === trumps.suit)
    .with(true, () => trumpPenalty)
    .otherwise(() => 0);

  return dir * c.value + isTrump;
}

const getBestValidDefense = (validDefenses: Card[], trumps: Card, deckSize: number) =>
  match(_.chain(validDefenses).sortBy((c) => cardScore(c, trumps, deckSize, 1)).value()[0])
    .with(P.nonNullable, (c) => ({ action: "DEFEND" as const, cardId: c.id }))
    .otherwise(() => null);

export function findBestDefense(
  playerCards: Card[],
  attackCards: Card[],
  defenseCards: Card[],
  trumps: Card,
  deckSize: number
): { action: "DEFEND" | "PASS" | "TAKE"; cardId: string } | null {
  const indexToDefend = defenseCards.length;
  const cardToDefend = attackCards[indexToDefend];

  return match(cardToDefend)
    .with(P.nullish, () => null)
    .with(P.nonNullable, (target) => {
      const validDefenses = playerCards.filter(
        (c) =>
          match(c.value > target.value).with(true, () => c.suit === target.suit).otherwise(() => false) ||
          match(c.suit === trumps.suit).with(true, () => target.suit !== trumps.suit).otherwise(() => false)
      );

      return match(validDefenses.length > 0)
        .with(true, () => getBestValidDefense(validDefenses, trumps, deckSize))
        .otherwise(() =>
          match(playerCards.filter((c) => c.rank === target.rank))
            .with(
              P.when((cards) => match(cards.length > 0).with(true, () => defenseCards.length === 0).otherwise(() => false)),
              (cards) => match(cards[0])
                .with(P.nonNullable, (c) => ({ action: "PASS" as const, cardId: c.id }))
                .otherwise(() => ({ action: "TAKE" as const, cardId: target.id }))
            )
            .otherwise(() => ({ action: "TAKE" as const, cardId: target.id }))
        );
    })
    .exhaustive();
}

const selectBestAttack = (candidates: Card[], trumps: Card, deckSize: number, dir: number) =>
  match(_.chain(candidates).sortBy((c) => cardScore(c, trumps, deckSize, dir)).value()[0])
    .with(P.nonNullable, (c) => ({ action: "ATTACK" as const, cardId: c.id }))
    .otherwise(() => null);

export function findBestAttack(
  playerCards: Card[],
  attackCards: Card[],
  defenseCards: Card[],
  trumps: Card,
  defenderHandCount: number,
  deckSize: number
): { action: "ATTACK"; cardId: string } | null {
  return match({
    noCards: playerCards.length === 0,
    fullTable: attackCards.length >= defenderHandCount
  })
    .with({ noCards: true }, () => null)
    .with({ fullTable: true }, () => null)
    .otherwise(() => {
      const boutRanks = new Set(
        [...attackCards, ...defenseCards].map((c) => c.rank)
      );

      const validCards = match(attackCards.length === 0)
        .with(true, () => playerCards)
        .otherwise(() => playerCards.filter((c) => boutRanks.has(c.rank)));

      return match(validCards.length === 0)
        .with(true, () => null)
        .otherwise(() => {
          const dir = match(attackCards.length > defenseCards.length)
            .with(true, () => -1)
            .otherwise(() => 1);

          const nonTrumps = validCards.filter((c) => c.suit !== trumps.suit);
          const candidates = match(nonTrumps.length > 0)
            .with(true, () => nonTrumps)
            .otherwise(() => validCards);

          return selectBestAttack(candidates, trumps, deckSize, dir);
        });
    });
}
