class GameUI {
    constructor() {
        this.engine = null;
        this.generator = new SudokuGenerator();
        this.selectedCell = null;
        this.notesMode = false;
        this.timerInterval = null;
        this.currentPuzzle = null;

        this.initializeElements();
        this.setupEventListeners();
        this.createSudokuGrid();
    }

    initializeElements() {
        this.gameGrid = document.getElementById('sudoku-grid');
        this.timerText = document.getElementById('game-timer-text');
        this.difficultyText = document.getElementById('difficulty-text');
        this.scoreMultiplier = document.getElementById('score-multiplier');
        this.mistakesCount = document.getElementById('mistakes-count');
        this.currentScore = document.getElementById('current-score');
        this.hintCounter = document.getElementById('hint-counter');
        this.gameOverlay = document.getElementById('game-overlay');
        this.overlayTitle = document.getElementById('overlay-title');
        this.overlayMessage = document.getElementById('overlay-message');

        this.pauseBtn = document.getElementById('pause-btn');
        this.resumeBtn = document.getElementById('resume-btn');
        this.quitBtn = document.getElementById('quit-btn');
        this.undoBtn = document.getElementById('undo-btn');
        this.eraseBtn = document.getElementById('erase-btn');
        this.notesBtn = document.getElementById('notes-btn');
        this.hintBtn = document.getElementById('hint-btn');

        this.numberBtns = document.querySelectorAll('.number-btn');
    }

    setupEventListeners() {
        this.pauseBtn?.addEventListener('click', () => this.pauseGame());
        this.resumeBtn?.addEventListener('click', () => this.resumeGame());
        this.quitBtn?.addEventListener('click', () => this.quitGame());
        this.undoBtn?.addEventListener('click', () => this.undoMove());
        this.eraseBtn?.addEventListener('click', () => this.eraseCell());
        this.notesBtn?.addEventListener('click', () => this.toggleNotesMode());
        this.hintBtn?.addEventListener('click', () => this.useHint());

        this.numberBtns.forEach(btn => {
            btn.addEventListener('click', e => {
                const number = parseInt(e.target.dataset.number);
                this.inputNumber(number);
            });
        });

        document.addEventListener('keydown', e => this.handleKeyPress(e));

        window.addEventListener('beforeunload', e => {
            if (this.engine && this.engine.timer.isRunning && !this.engine.gameState.isCompleted) {
                e.preventDefault();
                e.returnValue = 'You have an active game. Are you sure you want to leave?';
            }
        });
    }

    createSudokuGrid() {
        this.gameGrid.innerHTML = '';

        for (let i = 0; i < 81; i++) {
            const cell = document.createElement('div');
            cell.className = 'sudoku-cell';
            cell.dataset.index = i;
            cell.addEventListener('click', () => this.selectCell(i));
            this.gameGrid.appendChild(cell);
        }
    }

    startNewGame(difficulty = 'medium', puzzleData = null) {
        try {
            if (puzzleData) {
                this.currentPuzzle = puzzleData;
            } else {
                this.currentPuzzle = this.generator.generatePuzzle(difficulty);
            }

            this.engine = new SudokuEngine();
            this.engine.initializeGame(
                this.currentPuzzle.puzzle,
                this.currentPuzzle.solution,
                this.currentPuzzle.difficulty
            );

            this.updateUI();
            this.renderGrid();
            this.startTimer();
            this.showGamePage();
        } catch (error) {
            console.error('Failed to start new game:', error);
            this.showError('Failed to start new game. Please try again.');
        }
    }

    async startDailyChallenge(date = new Date()) {
        try {
            const dailyPuzzle = await this.generator.generateDailyPuzzle(date, 'medium');
            this.startNewGame('medium', dailyPuzzle);
        } catch (error) {
            console.error('Failed to start daily challenge:', error);
            this.showError('Failed to load daily challenge. Please try again.');
        }
    }

    selectCell(index) {
        if (!this.engine || this.engine.gameState.isCompleted || this.engine.gameState.isFailed) {
            return;
        }

        const previousSelected = document.querySelector('.sudoku-cell.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }

        this.selectedCell = index;
        const cell = this.gameGrid.children[index];
        cell.classList.add('selected');

        this.highlightRelatedCells(index);
    }

    highlightRelatedCells(index) {
        const row = Math.floor(index / 9);
        const col = index % 9;
        const cells = this.gameGrid.children;

        const currentNumber = this.engine.grid[row][col];

        for (let i = 0; i < 81; i++) {
            const cell = cells[i];
            cell.classList.remove('related', 'same-number');

            const cellRow = Math.floor(i / 9);
            const cellCol = i % 9;

            if (i !== index) {
                const cellNumber = this.engine.grid[cellRow][cellCol];

                if (cellRow === row || cellCol === col
                    || (Math.floor(cellRow / 3) === Math.floor(row / 3)
                     && Math.floor(cellCol / 3) === Math.floor(col / 3))) {
                    cell.classList.add('related');
                }

                if (currentNumber !== 0 && cellNumber === currentNumber) {
                    cell.classList.add('same-number');
                }
            }
        }
    }

    inputNumber(number) {
        if (!this.selectedCell && this.selectedCell !== 0) { return; }
        if (!this.engine || this.engine.gameState.isCompleted || this.engine.gameState.isFailed) { return; }

        const row = Math.floor(this.selectedCell / 9);
        const col = this.selectedCell % 9;

        if (this.notesMode) {
            this.toggleNote(row, col, number);
        } else {
            const result = this.engine.makeMove(row, col, number);
            this.handleMoveResult(result, row, col);
        }
    }

    toggleNote(row, col, number) {
        const cell = this.gameGrid.children[this.selectedCell];

        if (this.engine.originalGrid[row][col] !== 0) { return; }
        if (this.engine.grid[row][col] !== 0) { return; }

        let notesDiv = cell.querySelector('.cell-notes');
        if (!notesDiv) {
            notesDiv = document.createElement('div');
            notesDiv.className = 'cell-notes';
            for (let i = 1; i <= 9; i++) {
                const span = document.createElement('span');
                span.dataset.number = i;
                notesDiv.appendChild(span);
            }
            cell.appendChild(notesDiv);
        }

        const noteSpan = notesDiv.querySelector(`[data-number="${number}"]`);
        if (noteSpan.textContent) {
            noteSpan.textContent = '';
        } else {
            noteSpan.textContent = number;
        }
    }

    handleMoveResult(result, row, col) {
        if (result.error) {
            this.showError(result.error);
            return;
        }

        this.renderGrid();
        this.updateUI();

        const cell = this.gameGrid.children[this.selectedCell];

        if (!result.isCorrect && result.success) {
            cell.classList.add('error');
            setTimeout(() => cell.classList.remove('error'), 500);
        }

        if (result.completed) {
            this.handleGameComplete(result);
        } else if (result.gameOver) {
            this.handleGameOver(result);
        }

        this.clearCellNotes(row, col);
    }

    clearCellNotes(row, col) {
        const cell = this.gameGrid.children[row * 9 + col];
        const notesDiv = cell.querySelector('.cell-notes');
        if (notesDiv) {
            notesDiv.remove();
        }
    }

    eraseCell() {
        if (!this.selectedCell && this.selectedCell !== 0) { return; }
        this.inputNumber(0);
    }

    undoMove() {
        if (!this.engine) { return; }

        const result = this.engine.undoMove();
        if (result.success) {
            this.renderGrid();
            this.updateUI();

            const cellIndex = result.row * 9 + result.col;
            this.selectCell(cellIndex);
        } else {
            this.showError(result.error || 'Nothing to undo');
        }
    }

    toggleNotesMode() {
        this.notesMode = !this.notesMode;
        this.notesBtn.classList.toggle('active', this.notesMode);
    }

    useHint() {
        if (!this.engine) { return; }

        const result = this.engine.getHint();
        if (result.error) {
            this.showError(result.error);
            return;
        }

        const cellIndex = result.row * 9 + result.col;
        const cell = this.gameGrid.children[cellIndex];

        this.selectCell(cellIndex);
        this.inputNumber(result.number);

        cell.classList.add('hint');
        setTimeout(() => cell.classList.remove('hint'), 1000);

        this.updateUI();
    }

    pauseGame() {
        if (!this.engine) { return; }

        this.engine.pauseTimer();
        this.showOverlay('Game Paused', 'Tap resume to continue', 'pause');
        this.stopTimer();
    }

    resumeGame() {
        if (!this.engine) { return; }

        this.engine.resumeTimer();
        this.hideOverlay();
        this.startTimer();
    }

    quitGame() {
        this.stopTimer();
        this.engine = null;
        this.selectedCell = null;
        this.notesMode = false;
        this.currentPuzzle = null;

        this.hideOverlay();
        this.showHomePage();
    }

    handleGameComplete(result) {
        this.stopTimer();

        // Handle tournament level completion
        if (this.currentPuzzle?.type === 'tournament') {
            const { level } = this.currentPuzzle;
            const stars = this.calculateStars(result);

            if (window.tournamentUI) {
                window.tournamentUI.completeLevel(level, result.score, stars);
            }

            this.showOverlay(
                `Level ${level} Complete!`,
                `${this.currentPuzzle.levelData?.name || 'Tournament Level'}\n⭐ ${stars} Stars\nTime: ${this.engine.formatTime(result.time)}\nScore: ${result.score}`,
                'complete'
            );
        } else {
            this.showOverlay(
                'Congratulations!',
                `You completed the puzzle!\nTime: ${this.engine.formatTime(result.time)}\nScore: ${result.score}`,
                'complete'
            );
        }
    }

    calculateStars(result) {
        const { mistakes } = this.engine.gameState;
        const { hintsUsed } = this.engine.gameState;

        if (mistakes === 0 && hintsUsed === 0) {
            return 3; // Perfect
        } else if (mistakes <= 1 && hintsUsed <= 1) {
            return 2; // Good
        } else {
            return 1; // Complete
        }
    }

    handleGameOver(result) {
        this.stopTimer();
        this.showOverlay(
            'Game Over',
            result.reason || 'Too many mistakes',
            'gameover'
        );
    }

    renderGrid() {
        if (!this.engine) { return; }

        const gameState = this.engine.getGameState();
        const cells = this.gameGrid.children;

        for (let i = 0; i < 81; i++) {
            const row = Math.floor(i / 9);
            const col = i % 9;
            const cell = cells[i];

            const value = gameState.grid[row][col];
            const isOriginal = gameState.originalGrid[row][col] !== 0;

            cell.textContent = value || '';
            cell.className = 'sudoku-cell';

            if (isOriginal) {
                cell.classList.add('original');
            } else if (value) {
                cell.classList.add('user-input');
            }

            if (i === this.selectedCell) {
                cell.classList.add('selected');
            }
        }
    }

    updateUI() {
        if (!this.engine) { return; }

        const gameState = this.engine.getGameState();

        this.difficultyText.textContent = gameState.gameState.difficulty.charAt(0).toUpperCase()
                                         + gameState.gameState.difficulty.slice(1);

        const multipliers = { easy: '×1', medium: '×1.5', hard: '×2', expert: '×3' };
        this.scoreMultiplier.textContent = multipliers[gameState.gameState.difficulty] || '×1';

        this.mistakesCount.textContent = `${gameState.gameState.mistakes}/${gameState.gameState.maxMistakes}`;
        this.currentScore.textContent = gameState.gameState.score.toLocaleString();
        this.hintCounter.textContent = gameState.gameState.maxHints - gameState.gameState.hintsUsed;

        this.hintBtn.disabled = gameState.gameState.hintsUsed >= gameState.gameState.maxHints;
    }

    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            if (this.engine && this.engine.timer.isRunning && !this.engine.timer.isPaused) {
                const elapsed = this.engine.getElapsedTime();
                this.timerText.textContent = this.engine.formatTime(elapsed);
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    handleKeyPress(event) {
        if (!this.engine || this.gameOverlay && !this.gameOverlay.classList.contains('hidden')) {
            return;
        }

        const { key } = event;

        if (key >= '1' && key <= '9') {
            this.inputNumber(parseInt(key));
        } else if (key === '0' || key === 'Delete' || key === 'Backspace') {
            this.eraseCell();
        } else if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
            event.preventDefault();
            this.handleArrowKey(key);
        } else if (key === 'u' || key === 'U') {
            this.undoMove();
        } else if (key === 'h' || key === 'H') {
            this.useHint();
        } else if (key === 'n' || key === 'N') {
            this.toggleNotesMode();
        } else if (key === ' ') {
            event.preventDefault();
            this.pauseGame();
        }
    }

    handleArrowKey(key) {
        if (this.selectedCell === null) {
            this.selectCell(40); // Center cell
            return;
        }

        const row = Math.floor(this.selectedCell / 9);
        const col = this.selectedCell % 9;
        let newRow = row;
        let newCol = col;

        switch (key) {
            case 'ArrowUp':
                newRow = Math.max(0, row - 1);
                break;
            case 'ArrowDown':
                newRow = Math.min(8, row + 1);
                break;
            case 'ArrowLeft':
                newCol = Math.max(0, col - 1);
                break;
            case 'ArrowRight':
                newCol = Math.min(8, col + 1);
                break;
        }

        this.selectCell(newRow * 9 + newCol);
    }

    showOverlay(title, message, type = 'info') {
        this.overlayTitle.textContent = title;
        this.overlayMessage.textContent = message;

        if (type === 'complete') {
            this.resumeBtn.textContent = 'New Game';
            this.quitBtn.textContent = 'Back to Menu';
        } else if (type === 'gameover') {
            this.resumeBtn.textContent = 'Try Again';
            this.quitBtn.textContent = 'Back to Menu';
        } else {
            this.resumeBtn.textContent = 'Resume';
            this.quitBtn.textContent = 'Quit Game';
        }

        this.gameOverlay.classList.remove('hidden');
    }

    hideOverlay() {
        this.gameOverlay.classList.add('hidden');
    }

    showError(message) {
        console.error(message);

        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--error-color);
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            z-index: 2000;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    showGamePage() {
        const currentPage = document.querySelector('.page.active');
        const gamePage = document.getElementById('game-page');

        if (currentPage) { currentPage.classList.remove('active'); }
        gamePage.classList.add('active');

        document.getElementById('page-title').textContent = 'Sudoku';
        document.getElementById('back-btn').classList.remove('hidden');
    }

    showHomePage() {
        const currentPage = document.querySelector('.page.active');
        const homePage = document.getElementById('homepage');

        if (currentPage) { currentPage.classList.remove('active'); }
        homePage.classList.add('active');

        document.getElementById('page-title').textContent = 'Sudoku Master';
        document.getElementById('back-btn').classList.add('hidden');
    }

    async saveGameState() {
        if (!this.engine || !window.dataStorage) { return; }

        try {
            const gameData = this.engine.exportGameState();
            const result = await window.dataStorage.saveGameState(gameData, this.currentPuzzle);

            if (!result.success) {
                console.error('Failed to save game state:', result.error);
            }

            return result;
        } catch (error) {
            console.error('Failed to save game state:', error);
            return { success: false, error: error.message };
        }
    }

    async loadGameState() {
        if (!window.dataStorage) { return false; }

        try {
            const result = await window.dataStorage.loadGameState();
            if (!result.success) { return false; }

            this.currentPuzzle = result.puzzleData;
            this.engine = new SudokuEngine();

            const importResult = this.engine.importGameState(result.gameData);
            if (importResult.success) {
                this.updateUI();
                this.renderGrid();
                this.startTimer();
                return true;
            }
        } catch (error) {
            console.error('Failed to load game state:', error);
        }
        return false;
    }

    clearSavedGame() {
        if (window.dataStorage) {
            return window.dataStorage.clearGameState();
        }
    }
}

if (typeof window !== 'undefined') {
    window.GameUI = GameUI;
}
