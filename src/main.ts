import { table$, log$, intent$, resetGame } from "./store";
import "./player";
import "./controller";
import type { TableState, Hand, Player } from "./rules";
import type { Card } from "./consts";

const botPlayersArea = document.getElementById("bot-players")!;
const deckCount = document.getElementById("deck-count")!;
const deckStack = document.getElementById("deck-stack")!;
const boutArea = document.getElementById("bout-area")!;
const discardStack = document.getElementById("discard-stack")!;
const gameLog = document.getElementById("game-log")!;
const btnCopyLog = document.getElementById("btn-copy-log")!;
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

const renderCard = (card: Card, animationClass = '', onClick?: () => void) => {
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

const getThrowClass = (cardId: string, lastState: TableState | null) => {
    if (!lastState) return '';
    // Was this card in human hand?
    const inHumanHand = lastState.hands.find((h: Hand) => h.playerId === HUMAN_ID)?.cards.some((c: Card) => c.id === cardId);
    if (inHumanHand) return 'throw-bottom';
    // Was it in any bot's hand?
    const inBotHand = lastState.hands.some((h: Hand) => h.playerId !== HUMAN_ID && h.cards.some((c: Card) => c.id === cardId));
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
    gameLog.appendChild(div);
    gameLog.scrollTop = gameLog.scrollHeight;
}

log$.subscribe((msg: string) => logMessage(msg));

btnCopyLog.addEventListener("click", () => {
    const text = Array.from(gameLog.children).map(c => c.textContent).join('\n');
    navigator.clipboard.writeText(text).then(() => {
        const originalText = btnCopyLog.textContent;
        btnCopyLog.textContent = "COPIED!";
        setTimeout(() => btnCopyLog.textContent = originalText, 2000);
    });
});

btnRestartMain.addEventListener("click", () => resetGame());
btnRestartOverlay.addEventListener("click", () => {
    gameOverOverlay.style.display = "none";
    resetGame();
});

const onHumanCardClick = (card: Card) => {
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
let lastTableState: TableState | null = null;

table$.subscribe({
    next: (table: TableState) => {
        const hasStateChanged = (path: (keyof TableState)[]) => {
            if (!lastTableState) return true;
            let current: Record<string, unknown> | undefined = table as unknown as Record<string, unknown>;
            let last: Record<string, unknown> | undefined = lastTableState as unknown as Record<string, unknown>;
            for (const key of path) {
                current = current?.[key as string] as Record<string, unknown> | undefined;
                last = last?.[key as string] as Record<string, unknown> | undefined;
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
            table.players.filter((p: Player) => p.id !== HUMAN_ID).forEach((player: Player) => {
                const playerBox = document.createElement("div");
                playerBox.className = `player-box ${table.currentTurnId === player.id ? "active" : ""} ${table.currentDefendId === player.id ? "defender" : ""}`;
                
                const hand = table.hands.find((h: Hand) => h.playerId === player.id);
                const prevHand = lastTableState?.hands.find((h: Hand) => h.playerId === player.id);
                const cardCount = hand?.cards.length || 0;
                const prevCount = prevHand?.cards.length || 0;
                
                playerBox.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 5px;">${player.name}</div>
                    <div class="mini-hand"></div>
                    <div style="font-size: 0.6rem; color: #888; margin-top: 5px;">${table.currentDefendId === player.id ? "DEFENDING" : (table.currentTurnId === player.id ? "ATTACKING" : "WAITING")}</div>
                `;
                const miniHand = playerBox.querySelector(".mini-hand")!;
                for (let i = 0; i < cardCount; i++) {
                    const miniCard = document.createElement("div");
                    const isNew = i >= prevCount;
                    miniCard.className = `mini-card ${isNew ? 'mini-card-taken' : ''}`;
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
        if (hasStateChanged(['discardPile'])) {
            discardStack.innerHTML = "";
            const count = table.discardPile.length;
            const prevCount = lastTableState?.discardPile?.length || 0;
            
            const visibleDiscard = Math.min(Math.floor(count / 2), 10);
            for (let i = 0; i < visibleDiscard; i++) {
                const back = renderCardBack();
                back.classList.add("deck-card");
                if (i === visibleDiscard - 1 && count > prevCount) {
                    back.classList.add("card-beaten");
                }
                
                // Deterministic "chaoticness" based on index
                const rotation = (i * 133) % 40 - 20; 
                const offsetX = (i * 7) % 15 - 7;
                const offsetY = (i * 11) % 15 - 7;
                
                back.style.transform = `rotate(${rotation}deg) translate(${offsetX}px, ${offsetY}px)`;
                back.style.zIndex = i.toString();
                discardStack.appendChild(back);
            }
        }

        // 4. Bout Area
        if (hasStateChanged(['attack']) || hasStateChanged(['defense'])) {
            boutArea.innerHTML = "";
            table.attack.forEach((card: Card, i: number) => {
                const pair = document.createElement("div");
                pair.className = "bout-pair";
                
                const attackerCard = renderCard(card, getThrowClass(card.id, lastTableState));
                pair.appendChild(attackerCard);

                const defenderCardObj = table.defense[i];
                if (defenderCardObj) {
                    const defenderCard = renderCard(defenderCardObj, getThrowClass(defenderCardObj.id, lastTableState));
                    defenderCard.classList.add("defender-card");
                    pair.appendChild(defenderCard);
                }
                boutArea.appendChild(pair);
            });
        }

        // 5. Human Hand
        if (hasStateChanged(['hands'])) {
            const humanHand = table.hands.find((h: Hand) => h.playerId === HUMAN_ID)?.cards || [];
            humanHandArea.innerHTML = "";
            humanHand.forEach((card: Card) => {
                let animation = '';
                if (lastTableState) {
                    const wasInHand = lastTableState.hands.find((h: Hand) => h.playerId === HUMAN_ID)?.cards.some((c: Card) => c.id === card.id);
                    if (!wasInHand) {
                        const wasOnTable = lastTableState.attack.some((c: Card) => c.id === card.id) || lastTableState.defense.some((c: Card) => c.id === card.id);
                        animation = wasOnTable ? 'card-taken' : 'card-dealt';
                    }
                }
                humanHandArea.appendChild(renderCard(card, animation, () => onHumanCardClick(card)));
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