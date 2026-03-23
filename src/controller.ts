import { EMPTY, timer, switchMap, map } from "rxjs";
import _ from "underscore";
import { table$, intent$, knowledgeSources, applyOutcome } from "./store.js";
import type { KnowledgeSource } from "./store.js";
import type { TableState, Intent } from "./rules.js";
import { processIntent } from "./rules.js";
import { AI_DELAY_MS } from "./consts.js";

const applyIntent = (intent: Intent) => {
  const current = table$.value;
  if (current.isGameOver) return;
  applyOutcome(current, processIntent(current, intent));
};

// Human player: always subscribed so clicks are never lost
intent$.subscribe(applyIntent);

export const selectKS = (
  table: TableState,
  ksList: KnowledgeSource[] = knowledgeSources
) => {
  const allDefended = table.attack.length === table.defense.length;
  const isAI = (ks: KnowledgeSource) => ks.playerId !== 0;
  const canDefend = (ks: KnowledgeSource) =>
    ks.playerId === table.currentDefendId;
  const canAttack = (ks: KnowledgeSource) =>
    ks.playerId === table.currentTurnId;

  // Controller only drives AI. Human acts via intent$ above.
  // Priority: AI defender > AI primary attacker > any other AI throw-in
  return _.chain(ksList)
    .filter((ks) => isAI(ks) && ks.canAct(table))
    .sortBy((ks) => {
      if (!allDefended && canDefend(ks)) return 0;
      if (canAttack(ks)) return 1;
      return 2;
    })
    .first()
    .value();
};

// Active controller: switchMap cancels any pending AI action when state changes
table$
  .pipe(
    switchMap((table) => {
      if (table.isGameOver) return EMPTY;
      const selected = selectKS(table);
      if (!selected) return EMPTY;
      // AI KS: propose after a delay, passing the snapshot (not re-reading table$)
      return timer(AI_DELAY_MS).pipe(
        map((): Intent | null => selected.propose(table))
      );
    })
  )
  .subscribe((intent) => {
    if (!intent) return;
    applyIntent(intent);
  });
