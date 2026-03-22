import { createSignal, onMount, For, createEffect } from 'solid-js';
import { log$ } from '../store.js';

export function Log() {
  const [messages, setMessages] = createSignal<string[]>([]);
  let listRef: HTMLDivElement | undefined;

  onMount(() => {
    const sub = log$.subscribe(msg => {
      setMessages(m => [...m, msg].slice(-10)); // Keep last 10 messages for compactness
    });
    return () => sub.unsubscribe();
  });

  createEffect(() => {
    messages(); // Dependency
    if (listRef) {
      listRef.scrollTop = listRef.scrollHeight;
    }
  });

  return (
    <div class="fixed left-6 bottom-40 w-72 glass-panel bg-surface-container-low/40 rounded-xl p-5 border border-outline-variant/10 shadow-2xl backdrop-blur-3xl z-40 transition-all group hover:bg-surface-container-low/60">
      <div class="flex justify-between items-center mb-3">
        <span class="text-[10px] font-headline font-black uppercase tracking-[0.2em] text-on-surface-variant">Game History</span>
        <span class="material-symbols-outlined text-sm text-on-surface-variant group-hover:rotate-180 transition-transform cursor-pointer">unfold_less</span>
      </div>
      <div 
        ref={listRef}
        class="space-y-2 max-h-40 overflow-y-auto pr-2 scrollbar-hide opacity-80"
      >
        <For each={messages()}>
          {(msg) => (
            <div class="flex gap-2 items-baseline border-l border-primary/20 pl-3 py-0.5">
              <span class="text-[9px] font-mono text-on-surface-variant/40 shrink-0">{new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
              <p class="text-[11px] leading-relaxed font-body tracking-tight text-on-surface">
                {msg}
              </p>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
