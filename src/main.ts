import { table$, log$ } from "./store";
import "./player";

// ... (keep previous elements)
const deckCount = document.getElementById("deck-count")!;
const trumpInfo = document.getElementById("trump-info")!;
const boutArea = document.getElementById("bout-area")!;
const playerList = document.getElementById("player-list")!;
const gameLog = document.getElementById("game-log")!;

// ... (keep helper functions)

const getSuitSymbol = (suit: string) => {
    switch(suit) {
        case 'hearts': return '♥';
        case 'diamonds': return '♦';
        case 'clubs': return '♣';
        case 'spades': return '♠';
        default: return '';
    }
}

const renderCard = (card: any) => {
    const cardEl = document.createElement("div");
    cardEl.className = `card ${card.suit}`;
    cardEl.textContent = `${card.rank}${getSuitSymbol(card.suit)}`;
    return cardEl;
}

const logMessage = (msg: string) => {
    const div = document.createElement("div");
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    gameLog.prepend(div);
}

log$.subscribe(msg => logMessage(msg));

table$.subscribe({
    next: (table: any) => {
        // Stats
        deckCount.textContent = table.deck.length.toString();
        trumpInfo.textContent = `${table.trumps.rank}${getSuitSymbol(table.trumps.suit)}`;
        
        // Bout Area
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

        // Player List
        playerList.innerHTML = "";
        table.players.forEach((player: any) => {
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
    },
    complete: () => {
        logMessage("🏁 GAME OVER");
    }
});
