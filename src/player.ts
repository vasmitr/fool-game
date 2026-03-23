import { match } from "ts-pattern";
import { registerKS } from "./store.js";
import { findBestDefense, findBestAttack } from "./helpers.js";
import type { TableState, Intent } from "./rules.js";
import {
  getHand,
  getDefenderHandCount,
  isDefender,
  isPrimaryAttacker,
  canEndBout,
  hasUndefendedCards,
} from "./selectors.js";

const canAct =
  (playerId: number) =>
  (table: TableState): boolean => {
    if (table.isGameOver) return false;
    if (isDefender(table, playerId)) return hasUndefendedCards(table);
    if (isPrimaryAttacker(table, playerId) && canEndBout(table)) return true;
    return (
      (isPrimaryAttacker(table, playerId) || table.attack.length > 0) &&
      table.attack.length < getDefenderHandCount(table)
    );
  };

const propose =
  (playerId: number) =>
  (table: TableState): Intent | null => {
    // Human player (id=0) never auto-proposes; their input arrives via intent$
    if (playerId === 0) return null;

    const myHand = getHand(table, playerId);

    if (isDefender(table, playerId)) {
      const suggestion = findBestDefense(
        myHand,
        table.attack,
        table.defense,
        table.trumps,
        table.deck.length
      );
      return match(suggestion)
        .with(null, () => null)
        .with({ action: "TAKE" }, () => ({ action: "TAKE" as const, playerId }))
        .otherwise((s) => ({ action: s.action, playerId, cardId: s.cardId }));
    }

    const suggestion = findBestAttack(
      myHand,
      table.attack,
      table.defense,
      table.trumps,
      getDefenderHandCount(table),
      table.deck.length
    );
    if (suggestion)
      return { action: "ATTACK", playerId, cardId: suggestion.cardId };
    if (isPrimaryAttacker(table, playerId) && canEndBout(table))
      return { action: "BEATEN", playerId };
    return null;
  };

// Register all players as Knowledge Sources (human id=0 never auto-proposes)
[0, 1, 2, 3].forEach((id) => {
  registerKS({
    playerId: id,
    canAct: canAct(id),
    propose: propose(id)
  });
});
