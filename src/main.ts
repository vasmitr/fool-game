import { table$, log$, intent$, resetGame } from "./store";
import "./player";
import "./controller";
import type { TableState } from "./rules";

const botPlayersArea = document.getElementById("bot-players")!;
const deckCount = document.getElementById("deck-count")!;
const deckStack = document.getElementById("deck-stack")!;
const boutArea = document.getElementById("bout-area")!;
const discardStack = document.getElementById("discard-stack")!;
const discardCount = document.getElementById("discard-count")!;
const gameLog = document.getElementById("game-log")!;
const humanHandArea = document.getElementById("human-hand")!;
const humanControls = document.getElementById("human-controls")!;
const btnPass = document.getElementById("btn-pass")! as HTMLButtonElement;
const btnTake = document.getElementById("btn-take")! as HTMLButtonElement;
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

const renderCard = (card: any, animationClass = '', onClick?: () => void) => {
    const cardEl = document.createElement("div");
    cardEl.className = `card ${card.suit} ${animationClass}`;
    cardIdToElement.set(card.id, cardEl);
    
    // Corner Rank & Suit
    const cornerEl = document.createElement("div");
    cornerEl.style.position = "absolute";
    cornerEl.style.top = "2px";
    cornerEl.style.left = "5px";
    cornerEl.style.fontSize = "0.9rem";
    cornerEl.style.fontWeight = "bold";
    cornerEl.textContent = card.rank + getSuitSymbol(card.suit);
    
    // Center Suit Symbol
    const centerEl = document.createElement("div");
    centerEl.textContent = getSuitSymbol(card.suit);
    centerEl.style.fontSize = "2.5rem";
    
    cardEl.appendChild(cornerEl);
    cardEl.appendChild(centerEl);

    if (onClick) {
        cardEl.style.cursor = "pointer";
        cardEl.addEventListener("click", onClick);
    }
    return cardEl;
}

const getThrowClass = (cardId: string, lastState: any) => {
    if (!lastState) return '';
    // Was this card in human hand?
    const inHumanHand = lastState.hands.find((h: any) => h.playerId === HUMAN_ID)?.cards.some((c: any) => c.id === cardId);
    if (inHumanHand) return 'throw-bottom';
    // Was it in any bot's hand?
    const inBotHand = lastState.hands.some((h: any) => h.playerId !== HUMAN_ID && h.cards.some((c: any) => c.id === cardId));
    if (inBotHand) return 'throw-top';
    return '';
}

const renderCardBack = (isNew = false) => {
    const cardEl = document.createElement("div");
    cardEl.className = `card card-back ${isNew ? 'card-dealt' : ''}`;
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

const onHumanCardClick = (card: any) => {
    const table = table$.value;
    if (table.isGameOver) return;
    const isMyTurnToAttack = table.currentTurnId === HUMAN_ID;
    const isMyTurnToDefend = table.currentDefendId === HUMAN_ID;

    if (isMyTurnToAttack || (!isMyTurnToDefend && table.attack.length > 0)) {
        intent$.next({ type: "ATTACK_INTENT", playerId: HUMAN_ID, cardId: card.id, action: "ATTACK" });
    } else if (isMyTurnToDefend && table.attack.length > table.defense.length) {
        const allRanks = [...table.attack, ...table.defense].map(c => c.rank);
        if (table.defense.length === 0 && allRanks.includes(card.rank)) {
            intent$.next({ type: "PASS_INTENT", playerId: HUMAN_ID, cardId: card.id, action: "PASS" });
        } else {
            intent$.next({ type: "DEFENSE_INTENT", playerId: HUMAN_ID, cardId: card.id, action: "DEFEND" });
        }
    }
};

btnPass.addEventListener("click", () => {
    intent$.next({ type: "BEATEN_INTENT", playerId: HUMAN_ID, action: "BEATEN" });
});

btnTake.addEventListener("click", () => {
    intent$.next({ type: "TAKE_INTENT", playerId: HUMAN_ID, action: "TAKE" });
});

const cardIdToElement = new Map<string, HTMLElement>();
let lastTableState: any = null;

table$.subscribe({
    next: (table: any) => {
        const hasStateChanged = (path: string[]) => {
            if (!lastTableState) return true;
            let current = table;
            let last = lastTableState;
            for (const key of path) {
                current = current?.[key];
                last = last?.[key];
            }
            return JSON.stringify(current) !== JSON.stringify(last);
        };

        // 0. Game Over
        if (table.isGameOver) {
            gameOverOverlay.style.display = "flex";
            winnerText.textContent = `${table.winner} WINS!`;
        }

        // 1. Bots
        if (hasStateChanged(['players']) || hasStateChanged(['hands']) || hasStateChanged(['currentTurnId']) || hasStateChanged(['currentDefendId'])) {
            botPlayersArea.innerHTML = "";
            table.players.filter((p: any) => p.id !== HUMAN_ID).forEach((player: any) => {
                const playerBox = document.createElement("div");
                playerBox.className = `player-box ${table.currentTurnId === player.id ? "active" : ""} ${table.currentDefendId === player.id ? "defender" : ""}`;
                
                const hand = table.hands.find((h: any) => h.playerId === player.id);
                const cardCount = hand?.cards.length || 0;
                
                playerBox.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 5px;">${player.name}</div>
                    <div class="mini-hand"></div>
                    <div style="font-size: 0.6rem; color: #888; margin-top: 5px;">${table.currentDefendId === player.id ? "DEFENDING" : (table.currentTurnId === player.id ? "ATTACKING" : "WAITING")}</div>
                `;
                const miniHand = playerBox.querySelector(".mini-hand")!;
                for (let i = 0; i < cardCount; i++) {
                    const miniCard = document.createElement("div");
                    miniCard.className = "mini-card";
                    miniHand.appendChild(miniCard);
                }
                botPlayersArea.appendChild(playerBox);
            });
        }

        // 2. Deck & Trumps
        if (hasStateChanged(['deck']) || hasStateChanged(['trumps'])) {
            deckStack.innerHTML = "";
            deckCount.textContent = table.deck.length.toString();
            
            // Render trump card at the bottom
            const trumpCard = renderCard(table.trumps);
            trumpCard.classList.add("deck-card", "trump-card");
            deckStack.appendChild(trumpCard);

            // Render top cards of the deck as a stack
            const visibleDeckCount = Math.min(table.deck.length, 3);
            for (let i = 0; i < visibleDeckCount; i++) {
                const back = renderCardBack();
                back.classList.add("deck-card");
                back.style.top = `-${i * 2}px`;
                back.style.left = `${i * 2}px`;
                deckStack.appendChild(back);
            }
        }

        // 3. Discard Pile (Beaten)
        if (hasStateChanged(['beaten'])) {
            discardStack.innerHTML = "";
            const count = table.beaten.length;
            discardCount.textContent = (count / 2).toString(); // Bout count or card count? Let's show card count / 2 as rounds
            
            const visibleDiscard = Math.min(Math.floor(count / 2), 5);
            for (let i = 0; i < visibleDiscard; i++) {
                const back = renderCardBack();
                back.classList.add("deck-card");
                back.style.transform = `rotate(${(i - 2) * 5}deg)`;
                back.style.top = `-${i}px`;
                discardStack.appendChild(back);
            }
        }

        // 4. Bout Area
        if (hasStateChanged(['attack']) || hasStateChanged(['defense'])) {
            boutArea.innerHTML = "";
            table.attack.forEach((card: any, i: number) => {
                const pair = document.createElement("div");
                pair.className = "bout-pair";
                
                const attackerCard = renderCard(card, getThrowClass(card.id, lastTableState));
                pair.appendChild(attackerCard);

                if (table.defense[i]) {
                    const defenderCard = renderCard(table.defense[i], getThrowClass(table.defense[i].id, lastTableState));
                    defenderCard.classList.add("defender-card");
                    pair.appendChild(defenderCard);
                }
                boutArea.appendChild(pair);
            });
        }

        // 5. Human Hand
        if (hasStateChanged(['hands'])) {
            const humanHand = table.hands.find((h: any) => h.playerId === HUMAN_ID)?.cards || [];
            humanHandArea.innerHTML = "";
            humanHand.forEach((card: any) => {
                const isNew = lastTableState && !lastTableState.hands.find((h: any) => h.playerId === HUMAN_ID)?.cards.some((c: any) => c.id === card.id);
                humanHandArea.appendChild(renderCard(card, isNew ? 'card-dealt' : '', () => onHumanCardClick(card)));
            });
        }

        const isHumanActive = table.currentTurnId === HUMAN_ID || table.currentDefendId === HUMAN_ID;
        humanControls.style.display = isHumanActive ? "flex" : "none";
        
        // Buttons state
        const isParticipant = table.currentTurnId === HUMAN_ID || table.currentDefendId === HUMAN_ID;
        btnPass.disabled = !isParticipant || table.attack.length === 0;
        btnTake.disabled = table.currentDefendId !== HUMAN_ID || table.attack.length === 0;

        lastTableState = table;
    },
    complete: () => {
        logMessage("🏁 GAME OVER");
    }
});
