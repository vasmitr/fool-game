import { table$, intent$ } from "./store";
import { findBestDefense, findBestAttack } from "./helpers";
import { map, distinctUntilChanged, mergeMap, of, EMPTY, observeOn, asyncScheduler, delay } from "rxjs";

export const createPlayerBrain = (playerId: number) => {
  return table$.pipe(
    observeOn(asyncScheduler),
    // 1. Only look at the state if the game isn't over or relevant to this player
    map((table) => ({
      isMyTurnToAttack: table.currentTurnId === playerId,
      isMyTurnToDefend: table.currentDefendId === playerId,
      attack: table.attack,
      defense: table.defense,
      myHand: table.hands.find((h) => h.playerId === playerId)?.cards || [],
      defenderHandCount:
        table.hands.find((h) => h.playerId === table.currentDefendId)
          ?.cards.length || 0,
      trumps: table.trumps,
    })),
    // 2. Only re-think if something actually changed for this player
    distinctUntilChanged(
      (prev, curr) =>
        prev.isMyTurnToDefend === curr.isMyTurnToDefend &&
        prev.attack.length === curr.attack.length &&
        prev.defense.length === curr.defense.length &&
        prev.myHand.length === curr.myHand.length &&
        prev.defenderHandCount === curr.defenderHandCount,
    ),
    // 3. Logic: Decide what to do based on the context
    mergeMap((context) => {
      // 1. Attack / Throw-in Logic
      // All players except defender can throw more cards if ranks match table
      // AND defender has enough cards left in hand to defend
      const isEligibleToAttack =
        (context.isMyTurnToAttack ||
          (!context.isMyTurnToDefend && context.attack.length > 0)) &&
        context.attack.length < context.defenderHandCount;

      if (isEligibleToAttack) {
        const suggestion = findBestAttack(
          context.myHand,
          context.attack,
          context.defense,
          context.trumps,
          context.defenderHandCount,
        );
        if (suggestion) {
          return of({
            type: "ATTACK_INTENT",
            playerId: playerId,
            cardId: suggestion.cardId,
            action: suggestion.action,
          }).pipe(delay(1000));
        } else if (context.isMyTurnToAttack && context.attack.length > 0) {
          // Attacker gives up -> Beaten
          return of({
            type: "BEATEN_INTENT",
            playerId: playerId,
            action: "BEATEN",
          }).pipe(delay(1000));
        }
      }

      // 2. Defense Logic
      if (context.isMyTurnToDefend && context.attack.length > 0) {
        const suggestion = findBestDefense(
          context.myHand,
          context.attack,
          context.defense,
          context.trumps,
        );
        if (suggestion && suggestion.action !== "TAKE") {
          return of({
            type: "DEFENSE_INTENT",
            playerId: playerId,
            cardId: suggestion.cardId,
            action: suggestion.action === "PASS" ? "PASS" : "DEFEND",
          }).pipe(delay(1000));
        } else if (suggestion && suggestion.action === "TAKE") {
          // Defender takes
          return of({
             type: "TAKE_INTENT",
             playerId: playerId,
             action: "TAKE"
          }).pipe(delay(1000));
        }
      }
      // If nothing to do, return an "Empty" observable
      return EMPTY;
    }),
  );
};

// Initialize brains for bots (Marie Curie, Isaac Newton, Nikola Tesla)
[1, 2, 3].forEach((id) => {
  createPlayerBrain(id).subscribe(intent$ as any);
});
