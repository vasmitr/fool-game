import { EMPTY, switchMap } from "rxjs";
import _ from "underscore";
import { match, P } from "ts-pattern";
import { table$, intent$, knowledgeSources, applyOutcome } from "./store.js";
import type { KnowledgeSource } from "./store.js";
import type { TableState, Intent } from "./types.js";
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
    .value() as KnowledgeSource | undefined;
};

// Handle human intents directly and independently for UI responsiveness
intent$.subscribe((intent) => {
  applyIntent(intent);
});

// AI Controller Loop: Serializes AI actions to prevent race conditions
table$
  .pipe(
    switchMap((table: TableState) => {
      const ks = selectKS(table);
      
      return match({ isGameOver: table.isGameOver, ks })
        .with({ isGameOver: true }, () => EMPTY)
        .with({ ks: P.nullish }, () => EMPTY)
        // If human (0) has priority, wait for them (AI loop yields)
        .with({ ks: { playerId: 0 } }, () => EMPTY)
        // Otherwise, let the selected AI agent propose their action
        .with({ ks: P.nonNullable }, ({ ks: selected }) => selected.propose(table))
        .exhaustive();
    })
  )
  .subscribe((intent) =>
    match(intent)
      .with(P.nonNullable, applyIntent)
      .otherwise(() => undefined)
  );
