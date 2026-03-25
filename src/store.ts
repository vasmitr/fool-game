import { BehaviorSubject, Observable, Subject } from "rxjs";
import type { Intent, TableState, ActionOutcome } from "./types.js";
import { getInitialState } from "./transforms.js";

// --- Blackboard ---
export const table$ = new BehaviorSubject<TableState>(getInitialState());
export const intent$ = new Subject<Intent>(); // human player input
export const log$ = new BehaviorSubject<string>("Welcome to the table."); // start with message

export function resetGame() {
  table$.next(getInitialState());
  log$.next("🔄 GAME RESTARTED");
}

// --- Write API ---
export function applyOutcome(table: TableState, outcome: ActionOutcome): void {
  log$.next(outcome.log);
  table$.next(outcome.table);
}

// --- Knowledge Source registry ---
export type KnowledgeSource = {
  playerId: number;
  canAct: (table: TableState) => boolean;
  propose: (table: TableState) => Observable<Intent | null>;
};

export const knowledgeSources: KnowledgeSource[] = [];
export const registerKS = (ks: KnowledgeSource) => knowledgeSources.push(ks);

