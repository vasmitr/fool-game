import { createSignal, onMount, For, Show, createEffect } from "solid-js";
import { table$, log$, intent$, resetGame } from "./store.js";
import type { TableState, Player, Hand as HandType } from "./rules.js";
import type { Card as CardType } from "./consts.js";
import { Card } from "./components/Card.jsx";
import { Hand } from "./components/Hand.jsx";
import { Log } from "./components/Log.jsx";

const avatars = [
  "/avatars/marie_curie.png",
  "/avatars/isaac_newton.png",
  "/avatars/nikola_tesla.png"
];

const getSuitEmoji = (suit: string) => {
  switch (suit) {
    case "hearts":
      return "♥";
    case "diamonds":
      return "♦";
    case "clubs":
      return "♣";
    case "spades":
      return "♠";
    default:
      return "";
  }
};

export default function App() {
  const [state, setState] = createSignal<TableState>(table$.value);
  const [theme, setTheme] = createSignal<"midnight" | "daylight">(
    (localStorage.getItem("durak-theme") as "midnight" | "daylight") ||
      "midnight"
  );

  onMount(() => {
    const sub = table$.subscribe((val: TableState) => {
      // Re-cloning with spread ensures Solid sees this as a fresh state update
      setState({ ...val });
    });
    return () => sub.unsubscribe();
  });

  createEffect(() => {
    const currentTheme = theme();
    document.documentElement.setAttribute("data-theme", currentTheme);
    localStorage.setItem("durak-theme", currentTheme);
  });

  const isHumanTurn = () =>
    state().currentTurnId === 0 || state().currentDefendId === 0;

  return (
    <div class="h-screen w-full flex flex-col items-center justify-between py-10 overflow-hidden luxury-felt">
      {/* Top Bar Navigation */}
      <header class="fixed top-0 w-full px-8 py-4 flex justify-between items-center z-50">
        <div class="text-primary font-['Manrope'] font-black tracking-widest uppercase text-3xl">
          DURAK
        </div>
        <div class="flex gap-4 items-center">
          <button
            onClick={() =>
              setTheme((t) => (t === "midnight" ? "daylight" : "midnight"))
            }
            class="flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/10 bg-surface-container-low/50 text-primary hover:text-white hover:bg-surface-container-high/50 transition-all font-['Manrope'] font-bold text-xs uppercase tracking-widest shadow-xl group"
          >
            <span>Switch Theme</span>
          </button>
          <button
            onClick={() => resetGame()}
            class="text-error font-black text-[10px] uppercase border border-error/30 px-3 py-1 rounded opacity-50 hover:opacity-100 transition-opacity"
          >
            RESTART
          </button>
        </div>
      </header>

      {/* Opponents Area */}
      <div class="w-full max-w-6xl px-8 flex justify-between items-start pt-16">
        <For each={state().players.filter((p) => p.id !== 0)}>
          {(player, i) => {
            const hand = state().hands.find((h) => h.playerId === player.id);
            const isActive = state().currentTurnId === player.id;
            const isDefender = state().currentDefendId === player.id;

            return (
              <div class="flex flex-col items-center gap-2">
                <div
                  class={`relative p-1 rounded-full ${isActive || isDefender ? "ring-4 ring-primary/40 ring-offset-4 ring-offset-surface" : "border-2 border-outline-variant/30"}`}
                >
                  <img
                    class="w-20 h-20 rounded-full bg-surface-container-low object-cover shadow-2xl"
                    src={avatars[i()] || "https://i.pravatar.cc/100"}
                  />
                  <div class="absolute -bottom-1 -right-1 bg-primary text-on-primary text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                    {hand?.cards.length || 0}
                  </div>
                </div>
                <div class="flex flex-col items-center">
                  <span
                    class={`font-headline text-sm font-bold tracking-tight ${isActive || isDefender ? "text-primary" : "text-on-surface"}`}
                  >
                    {player.name}
                  </span>
                  <Show when={isActive || isDefender}>
                    <span class="text-[10px] uppercase tracking-widest text-primary font-bold animate-pulse">
                      {isDefender ? "Defending..." : "Attacking..."}
                    </span>
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* Center Center Playing Area */}
      <div class="relative w-full max-w-5xl h-80 border border-outline-variant/15 rounded-[3rem] flex items-center justify-center bg-surface-container/10 backdrop-blur-sm">
        {/* Table Cards Area */}
        <div class="flex gap-14 relative px-12 items-center">
          <For each={state().attack}>
            {(card, i) => (
              <div class="relative w-28 h-40 flex-shrink-0">
                <Card card={card} from={state().currentTurnId} />
                <Show when={state().defense[i()]}>
                  <div class="absolute inset-0 translate-x-8 translate-y-10 z-10 scale-100 rotate-3">
                    <Card
                      card={state().defense[i()]!}
                      from={state().currentDefendId}
                    />
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Deck & Trump Area - Restored to Bottom Right Corner */}
      <div class="fixed right-8 bottom-10 flex flex-col items-center gap-12 z-40">
        <div class="relative flex items-center justify-center w-40 h-40">
          {/* Trump card at the bottom (rotated and clearly visible) */}
          <div class="absolute rotate-90 scale-[0.8] origin-center z-0 -translate-x-12 opacity-90 card-glow">
            <Card card={state().trumps} />
          </div>

          {/* Visual Deck Stack */}
          <Show when={state().deck.length > 0}>
            <div class="relative w-24 h-32 bg-surface-container-low rounded-xl border border-white/20 shadow-2xl flex items-center justify-center z-10 translate-x-4">
              {/* Stack effect */}
              <div class="absolute inset-0 bg-surface-container-low rounded-lg border border-white/20 -translate-x-1 -translate-y-1 z-[-1]"></div>
              <div class="absolute inset-0 bg-surface-container-low rounded-lg border border-white/10 -translate-x-0.5 -translate-y-0.5 z-[-1]"></div>

              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-22 border border-white/10 rounded"></div>
              <span class="material-symbols-outlined text-primary-dim opacity-30 text-5xl">
                playing_cards
              </span>

              {/* Deck Count */}
              <div class="absolute -top-3 -right-3 bg-primary text-on-primary text-sm font-black w-10 h-10 flex items-center justify-center rounded-full border border-white/20 shadow-xl z-20">
                {state().deck.length}
              </div>
            </div>
          </Show>
        </div>

        <div class="flex flex-col items-center">
          <div class="w-16 h-20 bg-surface-container-high rounded-lg border border-outline-variant/30 flex flex-col items-center justify-center shadow-lg">
            <span class="material-symbols-outlined text-primary text-xl">
              delete_sweep
            </span>
            <span class="font-headline font-bold text-xs text-primary">
              {state().discardPile.length}
            </span>
          </div>
          <span class="text-[9px] uppercase font-bold tracking-widest mt-2 text-primary opacity-60">
            Beaten Pile
          </span>
        </div>
      </div>

      {/* Human Actions (Buttons) */}
      <div class="w-full flex flex-col items-center gap-10 pb-6 z-20">
        <Show when={isHumanTurn()}>
          <div class="flex gap-6 scale-110">
            <button
              onClick={() => intent$.next({ action: "TAKE", playerId: 0 })}
              disabled={
                state().currentDefendId !== 0 || state().attack.length === 0
              }
              class="px-10 py-4 bg-secondary-container text-on-secondary-container rounded-full font-headline font-bold text-xs uppercase tracking-widest border border-white/5 hover:scale-105 transition-all active:scale-95 shadow-2xl disabled:opacity-20 flex items-center gap-2"
            >
              Take Cards
            </button>
            <button
              onClick={() => intent$.next({ action: "BEATEN", playerId: 0 })}
              disabled={state().attack.length === 0}
              class="px-12 py-4 bg-primary text-on-primary rounded-full font-headline font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all active:scale-95 shadow-[0_0_30px_rgba(186,195,255,0.3)] disabled:opacity-20 flex items-center gap-2"
            >
              Pass / End Turn
            </button>
          </div>
        </Show>

        <Hand
          cards={state().hands.find((h) => h.playerId === 0)?.cards || []}
        />
      </div>

      <Log />

      {/* Game Over Screen */}
      <Show when={state().isGameOver}>
        <div class="fixed inset-0 bg-surface/80 backdrop-blur-3xl z-[100] flex flex-col items-center justify-center p-20 select-none animate-in fade-in duration-1000">
          <div class="flex flex-col items-center max-w-2xl text-center space-y-8">
            <div class="w-px h-24 bg-primary/30"></div>

            <h1
              class={`text-8xl font-black tracking-tighter uppercase ${state().winner === state().players[0]?.name ? "text-primary" : "text-error"}`}
            >
              {state().winner === state().players[0]?.name
                ? "CONQUERED"
                : "OVERCOME"}
            </h1>

            <div class="flex items-center gap-6">
              <div class="h-px w-12 bg-on-surface/20"></div>
              <div class="text-xl text-on-surface/80 italic font-headline uppercase tracking-widest">
                {state().winner} IS THE MASTER
              </div>
              <div class="h-px w-12 bg-on-surface/20"></div>
            </div>

            <div class="pt-12">
              <button
                onClick={() => resetGame()}
                class="group relative px-12 py-5 bg-primary text-on-primary rounded-full font-headline font-black text-sm uppercase tracking-[0.3em] overflow-hidden hover:scale-105 active:scale-95 transition-all shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
              >
                <span class="relative z-10">Return to Lobby</span>
                <div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
              </button>
            </div>

            <div class="w-px h-24 bg-primary/30"></div>
          </div>
        </div>
      </Show>
    </div>
  );
}
