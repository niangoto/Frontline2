// Constants
const PLAYER_COLORS = ["#FF0000", "#0000FF"];
const UNIT_RADIUS = 15;
const INITIAL_POINTS = 90;
const FRONT_LINE_COLOR = "#000000";
const BG_COLOR = "#F0F0F0";
const BUTTON_COLOR = "#64C864";
const BUTTON_TEXT_COLOR = "#FFFFFF";
const MAX_MOVE_DISTANCE = 30;
const MIN_DISTANCE_TO_FRONT = UNIT_RADIUS * 1.5;
const MOVE_SPEED = 3;
const MAX_UNITS = 50;  // New constant for maximum units
const MAX_TURNS = 15;  // New constant for maximum turns
const CAPITAL_RADIUS = UNIT_RADIUS;  // Now same size as units
const CAPITAL_COLOR = "#FFD700";
const SELECTION_COLOR = "#00FF00";
const SELECTION_LINE_WIDTH = 2;
const SELECTED_UNIT_COLOR = "#00FF00";
const SELECTED_UNIT_LINE_WIDTH = 3;
// Дължини на стрелките
const BLACK_ARROW_LENGTH = 50;
const BLUE_ARROW_LENGTH = BLACK_ARROW_LENGTH * 2;
// Пример: границата е между lat1 и lat2 (север-юг), canvas.height = 600
const LAT1 = 54.8; // северна граница (пример)
const LAT2 = 50.3; // южна граница (пример)

// DOM elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const gameInfo = document.getElementById('game-info');
const readyBtn = document.getElementById('ready-btn');
const settingsModal = document.getElementById('settings-modal');
const turnInput = document.getElementById('turn-input');
const confirmBtn = document.getElementById('confirm-btn');

// Game data
let gameData = {
    playerUnits: [[], []],
    frontLine: [],
    selectedUnit: null,
    phase: "placement",
    currentPlayer: 0,
    battlePhase: false,
    turnCount: 0,
    showArrows: true,
    maxTurns: 3,
    originalYPositions: [],
    initialSpacing: 0,
    capitals: [null, null], // Store capital positions for each player
    selectionStart: null,
    selectionEnd: null,
    selectedUnits: [],
    gameMode: "2players", // "2players" или "vsbot"
};

// Сега вече може:
let ARROW_LENGTH = Math.max(40, Math.floor(canvas.width / gameData.maxTurns / 2));

// Начално положение на фронтовата линия (географски координати)
function latToY(lat) {
    // Преобразува latitude към y в canvas
    return ((LAT1 - lat) / (LAT1 - LAT2)) * canvas.height;
}
function yToLat(y) {
    // Преобразува y в latitude
    return LAT1 - (y / canvas.height) * (LAT1 - LAT2);
}
function geoToCanvas([lon, lat]) {
    // longitude -> x, latitude -> y
    // Пример: x = (lon - LON1) / (LON2 - LON1) * canvas.width
    const LON1 = 14.0; // западна граница (пример)
    const LON2 = 24.0; // източна граница (пример)
    let x = ((lon - LON1) / (LON2 - LON1)) * canvas.width;
    let y = latToY(lat);
    return [x, y];
}
// Game class definition should come before any usage
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.frontLine = [];
        this.playerUnits = [[], []];
        this.currentPlayer = 0;
        this.selectedUnit = null;
        this.phase = "settings";
        this.battlePhase = false;
        this.turnCount = 0;
        this.maxTurns = 3;
        this.maxUnits = 10;
        this.gameMode = "2players"; 
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw territories
        if (this.frontLine.length > 1) {
            // Draw red territory
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            for (const point of this.frontLine) {
                this.ctx.lineTo(point[0], point[1]);
            }
            this.ctx.lineTo(0, this.canvas.height);
            this.ctx.closePath();
            this.ctx.fillStyle = '#ffcccc';
            this.ctx.fill();

            // Draw blue territory
            this.ctx.beginPath();
            this.ctx.moveTo(this.canvas.width, 0);
            for (const point of this.frontLine) {
                this.ctx.lineTo(point[0], point[1]);
            }
            this.ctx.lineTo(this.canvas.width, this.canvas.height);
            this.ctx.closePath();
            this.ctx.fillStyle = '#ccceff';
            this.ctx.fill();

            // Draw front line
            this.ctx.beginPath();
            this.ctx.moveTo(this.frontLine[0][0], this.frontLine[0][1]);
            for (const point of this.frontLine) {
                this.ctx.lineTo(point[0], point[1]);
            }
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Draw points on front line
            for (const point of this.frontLine) {
                this.ctx.beginPath();
                this.ctx.arc(point[0], point[1], 3, 0, Math.PI * 2);
                this.ctx.fillStyle = '#000000';
                this.ctx.fill();
            }
        }

        // Draw units
        for (let player = 0; player < 2; player++) {
            // Skip drawing red units during blue's placement phase
            if (this.phase === "placement" && player === 0 && this.currentPlayer === 1) {
                continue;
            }

            for (const unit of this.playerUnits[player]) {
                unit.draw(this.ctx, unit === this.selectedUnit);
            }
        }

        // Update game info
        const gameInfo = document.getElementById('game-info');
        if (this.phase === "placement") {
            gameInfo.textContent = `Играч ${this.currentPlayer + 1}: Поставяне на единици (${this.playerUnits[this.currentPlayer].length}/${this.maxUnits})`;
        } else if (this.phase.endsWith("_arrows")) {
            gameInfo.textContent = `Играч ${this.currentPlayer + 1}: Задаване на посоки`;
        }
    }
    update() {
        // ... съществуващ код ...

        // Проверка за бот
        if (this.gameMode === "vsbot" && 
            this.currentPlayer === 1 && 
            (this.phase === "placement" || this.phase === "player2_arrows")) {
            
            if (!this.bot) {
                this.bot = new BotController(this);
            }
            
            // Изкуствено забавяне за по-естествено поведение
            setTimeout(() => {
                this.bot.makeDecision();
                
                // Автоматично маркиране като готов ако е необходимо
                if (this.phase === "placement" && 
                    this.playerUnits[1].length >= this.maxUnits) {
                    this.handleReadyClick();
                } else if (this.phase === "player2_arrows") {
                    // Даваме малко време на стрелките да се визуализират
                    setTimeout(() => this.handleReadyClick(), 500);
                }
            }, 1000);
        }
    }
}

// Create game instance
let game = new Game(canvas);

// Инициализация на играта
let botController = null;
if (gameData.gameMode === "vsbot") {
    botController = new BotController(gameData);
}

// Клас Unit
class Unit {
    constructor(player, x, y) {
        this.player = player;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.prevX = x;
        this.prevY = y;
        this.direction = null;
        this.assignedPoints = [];  // Инициализираме масива тук
        this.forwardMoves = 0;
        this.totalPoints = 0;
        this.partialPoints = 0;
        this.blueArrow = null;
        this.isMoving = false;
        this.moveProgress = 0;
        this.blockedByFront = false;
        this.beingPushed = false;
        this.pushTargetX = x;
        this.pushTargetY = y;
        this.pushProgress = 0;
    }

    updatePosition() {
        // Първо обработваме избутването
        if (this.beingPushed) {
            this.x = this.prevX + (this.pushTargetX - this.prevX) * this.pushProgress;
            this.y = this.prevY + (this.pushTargetY - this.prevY) * this.pushProgress;
            this.pushProgress = Math.min(1.0, this.pushProgress + MOVE_SPEED / 10);

            // Ако центърът е напълно извън екрана — премахни единицата
            if (
                this.x < 0 ||
                this.x > canvas.width ||
                this.y < 0 ||
                this.y > canvas.height
            ) {
                gameData.playerUnits[this.player] = gameData.playerUnits[this.player].filter(u => u !== this);
                return;
            }

            // Check distance from front line after being pushed
            let tooClose = false;
            for (let point of gameData.frontLine) {
                let dist = Math.sqrt((this.x - point[0])**2 + (this.y - point[1])**2);
                if (dist < UNIT_RADIUS) {
                    tooClose = true;
                    break;
                }
            }

            // Ако е твърде близо до фронта и е притисната и от ръба (центърът извън екрана) — премахни
            if (tooClose) {
                if (
                    this.x < 0 ||
                    this.x > canvas.width ||
                    this.y < 0 ||
                    this.y > canvas.height
                ) {
                    gameData.playerUnits[this.player] = gameData.playerUnits[this.player].filter(u => u !== this);
                    return;
                }
                // Ако е само твърде близо до фронта — премахни
                gameData.playerUnits[this.player] = gameData.playerUnits[this.player].filter(u => u !== this);
                return;
            }

            // Ако ще излезе извън екрана — спри движението (не премахвай)
            if (
                this.x - UNIT_RADIUS < 0 ||
                this.x + UNIT_RADIUS > canvas.width ||
                this.y - UNIT_RADIUS < 0 ||
                this.y + UNIT_RADIUS > canvas.height
            ) {
                this.beingPushed = false;
                this.isMoving = false;
                this.blockedByFront = true;
                return;
            }

            // Спри движението ако попадне в морето (WW2 карта)
            if (isInSeaZone(this.x, this.y)) {
                this.beingPushed = false;
                this.isMoving = false;
                this.blockedByFront = true;
                return;
            }

            if (this.pushProgress >= 1.0) {
                this.beingPushed = false;
                this.prevX = this.x;
                this.prevY = this.y;
                // Актуализираме и целевите позиции ако има активно движение
                if (this.isMoving) {
                    this.targetX += (this.pushTargetX - this.prevX);
                    this.targetY += (this.pushTargetY - this.prevY);
                }
            }
            return;
        }

        if (this.isMoving) {
            // Изчисляваме потенциалните нови координати
            let newX = this.prevX + (this.targetX - this.prevX) * this.moveProgress;
            let newY = this.prevY + (this.targetY - this.prevY) * this.moveProgress;

            // Ако ще излезе извън екрана — спри движението (не премахвай)
            if (
                newX - UNIT_RADIUS < 0 ||
                newX + UNIT_RADIUS > canvas.width ||
                newY - UNIT_RADIUS < 0 ||
                newY + UNIT_RADIUS > canvas.height
            ) {
                this.isMoving = false;
                this.blockedByFront = true;
                return;
            }

            // Спри движението ако влиза в морето (WW2 карта)
            if (isInSeaZone(newX, newY)) {
                this.isMoving = false;
                this.blockedByFront = true;
                return;
            }

            // Вектор на движение
            let moveDirX = this.targetX - this.prevX;
            let moveDirY = this.targetY - this.prevY;
            let moveLen = Math.sqrt(moveDirX**2 + moveDirY**2);

            if (moveLen > 0.001) {
                moveDirX /= moveLen;
                moveDirY /= moveLen;
            }

            // Проверка за разстояние до фронтовата линия
            let tooClose = false;
            let closestDist = Infinity;
            let closestPoint = null;

            for (let point of gameData.frontLine) {
                let dist = Math.sqrt((newX - point[0])**2 + (newY - point[1])**2);
                if (dist < MIN_DISTANCE_TO_FRONT) {
                    tooClose = true;
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestPoint = point;
                    }
                }
            }

            if (!tooClose) {
                // Свободно движение
                this.x = newX;
                this.y = newY;
                this.moveProgress = Math.min(1.0, this.moveProgress + MOVE_SPEED / (moveLen + 0.1));
            } else {
                // Проверяваме дали се приближаваме или отдалечаваме от точката
                if (closestPoint) {
                    // Вектор към най-близката точка от фронта
                    let toPointX = closestPoint[0] - this.x;
                    let toPointY = closestPoint[1] - this.y;

                    // Скаларно произведение
                    let dotProduct = moveDirX * toPointX + moveDirY * toPointY;

                    if (dotProduct <= 0) {
                        // Позволяваме движение
                        this.x = newX;
                        this.y = newY;
                        this.moveProgress = Math.min(1.0, this.moveProgress + MOVE_SPEED / (moveLen + 0.1));
                    } else {
                        // Спираме движението
                        this.blockedByFront = true;
                        this.isMoving = false;
                    }
                } else {
                    this.blockedByFront = true;
                    this.isMoving = false;
                }
            }

            if (this.moveProgress >= 1.0) {
                this.isMoving = false;
            }
        }
    }

    draw(selected = false, showArrows = true) {
        // Рисуване на единицата
        ctx.beginPath();
        ctx.arc(this.x, this.y, UNIT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = PLAYER_COLORS[this.player];
        ctx.fill();
        
        // Дебел зелен контур за маркирани единици
        if (gameData.selectedUnits.includes(this)) {
            ctx.strokeStyle = SELECTED_UNIT_COLOR;
            ctx.lineWidth = SELECTED_UNIT_LINE_WIDTH;
            ctx.stroke();
            ctx.lineWidth = 1;
        } else {
            ctx.strokeStyle = PLAYER_COLORS[this.player];
            ctx.stroke();
        }
        
        if (showArrows) {
            // Синя стрелка (вижда се само ако е зададена)
            if (this.blueArrow) {
                let [endX, endY] = this.blueArrow;
                // Ограничаване на дължината до 2 * BLUE_ARROW_LENGTH
                let dx = endX - this.x;
                let dy = endY - this.y;
                let dist = Math.hypot(dx, dy);
                let maxLen = BLUE_ARROW_LENGTH;
                if (dist > maxLen) {
                    let scale = maxLen / dist;
                    endX = this.x + dx * scale;
                    endY = this.y + dy * scale;
                }

                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = "#0000FF";
                ctx.lineWidth = 2;
                ctx.stroke();

                // Накрайник на стрелката
                let angle = Math.atan2(endY - this.y, endX - this.x);
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - 10 * Math.cos(angle - Math.PI/6),
                    endY - 10 * Math.sin(angle - Math.PI/6)
                );
                ctx.lineTo(
                    endX - 10 * Math.cos(angle + Math.PI/6),
                    endY - 10 * Math.sin(angle + Math.PI/6)
                );
                ctx.closePath();
                ctx.fillStyle = "#0000FF";
                ctx.fill();
                ctx.lineWidth = 1;
            }
            // Черна стрелка (вижда се винаги, ако има зададена посока)
            if (this.direction !== null && !this.isMoving) {
                // ВИНАГИ дължина BLACK_ARROW_LENGTH
                let blackLen = BLACK_ARROW_LENGTH;
                let endX = this.x + blackLen * Math.cos(this.direction);
                let endY = this.y + blackLen * Math.sin(this.direction);
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 2;
                ctx.stroke();

                let angle = this.direction;
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - 10 * Math.cos(angle - Math.PI/6),
                    endY - 10 * Math.sin(angle - Math.PI/6)
                );
                ctx.lineTo(
                    endX - 10 * Math.cos(angle + Math.PI/6),
                    endY - 10 * Math.sin(angle + Math.PI/6)
                );
                ctx.closePath();
                ctx.fillStyle = "#000000";
                ctx.fill();
                ctx.lineWidth = 1;
            }
        }
    }
}

// Инициализация на фронтовата линия
function initializeFrontLine() {
    const POINTS_COUNT = 90;
    let mapType = "classic";
    const mapSelect = document.getElementById('map-select');
    if (mapSelect) {
        mapType = mapSelect.value;
    }

    if (mapType === "WW2") {
        // WW2 карта: използваме външен файл с изкривена линия
        let shape = (typeof WW2_FRONTLINE !== 'undefined') ? WW2_FRONTLINE : [];
        // Ако няма shape, fallback към права линия
        if (!shape || shape.length === 0) {
            shape = Array.from({length: POINTS_COUNT}, (_, i) => [canvas.width/2, (i / (POINTS_COUNT-1)) * canvas.height]);
        }
        // Скалираме по текущия размер на canvas
        let scaleY = canvas.height / 600;
        let scaleX = canvas.width / 700;
        let frontLine = shape.map(([x, y]) => [x * scaleX, y * scaleY]);
        gameData.frontLine = frontLine;
        gameData.initialSpacing = canvas.height / POINTS_COUNT;
        gameData.originalYPositions = frontLine.map(([x, y]) => y);

        // --- WW2: Задаване на столиците от масива и забрана за избор ---
        if (typeof WW2_CAPITALS !== 'undefined' && Array.isArray(WW2_CAPITALS)) {
            // Скалиране на столиците по canvas
            gameData.capitals = WW2_CAPITALS.map(c =>
                c ? [c[0] * scaleX, c[1] * scaleY] : null
            );
        }
        gameData.ww2CapitalsLocked = true;
        return;
    }

    if (
        mapType === "custom" &&
        typeof INITIAL_FRONTLINE !== "undefined" &&
        Array.isArray(INITIAL_FRONTLINE)
    ) {
        // Използвай точките от INITIAL_FRONTLINE (canvas координати)
        let frontLine = interpolateFrontLine(INITIAL_FRONTLINE, POINTS_COUNT);
        fillFrontLineEnds(frontLine, canvas.height / POINTS_COUNT, canvas);
        gameData.frontLine = frontLine;

        // Изчисли новото spacing за динамична корекция
        let totalLen = 0;
        for (let i = 1; i < gameData.frontLine.length; i++) {
            let dx = gameData.frontLine[i][0] - gameData.frontLine[i-1][0];
            let dy = gameData.frontLine[i][1] - gameData.frontLine[i-1][1];
            totalLen += Math.sqrt(dx*dx + dy*dy);
        }
        gameData.initialSpacing = totalLen / (gameData.frontLine.length - 1);
        gameData.originalYPositions = gameData.frontLine.map(([x, y]) => y);
    } else {
        // Класическа права линия
        gameData.initialSpacing = canvas.height / POINTS_COUNT;
        gameData.originalYPositions = Array.from({ length: POINTS_COUNT }, (_, i) => (i + 1) * gameData.initialSpacing);
        gameData.frontLine = gameData.originalYPositions.map(y => [canvas.width / 2, y]);
        // Първата точка най-горе, последната най-долу
        gameData.frontLine[0][1] = 0;
        gameData.frontLine[gameData.frontLine.length - 1][1] = canvas.height;
    }
}

// Проверка за поставяне на единица
function handlePlacement(pos) {
    // WW2 карта: не позволявай избор на столица
    if (gameData.ww2CapitalsLocked) {
        let [x, y] = pos;
        let player = gameData.currentPlayer;

        // Забрани поставяне в морето
        if (isInSeaZone(x, y)) return false;

        // Проверка за премахване на съществуваща единица
        for (let i = 0; i < gameData.playerUnits[player].length; i++) {
            let unit = gameData.playerUnits[player][i];
            if (Math.sqrt((x - unit.x)**2 + (y - unit.y)**2) <= UNIT_RADIUS) {
                gameData.playerUnits[player].splice(i, 1);
                return true;
            }
        }

        // Проверка за максимален брой единици
        if (gameData.playerUnits[player].length >= gameData.maxUnits) {
            return false;
        }
        
        // Проверка за разстояние от фронтова линия
        let minDistance = UNIT_RADIUS * 1.5;
        for (let point of gameData.frontLine) {
            if (Math.sqrt((x - point[0])**2 + (y - point[1])**2) < minDistance) {
                return false;
            }
        }
        
        // Проверка за разстояние от други единици
        for (let unit of gameData.playerUnits[player]) {
            if (Math.sqrt((x - unit.x)**2 + (y - unit.y)**2) < UNIT_RADIUS * 2) {
                return false;
            }
        }
        
        // Проверка за разстояние от столицата
        if (gameData.capitals[player]) {
            let capital = gameData.capitals[player];
            if (Math.sqrt((x - capital[0])**2 + (y - capital[1])**2) < UNIT_RADIUS * 2) {
                return false;
            }
        }
        
        if (!isInOwnTerritory(player, x, y)) {
            return false;
        }
        
        let newUnit = new Unit(player, x, y);
        gameData.playerUnits[player].push(newUnit);
        return true;
    }

    let [x, y] = pos;
    let player = gameData.currentPlayer;

    // Забрани поставяне в морето (за всички карти, ако има дефинирана морска зона)
    if (isInSeaZone(x, y)) return false;

    // Проверка за столица
    if (!gameData.capitals[player]) {
        return handleCapitalPlacement(pos);
    }

    // Проверка за премахване на съществуваща единица
    for (let i = 0; i < gameData.playerUnits[player].length; i++) {
        let unit = gameData.playerUnits[player][i];
        if (Math.sqrt((x - unit.x)**2 + (y - unit.y)**2) <= UNIT_RADIUS) {
            gameData.playerUnits[player].splice(i, 1);
            return true;
        }
    }
    
    // Проверка за максимален брой единици
    if (gameData.playerUnits[player].length >= gameData.maxUnits) {
        return false;
    }
    
    // Проверка за разстояние от фронтова линия
    let minDistance = UNIT_RADIUS * 1.5;
    for (let point of gameData.frontLine) {
        if (Math.sqrt((x - point[0])**2 + (y - point[1])**2) < minDistance) {
            return false;
        }
    }
    
    // Проверка за разстояние от други единици
    for (let unit of gameData.playerUnits[player]) {
        if (Math.sqrt((x - unit.x)**2 + (y - unit.y)**2) < UNIT_RADIUS * 2) {
            return false;
        }
    }
    
    // Проверка за разстояние от столицата
    if (gameData.capitals[player]) {
        let capital = gameData.capitals[player];
        if (Math.sqrt((x - capital[0])**2 + (y - capital[1])**2) < UNIT_RADIUS * 2) {
            return false;
        }
    }
    
    if (!isInOwnTerritory(player, x, y)) {
        return false;
    }
    
    let newUnit = new Unit(player, x, y);
    gameData.playerUnits[player].push(newUnit);
    // Ако е режим срещу бот и червения играч е готов, активирай бота
    if (gameData.gameMode === "vsbot" && 
        gameData.phase === "placement" && 
        gameData.currentPlayer === 1) {
        setTimeout(() => activateBot(), 100);
    }
    if (gameData.gameMode === "vsbot" && gameData.currentPlayer === 1) {
        setTimeout(activateBot, 100);
    }
    return true;
}
// Нова функция за активиране на бота
function activateBot() {
    if (!game.bot) {
        game.bot = new BotController(gameData);
    }
    
    if (gameData.phase === "placement") {
        // Ако ботът все още няма столица
        if (!gameData.capitals[1]) {
            game.bot.placeCapital();
            // Проверяваме дали е поставена успешно
            if (gameData.capitals[1]) {
                setTimeout(activateBot, 100);
            }
            return;
        }
        
        // Поставяме единици докато не стигнем максимума
        if (gameData.playerUnits[1].length < gameData.maxUnits) {
            game.bot.placeUnitEvenly(); // <-- ТУК!
            setTimeout(activateBot, 100);
        } else {
            // Преминаваме към фазата на стрелките
            gameData.currentPlayer = 0;
            gameData.phase = "player1_arrows";
            readyBtn.classList.remove('hidden');
        }
    } 
    else if (gameData.phase === "player2_arrows") {
        game.bot.handleArrowPhase();
        setTimeout(() => {
            gameData.phase = "battle";
            readyBtn.classList.add('hidden');
            calculateBattle();
        }, 500);
    }
}
function handleArrowSelection(pos, button) {
    let [x, y] = pos;
    
    // Проверяваме дали имаме вече избрана единица
    if (gameData.selectedUnit) {
        handleArrowDirection(pos, button);
        return true;
    }
    
    // Търсим единица под курсора
    for (let unit of gameData.playerUnits[gameData.currentPlayer]) {
        if (Math.sqrt((unit.x - x)**2 + (unit.y - y)**2) <= UNIT_RADIUS) {
            gameData.selectedUnit = unit;
            return true;
        }
    }
    return false;
}
function resetSelection() {
    gameData.selectionStart = null;
    gameData.selectionEnd = null;
    gameData.selectedUnits = [];
    gameData.selectedUnit = null;
}
// Обработка на посока на стрелка
function handleArrowDirection(pos, button) {
    if (!gameData.selectedUnit) return false;

    let [x, y] = pos;
    let dx = x - gameData.selectedUnit.x;
    let dy = y - gameData.selectedUnit.y;

    if (button === 2) {  // Десен бутон - синя стрелка (права)
        gameData.selectedUnit.blueArrow = [x, y];
        gameData.selectedUnit.direction = null;
    } else {  // Ляв бутон - черна стрелка
        gameData.selectedUnit.direction = Math.atan2(dy, dx);
        gameData.selectedUnit.blueArrow = null;
    }

    gameData.selectedUnit = null;
    return true;
}

// Проверка дали движението е към собствената територия
function isMovementTowardOwnTerritory(unit, angle) {
    if ((unit.player === 0 && Math.cos(angle) < 0) || (unit.player === 1 && Math.cos(angle) > 0)) {
        return true;
    }
    return false;
}

// Изчисляване на средна посока между две единици
function calculateAverageDirection(unit1, unit2) {
    if (unit1.direction === null && unit2.direction === null) {
        return null;
    }
    
    if (unit1.direction === null) return unit2.direction;
    if (unit2.direction === null) return unit1.direction;
    
    let x1 = Math.cos(unit1.direction);
    let y1 = Math.sin(unit1.direction);
    let x2 = Math.cos(unit2.direction);
    let y2 = Math.sin(unit2.direction);
    
    let avgX = (x1 + x2) / 2;
    let avgY = (y1 + y2) / 2;
    
    let length = Math.sqrt(avgX**2 + avgY**2);
    if (length > 0.001) {
        avgX /= length;
        avgY /= length;
    }
    
    return Math.atan2(avgY, avgX);
}

// Проверка и избутване на единици твърде близо до фронта
function checkUnitsDistanceFromFront() {
    let minDistance = UNIT_RADIUS * 1.5;
    for (let player of [0, 1]) {
        for (let unit of gameData.playerUnits[player]) {
            let closestPoint = null;
            let closestDist = Infinity;
            
            for (let point of gameData.frontLine) {
                let dist = Math.sqrt((unit.x - point[0])**2 + (unit.y - point[1])**2);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestPoint = point;
                }
            }
            
            if (closestDist < minDistance && closestPoint) {
                let pushDirX = unit.x - closestPoint[0];
                let pushDirY = unit.y - closestPoint[1];
                let pushLen = Math.sqrt(pushDirX**2 + pushDirY**2);
                
                if (pushLen > 0.001) {
                    pushDirX /= pushLen;
                    pushDirY /= pushLen;
                }
                
                let pushDistance = minDistance - closestDist;
                
                unit.beingPushed = true;
                unit.prevX = unit.x;
                unit.prevY = unit.y;
                unit.pushTargetX = unit.x + pushDirX * pushDistance;
                unit.pushTargetY = unit.y + pushDirY * pushDistance;
                unit.pushProgress = 0;
            }
        }
    }
}

// Проверка и избутване на единици при движение на фронтова линия
function checkAndPushUnits(pointIdx, newPoint, direction, pushingPlayer) {
    let [px, py] = gameData.frontLine[pointIdx];
    let [newPx, newPy] = newPoint;
    
    let opponent = 1 - pushingPlayer;
    for (let unit of gameData.playerUnits[opponent]) {
        let dist = Math.sqrt((unit.x - newPx)**2 + (unit.y - newPy)**2);
        if (dist < 1.5 * UNIT_RADIUS) {
            let pushDistance = 1.5 * UNIT_RADIUS - dist;
            let pushDirX = Math.cos(direction);
            let pushDirY = Math.sin(direction);
            
            unit.beingPushed = true;
            unit.prevX = unit.x;
            unit.prevY = unit.y;
            unit.pushTargetX = unit.x + pushDirX * pushDistance;
            unit.pushTargetY = unit.y + pushDirY * pushDistance;
            unit.pushProgress = 0;
        }
    }
}

// Откриване и премахване на примки във фронтовата линия
function detectAndRemoveLoops() {
    if (gameData.frontLine.length < 3) return;

    // Бърза проверка: ако две точки съвпадат (или са много близо), това е примка
    const EPS = 1e-2;
    let n = gameData.frontLine.length;
    for (let i = 0; i < n - 2; i++) {
        for (let j = i + 2; j < n; j++) {
            // Не сравнявай съседи и първа/последна
            if (j === i + 1) continue;
            let a = gameData.frontLine[i];
            let b = gameData.frontLine[j];
            let dx = a[0] - b[0];
            let dy = a[1] - b[1];
            if (dx * dx + dy * dy < EPS * EPS) {
                // Примка: премахни точките между i и j
                let pointsToRemove = gameData.frontLine.slice(i + 1, j);
                gameData.frontLine = [...gameData.frontLine.slice(0, i + 1), ...gameData.frontLine.slice(j)];
                removeUnitsInLoop([a, ...pointsToRemove, b]);
                return;
            }
        }
    }

    // Класическа проверка за пресичане на сегменти
    for (let i = 0; i < n - 3; i++) {
        for (let j = i + 2; j < n - 1; j++) {
            let a = gameData.frontLine[i];
            let b = gameData.frontLine[i + 1];
            let c = gameData.frontLine[j];
            let d = gameData.frontLine[j + 1];

            function ccw(A, B, C) {
                return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0]);
            }

            let intersect = ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);

            if (intersect) {
                let pointsToRemove = gameData.frontLine.slice(i + 1, j + 1);
                gameData.frontLine = [...gameData.frontLine.slice(0, i + 1), ...gameData.frontLine.slice(j + 1)];
                removeUnitsInLoop(pointsToRemove);
                return;
            }
        }
    }
}

function drawSelectedUnits() {
    if (gameData.selectedUnits.length === 0) return;
    
    // Рисуване на свързващи линии към центъра на селекцията
    if (gameData.selectionStart && gameData.selectionEnd) {
        const minX = Math.min(gameData.selectionStart[0], gameData.selectionEnd[0]);
        const maxX = Math.max(gameData.selectionStart[0], gameData.selectionEnd[0]);
        const minY = Math.min(gameData.selectionStart[1], gameData.selectionEnd[1]);
        const maxY = Math.max(gameData.selectionStart[1], gameData.selectionEnd[1]);
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        ctx.beginPath();
        for (const unit of gameData.selectedUnits) {
            ctx.moveTo(unit.x, unit.y);
            ctx.lineTo(centerX, centerY);
        }
        ctx.strokeStyle = "rgba(0, 255, 0, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}
// Премахване на единици вътре в примка
function removeUnitsInLoop(loopPoints) {
    if (loopPoints.length < 3) return;
    
    let polygon = [...loopPoints, loopPoints[0]];
    
    for (let player of [0, 1]) {
        let unitsToRemove = [];
        for (let unit of gameData.playerUnits[player]) {
            if (pointInPolygon([unit.x, unit.y], polygon)) {
                unitsToRemove.push(unit);
            }
        }
        
        gameData.playerUnits[player] = gameData.playerUnits[player].filter(u => !unitsToRemove.includes(u));
    }
}

// Проверка дали точка е вътре в полигон
function pointInPolygon(point, polygon) {
    let [x, y] = point;
    let n = polygon.length;
    let inside = false;
    let xinters;
    
    let [p1x, p1y] = polygon[0];
    for (let i = 1; i <= n; i++) {
        let [p2x, p2y] = polygon[i % n];
        if (y > Math.min(p1y, p2y)) {
            if (y <= Math.max(p1y, p2y)) {
                if (x <= Math.max(p1x, p2x)) {
                    if (p1y !== p2y) {
                        xinters = (y-p1y)*(p2x-p1x)/(p2y-p1y)+p1x;
                    }
                    if (p1x === p2x || x <= xinters) {
                        inside = !inside;
                    }
                }
            }
        }
        [p1x, p1y] = [p2x, p2y];
    }
    
    return inside;
}

// Изчисляване на битка
function calculateBattle() {
    if (gameData.frontLine.length === 0) {
        initializeFrontLine();
        return;
    }

    // Запазваме старите позиции на фронтовата линия
    window.oldFrontLine = gameData.frontLine.map(point => [...point]);

    gameData.battlePhase = true;
    gameData.turnCount++;

    // Инициализация на всички единици
    for (let player of [0, 1]) {
        for (let unit of gameData.playerUnits[player]) {
            // Защитни проверки за инициализация
            unit.assignedPoints = unit.assignedPoints || [];
            unit.totalPoints = unit.totalPoints || 0;
            unit.partialPoints = unit.partialPoints || 0;
            unit.forwardMoves = unit.forwardMoves || 0;
            
            // Нулиране на временни състояния
            unit.prevX = unit.x;
            unit.prevY = unit.y;
            unit.isMoving = false;
            unit.moveProgress = 0;
            unit.blockedByFront = false;
            unit.beingPushed = false;
            unit.pushProgress = 0;

            // Нулираме сините стрелки след първия ход
            if (gameData.turnCount > 1) {
                unit.blueArrow = null;
            }
        }
    }

    // Обработка на всяка точка от фронтовата линия
    gameData.frontLineWinners = [null, null];
    for (let pointIdx = 0; pointIdx < gameData.frontLine.length; pointIdx++) {
        let [px, py] = gameData.frontLine[pointIdx];
        let closest = [[], []];  // [player0, player1]

        // Намиране на най-близките единици за всеки играч
        for (let player of [0, 1]) {
            for (let unit of gameData.playerUnits[player]) {
                let dist = Math.sqrt((unit.x - px)**2 + (unit.y - py)**2);
                if (dist <= ARROW_LENGTH) {
                    closest[player].push({ unit, dist });
                }
            }
            
            // Сортиране по разстояние (най-близките първи)
            closest[player].sort((a, b) => a.dist - b.dist);
        }

        // Присвояване на точки и изчисляване на влиянието
        for (let player of [0, 1]) {
            let unitsInfo = closest[player];
            if (unitsInfo.length === 0) continue;

            if (unitsInfo.length >= 2) {
                let unit1 = unitsInfo[0].unit;
                let unit2 = unitsInfo[1].unit;
                let dist1 = unitsInfo[0].dist;
                let dist2 = unitsInfo[1].dist;

                // Ако две единици са на почти еднакво разстояние
                if (Math.abs(dist1 - dist2) < 0.1) {
                    unit1.assignedPoints.push([px, py]);
                    unit2.assignedPoints.push([px, py]);
                    unit1.partialPoints += 0.5;
                    unit2.partialPoints += 0.5;
                } else {
                    // Само най-близката единица получава точка
                    unitsInfo[0].unit.assignedPoints.push([px, py]);
                    unitsInfo[0].unit.totalPoints += 1;
                }
            } else {
                // Само една единица в обхвата
                unitsInfo[0].unit.assignedPoints.push([px, py]);
                unitsInfo[0].unit.totalPoints += 1;
            }
        }

        // Изчисляване на силата на двата играча за текущата точка
        let strengths = [0, 0];
        let winningUnits = [null, null];

        for (let player of [0, 1]) {
            let unitsInfo = closest[player];
            if (unitsInfo.length >= 2 && Math.abs(unitsInfo[0].dist - unitsInfo[1].dist) < 0.1) {
                // Две единици на почти еднакво разстояние
                strengths[player] = 1.0;
                winningUnits[player] = [unitsInfo[0].unit, unitsInfo[1].unit];
            } else if (unitsInfo.length >= 1) {
                // Една единица в обхвата
                let unit = unitsInfo[0].unit;
                strengths[player] = 1.0 / (unit.assignedPoints.length + 1);
                winningUnits[player] = unit;
            } else {
                // Няма единици - силата е 0
                strengths[player] = 0;
                winningUnits[player] = null;
            }
        }

        // --- move logic for each point ---
        if (pointIdx === 0) {
            if (strengths[0] > strengths[1]) {
                gameData.frontLineWinners[0] = 0;
                let moveX = Math.min(MAX_MOVE_DISTANCE, 5);
                let newX = gameData.frontLine[0][0] + moveX;
                // Не мести ако новата позиция е в територията на победителя или в морето
                if (!isInOwnTerritory(0, newX, 0) && !isInSeaZone(newX, 0)) {
                    gameData.frontLine[0][0] = newX;
                }
            } else if (strengths[1] > strengths[0]) {
                gameData.frontLineWinners[0] = 1;
                let moveX = Math.min(MAX_MOVE_DISTANCE, 5);
                let newX = gameData.frontLine[0][0] - moveX;
                if (!isInOwnTerritory(1, newX, 0) && !isInSeaZone(newX, 0)) {
                    gameData.frontLine[0][0] = newX;
                }
            }
            gameData.frontLine[0][1] = 0;
            continue;
        }
        if (pointIdx === gameData.frontLine.length - 1) {
            if (strengths[0] > strengths[1]) {
                gameData.frontLineWinners[1] = 0;
                let moveX = Math.min(MAX_MOVE_DISTANCE, 5);
                let newX = gameData.frontLine[pointIdx][0] + moveX;
                if (!isInOwnTerritory(0, newX, canvas.height) && !isInSeaZone(newX, canvas.height)) {
                    gameData.frontLine[pointIdx][0] = newX;
                }
            } else if (strengths[1] > strengths[0]) {
                gameData.frontLineWinners[1] = 1;
                let moveX = Math.min(MAX_MOVE_DISTANCE, 5);
                let newX = gameData.frontLine[pointIdx][0] - moveX;
                if (!isInOwnTerritory(1, newX, canvas.height) && !isInSeaZone(newX, canvas.height)) {
                    gameData.frontLine[pointIdx][0] = newX;
                }
            }
            gameData.frontLine[pointIdx][1] = canvas.height;
            continue;
        }
        if (strengths[0] > strengths[1] && winningUnits[0]) {
            if (Array.isArray(winningUnits[0])) {
                let [unit1, unit2] = winningUnits[0];
                let avgDirection = calculateAverageDirection(unit1, unit2);
                if (avgDirection !== null && !isMovementTowardOwnTerritory(unit1, avgDirection)) {
                    let newPx = px + Math.min(MAX_MOVE_DISTANCE, 5 * Math.cos(avgDirection));
                    let newPy = py + Math.min(MAX_MOVE_DISTANCE, 5 * Math.sin(avgDirection));
                    // Не мести ако новата позиция е в територията на победителя или в морето
                    if (!isInOwnTerritory(0, newPx, newPy) && !isInSeaZone(newPx, newPy)) {
                        checkAndPushUnits(pointIdx, [newPx, newPy], avgDirection, 0);
                        gameData.frontLine[pointIdx] = [newPx, newPy];
                        if ((newPx - px) * (unit1.player === 0 ? -1 : 1) > 0) {
                            unit1.forwardMoves += 0.5;
                            unit2.forwardMoves += 0.5;
                        }
                    }
                }
            } else {
                let unit = winningUnits[0];
                if (unit.direction !== null && !isMovementTowardOwnTerritory(unit, unit.direction)) {
                    let newPx = px + Math.min(MAX_MOVE_DISTANCE, 5 * Math.cos(unit.direction));
                    let newPy = py + Math.min(MAX_MOVE_DISTANCE, 5 * Math.sin(unit.direction));
                    if (!isInOwnTerritory(0, newPx, newPy) && !isInSeaZone(newPx, newPy)) {
                        checkAndPushUnits(pointIdx, [newPx, newPy], unit.direction, 0);
                        gameData.frontLine[pointIdx] = [newPx, newPy];
                        if ((newPx - px) * (unit.player === 0 ? -1 : 1) > 0) {
                            unit1.forwardMoves += 1;
                        }
                    }
                }
            }
        } else if (strengths[1] > strengths[0] && winningUnits[1]) {
            if (Array.isArray(winningUnits[1])) {
                let [unit1, unit2] = winningUnits[1];
                let avgDirection = calculateAverageDirection(unit1, unit2);
                if (avgDirection !== null && !isMovementTowardOwnTerritory(unit1, avgDirection)) {
                    let newPx = px + Math.min(MAX_MOVE_DISTANCE, 5 * Math.cos(avgDirection));
                    let newPy = py + Math.min(MAX_MOVE_DISTANCE, 5 * Math.sin(avgDirection));
                    if (!isInOwnTerritory(1, newPx, newPy) && !isInSeaZone(newPx, newPy)) {
                        checkAndPushUnits(pointIdx, [newPx, newPy], avgDirection, 1);
                        gameData.frontLine[pointIdx] = [newPx, newPy];
                        if ((newPx - px) * (unit1.player === 0 ? -1 : 1) > 0) {
                            unit2.forwardMoves += 0.5;
                        }
                    }
                }
            } else {
                let unit = winningUnits[1];
                if (unit.direction !== null && !isMovementTowardOwnTerritory(unit, unit.direction)) {
                    let newPx = px + Math.min(MAX_MOVE_DISTANCE, 5 * Math.cos(unit.direction));
                    let newPy = py + Math.min(MAX_MOVE_DISTANCE, 5 * Math.sin(unit.direction));
                    if (!isInOwnTerritory(1, newPx, newPy) && !isInSeaZone(newPx, newPy)) {
                        checkAndPushUnits(pointIdx, [newPx, newPy], unit.direction, 1);
                        gameData.frontLine[pointIdx] = [newPx, newPy];
                        if ((newPx - px) * (unit.player === 0 ? -1 : 1) > 0) {
                            unit.forwardMoves += 1;
                        }
                    }
                }
            }
        }
    }

    // Проверка за примки и корекция на фронтовата линия
    detectAndRemoveLoops();
    adjustFrontLine();
    checkFrontLineEdgeLoops();
    
    // Финална проверка: точката не може да е в територията на спечелилия я играч
    for (let i = 0; i < gameData.frontLine.length; i++) {
        let winner = null;
        if (i === 0 && gameData.frontLineWinners) winner = gameData.frontLineWinners[0];
        else if (i === gameData.frontLine.length - 1 && gameData.frontLineWinners) winner = gameData.frontLineWinners[1];
        else {
            // Определяме победителя за вътрешните точки (по силите)
            // Тук не винаги има winner, но няма да местим ако няма
            // Може да се разшири ако има нужда
        }
        if (winner !== null && isInOwnTerritory(winner, gameData.frontLine[i][0], gameData.frontLine[i][1])) {
            // Връщаме точката на старата позиция
            gameData.frontLine[i][0] = oldFrontLine[i][0];
            gameData.frontLine[i][1] = oldFrontLine[i][1];
        }
    }

    // Подготовка на движенията на единиците
    prepareUnitMovements();

    // Проверка за загуба
    checkForLoss();
}
// Корекция на фронтовата линия
function adjustFrontLine() {
    if (!gameData.originalYPositions || gameData.originalYPositions.length === 0) {
        initializeFrontLine();
        return;
    }

    const minSpacing = gameData.initialSpacing * 0.7;
    const maxSpacing = gameData.initialSpacing * 1.5;

    let newLine = [gameData.frontLine[0]];
    for (let i = 1; i < gameData.frontLine.length; i++) {
        const prev = newLine[newLine.length - 1];
        const curr = gameData.frontLine[i];
        const dist = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);

        if (dist > maxSpacing) {
            // Добави нова точка по средата
            const mid = [
                (prev[0] + curr[0]) / 2,
                (prev[1] + curr[1]) / 2
            ];
            newLine.push(mid);
            // След това ще се провери пак със същата curr, така че не увеличаваме i
            i--;
        } else if (dist < minSpacing && i < gameData.frontLine.length - 1) {
            // Пропусни тази точка (слива се с предишната)
            continue;
        } else {
            newLine.push(curr);
        }
    }
    gameData.frontLine = newLine;
    gameData.frontLine[0][1] = 0;
    gameData.frontLine[gameData.frontLine.length - 1][1] = canvas.height;
    // Не мести фронта в морето:
    clampFrontLineToLand();
    checkFrontLineEdgeLoops();
}

// Гарантира, че никоя точка от фронтовата линия не е в морето (освен ако е крайна)
function clampFrontLineToLand() {
    // Пропускаме първата и последната точка (крайните)
    for (let i = 1; i < gameData.frontLine.length - 1; i++) {
        let [x, y] = gameData.frontLine[i];
        if (isInSeaZone(x, y)) {
            // Върни точката на предишната сухоземна позиция (или просто не я мести)
            // Тук ще върнем към предишната позиция, ако има такава
            // Ако няма, просто не местим (оставяме я на ръба)
            // За целта пазим старата линия в calculateBattle
            if (typeof oldFrontLine !== "undefined" && oldFrontLine[i]) {
                gameData.frontLine[i][0] = oldFrontLine[i][0];
                gameData.frontLine[i][1] = oldFrontLine[i][1];
            }
        }
    }
}

// Подготовка на движенията на единиците
function prepareUnitMovements() {
    for (let player of [0, 1]) {
        for (let unit of gameData.playerUnits[player]) {
            if (unit.blueArrow) {
                let [endX, endY] = unit.blueArrow;
                // Ограничаване на дължината при движение
                let dx = endX - unit.x;
                let dy = endY - unit.y;
                let dist = Math.hypot(dx, dy);
                let maxLen = BLUE_ARROW_LENGTH;
                if (dist > maxLen) {
                    let scale = maxLen / dist;
                    endX = unit.x + dx * scale;
                    endY = unit.y + dy * scale;
                }
                unit.targetX = endX;
                unit.targetY = endY;
                unit.isMoving = true;
                unit.moveProgress = 0;
            } else if (unit.direction !== null) {
                let endX = unit.x + BLACK_ARROW_LENGTH * Math.cos(unit.direction);
                let endY = unit.y + BLACK_ARROW_LENGTH * Math.sin(unit.direction);
                unit.targetX = endX;
                unit.targetY = endY;
                unit.isMoving = true;
                unit.moveProgress = 0;
            }
        }
    }
}
// Проверка дали единица е в селекционния правоъгълник
function isUnitInSelection(unit) {
    if (!gameData.selectionStart || !gameData.selectionEnd) return false;
    
    const minX = Math.min(gameData.selectionStart[0], gameData.selectionEnd[0]);
    const maxX = Math.max(gameData.selectionStart[0], gameData.selectionEnd[0]);
    const minY = Math.min(gameData.selectionStart[1], gameData.selectionEnd[1]);
    const maxY = Math.max(gameData.selectionStart[1], gameData.selectionEnd[1]);
    
    return unit.x >= minX && unit.x <= maxX && unit.y >= minY && unit.y <= maxY;
}

// Рисуване на селекционния правоъгълник
function drawSelection() {
    if (gameData.selectionStart && gameData.selectionEnd) {
        const [x1, y1] = gameData.selectionStart;
        const [x2, y2] = gameData.selectionEnd;
        
        // Прозрачен зелен фон за селекцията
        ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        
        // Зелен контур на селекцията с по-дебели линии
        ctx.beginPath();
        ctx.rect(x1, y1, x2 - x1, y2 - y1);
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = 3; // Увеличаваме дебелината на линиите
        ctx.setLineDash([5, 3]); // Променяме пунктира
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
    }
}

// Обработка на групово задаване на стрелки
function handleGroupArrowDirection(pos, button) {
    if (gameData.selectedUnits.length === 0) return false;
    
    // Изчисляваме центъра на селекцията
    let centerX = 0, centerY = 0;
    for (const unit of gameData.selectedUnits) {
        centerX += unit.x;
        centerY += unit.y;
    }
    centerX /= gameData.selectedUnits.length;
    centerY /= gameData.selectedUnits.length;
    
    const [x, y] = pos;
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.sqrt(dx**2 + dy**2);
    
    for (const unit of gameData.selectedUnits) {
        if (button === 2) {  // Десен бутон - синя стрелка (2x дължина)
            const maxDist = BLUE_ARROW_LENGTH;
            const scaledDx = dx * maxDist / dist;
            const scaledDy = dy * maxDist / dist;
            unit.blueArrow = [unit.x + scaledDx, unit.y + scaledDy];
            unit.direction = null;
        } else {  // Ляв бутон - черна стрелка
            unit.direction = Math.atan2(dy, dx);
            unit.blueArrow = null;
        }
    }
    
    resetSelection();
    return true;
}
// Обновяване на позициите на единиците
function updateUnits() {
    let allStopped = true;
    let anyPushing = false;

    for (let player of [0, 1]) {
        for (let unit of gameData.playerUnits[player]) {
            if (unit.beingPushed) {
                unit.updatePosition();
                anyPushing = true;
                allStopped = false;
            }
        }
    }

    if (!anyPushing) {
        for (let player of [0, 1]) {
            for (let unit of gameData.playerUnits[player]) {
                if (!unit.beingPushed) {
                    unit.updatePosition();
                    if (unit.isMoving) {
                        allStopped = false;
                    }
                }
            }
        }

        checkUnitsDistanceFromFront();
    }

    if (allStopped && gameData.battlePhase) {
        if (gameData.turnCount >= gameData.maxTurns) {
            gameData.battlePhase = false;
            gameData.phase = "player1_arrows";
            gameData.currentPlayer = 0;
            gameData.turnCount = 0;

            // Reset unit directions
            for (let player of [0, 1]) {
                for (let unit of gameData.playerUnits[player]) {
                    unit.direction = null;
                    unit.blueArrow = null;
                }
            }

            readyBtn.classList.remove('hidden');
        } else {
            calculateBattle();
        }
    }

    // Проверка за загуба
    checkForLoss();
}

// Рисуване на играта
function drawGame() {
    // Clear the visible canvas before applying transforms
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    applyViewTransform(ctx);

    // WW2 карта: фон изображение
    if (document.getElementById('map-select') && document.getElementById('map-select').value === 'WW2') {
        if (!drawGame.bgImg) {
            drawGame.bgImg = new Image();
            drawGame.bgImg.src = 'map1.png';
        }
        ctx.globalAlpha = 1.0;
        // Draw background image in world coordinates
        ctx.drawImage(drawGame.bgImg, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    } else {
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // --- Рисуване на морето (WW2 карта) ---
    if (
        document.getElementById('map-select') &&
        document.getElementById('map-select').value === 'WW2' &&
        typeof WW2_SEA_ZONES !== "undefined" &&
        Array.isArray(WW2_SEA_ZONES)
    ) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#4A90E2";
        const scaleX = canvas.width / 700;
        const scaleY = canvas.height / 600;
        for (const zone of WW2_SEA_ZONES) {
            if (zone.length > 1) {
                ctx.beginPath();
                ctx.moveTo(zone[0][0] * scaleX, zone[0][1] * scaleY);
                for (let i = 1; i < zone.length; i++) {
                    ctx.lineTo(zone[i][0] * scaleX, zone[i][1] * scaleY);
                }
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // Рисуване на териториите
    if (gameData.frontLine.length > 1) {
        // Чертаем червената територия (лява)
        let redTerritory = [[0, 0], ...gameData.frontLine, [0, canvas.height]];
        ctx.beginPath();
        ctx.moveTo(redTerritory[0][0], redTerritory[0][1]);
        for (let i = 1; i < redTerritory.length; i++) {
            ctx.lineTo(redTerritory[i][0], redTerritory[i][1]);
        }
        ctx.globalAlpha = (document.getElementById('map-select') && document.getElementById('map-select').value === 'WW2') ? 0.25 : 1.0;
        ctx.fillStyle = "#FFC8C8";
        ctx.fill();
        ctx.globalAlpha = 1.0;
        // Чертаем синята територия (дясна)
        let blueTerritory = [[canvas.width, 0], ...gameData.frontLine, [canvas.width, canvas.height]];
        ctx.beginPath();
        ctx.moveTo(blueTerritory[0][0], blueTerritory[0][1]);
        for (let i = 1; i < blueTerritory.length; i++) {
            ctx.lineTo(blueTerritory[i][0], blueTerritory[i][1]);
        }
        ctx.globalAlpha = (document.getElementById('map-select') && document.getElementById('map-select').value === 'WW2') ? 0.25 : 1.0;
        ctx.fillStyle = "#9696FF";
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Чертаем фронтовата линия
        ctx.beginPath();
        ctx.moveTo(gameData.frontLine[0][0], gameData.frontLine[0][1]);
        for (let i = 1; i < gameData.frontLine.length; i++) {
            ctx.lineTo(gameData.frontLine[i][0], gameData.frontLine[i][1]);
        }
        ctx.strokeStyle = FRONT_LINE_COLOR;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
        
        // Точки на фронтовата линия
        for (let point of gameData.frontLine) {
            ctx.beginPath();
            ctx.arc(point[0], point[1], 3, 0, Math.PI * 2);
            ctx.fillStyle = FRONT_LINE_COLOR;
            ctx.fill();
        }

        if (gameData.frontLineWinners) {
            ctx.beginPath();
            ctx.arc(gameData.frontLine[0][0], 0, 7, 0, Math.PI * 2);
            ctx.fillStyle = gameData.frontLineWinners[0] === 0 ? "#FF0000" : "#0000FF";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(gameData.frontLine[gameData.frontLine.length - 1][0], canvas.height, 7, 0, Math.PI * 2);
            ctx.fillStyle = gameData.frontLineWinners[1] === 0 ? "#FF0000" : "#0000FF";
            ctx.fill();
        }
    }

    // Рисуване на селекционния правоъгълник
    if (gameData.phase.endsWith("_arrows") && gameData.selectionStart) {
        drawSelection();
    }

    // Рисуване на единиците
    for (let player of [0, 1]) {
        // Пропускаме червените единици по време на фазата на поставяне на синия играч
        if (gameData.phase === "placement" && player === 0 && gameData.currentPlayer === 1) {
            continue;
        }

        for (let unit of gameData.playerUnits[player]) {
            let selected = (gameData.phase.endsWith("_arrows") && 
                          gameData.currentPlayer === player && 
                          unit === gameData.selectedUnit);
            
            let showUnitArrows = true;
            if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase) {
                showUnitArrows = (player === gameData.currentPlayer);
            } else if (gameData.battlePhase) {
                showUnitArrows = gameData.showArrows;
            }
            
            unit.draw(selected, showUnitArrows);
        }
    }

    // Рисуване на столиците
    for (let player = 0; player < 2; player++) {
        // Пропускаме червената столица по време на фазата на поставяне на синия играч
        if (gameData.phase === "placement" && player === 0 && gameData.currentPlayer === 1) {
            continue;
        }

        let capital = gameData.capitals[player];
        if (capital) {
            ctx.beginPath();
            ctx.arc(capital[0], capital[1], CAPITAL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = CAPITAL_COLOR;
            ctx.fill();
            ctx.strokeStyle = PLAYER_COLORS[player];
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }

    ctx.restore();

    // Актуализиране на информацията за играта
    let infoText = "";
    if (gameData.phase === "placement") {
        // WW2 карта: не показвай съобщение за избор на столица
        if (!gameData.ww2CapitalsLocked && !gameData.capitals[gameData.currentPlayer]) {
            infoText = `Играч ${gameData.currentPlayer + 1}: Поставете столица (кликнете върху вашата територия)`;
        } else {
            infoText = `Играч ${gameData.currentPlayer + 1}: Поставете единици (${gameData.playerUnits[gameData.currentPlayer].length}/${gameData.maxUnits})`;
        }
    } else if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase) {
        infoText = `Играч ${gameData.currentPlayer + 1}: Ляв бутон - стрелка, Десен бутон - движение (2x дължина)`;
    } else if (gameData.battlePhase) {
        infoText = `Битка - ход ${gameData.turnCount} от ${gameData.maxTurns}`;
    } else if (gameData.phase === "end") {
        infoText = "Край на играта!";
    }
    
    // Добавяне на информация за броя единици
    let unitsInfo = ` | Червени: ${gameData.playerUnits[0].length}, Сини: ${gameData.playerUnits[1].length} единици`;
    infoText += unitsInfo;
    
    gameInfo.textContent = infoText;

    // Актуализиране на видимостта на бутона "Готово"
    if (gameData.phase === "placement") {
        if (gameData.playerUnits[gameData.currentPlayer].length > 0) {
            readyBtn.classList.remove('hidden');
        } else {
            readyBtn.classList.add('hidden');
        }
    }
}

// --- ZOOM & PAN STATE ---
let view = {
    scale: 1,
    minScale: 1, // Забранява намаляване (минимум 1)
    maxScale: 3,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    dragStart: null,
    dragOrigin: null
};

// --- ZOOM & PAN HELPERS ---
function applyViewTransform(ctx) {
    ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
}

function screenToWorld([x, y]) {
    return [
        (x - view.offsetX) / view.scale,
        (y - view.offsetY) / view.scale
    ];
}

function worldToScreen([x, y]) {
    return [
        x * view.scale + view.offsetX,
        y * view.scale + view.offsetY
    ];
}

// --- PATCH DRAWING TO SUPPORT ZOOM/PAN ---
function drawGame() {
    // Clear the visible canvas before applying transforms
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    applyViewTransform(ctx);

    // WW2 карта: фон изображение
    if (document.getElementById('map-select') && document.getElementById('map-select').value === 'WW2') {
        if (!drawGame.bgImg) {
            drawGame.bgImg = new Image();
            drawGame.bgImg.src = 'map1.png';
        }
        ctx.globalAlpha = 1.0;
        // Draw background image in world coordinates
        ctx.drawImage(drawGame.bgImg, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    } else {
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // --- Рисуване на морето (WW2 карта) ---
    if (
        document.getElementById('map-select') &&
        document.getElementById('map-select').value === 'WW2' &&
        typeof WW2_SEA_ZONES !== "undefined" &&
        Array.isArray(WW2_SEA_ZONES)
    ) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#4A90E2";
        const scaleX = canvas.width / 700;
        const scaleY = canvas.height / 600;
        for (const zone of WW2_SEA_ZONES) {
            if (zone.length > 1) {
                ctx.beginPath();
                ctx.moveTo(zone[0][0] * scaleX, zone[0][1] * scaleY);
                for (let i = 1; i < zone.length; i++) {
                    ctx.lineTo(zone[i][0] * scaleX, zone[i][1] * scaleY);
                }
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // Рисуване на териториите
    if (gameData.frontLine.length > 1) {
        // Чертаем червената територия (лява)
        let redTerritory = [[0, 0], ...gameData.frontLine, [0, canvas.height]];
        ctx.beginPath();
        ctx.moveTo(redTerritory[0][0], redTerritory[0][1]);
        for (let i = 1; i < redTerritory.length; i++) {
            ctx.lineTo(redTerritory[i][0], redTerritory[i][1]);
        }
        ctx.globalAlpha = (document.getElementById('map-select') && document.getElementById('map-select').value === 'WW2') ? 0.25 : 1.0;
        ctx.fillStyle = "#FFC8C8";
        ctx.fill();
        ctx.globalAlpha = 1.0;
        // Чертаем синята територия (дясна)
        let blueTerritory = [[canvas.width, 0], ...gameData.frontLine, [canvas.width, canvas.height]];
        ctx.beginPath();
        ctx.moveTo(blueTerritory[0][0], blueTerritory[0][1]);
        for (let i = 1; i < blueTerritory.length; i++) {
            ctx.lineTo(blueTerritory[i][0], blueTerritory[i][1]);
        }
        ctx.globalAlpha = (document.getElementById('map-select') && document.getElementById('map-select').value === 'WW2') ? 0.25 : 1.0;
        ctx.fillStyle = "#9696FF";
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Чертаем фронтовата линия
        ctx.beginPath();
        ctx.moveTo(gameData.frontLine[0][0], gameData.frontLine[0][1]);
        for (let i = 1; i < gameData.frontLine.length; i++) {
            ctx.lineTo(gameData.frontLine[i][0], gameData.frontLine[i][1]);
        }
        ctx.strokeStyle = FRONT_LINE_COLOR;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
        
        // Точки на фронтовата линия
        for (let point of gameData.frontLine) {
            ctx.beginPath();
            ctx.arc(point[0], point[1], 3, 0, Math.PI * 2);
            ctx.fillStyle = FRONT_LINE_COLOR;
            ctx.fill();
        }

        if (gameData.frontLineWinners) {
            ctx.beginPath();
            ctx.arc(gameData.frontLine[0][0], 0, 7, 0, Math.PI * 2);
            ctx.fillStyle = gameData.frontLineWinners[0] === 0 ? "#FF0000" : "#0000FF";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(gameData.frontLine[gameData.frontLine.length - 1][0], canvas.height, 7, 0, Math.PI * 2);
            ctx.fillStyle = gameData.frontLineWinners[1] === 0 ? "#FF0000" : "#0000FF";
            ctx.fill();
        }
    }

    // Рисуване на селекционния правоъгълник
    if (gameData.phase.endsWith("_arrows") && gameData.selectionStart) {
        drawSelection();
    }

    // Рисуване на единиците
    for (let player of [0, 1]) {
        // Пропускаме червените единици по време на фазата на поставяне на синия играч
        if (gameData.phase === "placement" && player === 0 && gameData.currentPlayer === 1) {
            continue;
        }

        for (let unit of gameData.playerUnits[player]) {
            let selected = (gameData.phase.endsWith("_arrows") && 
                          gameData.currentPlayer === player && 
                          unit === gameData.selectedUnit);
            
            let showUnitArrows = true;
            if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase) {
                showUnitArrows = (player === gameData.currentPlayer);
            } else if (gameData.battlePhase) {
                showUnitArrows = gameData.showArrows;
            }
            
            unit.draw(selected, showUnitArrows);
        }
    }

    // Рисуване на столиците
    for (let player = 0; player < 2; player++) {
        // Пропускаме червената столица по време на фазата на поставяне на синия играч
        if (gameData.phase === "placement" && player === 0 && gameData.currentPlayer === 1) {
            continue;
        }

        let capital = gameData.capitals[player];
        if (capital) {
            ctx.beginPath();
            ctx.arc(capital[0], capital[1], CAPITAL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = CAPITAL_COLOR;
            ctx.fill();
            ctx.strokeStyle = PLAYER_COLORS[player];
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }

    // Актуализиране на информацията за играта
    let infoText = "";
    if (gameData.phase === "placement") {
        // WW2 карта: не показвай съобщение за избор на столица
        if (!gameData.ww2CapitalsLocked && !gameData.capitals[gameData.currentPlayer]) {
            infoText = `Играч ${gameData.currentPlayer + 1}: Поставете столица (кликнете върху вашата територия)`;
        } else {
            infoText = `Играч ${gameData.currentPlayer + 1}: Поставете единици (${gameData.playerUnits[gameData.currentPlayer].length}/${gameData.maxUnits})`;
        }
    } else if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase) {
        infoText = `Играч ${gameData.currentPlayer + 1}: Ляв бутон - стрелка, Десен бутон - движение (2x дължина)`;
    } else if (gameData.battlePhase) {
        infoText = `Битка - ход ${gameData.turnCount} от ${gameData.maxTurns}`;
    } else if (gameData.phase === "end") {
        infoText = "Край на играта!";
    }
    
    // Добавяне на информация за броя единици
    let unitsInfo = ` | Червени: ${gameData.playerUnits[0].length}, Сини: ${gameData.playerUnits[1].length} единици`;
    infoText += unitsInfo;
    
    gameInfo.textContent = infoText;

    // Актуализиране на видимостта на бутона "Готово"
    if (gameData.phase === "placement") {
        if (gameData.playerUnits[gameData.currentPlayer].length > 0) {
            readyBtn.classList.remove('hidden');
        } else {
            readyBtn.classList.add('hidden');
        }
    }
}

// --- PATCH INPUT EVENTS TO SUPPORT ZOOM/PAN ---
canvas.addEventListener('mousedown', function(e) {
    // Позволи пан само ако няма селектирани единици
    // и не се настройва синя стрелка за единица
    const isSettingBlueArrow = (
        gameData.phase.endsWith("_arrows") &&
        !gameData.battlePhase &&
        gameData.selectedUnit !== null
    );
    if (e.button === 2 && gameData.selectedUnits.length === 0 && !isSettingBlueArrow) {
        view.dragging = true;
        view.dragStart = [e.clientX, e.clientY];
        view.dragOrigin = [view.offsetX, view.offsetY];
        return;
    }
    let rect = canvas.getBoundingClientRect();
    let pos = screenToWorld([e.clientX - rect.left, e.clientY - rect.top]);
    let button = e.button;
    
    if (gameData.phase === "placement") {
        // Само ако НЕ е WW2 карта, позволи местене/премахване на столица
        if (!gameData.ww2CapitalsLocked) {
            let capital = gameData.capitals[gameData.currentPlayer];
            if (capital && Math.sqrt((pos[0] - capital[0])**2 + (pos[1] - capital[1])**2) <= CAPITAL_RADIUS) {
                gameData.capitals[gameData.currentPlayer] = null;
                return;
            }
        }
        // Обработка на поставяне
        handlePlacement(pos);
    } else if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase) {
        if (gameData.selectedUnits.length > 0) {
            // Ако имаме маркирани единици, обработваме второто кликване
            handleGroupArrowDirection(pos, button);
        } else {
            // Първо проверяваме дали не сме кликнали върху единица
            if (!handleArrowSelection(pos, button)) {
                // Ако не сме кликнали върху единица, започваме селекция
                gameData.selectionStart = pos;
                gameData.selectionEnd = pos;
            }
        }
    }
});

canvas.addEventListener('mousemove', function(e) {
    // Позволи пан само ако няма селектирани единици
    // и не се настройва синя стрелка за единица
    const isSettingBlueArrow = (
        gameData.phase.endsWith("_arrows") &&
        !gameData.battlePhase &&
        gameData.selectedUnit !== null
    );
    if (view.dragging && gameData.selectedUnits.length === 0 && !isSettingBlueArrow) {
        let dx = e.clientX - view.dragStart[0];
        let dy = e.clientY - view.dragStart[1];
        view.offsetX = view.dragOrigin[0] + dx;
        view.offsetY = view.dragOrigin[1] + dy;
        return;
    }
    let rect = canvas.getBoundingClientRect();
    let pos = screenToWorld([e.clientX - rect.left, e.clientY - rect.top]);
    if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase && 
        gameData.selectionStart && e.buttons === 1) {
        gameData.selectionEnd = pos;
        
        // Маркираме единиците в селекцията
        gameData.selectedUnits = [];
        for (let unit of gameData.playerUnits[gameData.currentPlayer]) {
            if (isUnitInSelection(unit)) {
                gameData.selectedUnits.push(unit);
            }
        }
    }
    if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase && gameData.selectedUnit && e.buttons === 2) {
        gameData.selectedUnit.blueArrow = pos;
    }
});

canvas.addEventListener('mouseup', function(e) {
    // Позволи спиране на пан само ако няма селектирани единици
    // и не се настройва синя стрелка за единица
    const isSettingBlueArrow = (
        gameData.phase.endsWith("_arrows") &&
        !gameData.battlePhase &&
        gameData.selectedUnit !== null
    );
    if (view.dragging && e.button === 2 && gameData.selectedUnits.length === 0 && !isSettingBlueArrow) {
        view.dragging = false;
        return;
    }
    let rect = canvas.getBoundingClientRect();
    let pos = screenToWorld([e.clientX - rect.left, e.clientY - rect.top]);
    if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase && 
        gameData.selectionStart && gameData.selectionEnd) {
        // Ако правоъгълникът е твърде малък, го игнорираме
        const minX = Math.min(gameData.selectionStart[0], gameData.selectionEnd[0]);
        const maxX = Math.max(gameData.selectionStart[0], gameData.selectionEnd[0]);
        const minY = Math.min(gameData.selectionStart[1], gameData.selectionEnd[1]);
        const maxY = Math.max(gameData.selectionStart[1], gameData.selectionEnd[1]);
        
        if (maxX - minX < 10 && maxY - minY < 10) {
            gameData.selectionStart = null;
            gameData.selectionEnd = null;
            gameData.selectedUnits = [];
        }
    }
});
canvas.addEventListener('wheel', function(e) {
    // Zoom in/out
    e.preventDefault();
    let rect = canvas.getBoundingClientRect();
    let mouse = [e.clientX - rect.left, e.clientY - rect.top];
    let world = screenToWorld(mouse);

    let scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
    let newScale = Math.max(view.minScale, Math.min(view.maxScale, view.scale * scaleFactor));
    if (newScale === view.scale) return;

    // Adjust offset so zoom is centered on mouse
    view.offsetX = mouse[0] - (world[0] * newScale);
    view.offsetY = mouse[1] - (world[1] * newScale);
    view.scale = newScale;
}, { passive: false });

canvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

// Бутон за готовност
readyBtn.addEventListener('click', function() {
    if (gameData.phase === "placement") {
        if (!gameData.capitals[gameData.currentPlayer]) return;
        if (gameData.gameMode === "vsbot" && gameData.currentPlayer === 1) {
            readyBtn.classList.add('hidden');
            setTimeout(activateBot, 100);
            return; // Не сменяй currentPlayer, ботът ще го направи
        }
        if (gameData.playerUnits[gameData.currentPlayer].length > 0) {
            gameData.currentPlayer = 1 - gameData.currentPlayer;
            if (gameData.currentPlayer === 1 && gameData.gameMode === "vsbot") {
                readyBtn.classList.add('hidden');
                setTimeout(activateBot, 100);
            } else if (gameData.currentPlayer === 0) {
                gameData.phase = "player1_arrows";
            }
        }
    } else if (gameData.phase.endsWith("_arrows")) {
        if (gameData.phase === "player1_arrows") {
            gameData.phase = "player2_arrows";
            gameData.currentPlayer = 1;
            if (gameData.gameMode === "vsbot") {
                setTimeout(activateBot, 100);
            }
        } else if (gameData.phase === "player2_arrows") {
            gameData.phase = "battle";
            readyBtn.classList.add('hidden');
            calculateBattle();
        }
    }
    gameData.selectedUnit = null;
});
// Настройки на играта
document.getElementById('confirm-btn').addEventListener('click', function() {
    let turns = parseInt(document.getElementById('turn-input').value);
    let units = parseInt(document.getElementById('units-input').value);
    // Запазваме избрания режим
    const modeSelect = document.getElementById('mode-select');
    game.gameMode = modeSelect.value;
    gameData.gameMode = modeSelect.value;
    if (turns >= 1 && turns <= MAX_TURNS && units >= 1 && units <= MAX_UNITS) {
        // Запазваме настройките в gameData
        gameData.maxTurns = turns;
        gameData.maxUnits = units;
        ARROW_LENGTH = Math.max(40, Math.floor(canvas.width / gameData.maxTurns / 2));
        
        // Актуализираме текста за брой единици
        if (gameData.phase === "placement") {
            gameInfo.textContent = `Играч ${gameData.currentPlayer + 1}: Поставете единици (${gameData.playerUnits[gameData.currentPlayer].length}/${gameData.maxUnits})`;
        }
        
        settingsModal.classList.add('hidden');
        gameData.phase = "placement";
        initializeFrontLine();
        gameLoop();
    }
});

// Single game loop function
function gameLoop() {
    if (gameData.battlePhase) {
        updateUnits();
    }
    drawGame();
    requestAnimationFrame(gameLoop);
}

// Single initialization
initializeFrontLine();
settingsModal.classList.remove('hidden');
readyBtn.classList.add('hidden');

function handleCapitalPlacement(pos) {
    // WW2 карта: не позволявай избор на столица
    if (gameData.ww2CapitalsLocked) {
        return false;
    }
    let [x, y] = pos;
    let player = gameData.currentPlayer;

    // Проверка за разстояние от фронтова линия
    let minDistance = UNIT_RADIUS * 2;
    for (let point of gameData.frontLine) {
        if (Math.sqrt((x - point[0])**2 + (y - point[1])**2) < minDistance) {
            return false;
        }
    }

    // Единствената проверка за територия:
    if (!isInOwnTerritory(player, x, y)) {
        return false;
    }

    gameData.capitals[player] = [x, y];
    return true;
}

function checkForLoss() {
    for (let player = 0; player < 2; player++) {
        const opponent = 1 - player;

        // Проверка дали играчът е загубил всичките си единици
        if (gameData.playerUnits[player].length === 0) {
            endGame(opponent, `Играч ${опонент + 1} печели! Играч ${player + 1} загуби всичките си единици.`);
            return;
        }

        // Проверка дали столицата на играча е в територията на противника
        const capital = gameData.capitals[player];
        if (capital) {
            const isInOpponentTerritory = isCapitalInOpponentTerritory(player, capital);
            if (isInOpponentTerritory) {
                endGame(opponent, `Играч ${опонент + 1} печели! Столицата на играч ${player + 1} е превзета.`);
                return;
            }
        }
    }
}

function endGame(winningPlayer, message) {
    gameData.phase = "end";



    gameData.battlePhase = false;
    gameInfo.textContent = message;

    // Скриваме бутона "Готово"

    readyBtn.classList.add('hidden');
}

function isCapitalInOpponentTerritory(player, capital) {
    const [x, y] = capital;

    // Определяме територията на противника
    let opponentTerritory;
    if (player === 0) {
        // Червеният играч (лява територия), проверяваме дали е в синята територия
        opponentTerritory = [[canvas.width, 0], ...gameData.frontLine, [canvas.width, canvas.height]];
    } else {
        // Синият играч (дясна територия), проверяваме дали е в червената територия
        opponentTerritory = [[0, 0], ...gameData.frontLine, [0, canvas.height]];
    }

    // Проверяваме дали столицата е в територията на противника
    return pointInPolygon([x, y], opponentTerritory);
}

function interpolateFrontLine(points, count) {
    // 1. Изчисли дължините на сегментите
    let lengths = [];
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        let dx = points[i][0] - points[i-1][0];
        let dy = points[i][1] - points[i-1][1];
        let len = Math.sqrt(dx*dx + dy*dy);
        lengths.push(len);
        totalLength += len;
    }

    // 2. Разпредели равномерно по дължината
    let step = totalLength / (count - 1);
    let result = [points[0].slice()];
    let currIdx =  1;
    let currLen = 0;
    let prev = points[0].slice();

    for (let i = 1; i < count - 1; i++) {
        let targetLen = i * step;
        while (currLen + lengths[currIdx-1] < targetLen && currIdx < points.length - 1) {
            currLen += lengths[currIdx-1];
            prev = points[currIdx].slice();
            currIdx++;
        }
        let remain = targetLen - currLen;
        let segLen = lengths[currIdx-1];
        let t = remain / segLen;
        let x = prev[0] + (points[currIdx][0] - prev[0]) * t;
        let y = prev[1] + (points[currIdx][1] - prev[1]) * t;
        result.push([x, y]);
    }
    result.push(points[points.length-1].slice());
    return result;
}

function interpolateFrontLineBySpacing(points, spacing) {
    // 1. Изчисли дължините на сегментите
    let lengths = [];
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        let dx = points[i][0] - points[i-1][0];
        let dy = points[i][1] - points[i-1][1];
        let len = Math.sqrt(dx*dx + dy*dy);
        lengths.push(len);
        totalLength += len;
    }

    let result = [points[0].slice()];
    let currIdx = 1;
    let currLen = 0;
    let prev = points[0].slice();

    while (currIdx < points.length) {
        let segLen = lengths[currIdx-1];
        let remain = spacing - currLen;
        if (segLen >= remain) {
            // Слагаме нова точка на разстояние spacing от предишната
            let t = remain / segLen;
            let x = prev[0] + (points[currIdx][0] - prev[0]) * t;
            let y = prev[1] + (points[currIdx][1] - prev[1]) * t;
            result.push([x, y]);
            // Новият сегмент започва от тази точка
            prev = [x, y];
            lengths[currIdx-1] = segLen - remain;
            points[currIdx-1] = prev;
            currLen = 0;
        } else {
            // Отиваме към следващия сегмент
            currLen += segLen;
            prev = points[currIdx].slice();
            currIdx++;
        }
    }
    // Добави последната точка, ако не съвпада с последната от масива
    if (result.length === 0 || (result[result.length-1][0] !== points[points.length-1][0] || result[result.length-1][1] !== points[points.length-1][1])) {
        result.push(points[points.length-1].slice());
    }
    return result;
}

const mapSelect = document.getElementById('map-select');
if (mapSelect) {
    mapSelect.addEventListener('change', function() {
        initializeFrontLine();
        // Отключи местенето на столица ако не е WW2 карта
        if (mapSelect.value !== "WW2") {
            gameData.ww2CapitalsLocked = false;
        }
        drawGame();
    });
}

function fillFrontLineEnds(frontLine, spacing, canvas) {
    // Запълни отгоре
    let first = frontLine[0];
    if (first[1] > 0) {
        let steps = Math.ceil(first[1] / spacing);
        let dx = (frontLine[1][0] - first[0]) / (frontLine[1][1] - first[1]);
        for (let i = 1; i <= steps; i++) {
            let y = first[1] - i * spacing;
            if (y < 0) y = 0;
            let x = first[0] + dx * (y - first[1]);
            frontLine.unshift([x, y]);
            if (y === 0) break;
        }
    }
    frontLine[0][1] = 0;

    // Запълни отдолу
    let last = frontLine[frontLine.length - 1];
    if (last[1] < canvas.height) {
        let steps = Math.ceil((canvas.height - last[1]) / spacing);
        let dx = (last[0] - frontLine[frontLine.length - 2][0]) / (last[1] - frontLine[frontLine.length - 2][1]);
        for (let i = 1; i <= steps; i++) {
            let y = last[1] + i * spacing;
            if (y > canvas.height) y = canvas.height;
            let x = last[0] + dx * (y - last[1]);
            frontLine.push([x, y]);
            if (y === canvas.height) break;
        }
    }
    frontLine[frontLine.length - 1][1] = canvas.height;
    // НЕ пипай x-координатите!
}

// Проверка дали е в собствената територия
function isInOwnTerritory(player, x, y) {
    // Винаги определяй територията по полигон
    if (player === 0) {
        // Червен: лявата територия
        let redPoly = [[0, 0], ...gameData.frontLine, [0, canvas.height]];
        return pointInPolygon([x, y], redPoly);
    } else {
        // Син: дясната територия
        let bluePoly = [[canvas.width, 0], ...gameData.frontLine, [canvas.width, canvas.height]];
        return pointInPolygon([x, y], bluePoly);
    }
}

function nextPlacementTurn() {
    gameData.currentPlayer = (gameData.currentPlayer + 1) % 2;
    if (gameData.gameMode === "vsbot" && gameData.currentPlayer === 1) {
        botController.makeDecision();
        // След като ботът разположи, премини към следващия ход:
        gameData.currentPlayer = 0;
    }
}

// Функция за намиране на най-близката точка по ръба на морската зона
function findClosestSeaEdgePoint(x, y) {
    if (
        typeof WW2_SEA_ZONES === "undefined" ||
        !Array.isArray(WW2_SEA_ZONES) ||
        WW2_SEA_ZONES.length === 0
    ) return null;

    const scaleX = canvas.width / 700;
    const scaleY = canvas.height / 600;
    let minDist = Infinity;
    let result = null;

    for (const zone of WW2_SEA_ZONES) {
        for (let i = 0; i < zone.length; i++) {
            const zx = zone[i][0] * scaleX;
            const zy = zone[i][1] * scaleY;
            const dist = Math.hypot(x - zx, y - zy);
            if (dist < minDist) {
                minDist = dist;
                result = { zone, idx: i, point: [zx, zy] };
            }
        }
    }
    return result;
}

// Нови функции за проверка на ръбовете
function checkFrontLineEdgeLoops() {
    // Проверка за горен ръб (y <= 0)
    for (let i = 1; i < gameData.frontLine.length - 1; i++) {
        let [x, y] = gameData.frontLine[i];
        if (y <= 0) {
            let rest = gameData.frontLine.slice(i + 1);
            gameData.frontLine = [[x, 0], ...rest];
            return;
        }
    }
    // Проверка за долен ръб (y >= canvas.height)
    for (let i = gameData.frontLine.length - 2; i > 0; i--) {
        let [x, y] = gameData.frontLine[i];
        if (y >= canvas.height) {
            let rest = gameData.frontLine.slice(0, i);
            gameData.frontLine = [...rest, [x, canvas.height]];
            return;
        }
    }
    // Проверка за ляв ръб (x <= 0)
    for (let i = 1; i < gameData.frontLine.length - 1; i++) {
        let [x, y] = gameData.frontLine[i];
        if (x <= 0) {
            let loopPoints = [...gameData.frontLine.slice(0, i + 1), [0, gameData.frontLine[i][1]]];
            if (loopPoints.length > 2) removeUnitsInLoop(loopPoints);
            let rest = gameData.frontLine.slice(i + 1);
            gameData.frontLine = [[0, gameData.frontLine[i][1]], ...rest];
            return;
        }
    }
    // Проверка за десен ръб (x >= canvas.width)
    for (let i = gameData.frontLine.length - 2; i > 0; i--) {
        let [x, y] = gameData.frontLine[i];
        if (x >= canvas.width) {
            let loopPoints = [[canvas.width, gameData.frontLine[i][1]], ...gameData.frontLine.slice(i)];
            if (loopPoints.length > 2) removeUnitsInLoop(loopPoints);
            let rest = gameData.frontLine.slice(0, i);
            gameData.frontLine = [...rest, [canvas.width, gameData.frontLine[i][1]]];
            return;
        }
    }
}

// Проверка дали точка е в морската зона (само за WW2 карта)
function isInSeaZone(x, y) {
    if (
        typeof WW2_SEA_ZONES !== "undefined" &&
        Array.isArray(WW2_SEA_ZONES) &&
        WW2_SEA_ZONES.length > 0 &&
        document.getElementById('map-select') &&
        document.getElementById('map-select').value === 'WW2'
    ) {
        // Вземи скалата за WW2 карта
        const scaleX = canvas.width / 700;
        const scaleY = canvas.height / 600;
        for (const zone of WW2_SEA_ZONES) {
            // Преобразувай x, y към оригиналната координатна система на морето
            if (pointInPolygon([x / scaleX, y / scaleY], zone)) return true;
        }
    }
    return false;
}