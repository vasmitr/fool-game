import { For } from 'solid-js';
import { Card } from './Card.jsx';
import { table$, intent$ } from '../store.js';
import type { Card as CardType } from '../consts.js';
import type { TableState } from '../types.js';
import { getTableRanks, isDefender } from '../selectors.js';

interface HandProps {
  cards: CardType[];
}

const isPassTransfer = (table: TableState, card: CardType) =>
  table.defense.length === 0 && getTableRanks(table).includes(card.rank);

const defenderAction = (table: TableState, card: CardType): "DEFEND" | "PASS" =>
  isPassTransfer(table, card) ? "PASS" : "DEFEND";

const getCardAction = (table: TableState, card: CardType): "ATTACK" | "DEFEND" | "PASS" =>
  isDefender(table, 0) ? defenderAction(table, card) : "ATTACK";

export function Hand(props: HandProps) {
  const onHumanCardClick = (card: CardType) => {
    const table = table$.value;
    if (table.isGameOver) return;
    intent$.next({ action: getCardAction(table, card), playerId: 0, cardId: card.id });
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
