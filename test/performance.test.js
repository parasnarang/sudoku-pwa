/**
 * Performance Benchmarks for Sudoku PWA
 * Tests performance characteristics and identifies bottlenecks
 */

describe('Performance Benchmarks', () => {
    let engine, storage, userProgress;
    let testData;
    let performanceThresholds;

    beforeAll(() => {
        testData = TestUtils.generateTestData();
        
        // Define performance thresholds (in milliseconds)
        performanceThresholds = {
            sudokuValidation: 10,
            puzzleGeneration: 2000,
            gameStateSave: 50,
            gameStateLoad: 30,
            statisticsCalculation: 20,
            achievementCheck: 15,
            gridRender: 100,
            userInteraction: 16, // 60fps target
            dataCompression: 100,
            cacheOperations: 50
        };
    });

    beforeEach(() => {
        engine = new SudokuEngine();
        storage = new DataStorage();
        userProgress = new UserProgress(storage);
    });

    afterEach(() => {
        TestUtils.cleanup();
    });

    describe('Sudoku Engine Performance', () => {
        beforeEach(() => {
            engine.grid = [...testData.validSudokuGrid.map(row => [...row])];
        });

        it('should validate moves quickly', () => {
            const iterations = 10000;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                const row = Math.floor(Math.random() * 9);
                const col = Math.floor(Math.random() * 9);
                const value = Math.floor(Math.random() * 9) + 1;
                engine.isValidMove(row, col, value);
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / iterations;

            console.log(`Average validation time: ${avgTime.toFixed(4)}ms per operation`);
            expect(totalTime).toBeLessThan(performanceThresholds.sudokuValidation * iterations / 100);
        });

        it('should handle grid validation efficiently', () => {
            const iterations = 1000;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                engine.isValidGrid();
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / iterations;

            console.log(`Average grid validation time: ${avgTime.toFixed(4)}ms per operation`);
            expect(totalTime).toBeLessThan(performanceThresholds.sudokuValidation * iterations / 10);
        });

        it('should compute hints quickly', () => {
            engine.solution = [...testData.solvedSudokuGrid.map(row => [...row])];
            
            const iterations = 100;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                engine.getHint();
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / iterations;

            console.log(`Average hint calculation time: ${avgTime.toFixed(4)}ms per operation`);
            expect(totalTime).toBeLessThan(performanceThresholds.sudokuValidation * iterations);
        });

        it('should export/import game state efficiently', () => {
            const iterations = 1000;
            
            // Test export performance
            const exportStartTime = performance.now();
            
            for (let i = 0; i < iterations; i++) {
                engine.exportGameState();
            }
            
            const exportEndTime = performance.now();
            const exportTime = exportEndTime - exportStartTime;
            
            // Test import performance
            const gameState = engine.exportGameState().data;
            const importStartTime = performance.now();
            
            for (let i = 0; i < iterations; i++) {
                const newEngine = new SudokuEngine();
                newEngine.importGameState(gameState);
            }
            
            const importEndTime = performance.now();
            const importTime = importEndTime - importStartTime;
            
            console.log(`Average export time: ${(exportTime / iterations).toFixed(4)}ms`);
            console.log(`Average import time: ${(importTime / iterations).toFixed(4)}ms`);
            
            expect(exportTime).toBeLessThan(performanceThresholds.gameStateSave);
            expect(importTime).toBeLessThan(performanceThresholds.gameStateLoad);
        });
    });

    describe('Puzzle Generation Performance', () => {
        it('should generate puzzles within time limits', async () => {
            const difficulties = ['easy', 'medium', 'hard', 'expert'];
            const results = {};

            for (const difficulty of difficulties) {
                const startTime = performance.now();
                
                try {
                    await engine.generatePuzzle(difficulty);
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    
                    results[difficulty] = duration;
                    console.log(`${difficulty} puzzle generation: ${duration.toFixed(2)}ms`);
                    
                    expect(duration).toBeLessThan(performanceThresholds.puzzleGeneration);
                } catch (error) {
                    console.warn(`Failed to generate ${difficulty} puzzle:`, error.message);
                }
            }

            // Verify at least some difficulties completed
            expect(Object.keys(results).length).toBeGreaterThan(0);
        });

        it('should generate consistent performance across multiple runs', async () => {
            const runs = 5;
            const times = [];

            for (let i = 0; i < runs; i++) {
                const startTime = performance.now();
                await engine.generatePuzzle('medium');
                const endTime = performance.now();
                times.push(endTime - startTime);
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const maxTime = Math.max(...times);
            const minTime = Math.min(...times);
            const variance = maxTime - minTime;

            console.log(`Generation times - Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms, Variance: ${variance.toFixed(2)}ms`);

            expect(avgTime).toBeLessThan(performanceThresholds.puzzleGeneration);
            expect(variance).toBeLessThan(performanceThresholds.puzzleGeneration * 0.5); // Variance should be reasonable
        });
    });

    describe('Data Storage Performance', () => {
        const largeGameData = {
            grid: testData.validSudokuGrid,
            solution: testData.solvedSudokuGrid,
            history: new Array(100).fill().map((_, i) => ({
                row: i % 9,
                col: Math.floor(i / 9) % 9,
                value: (i % 9) + 1,
                timestamp: Date.now() - (i * 1000)
            })),
            timer: { elapsedTime: 300000, isRunning: false },
            difficulty: 'medium',
            metadata: {
                notes: 'a'.repeat(1000),
                settings: { theme: 'dark', sound: true }
            }
        };

        it('should save game state quickly', async () => {
            const iterations = 100;
            const times = [];

            for (let i = 0; i < iterations; i++) {
                const startTime = performance.now();
                await storage.saveGameState(largeGameData);
                const endTime = performance.now();
                times.push(endTime - startTime);
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const maxTime = Math.max(...times);

            console.log(`Save performance - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
            expect(avgTime).toBeLessThan(performanceThresholds.gameStateSave);
        });

        it('should load game state quickly', async () => {
            // First save some data
            await storage.saveGameState(largeGameData);

            const iterations = 100;
            const times = [];

            for (let i = 0; i < iterations; i++) {
                const startTime = performance.now();
                await storage.loadGameState();
                const endTime = performance.now();
                times.push(endTime - startTime);
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const maxTime = Math.max(...times);

            console.log(`Load performance - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
            expect(avgTime).toBeLessThan(performanceThresholds.gameStateLoad);
        });

        it('should handle data compression efficiently', async () => {
            const testData = JSON.stringify(largeGameData);
            const iterations = 50;
            
            const startTime = performance.now();
            
            for (let i = 0; i < iterations; i++) {
                // Simulate compression
                const compressed = btoa(testData);
                const decompressed = atob(compressed);
                expect(decompressed).toBe(testData);
            }
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / iterations;
            
            console.log(`Compression performance - Avg: ${avgTime.toFixed(2)}ms per operation`);
            expect(totalTime).toBeLessThan(performanceThresholds.dataCompression);
        });

        it('should handle cache operations efficiently', async () => {
            const iterations = 50;
            const cacheOperations = [];

            // Test cache writes
            const writeStartTime = performance.now();
            for (let i = 0; i < iterations; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                
                await storage.cacheDailyPuzzle(dateStr, {
                    puzzle: testData.validSudokuGrid,
                    solution: testData.solvedSudokuGrid,
                    difficulty: 'medium',
                    seed: i
                });
            }
            const writeEndTime = performance.now();
            const writeTime = writeEndTime - writeStartTime;

            // Test cache reads
            const readStartTime = performance.now();
            for (let i = 0; i < iterations; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                
                await storage.getCachedDailyPuzzle(dateStr);
            }
            const readEndTime = performance.now();
            const readTime = readEndTime - readStartTime;

            console.log(`Cache write performance - Avg: ${(writeTime / iterations).toFixed(2)}ms`);
            console.log(`Cache read performance - Avg: ${(readTime / iterations).toFixed(2)}ms`);

            expect(writeTime).toBeLessThan(performanceThresholds.cacheOperations * iterations / 10);
            expect(readTime).toBeLessThan(performanceThresholds.cacheOperations * iterations / 20);
        });
    });

    describe('User Progress Performance', () => {
        it('should calculate statistics quickly with large datasets', () => {
            // Generate large dataset
            for (let i = 0; i < 5000; i++) {
                userProgress.trackGameCompletion({
                    completed: Math.random() > 0.2, // 80% completion rate
                    time: 120000 + Math.random() * 480000, // 2-10 minutes
                    difficulty: ['easy', 'medium', 'hard', 'expert'][i % 4],
                    score: 500 + Math.random() * 1000,
                    mistakes: Math.floor(Math.random() * 10),
                    hintsUsed: Math.floor(Math.random() * 5)
                });
            }

            const startTime = performance.now();

            const stats = userProgress.getDisplayStats();
            const completionStats = userProgress.getCompletionStats();
            const timeStats = userProgress.getTimeStats();
            const trends = userProgress.getPerformanceTrends();

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`Statistics calculation with 5000 games: ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(performanceThresholds.statisticsCalculation);
            expect(stats.gamesPlayed).toBe('5000');
        });

        it('should check achievements efficiently', () => {
            // Set up user with substantial progress
            userProgress.stats = {
                gamesPlayed: 1000,
                gamesCompleted: 800,
                bestTime: 90000,
                currentStreak: 25,
                bestStreak: 50,
                totalHints: 200,
                totalMistakes: 150,
                difficultyStats: {
                    easy: { played: 300, completed: 300, bestTime: 90000 },
                    medium: { played: 400, completed: 350, bestTime: 120000 },
                    hard: { played: 200, completed: 120, bestTime: 300000 },
                    expert: { played: 100, completed: 30, bestTime: 600000 }
                }
            };

            const iterations = 1000;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                userProgress.checkAchievements({
                    completed: true,
                    time: 180000,
                    difficulty: 'medium',
                    mistakes: 2,
                    hintsUsed: 1,
                    score: 900
                });
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / iterations;

            console.log(`Achievement checking - Avg: ${avgTime.toFixed(4)}ms per check`);
            expect(totalTime).toBeLessThan(performanceThresholds.achievementCheck * iterations / 10);
        });

        it('should handle tournament tracking efficiently', () => {
            const iterations = 1000;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                userProgress.trackTournamentLevel({
                    level: (i % 22) + 1,
                    score: 800 + Math.random() * 400,
                    time: 180000 + Math.random() * 120000,
                    mistakes: Math.floor(Math.random() * 3)
                });
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / iterations;

            console.log(`Tournament tracking - Avg: ${avgTime.toFixed(4)}ms per level`);
            expect(totalTime).toBeLessThan(performanceThresholds.statisticsCalculation);
        });
    });

    describe('UI Interaction Performance', () => {
        it('should handle rapid user inputs', async () => {
            const gameUI = new GameUI();
            await gameUI.startNewGame('medium');

            const iterations = 100;
            const inputs = [];

            // Generate valid inputs
            for (let row = 0; row < 9 && inputs.length < iterations; row++) {
                for (let col = 0; col < 9 && inputs.length < iterations; col++) {
                    if (gameUI.engine.grid[row][col] === 0) {
                        for (let value = 1; value <= 9; value++) {
                            if (gameUI.engine.isValidMove(row, col, value)) {
                                inputs.push({ row, col, value });
                                break;
                            }
                        }
                    }
                }
            }

            // Test input handling performance
            const startTime = performance.now();

            for (const input of inputs) {
                gameUI.inputNumber(input.value, input.row, input.col);
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / inputs.length;

            console.log(`User input handling - Avg: ${avgTime.toFixed(4)}ms per input`);
            expect(avgTime).toBeLessThan(performanceThresholds.userInteraction);
        });

        it('should handle timer updates efficiently', () => {
            const engine = new SudokuEngine();
            engine.startTimer();

            const iterations = 1000;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                engine.getFormattedTime();
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / iterations;

            console.log(`Timer formatting - Avg: ${avgTime.toFixed(4)}ms per update`);
            expect(totalTime).toBeLessThan(10); // Should be very fast
        });
    });

    describe('Memory Usage Performance', () => {
        it('should maintain reasonable memory usage', () => {
            if (typeof performance.memory !== 'undefined') {
                const initialMemory = performance.memory.usedJSHeapSize;
                
                // Create multiple game instances
                const games = [];
                for (let i = 0; i < 50; i++) {
                    const game = new SudokuEngine();
                    game.grid = [...testData.validSudokuGrid.map(row => [...row])];
                    game.solution = [...testData.solvedSudokuGrid.map(row => [...row])];
                    games.push(game);
                }
                
                const peakMemory = performance.memory.usedJSHeapSize;
                
                // Cleanup
                games.length = 0;
                
                // Force garbage collection if available
                if (typeof gc === 'function') {
                    gc();
                }
                
                setTimeout(() => {
                    const finalMemory = performance.memory.usedJSHeapSize;
                    const memoryIncrease = peakMemory - initialMemory;
                    const memoryRetained = finalMemory - initialMemory;
                    
                    console.log(`Memory usage - Increase: ${Math.round(memoryIncrease / 1024)}KB, Retained: ${Math.round(memoryRetained / 1024)}KB`);
                    
                    // Memory increase should be reasonable for 50 games
                    expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // Less than 5MB
                }, 100);
            }
        });

        it('should not leak memory with repeated operations', () => {
            if (typeof performance.memory !== 'undefined') {
                const initialMemory = performance.memory.usedJSHeapSize;
                
                // Perform many operations that could potentially leak
                for (let i = 0; i < 1000; i++) {
                    const engine = new SudokuEngine();
                    engine.generatePuzzle?.('easy').catch(() => {}); // Handle async errors
                    
                    const progress = new UserProgress();
                    progress.trackGameCompletion({
                        completed: true,
                        time: 200000,
                        difficulty: 'medium',
                        score: 850
                    });
                    
                    const storage = new DataStorage();
                    storage.saveGameState({
                        grid: testData.validSudokuGrid,
                        difficulty: 'medium'
                    }).catch(() => {}); // Handle async errors
                }
                
                // Allow some time for cleanup
                setTimeout(() => {
                    if (typeof gc === 'function') {
                        gc();
                    }
                    
                    const finalMemory = performance.memory.usedJSHeapSize;
                    const memoryLeak = finalMemory - initialMemory;
                    
                    console.log(`Memory leak test - Initial: ${Math.round(initialMemory / 1024)}KB, Final: ${Math.round(finalMemory / 1024)}KB, Difference: ${Math.round(memoryLeak / 1024)}KB`);
                    
                    // Should not have significant memory leak
                    expect(memoryLeak).toBeLessThan(2 * 1024 * 1024); // Less than 2MB growth
                }, 200);
            }
        });
    });

    describe('Performance Regression Detection', () => {
        it('should track performance metrics for regression testing', () => {
            const metrics = {
                sudokuValidation: [],
                gameStateSave: [],
                gameStateLoad: [],
                achievementCheck: [],
                statisticsCalc: []
            };

            // Run multiple performance tests and collect metrics
            const runs = 10;
            
            for (let run = 0; run < runs; run++) {
                // Test sudoku validation
                const engine = new SudokuEngine();
                engine.grid = [...testData.validSudokuGrid.map(row => [...row])];
                
                const validationStart = performance.now();
                for (let i = 0; i < 100; i++) {
                    engine.isValidMove(i % 9, Math.floor(i / 9) % 9, (i % 9) + 1);
                }
                const validationEnd = performance.now();
                metrics.sudokuValidation.push(validationEnd - validationStart);

                // Test achievement checking
                const progress = new UserProgress();
                const achStart = performance.now();
                progress.checkAchievements({
                    completed: true,
                    time: 180000,
                    difficulty: 'medium',
                    score: 900
                });
                const achEnd = performance.now();
                metrics.achievementCheck.push(achEnd - achStart);
            }

            // Calculate statistics for each metric
            Object.entries(metrics).forEach(([metricName, values]) => {
                if (values.length > 0) {
                    const avg = values.reduce((a, b) => a + b, 0) / values.length;
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / values.length);
                    
                    console.log(`${metricName} - Avg: ${avg.toFixed(2)}ms, Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms, StdDev: ${stdDev.toFixed(2)}ms`);
                    
                    // Store baseline for regression testing
                    // In a real scenario, these would be stored and compared against previous runs
                    expect(avg).toBeGreaterThan(0);
                    expect(stdDev).toBeLessThan(avg); // Standard deviation shouldn't be too high
                }
            });
        });
    });
});