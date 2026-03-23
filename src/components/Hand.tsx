import { For } from 'solid-js';
import { Card } from './Card.jsx';
import { table$, intent$ } from '../store.js';
import type { Card as CardType } from '../consts.js';
import { getTableRanks, isDefender } from '../selectors.js';

interface HandProps {
  cards: CardType[];
}

export function Hand(props: HandProps) {
  const onHumanCardClick = (card: CardType) => {
    console.log("Human Clicked Card:", card.rank, card.suit);
    const table = table$.value;
    if (table.isGameOver) return;
    
    // Choose action based on role
    let action: "ATTACK" | "DEFEND" | "PASS" = isDefender(table, 0) ? "DEFEND" : "ATTACK";

    // Transfer logic: if defender plays same rank on empty defense
    if (action === "DEFEND" && table.defense.length === 0 && getTableRanks(table).includes(card.rank)) {
      action = "PASS";
    }

    intent$.next({ action, playerId: 0, cardId: card.id });
  };

  return (
    <div class="flex justify-center -space-x-12 px-12 h-48 items-end w-full overflow-x-auto scrollbar-hide">
      <For each={props.cards}>
        {(card, i) => (
          <div 
            class="transform origin-bottom"
            style={{
              "transform": `rotate(${(i() - (props.cards.length / 2)) * 3}deg) translateY(${Math.abs(i() - (props.cards.length / 2)) * 2}px)`
            }}
          >
            <Card card={card} onClick={onHumanCardClick} from="hand" />
          </div>
        )}
      </For>
    </div>
  );
}
