import { For } from 'solid-js';
import { Card } from './Card.jsx';
import { table$, intent$ } from '../store.js';
import type { Card as CardType } from '../consts.js';

interface HandProps {
  cards: CardType[];
}

export function Hand(props: HandProps) {
  const onHumanCardClick = (card: CardType) => {
    console.log("Human Clicked Card:", card.rank, card.suit);
    const table = table$.value;
    if (table.isGameOver) return;
    
    // Choose action based on role
    const action = table.currentDefendId === 0 ? "DEFEND" : "ATTACK";
    intent$.next({ action, playerId: 0, cardId: card.id });
  };

  return (
    <div class="flex justify-center -space-x-12 px-12 h-48 items-end w-full overflow-x-auto scrollbar-hide">
      <For each={props.cards}>
        {(card, i) => (
          <div 
            class="transform transition-all duration-500 origin-bottom"
            style={{
              "transform": `rotate(${(i() - (props.cards.length / 2)) * 3}deg) translateY(${Math.abs(i() - (props.cards.length / 2)) * 2}px)`
            }}
          >
            <Card card={card} onClick={onHumanCardClick} />
          </div>
        )}
      </For>
    </div>
  );
}
