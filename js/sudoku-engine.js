class SudokuEngine {
    constructor() {
        this.grid = Array(9).fill(null).map(() => Array(9).fill(0));
        this.originalGrid = Array(9).fill(null).map(() => Array(9).fill(0));
        this.solution = Array(9).fill(null).map(() => Array(9).fill(0));
        this.moveHistory = [];
        this.timer = {
            startTime: null,
            pausedTime: 0,
            isRunning: false,
            isPaused: false
        };
        this.gameState = {
            mistakes: 0,
            hintsUsed: 0,
            maxMistakes: 3,
            maxHints: 3,
            isCompleted: false,
            isFailed: false,
            difficulty: 'medium',
            score: 0
        };
    }

    isValidInRow(grid, row, num) {
        if (row < 0 || row >= 9) return false;
        for (let col = 0; col < 9; col++) {
            if (grid[row][col] === num) {
                return false;
            }
        }
        return true;
    }

    isValidInColumn(grid, col, num) {
        if (col < 0 || col >= 9) return false;
        for (let row = 0; row < 9; row++) {
            if (grid[row][col] === num) {
                return false;
            }
        }
        return true;
    }

    isValidInBox(grid, startRow, startCol, num) {
        if (startRow < 0 || startRow >= 9 || startCol < 0 || startCol >= 9) return false;
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (grid[startRow + row][startCol + col] === num) {
                    return false;
                }
            }
        }
        return true;
    }

    isValidPlacement(grid, row, col, num) {
        if (num < 1 || num > 9) return false;
        if (row < 0 || row >= 9 || col < 0 || col >= 9) return false;
        
        const boxStartRow = Math.floor(row / 3) * 3;
        const boxStartCol = Math.floor(col / 3) * 3;
        
        return this.isValidInRow(grid, row, num) &&
               this.isValidInColumn(grid, col, num) &&
               this.isValidInBox(grid, boxStartRow, boxStartCol, num);
    }

    isValidGrid(grid) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const num = grid[row][col];
                if (num !== 0) {
                    grid[row][col] = 0;
                    if (!this.isValidPlacement(grid, row, col, num)) {
                        grid[row][col] = num;
                        return false;
                    }
                    grid[row][col] = num;
                }
            }
        }
        return true;
    }

    findEmptyCell(grid) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] === 0) {
                    return [row, col];
                }
            }
        }
        return null;
    }

    solveSudoku(grid) {
        const emptyCell = this.findEmptyCell(grid);
        if (!emptyCell) {
            return true;
        }

        const [row, col] = emptyCell;
        
        for (let num = 1; num <= 9; num++) {
            if (this.isValidPlacement(grid, row, col, num)) {
                grid[row][col] = num;
                
                if (this.solveSudoku(grid)) {
                    return true;
                }
                
                grid[row][col] = 0;
            }
        }
        
        return false;
    }

    hasUniqueSolution(grid) {
        const gridCopy = grid.map(row => [...row]);
        let solutions = 0;
        
        const countSolutions = (g) => {
            if (solutions > 1) return;
            
            const emptyCell = this.findEmptyCell(g);
            if (!emptyCell) {
                solutions++;
                return;
            }

            const [row, col] = emptyCell;
            
            for (let num = 1; num <= 9; num++) {
                if (this.isValidPlacement(g, row, col, num)) {
                    g[row][col] = num;
                    countSolutions(g);
                    g[row][col] = 0;
                }
            }
        };

        countSolutions(gridCopy);
        return solutions === 1;
    }

    getHint() {
        if (this.gameState.hintsUsed >= this.gameState.maxHints) {
            return { error: 'No more hints available' };
        }

        const emptyCells = [];
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) {
                    emptyCells.push([row, col]);
                }
            }
        }

        if (emptyCells.length === 0) {
            return { error: 'No empty cells to hint' };
        }

        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const [row, col] = randomCell;
        const correctNumber = this.solution[row][col];

        this.gameState.hintsUsed++;
        
        return {
            row,
            col,
            number: correctNumber,
            hintsRemaining: this.gameState.maxHints - this.gameState.hintsUsed
        };
    }

    makeMove(row, col, num) {
        if (row < 0 || row >= 9 || col < 0 || col >= 9) {
            return { error: 'Invalid cell position' };
        }

        if (this.originalGrid[row][col] !== 0) {
            return { error: 'Cannot modify original puzzle numbers' };
        }

        if (this.gameState.isCompleted || this.gameState.isFailed) {
            return { error: 'Game is finished' };
        }

        const previousValue = this.grid[row][col];
        
        this.moveHistory.push({
            row,
            col,
            previousValue,
            newValue: num,
            timestamp: Date.now()
        });

        this.grid[row][col] = num;

        let isCorrect = true;
        if (num !== 0 && this.solution[row][col] !== num) {
            isCorrect = false;
            this.gameState.mistakes++;
            
            if (this.gameState.mistakes >= this.gameState.maxMistakes) {
                this.gameState.isFailed = true;
                this.stopTimer();
                return {
                    success: false,
                    isCorrect: false,
                    mistakes: this.gameState.mistakes,
                    gameOver: true,
                    reason: 'Too many mistakes'
                };
            }
        }

        if (this.isPuzzleComplete()) {
            this.gameState.isCompleted = true;
            this.stopTimer();
            this.calculateFinalScore();
            
            return {
                success: true,
                isCorrect,
                completed: true,
                score: this.gameState.score,
                time: this.getElapsedTime()
            };
        }

        return {
            success: true,
            isCorrect,
            mistakes: this.gameState.mistakes,
            mistakesRemaining: this.gameState.maxMistakes - this.gameState.mistakes
        };
    }

    undoMove() {
        if (this.moveHistory.length === 0) {
            return { error: 'No moves to undo' };
        }

        const lastMove = this.moveHistory.pop();
        this.grid[lastMove.row][lastMove.col] = lastMove.previousValue;

        if (lastMove.newValue !== 0 && 
            this.solution[lastMove.row][lastMove.col] !== lastMove.newValue) {
            this.gameState.mistakes = Math.max(0, this.gameState.mistakes - 1);
            
            if (this.gameState.isFailed && this.gameState.mistakes < this.gameState.maxMistakes) {
                this.gameState.isFailed = false;
            }
        }

        this.gameState.isCompleted = false;

        return {
            success: true,
            row: lastMove.row,
            col: lastMove.col,
            value: lastMove.previousValue,
            mistakes: this.gameState.mistakes
        };
    }

    isPuzzleComplete() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) {
                    return false;
                }
                if (this.grid[row][col] !== this.solution[row][col]) {
                    return false;
                }
            }
        }
        return true;
    }

    startTimer() {
        if (!this.timer.isRunning) {
            this.timer.startTime = Date.now() - this.timer.pausedTime;
            this.timer.isRunning = true;
            this.timer.isPaused = false;
        }
    }

    pauseTimer() {
        if (this.timer.isRunning && !this.timer.isPaused) {
            this.timer.pausedTime = Date.now() - this.timer.startTime;
            this.timer.isPaused = true;
        }
    }

    resumeTimer() {
        if (this.timer.isRunning && this.timer.isPaused) {
            this.timer.startTime = Date.now() - this.timer.pausedTime;
            this.timer.isPaused = false;
        }
    }

    stopTimer() {
        this.timer.isRunning = false;
        this.timer.isPaused = false;
        if (this.timer.startTime) {
            this.timer.pausedTime = Date.now() - this.timer.startTime;
        }
    }

    getElapsedTime() {
        if (!this.timer.startTime) return 0;
        
        if (this.timer.isPaused) {
            return this.timer.pausedTime;
        } else if (this.timer.isRunning) {
            return Date.now() - this.timer.startTime;
        } else {
            return this.timer.pausedTime;
        }
    }

    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        } else {
            return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
        }
    }

    calculateFinalScore() {
        const baseScore = 1000;
        const elapsedTime = this.getElapsedTime();
        const timeInMinutes = elapsedTime / (1000 * 60);
        
        const difficultyMultipliers = {
            easy: 1,
            medium: 1.5,
            hard: 2,
            expert: 3
        };

        const difficultyMultiplier = difficultyMultipliers[this.gameState.difficulty] || 1;
        
        let timeBonus = Math.max(0, 500 - (timeInMinutes * 10));
        const mistakePenalty = this.gameState.mistakes * 100;
        const hintPenalty = this.gameState.hintsUsed * 0.1;

        let finalScore = (baseScore + timeBonus - mistakePenalty) * difficultyMultiplier;
        finalScore = finalScore * (1 - hintPenalty);
        
        this.gameState.score = Math.max(0, Math.round(finalScore));
        return this.gameState.score;
    }

    initializeGame(puzzle, solution, difficulty = 'medium') {
        if (!puzzle || !solution) {
            throw new Error('Puzzle and solution are required');
        }

        if (!Array.isArray(puzzle) || puzzle.length !== 9 || 
            !puzzle.every(row => Array.isArray(row) && row.length === 9)) {
            throw new Error('Invalid puzzle format');
        }

        if (!Array.isArray(solution) || solution.length !== 9 || 
            !solution.every(row => Array.isArray(row) && row.length === 9)) {
            throw new Error('Invalid solution format');
        }

        this.grid = puzzle.map(row => [...row]);
        this.originalGrid = puzzle.map(row => [...row]);
        this.solution = solution.map(row => [...row]);
        this.moveHistory = [];
        
        this.timer = {
            startTime: null,
            pausedTime: 0,
            isRunning: false,
            isPaused: false
        };
        
        this.gameState = {
            mistakes: 0,
            hintsUsed: 0,
            maxMistakes: 3,
            maxHints: 3,
            isCompleted: false,
            isFailed: false,
            difficulty: difficulty,
            score: 0
        };

        if (!this.isValidGrid(this.grid)) {
            throw new Error('Invalid puzzle provided');
        }

        if (!this.isValidGrid(this.solution)) {
            throw new Error('Invalid solution provided');
        }

        this.startTimer();
        
        return {
            success: true,
            message: 'Game initialized successfully'
        };
    }

    getGameState() {
        return {
            grid: this.grid.map(row => [...row]),
            originalGrid: this.originalGrid.map(row => [...row]),
            gameState: { ...this.gameState },
            timer: {
                elapsedTime: this.getElapsedTime(),
                formattedTime: this.formatTime(this.getElapsedTime()),
                isRunning: this.timer.isRunning,
                isPaused: this.timer.isPaused
            },
            moveCount: this.moveHistory.length
        };
    }

    exportGameState() {
        return {
            grid: this.grid,
            originalGrid: this.originalGrid,
            solution: this.solution,
            moveHistory: this.moveHistory,
            timer: this.timer,
            gameState: this.gameState,
            timestamp: Date.now()
        };
    }

    importGameState(savedState) {
        try {
            this.grid = savedState.grid.map(row => [...row]);
            this.originalGrid = savedState.originalGrid.map(row => [...row]);
            this.solution = savedState.solution.map(row => [...row]);
            this.moveHistory = [...savedState.moveHistory];
            this.timer = { ...savedState.timer };
            this.gameState = { ...savedState.gameState };
            
            return { success: true, message: 'Game state restored successfully' };
        } catch (error) {
            return { success: false, error: 'Failed to restore game state: ' + error.message };
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SudokuEngine;
} else if (typeof window !== 'undefined') {
    window.SudokuEngine = SudokuEngine;
}