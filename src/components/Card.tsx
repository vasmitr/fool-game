import { onMount, onCleanup } from 'solid-js';
import gsap from 'gsap';
import type { Card as CardType } from '../consts.js';

// Global registry to track card positions across mounting/unmounting
const cardRegistry = new Map<string, DOMRect>();

interface CardProps {
  card: CardType;
  onClick?: (card: CardType) => void;
  isBack?: boolean;
  from?: 'bottom' | 'top' | 'hand' | 'deck' | number; // ID of player who threw it
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};
const getSuitSymbol = (suit: string) => SUIT_SYMBOLS[suit] ?? '';

const getCardClick = (onClick: CardProps['onClick'], card: CardType) =>
  onClick ? (() => onClick(card)) : undefined;

const cardCursorStyle = (onClick: CardProps['onClick']) => onClick ? 'pointer' : 'default';

const clickableClass = (onClick: CardProps['onClick']) => onClick ? 'cursor-pointer' : '';

const suitColorClass = (isRed: boolean) => isRed ? 'text-error' : 'text-slate-900';

const animateCard = (el: HTMLDivElement, id: string, lastRect: DOMRect | undefined) => {
  if (lastRect) {
    const currentRect = el.getBoundingClientRect();
    gsap.from(el, {
      x: lastRect.left - currentRect.left,
      y: lastRect.top - currentRect.top,
      rotation: (Math.random() - 0.5) * 60,
      scale: 0.8,
      duration: 0.8,
      ease: "power2.out",
      clearProps: "all"
    });
    cardRegistry.delete(id);
  } else {
    gsap.from(el, { scale: 0.2, opacity: 0, y: 400, rotation: 90, duration: 0.6, ease: "back.out(1.7)" });
  }
};

const recordCardPosition = (el: HTMLDivElement, id: string) => {
  cardRegistry.set(id, el.getBoundingClientRect());
  setTimeout(() => cardRegistry.delete(id), 1000);
};

const mountCardEffect = (ref: HTMLDivElement, card: CardType | undefined) => {
  if (!card) return;
  const lastRect = cardRegistry.get(card.id);
  requestAnimationFrame(() => animateCard(ref, card.id, lastRect));
};

const cleanupCardEffect = (ref: HTMLDivElement, card: CardType | undefined) => {
  if (!card) return;
  recordCardPosition(ref, card.id);
};

export function Card(props: CardProps) {
  let cardRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!cardRef) return;
    mountCardEffect(cardRef, props.card);
  });

  onCleanup(() => {
    if (!cardRef) return;
    cleanupCardEffect(cardRef, props.card);
  });

  const isRed = () => props.card.suit === 'hearts' || props.card.suit === 'diamonds';

  return (
    <div
      ref={(el) => { cardRef = el; }}
      onClick={getCardClick(props.onClick, props.card)}
      data-card-id={props.card?.id}
      style={{
        cursor: cardCursorStyle(props.onClick)
      }}
      class={`group relative w-28 h-40 bg-white rounded-xl shadow-2xl flex flex-col p-4 border-2 border-outline-variant/20 transition-all duration-300 card-glow hover:-translate-y-8 select-none m-1
        ${props.card.suit}
        ${clickableClass(props.onClick)}`}
    >
      <div class={`flex justify-between items-start w-full ${suitColorClass(isRed())}`}>
        <span class="font-headline font-black text-2xl leading-none">
          {props.card.rank}
        </span>
        <span class="text-2xl leading-none opacity-80">
          {getSuitSymbol(props.card.suit)}
        </span>
      </div>

      <div class={`flex-1 flex items-center justify-center text-6xl select-none group-hover:scale-125 transition-transform duration-700 ${suitColorClass(isRed())}`}>
        {getSuitSymbol(props.card.suit)}
      </div>

      <div class={`flex justify-between items-end w-full rotate-180 ${suitColorClass(isRed())}`}>
        <span class="font-headline font-black text-2xl leading-none">
          {props.card.rank}
        </span>
        <span class="text-2xl leading-none opacity-80">
          {getSuitSymbol(props.card.suit)}
        </span>
      </div>
    </div>
  );
}
