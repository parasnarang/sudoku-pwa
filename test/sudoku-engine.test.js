/**
 * Unit Tests for Sudoku Engine
 * Tests the core Sudoku game logic, validation, and solving algorithms
 */

describe('Sudoku Engine', () => {
    let engine;
    let testData;

    beforeAll(() => {
        testData = TestUtils.generateTestData();
    });

    beforeEach(() => {
        engine = new SudokuEngine();
    });

    afterEach(() => {
        TestUtils.cleanup();
    });

    describe('Grid Initialization', () => {
        it('should create a 9x9 empty grid', () => {
            expect(engine.grid).toBeDefined();
            expect(engine.grid).toHaveLength(9);
            expect(engine.grid[0]).toHaveLength(9);
            
            // Check all cells are initially 0
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    expect(engine.grid[row][col]).toBe(0);
                }
            }
        });

        it('should initialize solution grid', () => {
            expect(engine.solution).toBeDefined();
            expect(engine.solution).toHaveLength(9);
        });

        it('should track original cells', () => {
            expect(engine.originalCells).toBeDefined();
            expect(engine.originalCells).toHaveLength(81);
        });

        it('should initialize with default difficulty', () => {
            expect(engine.difficulty).toBe('medium');
        });
    });

    describe('Grid Validation', () => {
        beforeEach(() => {
            engine.grid = [...testData.validSudokuGrid.map(row => [...row])];
        });

        it('should validate rows correctly', () => {
            expect(engine.isValidRow(0, 5)).toBe(false); // 5 already exists in row 0
            expect(engine.isValidRow(0, 1)).toBe(true);  // 1 doesn't exist in row 0
            expect(engine.isValidRow(1, 3)).toBe(true);  // 3 doesn't exist in row 1
        });

        it('should validate columns correctly', () => {
            expect(engine.isValidCol(0, 6)).toBe(false); // 6 already exists in col 0
            expect(engine.isValidCol(0, 2)).toBe(true);  // 2 doesn't exist in col 0
            expect(engine.isValidCol(1, 1)).toBe(true);  // 1 doesn't exist in col 1
        });

        it('should validate 3x3 boxes correctly', () => {
            expect(engine.isValidBox(0, 0, 5)).toBe(false); // 5 already exists in top-left box
            expect(engine.isValidBox(0, 2, 4)).toBe(true);  // 4 doesn't exist in top-left box
            expect(engine.isValidBox(3, 3, 5)).toBe(true);  // 5 doesn't exist in middle box
        });

        it('should validate complete placement', () => {
            expect(engine.isValidMove(0, 2, 4)).toBe(true);  // Valid move
            expect(engine.isValidMove(0, 0, 6)).toBe(false); // Would conflict with column
            expect(engine.isValidMove(1, 1, 1)).toBe(false); // Would conflict with row
        });

        it('should detect invalid grid configurations', () => {
            engine.grid = [...testData.invalidSudokuGrid.map(row => [...row])];
            expect(engine.isValidGrid()).toBe(false);
        });

        it('should detect valid grid configurations', () => {
            engine.grid = [...testData.solvedSudokuGrid.map(row => [...row])];
            expect(engine.isValidGrid()).toBe(true);
        });
    });

    describe('Cell Management', () => {
        it('should make valid moves', () => {
            const result = engine.makeMove(0, 0, 5);
            expect(result.success).toBe(true);
            expect(engine.grid[0][0]).toBe(5);
        });

        it('should reject invalid moves', () => {
            engine.grid[0][1] = 5; // Place 5 in first row
            const result = engine.makeMove(0, 0, 5); // Try to place another 5 in same row
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid move');
        });

        it('should clear cells', () => {
            engine.grid[0][0] = 5;
            const result = engine.clearCell(0, 0);
            expect(result.success).toBe(true);
            expect(engine.grid[0][0]).toBe(0);
        });

        it('should not clear original cells', () => {
            engine.originalCells[0] = true; // Mark as original
            engine.grid[0][0] = 5;
            const result = engine.clearCell(0, 0);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot clear original cell');
        });

        it('should get cell value', () => {
            engine.grid[4][4] = 7;
            expect(engine.getCellValue(4, 4)).toBe(7);
            expect(engine.getCellValue(0, 0)).toBe(0);
        });

        it('should check if cell is original', () => {
            engine.originalCells[0] = true;
            expect(engine.isOriginalCell(0, 0)).toBe(true);
            expect(engine.isOriginalCell(0, 1)).toBe(false);
        });
    });

    describe('Game State Management', () => {
        it('should detect completed puzzle', () => {
            engine.grid = [...testData.solvedSudokuGrid.map(row => [...row])];
            expect(engine.isComplete()).toBe(true);
        });

        it('should detect incomplete puzzle', () => {
            engine.grid = [...testData.validSudokuGrid.map(row => [...row])];
            expect(engine.isComplete()).toBe(false);
        });

        it('should count filled cells', () => {
            engine.grid = [...testData.validSudokuGrid.map(row => [...row])];
            const filledCount = engine.getFilledCellsCount();
            expect(filledCount).toBeGreaterThan(0);
            expect(filledCount).toBeLessThan(81);
        });

        it('should count empty cells', () => {
            engine.grid = [...testData.validSudokuGrid.map(row => [...row])];
            const emptyCount = engine.getEmptyCellsCount();
            const filledCount = engine.getFilledCellsCount();
            expect(emptyCount + filledCount).toBe(81);
        });

        it('should calculate completion percentage', () => {
            engine.grid = [...testData.validSudokuGrid.map(row => [...row])];
            const percentage = engine.getCompletionPercentage();
            expect(percentage).toBeGreaterThan(0);
            expect(percentage).toBeLessThan(100);
        });
    });

    describe('Hint System', () => {
        beforeEach(() => {
            engine.grid = [...testData.validSudokuGrid.map(row => [...row])];
            engine.solution = [...testData.solvedSudokuGrid.map(row => [...row])];
        });

        it('should provide valid hints', () => {
            const hint = engine.getHint();
            expect(hint.success).toBe(true);
            expect(hint.row).toBeGreaterThan(-1);
            expect(hint.row).toBeLessThan(9);
            expect(hint.col).toBeGreaterThan(-1);
            expect(hint.col).toBeLessThan(9);
            expect(hint.value).toBeGreaterThan(0);
            expect(hint.value).toBeLessThan(10);
        });

        it('should not provide hints for completed puzzles', () => {
            engine.grid = [...testData.solvedSudokuGrid.map(row => [...row])];
            const hint = engine.getHint();
            expect(hint.success).toBe(false);
            expect(hint.message).toContain('complete');
        });

        it('should apply hints correctly', () => {
            const hint = engine.getHint();
            if (hint.success) {
                const originalValue = engine.grid[hint.row][hint.col];
                expect(originalValue).toBe(0); // Should be empty cell
                
                const result = engine.applyHint(hint);
                expect(result.success).toBe(true);
                expect(engine.grid[hint.row][hint.col]).toBe(hint.value);
            }
        });

        it('should track hint usage', () => {
            const initialHints = engine.hintsUsed;
            const hint = engine.getHint();
            if (hint.success) {
                engine.applyHint(hint);
                expect(engine.hintsUsed).toBe(initialHints + 1);
            }
        });
    });

    describe('Game Timer', () => {
        it('should initialize timer', () => {
            expect(engine.timer).toBeDefined();
            expect(engine.timer.startTime).toBe(0);
            expect(engine.timer.elapsedTime).toBe(0);
            expect(engine.timer.isRunning).toBe(false);
        });

        it('should start timer', () => {
            engine.startTimer();
            expect(engine.timer.isRunning).toBe(true);
            expect(engine.timer.startTime).toBeGreaterThan(0);
        });

        it('should pause timer', () => {
            engine.startTimer();
            expect(engine.timer.isRunning).toBe(true);
            
            engine.pauseTimer();
            expect(engine.timer.isRunning).toBe(false);
        });

        it('should resume timer', () => {
            engine.startTimer();
            engine.pauseTimer();
            expect(engine.timer.isRunning).toBe(false);
            
            engine.resumeTimer();
            expect(engine.timer.isRunning).toBe(true);
        });

        it('should stop timer', () => {
            engine.startTimer();
            await TestUtils.wait(50);
            const elapsedTime = engine.stopTimer();
            
            expect(engine.timer.isRunning).toBe(false);
            expect(elapsedTime).toBeGreaterThan(0);
        });

        it('should get formatted time', () => {
            engine.timer.elapsedTime = 125000; // 2 minutes 5 seconds
            const formatted = engine.getFormattedTime();
            expect(formatted).toContain('2:05');
        });
    });

    describe('Game State Serialization', () => {
        beforeEach(() => {
            engine.grid = [...testData.validSudokuGrid.map(row => [...row])];
            engine.solution = [...testData.solvedSudokuGrid.map(row => [...row])];
            engine.difficulty = 'hard';
            engine.startTimer();
        });

        it('should export game state', () => {
            const gameState = engine.exportGameState();
            expect(gameState.success).toBe(true);
            expect(gameState.data.grid).toEqual(engine.grid);
            expect(gameState.data.solution).toEqual(engine.solution);
            expect(gameState.data.difficulty).toBe('hard');
            expect(gameState.data.timer).toBeDefined();
        });

        it('should import game state', () => {
            const gameState = engine.exportGameState();
            const newEngine = new SudokuEngine();
            
            const result = newEngine.importGameState(gameState.data);
            expect(result.success).toBe(true);
            expect(newEngine.grid).toEqual(engine.grid);
            expect(newEngine.solution).toEqual(engine.solution);
            expect(newEngine.difficulty).toBe('hard');
        });

        it('should handle invalid import data', () => {
            const result = engine.importGameState({});
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid game state');
        });

        it('should preserve game statistics on import', () => {
            engine.hintsUsed = 3;
            engine.mistakeCount = 2;
            
            const gameState = engine.exportGameState();
            const newEngine = new SudokuEngine();
            newEngine.importGameState(gameState.data);
            
            expect(newEngine.hintsUsed).toBe(3);
            expect(newEngine.mistakeCount).toBe(2);
        });
    });

    describe('Puzzle Generation Interface', () => {
        it('should generate new puzzle', async () => {
            const result = await engine.generatePuzzle('easy');
            expect(result.success).toBe(true);
            expect(engine.grid).toBeDefined();
            expect(engine.solution).toBeDefined();
            expect(engine.difficulty).toBe('easy');
        });

        it('should handle generation errors', async () => {
            // Mock the puzzle generator to fail
            const originalGenerator = window.PuzzleGenerator;
            window.PuzzleGenerator = null;
            
            const result = await engine.generatePuzzle('medium');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Generator not available');
            
            // Restore original
            window.PuzzleGenerator = originalGenerator;
        });

        it('should set difficulty correctly', () => {
            engine.setDifficulty('expert');
            expect(engine.difficulty).toBe('expert');
        });

        it('should get difficulty levels', () => {
            const levels = engine.getDifficultyLevels();
            expect(levels).toContain('easy');
            expect(levels).toContain('medium');
            expect(levels).toContain('hard');
            expect(levels).toContain('expert');
        });
    });

    describe('Error Handling', () => {
        it('should handle out-of-bounds moves', () => {
            const result = engine.makeMove(-1, 0, 5);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid position');
        });

        it('should handle invalid values', () => {
            const result = engine.makeMove(0, 0, 10);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid value');
        });

        it('should handle null/undefined inputs', () => {
            const result = engine.makeMove(null, undefined, 5);
            expect(result.success).toBe(false);
        });

        it('should validate grid bounds', () => {
            expect(engine.isValidPosition(0, 0)).toBe(true);
            expect(engine.isValidPosition(8, 8)).toBe(true);
            expect(engine.isValidPosition(-1, 0)).toBe(false);
            expect(engine.isValidPosition(0, 9)).toBe(false);
        });
    });

    describe('Performance', () => {
        it('should validate moves quickly', () => {
            const startTime = performance.now();
            
            for (let i = 0; i < 1000; i++) {
                engine.isValidMove(Math.floor(Math.random() * 9), Math.floor(Math.random() * 9), Math.floor(Math.random() * 9) + 1);
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(100); // Should complete in under 100ms
        });

        it('should handle large number of moves efficiently', () => {
            const startTime = performance.now();
            
            // Make 100 valid moves
            let moves = 0;
            for (let row = 0; row < 9 && moves < 100; row++) {
                for (let col = 0; col < 9 && moves < 100; col++) {
                    if (engine.grid[row][col] === 0) {
                        for (let value = 1; value <= 9 && moves < 100; value++) {
                            if (engine.isValidMove(row, col, value)) {
                                engine.makeMove(row, col, value);
                                moves++;
                                break;
                            }
                        }
                    }
                }
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(50); // Should complete in under 50ms
        });
    });
});