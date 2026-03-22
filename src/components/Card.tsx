import { onMount, createEffect, splitProps, Show } from 'solid-js';
import gsap from 'gsap';
import type { Card as CardType } from '../consts.js';

interface CardProps {
  card: CardType;
  onClick?: (card: CardType) => void;
  isBack?: boolean;
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
      gsap.from(cardRef, {
        scale: 0.5,
        opacity: 0,
        y: 40,
        duration: 0.5,
        ease: "back.out(2.5)",
      });
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
