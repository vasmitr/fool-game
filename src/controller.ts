import { EMPTY, switchMap, merge } from "rxjs";
import _ from "underscore";
import { table$, knowledgeSources, applyOutcome } from "./store.js";
import type { KnowledgeSource } from "./store.js";
import type { TableState, Intent } from "./rules.js";
import { processIntent } from "./rules.js";
import { isDefender, isPrimaryAttacker, hasUndefendedCards } from "./selectors.js";

const applyIntent = (intent: Intent) => {
  const current = table$.value;
  if (current.isGameOver) return;
  applyOutcome(current, processIntent(current, intent));
};

export const selectKS = (
  table: TableState,
  ksList: KnowledgeSource[] = knowledgeSources
) =>
  _.chain(ksList)
    .filter((ks) => ks.canAct(table))
    .sortBy((ks) => {
      if (hasUndefendedCards(table) && isDefender(table, ks.playerId)) return 0;
      if (isPrimaryAttacker(table, ks.playerId)) return 1;
      return 2;
    })
    .first()
    .value();

table$
  .pipe(
    switchMap((table) => {
      if (table.isGameOver) return EMPTY;
      
      const eligible = knowledgeSources.filter((ks) => ks.canAct(table));
      if (eligible.length === 0) return EMPTY;

      // Merge all eligible KS proposals. The first one to emit wins this "turn"
      // and triggers a table$ update, which cancels all other pending proposals.
      return merge(...eligible.map((ks) => ks.propose(table)));
    })
  )
  .subscribe((intent) => {
    if (intent) applyIntent(intent);
  });
