import { EMPTY } from "rxjs";
import { table$, intent$, knowledgeSources, registerKS } from "./store.js";

/**
 * BRIDGE: Exposes internal game state to the window object.
 * This is used primarily by Playwright E2E tests to manipulate 
 * and verify the game state in real-time.
 */
if (import.meta.env.DEV && typeof window !== "undefined") {
  window.table$ = table$;
  window.intent$ = intent$;
  window.knowledgeSources = knowledgeSources;
  window.rxjs = { EMPTY };
  window.registerKS = registerKS;
}
