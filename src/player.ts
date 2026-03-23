import { Observable, of, delay, first } from "rxjs";
import { match, P } from "ts-pattern";
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
  hasUndefendedCards,
} from "./selectors.js";

const computeIntent = (playerId: number, table: TableState): Intent | null => {
  const myHand = getHand(table, playerId);

  return match({
    isDefender: isDefender(table, playerId),
    isPrimary: isPrimaryAttacker(table, playerId),
    canThrowIn:
      table.attack.length > 0 &&
      table.attack.length < getDefenderHandCount(table),
  })
    .with({ isDefender: true }, () => {
      const suggestion = findBestDefense(
        myHand,
        table.attack,
        table.defense,
        table.trumps,
        table.deck.length
      );
      return match(suggestion)
        .with(null, () => null)
        .with({ action: "TAKE" }, () => ({ action: "TAKE" as const, playerId }))
        .otherwise((s) => ({ action: s.action, playerId, cardId: s.cardId }));
    })
    .with({ isPrimary: true }, { canThrowIn: true }, () => {
      const suggestion = findBestAttack(
        myHand,
        table.attack,
        table.defense,
        table.trumps,
        getDefenderHandCount(table),
        table.deck.length
      );

      return match(suggestion)
        .with(P.nonNullable, (s) => ({
          action: "ATTACK" as const,
          playerId,
          cardId: s.cardId,
        }))
        .otherwise(() =>
          isPrimaryAttacker(table, playerId) && canEndBout(table)
            ? { action: "BEATEN" as const, playerId }
            : null
        );
    })
    .otherwise(() => null);
};

const canAct =
  (playerId: number) =>
  (table: TableState): boolean =>
    match({
      isGameOver: table.isGameOver,
      isDefender: isDefender(table, playerId),
      isHuman: playerId === 0,
    })
      .with({ isGameOver: true }, () => false)
      .with({ isDefender: true }, () => hasUndefendedCards(table))
      .with({ isHuman: true }, () => {
        const isPrimary = isPrimaryAttacker(table, playerId);
        const canThrowIn =
          table.attack.length > 0 &&
          table.attack.length < getDefenderHandCount(table);
        return isPrimary || canThrowIn;
      })
      .otherwise(() => computeIntent(playerId, table) !== null);

const propose =
  (playerId: number) =>
  (table: TableState): Observable<Intent | null> =>
    playerId === 0
      ? intent$.pipe(first())
      : of(computeIntent(playerId, table)).pipe(delay(AI_DELAY_MS));

[0, 1, 2, 3].forEach((id) => {
  registerKS({
    playerId: id,
    canAct: canAct(id),
    propose: propose(id),
  });
});
