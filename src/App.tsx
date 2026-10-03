import { createSignal, onMount, For, Show, createEffect } from "solid-js";
import { table$, intent$, resetGame } from "./store.js";
import type { TableState, Hand as HandType } from "./types.js";
import { Card } from "./components/Card.jsx";
import { Hand } from "./components/Hand.jsx";
import { Log } from "./components/Log.jsx";
import { canEndBout, allDefended } from "./selectors.js";
import gsap from "gsap";

const avatars = [
  `${import.meta.env.BASE_URL}avatars/marie_curie.png`,
  `${import.meta.env.BASE_URL}avatars/isaac_newton.png`,
  `${import.meta.env.BASE_URL}avatars/nikola_tesla.png`,
];

const themeIcon = (t: string) =>
  t === "midnight" ? "light_mode" : "dark_mode";

const boutLabel = (table: TableState) =>
  allDefended(table) ? "End Turn / Bito" : "Pass";

const isDefenderWithAttack = (table: TableState) =>
  table.currentDefendId === 0 && table.attack.length > 0;

const humanCards = (table: TableState) => {
  const hand = table.hands.find((h) => h.playerId === 0);
  return hand ? hand.cards : [];
};

const isHumanWinner = (table: TableState) =>
  table.winner === table.players[0]?.name;

const winnerHeadingClass = (table: TableState) =>
  isHumanWinner(table) ? "text-primary" : "text-error";

const winnerLabel = (table: TableState) =>
  isHumanWinner(table) ? "CONQUERED" : "OVERCOME";

const getAttackerLabel = (id: number, name: string) =>
  id === 0 ? "YOUR TURN" : `${name}'S TURN`;

const getActiveTurnMsg = (s: TableState) => {
  const attacker = s.players.find((p) => p.id === s.currentTurnId);
  return attacker ? getAttackerLabel(s.currentTurnId, attacker.name) : null;
};

const getTurnMsg = (s: TableState) =>
  s.attack.length > 0 ? null : getActiveTurnMsg(s);

const killTween = (ref: HTMLDivElement | undefined) => {
  if (ref) gsap.killTweensOf(ref);
};

const scheduleNoticeAnim = (
  ref: HTMLDivElement,
  target: HTMLDivElement | undefined,
) => {
  if (!target) return;
  gsap
    .timeline()
    .to(ref, {
      delay: 0.8,
      y: -window.innerHeight / 2 + 40,
      scale: 0.6,
      duration: 0.8,
      ease: "expo.out",
    });
};

const isActiveOrDef = (isActive: boolean, isDef: boolean) => isActive || isDef;

const opponentRingClass = (active: boolean) =>
  active
    ? "ring-4 ring-primary/40 ring-offset-4 ring-offset-surface"
    : "border-2 border-outline-variant/30";

const opponentNameClass = (active: boolean) =>
  active ? "text-primary" : "text-on-surface";

const avatarSrc = (index: number) =>
  avatars[index] || "https://i.pravatar.cc/100";

const handCardCount = (hand: HandType | undefined) =>
  hand ? hand.cards.length : 0;

export default function App() {
  const [state, setState] = createSignal<TableState>(table$.value);
  const [theme, setTheme] = createSignal<"midnight" | "daylight">(
    (localStorage.getItem("durak-theme") as "midnight" | "daylight") ||
      "midnight",
  );
  const [notice, setNotice] = createSignal<string | null>(null);
  let noticeRef: HTMLDivElement | undefined;
  const avatarRefs = new Map<number, HTMLDivElement>();

  onMount(() => {
    const sub = table$.subscribe((val: TableState) => {
      setState({ ...val });
    });
    return () => sub.unsubscribe();
  });

  // Turn Notification with Spatial "Stay" Animation
  createEffect(() => {
    const s = state();
    const msg = getTurnMsg(s);
    if (!msg) return;
    killTween(noticeRef);
    setNotice(msg);
    const activeId = s.currentTurnId;
    requestAnimationFrame(() => {
      if (!noticeRef) return;
      scheduleNoticeAnim(noticeRef, avatarRefs.get(activeId));
    });
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
        <div class="flex gap-6 items-center">
          <button
            onClick={() =>
              setTheme((t) => (t === "midnight" ? "daylight" : "midnight"))
            }
            class="w-10 h-10 flex items-center justify-center rounded-full border border-white/10 bg-surface-container-low/50 text-primary hover:text-white hover:bg-surface-container-high/50 transition-all shadow-lg group"
          >
            <span class="material-symbols-outlined text-xl">
              {themeIcon(theme())}
            </span>
          </button>
          <button
            onClick={() => resetGame()}
            class="text-error font-black text-xs uppercase border border-error/30 px-5 py-2.5 rounded-full hover:bg-error/10 transition-colors tracking-widest bg-error/5"
          >
            NEW GAME
          </button>
        </div>
      </header>

      {/* Opponents Area */}
      <div class="w-full max-w-6xl px-8 flex justify-between items-start pt-16">
        <For each={state().players.filter((p) => p.id !== 0)}>
          {(player, i) => {
            const hand = state().hands.find((h) => h.playerId === player.id);
            const active = isActiveOrDef(
              state().currentTurnId === player.id,
              state().currentDefendId === player.id,
            );

            return (
              <div
                ref={(el) => avatarRefs.set(player.id, el)}
                class="flex flex-col items-center gap-2"
              >
                <div
                  class={`relative p-1 rounded-full ${opponentRingClass(active)}`}
                >
                  <img
                    class="w-20 h-20 rounded-full bg-surface-container-low object-cover shadow-2xl"
                    src={avatarSrc(i())}
                  />
                  <div class="absolute -bottom-1 -right-1 bg-primary text-on-primary text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                    {handCardCount(hand)}
                  </div>
                </div>
                <div class="flex flex-col items-center">
                  <span
                    class={`font-headline text-sm font-bold tracking-tight ${opponentNameClass(active)}`}
                  >
                    {player.name}
                  </span>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* Center Center Playing Area */}
      <div class="relative w-full max-w-5xl h-80 border border-outline-variant/15 rounded-[3rem] flex items-center justify-center bg-surface-container/10 backdrop-blur-sm">
        {/* Table Cards Area */}
        <div
          data-testid="table-cards"
          class="flex gap-14 relative px-12 items-center"
        >
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

      {/* Deck & Trump Area */}
      <div class="fixed right-8 bottom-10 flex flex-col items-center gap-12 z-40">
        <div class="relative flex items-center justify-center w-40 h-40">
          <div class="absolute rotate-90 scale-[0.8] origin-center z-0 -translate-x-12 opacity-90 card-glow">
            <Card card={state().trumps} />
          </div>
          <Show when={state().deck.length > 0}>
            <div class="relative w-24 h-32 bg-surface-container-low rounded-xl border border-white/20 shadow-2xl flex items-center justify-center z-10 translate-x-4">
              <div class="absolute inset-0 bg-surface-container-low rounded-lg border border-white/20 -translate-x-1 -translate-y-1 z-[-1]"></div>
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-22 border border-white/10 rounded"></div>
              <span class="material-symbols-outlined text-primary-dim opacity-30 text-5xl">
                playing_cards
              </span>
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
        </div>
      </div>

      {/* Human Actions Area */}
      <div
        ref={(el) => avatarRefs.set(0, el)}
        class="w-full flex flex-col items-center gap-6 pb-6 z-20"
      >
        <div class="flex flex-col items-center gap-3 h-12">
          <Show when={isHumanTurn()}>
            <div class="flex gap-6">
              <Show when={isDefenderWithAttack(state())}>
                <button
                  onClick={() => intent$.next({ action: "TAKE", playerId: 0 })}
                  class="px-10 py-4 bg-secondary-container text-on-secondary-container rounded-full font-headline font-bold text-xs uppercase tracking-widest border border-white/5 hover:scale-105 transition-all active:scale-95 shadow-2xl disabled:opacity-20 flex items-center gap-2"
                >
                  Take Cards
                </button>
              </Show>
              <button
                onClick={() => intent$.next({ action: "BEATEN", playerId: 0 })}
                disabled={!canEndBout(state())}
                class="px-12 py-4 bg-primary text-on-primary rounded-full font-headline font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all active:scale-95 shadow-[0_0_30px_rgba(186,195,255,0.3)] disabled:opacity-20 flex items-center gap-2"
              >
                {boutLabel(state())}
              </button>
            </div>
          </Show>
        </div>
        <Hand cards={humanCards(state())} />
      </div>

      <Log />

      {/* Turn Notification Overlay (Spatial Stay) */}
      <Show when={notice()}>
        <div class="fixed inset-0 pointer-events-none flex items-center justify-center z-[200]">
          <div
            ref={(el) => {
              noticeRef = el;
            }}
            class="relative bg-primary px-10 py-3 skew-x-[-15deg] shadow-[0_20px_50px_rgba(0,0,0,0.4)] border-r-8 border-white/30"
          >
            <div class="absolute inset-0 bg-white/10 skew-x-[15deg] pointer-events-none"></div>
            <span class="relative z-10 text-xl font-black italic tracking-[0.3em] uppercase text-on-primary skew-x-[15deg] block whitespace-nowrap">
              {notice()}
            </span>
          </div>
        </div>
      </Show>

      {/* Game Over Screen */}
      <Show when={state().isGameOver}>
        <div class="fixed inset-0 bg-surface/80 backdrop-blur-3xl z-[250] flex flex-col items-center justify-center p-20 select-none">
          <div class="flex flex-col items-center max-w-2xl text-center space-y-8">
            <h1
              class={`text-8xl font-black tracking-tighter uppercase ${winnerHeadingClass(state())}`}
            >
              {winnerLabel(state())}
            </h1>
            <div class="text-xl text-on-surface/80 italic font-headline uppercase tracking-widest">
              {state().winner} IS THE MASTER
            </div>
            <button
              onClick={() => resetGame()}
              class="px-12 py-5 bg-primary text-on-primary rounded-full font-headline font-black text-sm uppercase tracking-[0.3em] shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              Return to the Game
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
