import { EMPTY, switchMap, merge } from "rxjs";
import _ from "underscore";
import { match, P } from "ts-pattern";
import { table$, knowledgeSources, applyOutcome } from "./store.js";
import type { KnowledgeSource } from "./store.js";
import type { TableState, Intent } from "./rules.js";
import { processIntent } from "./rules.js";
import {
  isDefender,
  isPrimaryAttacker,
  hasUndefendedCards
} from "./selectors.js";

const applyIntent = (intent: Intent) => {
  const current = table$.value;
  return match(current.isGameOver)
    .with(true, () => undefined)
    .otherwise(() => applyOutcome(current, processIntent(current, intent)));
};

export const selectKS = (
  table: TableState,
  ksList: KnowledgeSource[] = knowledgeSources
) => {
  const hasUndef = hasUndefendedCards(table);
  return _.chain(ksList)
    .filter((ks) => ks.canAct(table))
    .sortBy((ks) =>
      match({
        isDef: isDefender(table, ks.playerId),
        isAtt: isPrimaryAttacker(table, ks.playerId),
        hasUndef
      })
        .with({ hasUndef: true, isDef: true }, () => 0)
        .with({ isAtt: true }, () => 1)
        .otherwise(() => 2)
    )
    .first()
    .value();
};

table$
  .pipe(
    switchMap((table: TableState) => {
      const eligible = knowledgeSources.filter((ks) => ks.canAct(table));
      return match([table.isGameOver, eligible])
        .with([true, P._], () => EMPTY)
        .with([P._, []], () => EMPTY)
        .otherwise(() => merge(...eligible.map((ks) => ks.propose(table))));
    })
  )
  .subscribe((intent) =>
    match(intent)
      .with(P.nonNullable, applyIntent)
      .otherwise(() => undefined)
  );
