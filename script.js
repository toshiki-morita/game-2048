document.addEventListener('DOMContentLoaded', () => {
    const gameBoard = document.getElementById('game-board');
    const scoreDisplay = document.getElementById('score');
    const bestScoreDisplay = document.getElementById('best-score');
    const newGameBtn = document.getElementById('new-game-btn');
    const undoBtn = document.getElementById('undo-btn');
    const gameOverScreen = document.getElementById('game-over-screen');
    const retryBtn = document.getElementById('retry-btn');
    const normalModeBtn = document.getElementById('normal-mode-btn');
    const timeAttackModeBtn = document.getElementById('time-attack-mode-btn');
    const timerContainer = document.getElementById('timer-container');
    const timerDisplay = document.getElementById('timer');

    const gridSize = 4;
    let tiles = [];
    let score = 0;
    let bestScore = localStorage.getItem('bestScore2048') || 0;
    let isGameOver = false;
    let undoCount = 1;
    let previousTiles = [];
    let previousScore = 0;

    let currentMode = 'normal'; // 'normal' or 'time-attack'
    let timeLeft = 60;
    let timerId;

    // --- Game Initialization ---
    function setupGame() {
        tiles = [];
        score = 0;
        isGameOver = false;
        undoCount = 1;
        gameOverScreen.classList.add('hidden');
        
        // Create the background grid cells
        gameBoard.innerHTML = '';
        for (let i = 0; i < gridSize * gridSize; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            gameBoard.appendChild(cell);
        }

        addRandomTile();
        addRandomTile();
        updateDisplay();
    }

    function startGame() {
        stopTimer();
        setupGame();
        if (currentMode === 'time-attack') {
            startTimer();
        }
    }

    // --- Display Updates ---
    function updateDisplay() {
        // This function is now split into more specific update functions
        updateScore();
        updateUndoButton();
    }

    function updateScore() {
        scoreDisplay.textContent = score;
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('bestScore2048', bestScore);
        }
        bestScoreDisplay.textContent = bestScore;
    }

    function updateUndoButton() {
        undoBtn.textContent = `やり直し (${undoCount})`;
        undoBtn.disabled = undoCount === 0;
    }

    function updateBoard() {
        tiles.forEach(tile => {
            if (tile.element) {
                // Update existing tile's position and value
                setPosition(tile.element, tile.r, tile.c);
                tile.element.dataset.value = tile.value;
                tile.element.textContent = tile.value;

                if (tile.merged) {
                    tile.element.classList.add('tile-merged');
                    // Remove class after animation
                    tile.element.addEventListener('animationend', () => {
                        tile.element.classList.remove('tile-merged');
                    }, { once: true });
                }
            }
        });
    }

    function setPosition(element, r, c) {
        element.style.top = `${r * 100 + (r + 1) * 15}px`;
        element.style.left = `${c * 100 + (c + 1) * 15}px`;
    }

    // --- Game Logic ---
    function addRandomTile() {
        const emptyCells = [];
        const currentPositions = tiles.map(t => `${t.r},${t.c}`);
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                if (!currentPositions.includes(`${r},${c}`)) {
                    emptyCells.push({ r, c });
                }
            }
        }

        if (emptyCells.length > 0) {
            const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            const value = Math.random() < 0.9 ? 2 : 4;
            const newTile = {
                id: Date.now() + Math.random(), // Ensure unique ID
                value: value,
                r: r,
                c: c,
                merged: false,
                element: createTileElement(r, c, value)
            };
            tiles.push(newTile);
            gameBoard.appendChild(newTile.element);
        }
    }

    async function handleKeyPress(e) {
        if (isGameOver) return;
        
        let direction;
        switch (e.key) {
            case 'ArrowUp': direction = 'up'; break;
            case 'ArrowDown': direction = 'down'; break;
            case 'ArrowLeft': direction = 'left'; break;
            case 'ArrowRight': direction = 'right'; break;
            default: return;
        }

        saveState();
        const moved = move(direction);

        if (moved) {
            updateBoard();
            // Wait for move animation to finish
            await new Promise(resolve => setTimeout(resolve, 110));

            // Process merges after animation
            const tilesToRemove = [];
            const mergedTiles = tiles.filter(t => t.merged);

            mergedTiles.forEach(mergedTile => {
                tiles.forEach(tile => {
                    if (tile.mergedInto === mergedTile.id) {
                        tilesToRemove.push(tile);
                    }
                });
                mergedTile.value *= 2;
                mergedTile.element.dataset.value = mergedTile.value;
                mergedTile.element.textContent = mergedTile.value;
            });

            // Remove the old tiles that were merged
            tilesToRemove.forEach(tile => {
                tile.element.remove();
            });
            tiles = tiles.filter(tile => !tilesToRemove.includes(tile));

            // Reset merge flags
            tiles.forEach(t => { t.merged = false; t.mergedInto = null; });

            addRandomTile();
            updateScore();
            updateUndoButton();
            checkGameOver();
        }
    }

    function checkGameOver() {
        if (tiles.length < gridSize * gridSize && !canMove()) {
             // Game continues if there are empty cells
        } else if (tiles.length === gridSize * gridSize && !canMove()){
            isGameOver = true;
            gameOverScreen.classList.remove('hidden');
            stopTimer();
            if (score > bestScore) {
                bestScore = score;
                localStorage.setItem('bestScore2048', bestScore);
            }
        }
    }

    function canMove() {
        const grid = buildGrid();
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                if (grid[r][c] === 0) return true;
                const currentValue = grid[r][c];
                if (r < gridSize - 1 && currentValue === grid[r + 1][c]) return true;
                if (c < gridSize - 1 && currentValue === grid[r][c + 1]) return true;
            }
        }
        return false;
    }

    // --- Move Functions ---
    function moveUp() {
        return move(true, true);
    }

    function moveDown() {
        return move(true, false);
    }

    function moveLeft() {
        return move(false, true);
    }

    function moveRight() {
        return move(false, false);
    }

    function move(direction) {
        let moved = false;
        const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
        const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;

        // Reset merge flags
        tiles.forEach(t => { t.merged = false; t.mergedInto = null; });

        const sortedTiles = tiles.sort((a, b) => {
            if (dx === 1) return b.c - a.c;
            if (dx === -1) return a.c - b.c;
            if (dy === 1) return b.r - a.r;
            if (dy === -1) return a.r - b.r;
            return 0;
        });

        sortedTiles.forEach(tile => {
            let nextR = tile.r, nextC = tile.c;
            let currentR, currentC;

            do {
                currentR = nextR;
                currentC = nextC;
                nextR += dy;
                nextC += dx;
            } while (isValidCell(nextR, nextC) && !getTileAt(nextR, nextC));

            const otherTile = getTileAt(nextR, nextC);

            if (otherTile && otherTile.value === tile.value && !otherTile.merged) {
                score += tile.value * 2;
                otherTile.merged = true;
                tile.mergedInto = otherTile.id;
                tile.r = otherTile.r;
                tile.c = otherTile.c;
                moved = true;
            } else {
                if (tile.r !== currentR || tile.c !== currentC) {
                    tile.r = currentR;
                    tile.c = currentC;
                    moved = true;
                }
            }
        });

        return moved;
    }

    function buildGrid() {
        const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
        tiles.forEach(tile => {
            grid[tile.r][tile.c] = tile.value;
        });
        return grid;
    }

    function getTileAt(r, c) {
        return tiles.find(tile => tile.r === r && tile.c === c);
    }

    function isValidCell(r, c) {
        return r >= 0 && r < gridSize && c >= 0 && c < gridSize;
    }

    function getLine(index, isVertical) {
        const line = [];
        for (let i = 0; i < gridSize; i++) {
            line.push(isVertical ? grid[i][index] : grid[index][i]);
        }
        return line;
    }

    function setLine(index, line, isVertical) {
        for (let i = 0; i < gridSize; i++) {
            if (isVertical) {
                grid[i][index] = line[i];
            } else {
                grid[index][i] = line[i];
            }
        }
    }

    function processLine(line, isAscending) {
        let filteredLine = line.filter(val => val !== 0);
        if (!isAscending) filteredLine.reverse();

        let newLine = [];
        let lineMoved = false;

        for (let i = 0; i < filteredLine.length; i++) {
            if (i < filteredLine.length - 1 && filteredLine[i] === filteredLine[i + 1]) {
                const newValue = filteredLine[i] * 2;
                newLine.push(newValue);
                score += newValue;
                i++; // Skip next element
            } else {
                newLine.push(filteredLine[i]);
            }
        }

        // Pad with zeros
        const paddedLine = Array(gridSize).fill(0);
        for (let i = 0; i < newLine.length; i++) {
            paddedLine[i] = newLine[i];
        }

        if (!isAscending) paddedLine.reverse();

        // Check if the line has changed
        for (let i = 0; i < gridSize; i++) {
            if (line[i] !== paddedLine[i]) {
                lineMoved = true;
                break;
            }
        }

        return { newLine: paddedLine, lineMoved };
    }

    // --- Undo Logic ---
    function saveState() {
        previousTiles = JSON.parse(JSON.stringify(tiles)); // Deep copy
        previousScore = score;
    }

    function createTileElement(r, c, value) {
        const element = document.createElement('div');
        element.className = 'tile tile-new';
        element.dataset.value = value;
        element.textContent = value;
        setPosition(element, r, c);
        element.addEventListener('animationend', () => {
            element.classList.remove('tile-new');
        }, { once: true });
        return element;
    }

    function undo() {
        if (undoCount > 0 && !isGameOver) {
            // Remove current tiles from board
            tiles.forEach(t => t.element.remove());

            tiles = JSON.parse(JSON.stringify(previousTiles)); // Deep copy
            tiles.forEach(tile => {
                tile.element = createTileElement(tile.r, tile.c, tile.value);
                gameBoard.appendChild(tile.element);
            });

            score = previousScore;
            undoCount--;
            updateScore();
            updateUndoButton();
        }
    }

    // --- Mode Selection & Timer ---
    function selectMode(mode) {
        currentMode = mode;
        if (mode === 'normal') {
            normalModeBtn.classList.add('active');
            timeAttackModeBtn.classList.remove('active');
            timerContainer.classList.add('hidden');
        } else {
            timeAttackModeBtn.classList.add('active');
            normalModeBtn.classList.remove('active');
            timerContainer.classList.remove('hidden');
        }
        startGame();
    }

    function startTimer() {
        timeLeft = 60;
        timerDisplay.textContent = timeLeft;
        timerId = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(timerId);
                isGameOver = true;
                gameOverScreen.classList.remove('hidden');
                if (score > bestScore) {
                    bestScore = score;
                    localStorage.setItem('bestScore2048', bestScore);
                }
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerId);
    }

    // --- Event Listeners ---
    document.addEventListener('keydown', (e) => handleKeyPress(e));
    newGameBtn.addEventListener('click', startGame);
    retryBtn.addEventListener('click', startGame);
    undoBtn.addEventListener('click', undo);
    normalModeBtn.addEventListener('click', () => selectMode('normal'));
    timeAttackModeBtn.addEventListener('click', () => selectMode('time-attack'));

    // --- Initial Load ---
    startGame();
});
