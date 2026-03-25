import { BehaviorSubject, Subject, EMPTY } from "rxjs";
import type { TableState, Intent } from "./types.js";
import type { KnowledgeSource } from "./store.js";

declare global {
  interface Window {
    table$: BehaviorSubject<TableState>;
    intent$: Subject<Intent>;
    knowledgeSources: KnowledgeSource[];
    rxjs: { EMPTY: typeof EMPTY };
    registerKS: (ks: KnowledgeSource) => void;
  }
}

export {};
