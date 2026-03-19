import { EMPTY, timer } from "rxjs";
import { switchMap, map } from "rxjs";
import { table$, intent$, knowledgeSources, applyOutcome } from "./store";
import type { TableState, Intent } from "./rules";
import { processIntent } from "./rules";
import { AI_DELAY_MS } from "./consts";

const AUTO_PASS_MS = 5000;

// Human player: direct write to blackboard via UI
intent$.subscribe((intent) => {
  const table = table$.value;
  if (table.isGameOver) return;
  applyOutcome(table, processIntent(table, intent));
});

const selectKS = (table: TableState) => {
  const allDefended = table.attack.length === table.defense.length;
  // Priority: defender (when there are undefended cards) > current attacker > throw-in players
  return (
    (!allDefended
      ? knowledgeSources.find(
          (ks) => ks.playerId === table.currentDefendId && ks.canAct(table),
        )
      : undefined) ??
    knowledgeSources.find(
      (ks) => ks.playerId === table.currentTurnId && ks.canAct(table),
    ) ??
    knowledgeSources.find((ks) => ks.canAct(table))
  );
};

// Active controller: switchMap cancels any pending delay when state changes
table$
  .pipe(
    switchMap((table) => {
      if (table.isGameOver) return EMPTY;
      const selected = selectKS(table);
      if (selected) {
        return timer(AI_DELAY_MS).pipe(
          map((): Intent | null => selected.propose(table$.value)),
        );
      }
      // No AI can act — if the bout is fully defended, auto-pass after a pause
      if (table.attack.length > 0 && table.attack.length === table.defense.length) {
        const beaten: Intent = { action: "BEATEN", playerId: table.currentTurnId };
        return timer(AUTO_PASS_MS).pipe(map((): Intent | null => beaten));
      }
      return EMPTY;
    }),
  )
  .subscribe((intent) => {
    if (!intent) return;
    const current = table$.value;
    if (current.isGameOver) return;
    applyOutcome(current, processIntent(current, intent));
  });
