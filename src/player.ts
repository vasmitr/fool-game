import { Observable, of, delay, first } from "rxjs";
import { match, P } from "ts-pattern";
import _ from "underscore";
import { registerKS, intent$ } from "./store.js";
import { findBestDefense, findBestAttack } from "./helpers.js";
import type { TableState, Intent } from "./rules.js";
import { AI_DELAY_MS } from "./consts.js";
import {
  getHand,
  getDefenderHandCount,
  isDefender,
  isPrimaryAttacker,
  canEndBout,
  hasUndefendedCards
} from "./selectors.js";

const computeIntent = (playerId: number, table: TableState): Intent | null => {
  const myHand = getHand(table, playerId);

  return match({
    isDefender: isDefender(table, playerId),
    isPrimary: isPrimaryAttacker(table, playerId),
    canThrowIn:
      table.attack.length > 0 &&
      table.attack.length < getDefenderHandCount(table)
  })
    .with({ isDefender: true }, () =>
      match(
        findBestDefense(
          myHand,
          table.attack,
          table.defense,
          table.trumps,
          table.deck.length
        )
      )
        .with(null, () => null)
        .with({ action: "TAKE" }, () => ({ action: "TAKE" as const, playerId }))
        .otherwise((s) => ({ action: s.action, playerId, cardId: s.cardId }))
    )
    .with({ isPrimary: true }, () =>
      match(
        findBestAttack(
          myHand,
          table.attack,
          table.defense,
          table.trumps,
          getDefenderHandCount(table),
          table.deck.length
        )
      )
        .with(P.nonNullable, (s) => ({
          action: "ATTACK" as const,
          playerId,
          cardId: s.cardId
        }))
        .otherwise(() =>
          match(canEndBout(table))
            .with(true, () => ({ action: "BEATEN" as const, playerId }))
            .otherwise(() => null)
        )
    )
    .with({ canThrowIn: true }, () =>
      match(
        findBestAttack(
          myHand,
          table.attack,
          table.defense,
          table.trumps,
          getDefenderHandCount(table),
          table.deck.length
        )
      )
        .with(P.nonNullable, (s) => ({
          action: "ATTACK" as const,
          playerId,
          cardId: s.cardId
        }))
        .otherwise(() => null)
    )
    .otherwise(() => null);
};

const canAct =
  (playerId: number) =>
  (table: TableState): boolean =>
    match({
      isGameOver: table.isGameOver,
      isDefender: isDefender(table, playerId),
      isHuman: playerId === 0
    })
      .with({ isGameOver: true }, () => false)
      .with({ isDefender: true }, () => hasUndefendedCards(table))
      .with({ isHuman: true }, () =>
        match({
          isPrimary: isPrimaryAttacker(table, playerId),
          canThrowIn:
            table.attack.length > 0 &&
            table.attack.length < getDefenderHandCount(table)
        })
          .with({ isPrimary: true }, () => true)
          .with({ canThrowIn: true }, () => true)
          .otherwise(() => false)
      )
      .otherwise(() =>
        match(computeIntent(playerId, table)).with(P.nonNullable, () => true).otherwise(() => false)
      );

const propose =
  (playerId: number) =>
  (table: TableState): Observable<Intent | null> =>
    match(playerId === 0)
      .with(true, () => intent$.pipe(first()))
      .otherwise(() => of(computeIntent(playerId, table)).pipe(delay(AI_DELAY_MS)));

_.chain([0, 1, 2, 3]).each((id) => {
  registerKS({
    playerId: id,
    canAct: canAct(id),
    propose: propose(id)
  });
});
