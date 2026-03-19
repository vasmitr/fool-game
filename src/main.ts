import { table$, log$, intent$, resetGame } from "./store";
import "./player";
import "./controller";
import { findBestDefense, findBestAttack } from "./helpers";
import type { Intent } from "./rules";

const deckCount = document.getElementById("deck-count")!;
const trumpInfo = document.getElementById("trump-info")!;
const boutArea = document.getElementById("bout-area")!;
const playerList = document.getElementById("player-list")!;
const gameLog = document.getElementById("game-log")!;
const humanHandArea = document.getElementById("human-hand")!;
const humanControls = document.getElementById("human-controls")!;
const btnPass = document.getElementById("btn-pass")!;
const btnTake = document.getElementById("btn-take")!;
const btnRestartMain = document.getElementById("btn-restart-main")!;
const btnRestartOverlay = document.getElementById("btn-restart-overlay")!;
const gameOverOverlay = document.getElementById("game-over-overlay")!;
const winnerText = document.getElementById("winner-text")!;

const HUMAN_ID = 0;

const getSuitSymbol = (suit: string) => {
    switch(suit) {
        case 'hearts': return '♥';
        case 'diamonds': return '♦';
        case 'clubs': return '♣';
        case 'spades': return '♠';
        default: return '';
    }
}

const renderCard = (card: any, onClick?: () => void) => {
    const cardEl = document.createElement("div");
    cardEl.className = `card ${card.suit}`;
    cardEl.textContent = `${card.rank}${getSuitSymbol(card.suit)}`;
    if (onClick) {
        cardEl.style.cursor = "pointer";
        cardEl.addEventListener("click", onClick);
    }
    return cardEl;
}

const logMessage = (msg: string) => {
    const div = document.createElement("div");
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    gameLog.prepend(div);
}

log$.subscribe((msg: string) => logMessage(msg));

btnRestartMain.addEventListener("click", () => resetGame());
btnRestartOverlay.addEventListener("click", () => {
    gameOverOverlay.style.display = "none";
    resetGame();
});

// Handle human clicks
const onHumanCardClick = (card: any) => {
    const table = table$.value;
    if (table.isGameOver) return;
    const isMyTurnToAttack = table.currentTurnId === HUMAN_ID;
    const isMyTurnToDefend = table.currentDefendId === HUMAN_ID;

    if (isMyTurnToAttack || (!isMyTurnToDefend && table.attack.length > 0)) {
        intent$.next({ type: "ATTACK_INTENT", playerId: HUMAN_ID, cardId: card.id, action: "ATTACK" });
    } else if (isMyTurnToDefend && table.attack.length > table.defense.length) {
        // Can I transfer? (rank match + no defense started)
        const allRanks = [...table.attack, ...table.defense].map(c => c.rank);
        if (table.defense.length === 0 && allRanks.includes(card.rank)) {
            intent$.next({ type: "PASS_INTENT", playerId: HUMAN_ID, cardId: card.id, action: "PASS" });
        } else {
            intent$.next({ type: "DEFENSE_INTENT", playerId: HUMAN_ID, cardId: card.id, action: "DEFEND" });
        }
    }
};

btnPass.addEventListener("click", () => {
    intent$.next({
        type: "BEATEN_INTENT",
        playerId: HUMAN_ID,
        action: "BEATEN"
    });
});

btnTake.addEventListener("click", () => {
    intent$.next({
        type: "TAKE_INTENT",
        playerId: HUMAN_ID,
        action: "TAKE"
    });
});

table$.subscribe({
    next: (table: any) => {
        // 0. Game Over Status
        if (table.isGameOver) {
            gameOverOverlay.style.display = "flex";
            winnerText.textContent = `${table.winner} WINS!`;
        }

        // 1. Stats
        deckCount.textContent = table.deck.length.toString();
        trumpInfo.textContent = `${table.trumps.rank}${getSuitSymbol(table.trumps.suit)}`;
        
        // 2. Bout Area
        boutArea.innerHTML = "";
        table.attack.forEach((card: any, i: number) => {
            boutArea.appendChild(renderCard(card));
            if (table.defense[i]) {
                const defendCard = renderCard(table.defense[i]);
                defendCard.style.marginLeft = "-20px";
                defendCard.style.marginTop = "10px";
                defendCard.style.zIndex = "1";
                boutArea.appendChild(defendCard);
            }
        });

        // 3. Bot Player List (Marie, Isaac, Nikola)
        playerList.innerHTML = "";
        table.players.filter(p => p.id !== HUMAN_ID).forEach((player: any) => {
            const playerBox = document.createElement("div");
            playerBox.className = `player-box ${table.currentTurnId === player.id ? "active" : ""} ${table.currentDefendId === player.id ? "defender" : ""}`;
            
            const hand = table.hands.find((h: any) => h.playerId === player.id);
            playerBox.innerHTML = `
                <div style="font-weight: bold;">${player.name}</div>
                <div>Cards: ${hand?.cards.length || 0}</div>
                <div style="font-size: 0.7rem; color: #888;">${table.currentDefendId === player.id ? "DEFENDING" : (table.currentTurnId === player.id ? "ATTACKING" : "WAITING")}</div>
            `;
            playerList.appendChild(playerBox);
        });

        // 4. Human Hand and Controls
        const humanHand = table.hands.find((h: any) => h.playerId === HUMAN_ID)?.cards || [];
        humanHandArea.innerHTML = "";
        humanHand.forEach((card: any) => {
            humanHandArea.appendChild(renderCard(card, () => onHumanCardClick(card)));
        });

        const isHumanActive = table.currentTurnId === HUMAN_ID || table.currentDefendId === HUMAN_ID;
        humanControls.style.display = isHumanActive ? "block" : "none";
        
        if (isHumanActive) {
            humanHandArea.classList.add("active-turn");
        } else {
            humanHandArea.classList.remove("active-turn");
        }

        // Disable buttons if not appropriate
        const isParticipant = table.currentTurnId === HUMAN_ID || table.currentDefendId === HUMAN_ID;
        (btnPass as HTMLButtonElement).disabled = !isParticipant || table.attack.length === 0;
        (btnTake as HTMLButtonElement).disabled = table.currentDefendId !== HUMAN_ID || table.attack.length === 0;
    },
    complete: () => {
        logMessage("🏁 GAME OVER");
    }
});
