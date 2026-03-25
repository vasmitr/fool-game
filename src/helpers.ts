import { shuffle, uniqueId } from "underscore";
import _ from "underscore";
import { match, P } from "ts-pattern";
import { rankValues, suits, Card, Rank } from "./consts.js";
import { canBeat } from "./selectors.js";

export function getDeck(): Card[] {
  return shuffle(
    (Object.entries(rankValues) as [Rank, number][]).flatMap(([rank, value]) =>
      suits.map((suit) => ({ rank, value, suit, id: uniqueId() }))
    ) as Card[]
  );
}

function cardScore(
  c: Card,
  trumps: Card,
  deckSize: number,
  dir: number
): number {
  const trumpPenalty = match(dir)
    .with(P.number.lt(0), () => 0)
    .otherwise(() => (deckSize / 36) * 14);

  const isTrump = match(c.suit)
    .with(trumps.suit, () => trumpPenalty)
    .otherwise(() => 0);

  return dir * c.value + isTrump;
}

const getValidDefenses = (hand: Card[], target: Card, trumpSuit: string): Card[] =>
  hand.filter((c) => canBeat(c, target, trumpSuit));

const getSameRankCards = (hand: Card[], rank: string): Card[] =>
  hand.filter((c) => c.rank === rank);

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
      const validDefenses = getValidDefenses(playerCards, target, trumps.suit);
      const passCards = getSameRankCards(playerCards, target.rank);
      return match({ validDefenses, passCards, defenseCards })
        .with(
          { validDefenses: P.when((v) => v.length > 0) },
          ({ validDefenses }) => getBestValidDefense(validDefenses, trumps, deckSize)
        )
        .with(
          { passCards: P.when((p) => p.length > 0), defenseCards: [] },
          ({ passCards }) => ({ action: "PASS" as const, cardId: passCards[0]!.id })
        )
        .otherwise(() => ({ action: "TAKE" as const, cardId: target.id }));
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

      const validCards = match(attackCards)
        .with([], () => playerCards)
        .otherwise(() => playerCards.filter((c) => boutRanks.has(c.rank)));

      return match(validCards)
        .with([], () => null)
        .otherwise(() => {
          const dir = match(attackCards.length)
            .with(P.number.gt(defenseCards.length), () => -1)
            .otherwise(() => 1);

          const nonTrumps = validCards.filter((c) => c.suit !== trumps.suit);
          const candidates = match(nonTrumps.length)
            .with(P.number.gt(0), () => nonTrumps)
            .otherwise(() => validCards);

          return selectBestAttack(candidates, trumps, deckSize, dir);
        });
    });
}
