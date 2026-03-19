import { registerKS } from "./store";
import { findBestDefense, findBestAttack } from "./helpers";
import type { TableState, Intent } from "./rules";

const canAct = (playerId: number) => (table: TableState): boolean => {
  if (table.isGameOver) return false;
  const isMyTurnToDefend = table.currentDefendId === playerId;
  const isMyTurnToAttack = table.currentTurnId === playerId;
  const defenderHandCount =
    table.hands.find((h) => h.playerId === table.currentDefendId)?.cards
      .length ?? 0;

  if (isMyTurnToDefend) return table.attack.length > table.defense.length;
  return (
    (isMyTurnToAttack || table.attack.length > 0) &&
    table.attack.length < defenderHandCount
  );
};

const propose = (playerId: number) => (table: TableState): Intent | null => {
  const myHand =
    table.hands.find((h) => h.playerId === playerId)?.cards ?? [];
  const defenderHandCount =
    table.hands.find((h) => h.playerId === table.currentDefendId)?.cards
      .length ?? 0;
  const isMyTurnToDefend = table.currentDefendId === playerId;
  const isMyTurnToAttack = table.currentTurnId === playerId;

  if (isMyTurnToDefend) {
    const suggestion = findBestDefense(
      myHand,
      table.attack,
      table.defense,
      table.trumps,
    );
    if (!suggestion) return null;
    if (suggestion.action === "TAKE") return { action: "TAKE", playerId };
    return {
      action: suggestion.action === "PASS" ? "PASS" : "DEFEND",
      playerId,
      cardId: suggestion.cardId,
    };
  }

  const suggestion = findBestAttack(
    myHand,
    table.attack,
    table.defense,
    table.trumps,
    defenderHandCount,
  );
  if (suggestion) return { action: "ATTACK", playerId, cardId: suggestion.cardId };
  if (
    isMyTurnToAttack &&
    table.attack.length > 0 &&
    table.attack.length === table.defense.length
  ) {
    return { action: "BEATEN", playerId };
  }
  return null;
};

// Register AI bots (Marie Curie, Isaac Newton, Nikola Tesla) as Knowledge Sources
[1, 2, 3].forEach((id) => {
  registerKS({
    playerId: id,
    canAct: canAct(id),
    propose: propose(id),
  });
});
