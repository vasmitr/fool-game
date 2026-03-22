import { onMount, onCleanup, createEffect, splitProps, Show } from 'solid-js';
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

const getSuitSymbol = (suit: string) => {
    switch(suit) {
        case 'hearts': return '♥';
        case 'diamonds': return '♦';
        case 'clubs': return '♣';
        case 'spades': return '♠';
        default: return '';
    }
}

export function Card(props: CardProps) {
  let cardRef: HTMLDivElement | undefined;

  onMount(() => {
    if (cardRef) {
      const id = props.card.id;
      const lastRect = cardRegistry.get(id);
      
      // Delay to next frame to ensure browser layout is ready
      requestAnimationFrame(() => {
        if (!cardRef) return;
        
        if (lastRect) {
            const currentRect = cardRef.getBoundingClientRect();
            const deltaX = lastRect.left - currentRect.left;
            const deltaY = lastRect.top - currentRect.top;

            gsap.from(cardRef, {
              x: deltaX,
              y: deltaY,
              rotation: (Math.random() - 0.5) * 60,
              scale: 0.8,
              duration: 0.8,
              ease: "power2.out",
              clearProps: "all"
            });
            
            cardRegistry.delete(id);
        } else {
            gsap.from(cardRef, {
              scale: 0.2,
              opacity: 0,
              y: 400,
              rotation: 90,
              duration: 0.6,
              ease: "back.out(1.7)"
            });
        }
      });
    }
  });

  onCleanup(() => {
    if (cardRef && props.card) {
      // Store current position before being unmounted
      cardRegistry.set(props.card.id, cardRef.getBoundingClientRect());
      
      // Auto-cleanup after a short delay if not re-mounted
      const id = props.card.id;
      setTimeout(() => cardRegistry.delete(id), 1000);
    }
  });

  const isRed = () => props.card.suit === 'hearts' || props.card.suit === 'diamonds';

  return (
    <div
      ref={cardRef}
      onClick={props.onClick ? [props.onClick, props.card] : undefined}
      style={{
        cursor: props.onClick ? 'pointer' : 'default'
      }}
      class={`group relative w-28 h-40 bg-white rounded-xl shadow-2xl flex flex-col p-4 border-2 border-outline-variant/20 transition-all duration-300 card-glow hover:-translate-y-8 select-none m-1
        ${props.card.suit} 
        ${props.onClick ? 'cursor-pointer' : ''}`}
    >
      <div class={`flex justify-between items-start w-full ${isRed() ? 'text-error' : 'text-slate-900'}`}>
        <span class="font-headline font-black text-2xl leading-none">
          {props.card.rank}
        </span>
        <span class="text-2xl leading-none opacity-80">
          {getSuitSymbol(props.card.suit)}
        </span>
      </div>
      
      <div class={`flex-1 flex items-center justify-center text-6xl select-none group-hover:scale-125 transition-transform duration-700 ${isRed() ? 'text-error' : 'text-slate-900'}`}>
        {getSuitSymbol(props.card.suit)}
      </div>

      <div class={`flex justify-between items-end w-full rotate-180 ${isRed() ? 'text-error' : 'text-slate-900'}`}>
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
