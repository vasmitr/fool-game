import { table$ } from "./store";
import "./player";

console.log("=== DURAK AUTONOMOUS GAME START ===");

table$.subscribe({
  next: (table) => {
    console.log(`\n[STATE] Deck: ${table.deck.length}, Table: ${table.attack.length}/${table.defense.length}`);
    console.log(`Attacker: P${table.currentTurnId}, Defender: P${table.currentDefendId}`);
  },
  complete: () => {
    console.log("\n=== GAME FINISHED ===");
    process.exit(0);
  }
});
