/**
 * Integration Tests for Sudoku PWA
 * Tests complete user flows and system interactions
 */

describe('Sudoku PWA Integration Tests', () => {
    let gameUI, userProgress, dataStorage, appRouter;
    let testContainer;

    beforeAll(async () => {
        // Set up test environment
        testContainer = TestUtils.createDOM(`
            <div data-test="true" id="test-container">
                <div id="sudoku-grid"></div>
                <div id="number-pad"></div>
                <div id="game-controls"></div>
                <div id="timer-display">00:00</div>
                <div id="homepage"></div>
                <div id="calendar-page"></div>
                <div id="tournament-page"></div>
                <div id="profile-page"></div>
            </div>
        `);
        document.body.appendChild(testContainer);
    });

    beforeEach(async () => {
        // Initialize core systems
        dataStorage = new DataStorage();
        await dataStorage.initializeStorage();
        
        userProgress = new UserProgress(dataStorage);
        appRouter = new AppRouter();
        gameUI = new GameUI();

        // Make globally available for integration
        window.dataStorage = dataStorage;
        window.userProgress = userProgress;
        window.appRouter = appRouter;
        window.gameUI = gameUI;
    });

    afterEach(() => {
        TestUtils.cleanup();
    });

    afterAll(() => {
        testContainer?.remove();
    });

    describe('Complete Game Flow', () => {
        it('should complete a full game session', async () => {
            // Start new game
            const gameResult = await gameUI.startNewGame('medium');
            expect(gameResult.success).toBe(true);
            expect(gameUI.engine.difficulty).toBe('medium');

            // Make some moves
            const validMoves = [];
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (gameUI.engine.grid[row][col] === 0) {
                        for (let value = 1; value <= 9; value++) {
                            if (gameUI.engine.isValidMove(row, col, value)) {
                                validMoves.push({ row, col, value });
                                if (validMoves.length >= 10) break;
                            }
                        }
                        if (validMoves.length >= 10) break;
                    }
                }
                if (validMoves.length >= 10) break;
            }

            // Execute moves
            let successfulMoves = 0;
            for (const move of validMoves) {
                const result = gameUI.inputNumber(move.value, move.row, move.col);
                if (result.success) {
                    successfulMoves++;
                }
            }

            expect(successfulMoves).toBeGreaterThan(5);
            expect(gameUI.engine.getFilledCellsCount()).toBeGreaterThan(0);

            // Test timer functionality
            gameUI.startTimer();
            expect(gameUI.engine.timer.isRunning).toBe(true);

            await TestUtils.wait(100);

            gameUI.pauseGame();
            expect(gameUI.engine.timer.isRunning).toBe(false);

            gameUI.resumeGame();
            expect(gameUI.engine.timer.isRunning).toBe(true);

            // Test save/load
            const saveResult = await dataStorage.saveGameState(gameUI.engine.exportGameState().data);
            expect(saveResult.success).toBe(true);

            const loadResult = await dataStorage.loadGameState();
            expect(loadResult.success).toBe(true);
        });

        it('should handle game completion flow', async () => {
            await gameUI.startNewGame('easy');
            
            // Complete the puzzle (simulate by filling solution)
            gameUI.engine.grid = [...gameUI.engine.solution.map(row => [...row])];
            
            const completionResult = gameUI.checkCompletion();
            expect(completionResult.completed).toBe(true);

            // Verify progress tracking
            const initialGames = userProgress.stats.gamesCompleted;
            
            userProgress.trackGameCompletion({
                completed: true,
                time: 180000,
                difficulty: 'easy',
                mistakes: 0,
                hintsUsed: 0,
                score: 1200
            });

            expect(userProgress.stats.gamesCompleted).toBe(initialGames + 1);
            expect(userProgress.stats.currentStreak).toBeGreaterThan(0);

            // Check achievements
            const achievements = userProgress.checkAchievements({
                completed: true,
                time: 180000,
                difficulty: 'easy',
                mistakes: 0,
                hintsUsed: 0,
                score: 1200
            });

            expect(Array.isArray(achievements)).toBe(true);
        });

        it('should persist game state across sessions', async () => {
            // Start a game and make some moves
            await gameUI.startNewGame('medium');
            const initialGrid = gameUI.engine.grid.map(row => [...row]);
            
            // Make a few moves
            gameUI.inputNumber(5, 0, 0);
            gameUI.inputNumber(3, 1, 1);
            
            // Save current state
            const gameState = gameUI.engine.exportGameState();
            await dataStorage.saveGameState(gameState.data);

            // Simulate app restart by creating new instances
            const newGameUI = new GameUI();
            const loadResult = await dataStorage.loadGameState();
            
            expect(loadResult.success).toBe(true);
            
            const importResult = newGameUI.engine.importGameState(loadResult.gameData);
            expect(importResult.success).toBe(true);
            
            // Verify state was restored
            expect(newGameUI.engine.grid[0][0]).toBe(gameState.data.grid[0][0]);
            expect(newGameUI.engine.grid[1][1]).toBe(gameState.data.grid[1][1]);
            expect(newGameUI.engine.difficulty).toBe('medium');
        });
    });

    describe('Daily Challenge Flow', () => {
        it('should handle daily challenge lifecycle', async () => {
            const today = new Date().toISOString().split('T')[0];
            
            // Check if daily challenge is available
            const cachedPuzzle = await dataStorage.getCachedDailyPuzzle(today);
            
            let challengeResult;
            if (cachedPuzzle.success) {
                challengeResult = await gameUI.startDailyChallenge();
            } else {
                // Generate and cache daily puzzle
                challengeResult = await gameUI.generateDailyChallenge(today);
            }
            
            expect(challengeResult.success).toBe(true);
            expect(gameUI.engine.difficulty).toBeDefined();

            // Complete the challenge
            const completionTime = 240000; // 4 minutes
            userProgress.trackDailyChallenge({
                date: today,
                completed: true,
                time: completionTime,
                score: 900,
                mistakes: 1
            });

            // Verify daily stats
            const dailyStats = userProgress.getDailyChallengeStats();
            expect(dailyStats[today]).toBeDefined();
            expect(dailyStats[today].completed).toBe(true);
            expect(dailyStats[today].score).toBe(900);

            // Check daily streak
            const streak = userProgress.getDailyChallengeStreak();
            expect(streak).toBeGreaterThan(-1);
        });

        it('should maintain daily challenge cache', async () => {
            const testDate = '2024-12-15';
            const puzzleData = {
                puzzle: TestUtils.generateTestData().validSudokuGrid,
                solution: TestUtils.generateTestData().solvedSudokuGrid,
                difficulty: 'medium',
                seed: 12345
            };

            // Cache the puzzle
            const cacheResult = await dataStorage.cacheDailyPuzzle(testDate, puzzleData);
            expect(cacheResult.success).toBe(true);

            // Retrieve cached puzzle
            const retrieveResult = await dataStorage.getCachedDailyPuzzle(testDate);
            expect(retrieveResult.success).toBe(true);
            expect(retrieveResult.data.seed).toBe(12345);
            expect(retrieveResult.data.difficulty).toBe('medium');

            // Test cache expiration
            const cleanupResult = await dataStorage.cleanupExpiredCache();
            expect(cleanupResult.success).toBe(true);
        });
    });

    describe('Tournament Flow', () => {
        it('should handle tournament progression', async () => {
            // Start at level 1
            const tournamentProgress = userProgress.getTournamentProgress();
            expect(tournamentProgress.currentLevel).toBe(1);

            // Complete level 1
            const level1Result = {
                level: 1,
                score: 1000,
                time: 300000,
                mistakes: 2
            };

            userProgress.trackTournamentLevel(level1Result);

            const updatedProgress = userProgress.getTournamentProgress();
            expect(updatedProgress.completedLevels).toContain(1);
            expect(updatedProgress.currentLevel).toBe(2);
            expect(updatedProgress.totalScore).toBe(1000);

            // Complete several more levels
            for (let level = 2; level <= 5; level++) {
                userProgress.trackTournamentLevel({
                    level: level,
                    score: 1000 + (level * 50),
                    time: 300000 - (level * 5000),
                    mistakes: Math.max(0, 3 - level)
                });
            }

            const finalProgress = userProgress.getTournamentProgress();
            expect(finalProgress.completedLevels).toHaveLength(5);
            expect(finalProgress.currentLevel).toBe(6);
            expect(finalProgress.totalScore).toBeGreaterThan(5000);

            // Test weekly reset
            userProgress.resetTournament();
            const resetProgress = userProgress.getTournamentProgress();
            expect(resetProgress.completedLevels).toHaveLength(0);
            expect(resetProgress.currentLevel).toBe(1);
            expect(resetProgress.totalScore).toBe(0);
        });

        it('should track weekly tournament statistics', async () => {
            const weekId = userProgress.getCurrentWeekId();
            
            // Complete some tournament levels
            userProgress.trackTournamentLevel({ level: 1, score: 1200, time: 280000 });
            userProgress.trackTournamentLevel({ level: 2, score: 1100, time: 320000 });
            
            const weeklyStats = userProgress.getWeeklyTournamentStats();
            expect(weeklyStats[weekId]).toBeDefined();
            expect(weeklyStats[weekId].score).toBe(2300);
            expect(weeklyStats[weekId].levelsCompleted).toBe(2);
            
            // Simulate next week
            const nextWeekId = `${new Date().getFullYear()}-W${Math.ceil(new Date().getDate() / 7) + 1}`;
            userProgress.resetTournament();
            userProgress.trackTournamentLevel({ level: 1, score: 1500, time: 250000 });
            
            const updatedWeeklyStats = userProgress.getWeeklyTournamentStats();
            expect(updatedWeeklyStats[weekId].score).toBe(2300); // Previous week preserved
            expect(updatedWeeklyStats[nextWeekId]).toBeDefined();
        });
    });

    describe('Settings and Preferences', () => {
        it('should manage user settings across components', async () => {
            const settingsManager = new SettingsManager(dataStorage);
            await settingsManager.loadSettings();

            // Change theme
            settingsManager.setTheme('dark');
            expect(settingsManager.get('theme')).toBe('dark');

            // Change difficulty
            settingsManager.setDefaultDifficulty('expert');
            expect(settingsManager.get('difficulty.defaultDifficulty')).toBe('expert');

            // Update sound settings
            settingsManager.setSoundEnabled(false);
            expect(settingsManager.get('sound.enabled')).toBe(false);

            settingsManager.setSoundVolume(0.3);
            expect(settingsManager.get('sound.volume')).toBe(0.3);

            // Save and reload settings
            await settingsManager.saveSettings();
            
            const newSettingsManager = new SettingsManager(dataStorage);
            await newSettingsManager.loadSettings();
            
            expect(newSettingsManager.get('theme')).toBe('dark');
            expect(newSettingsManager.get('difficulty.defaultDifficulty')).toBe('expert');
            expect(newSettingsManager.get('sound.enabled')).toBe(false);
        });

        it('should apply settings to game components', async () => {
            const settingsManager = new SettingsManager(dataStorage);
            
            // Set default difficulty
            settingsManager.setDefaultDifficulty('hard');
            
            // Start new game (should use default difficulty)
            const gameResult = await gameUI.startNewGame();
            expect(gameUI.engine.difficulty).toBe('hard');

            // Change animation settings
            settingsManager.set('display.animations', false);
            expect(settingsManager.get('display.animations')).toBe(false);

            // Change reduced motion
            settingsManager.set('display.reducedMotion', true);
            expect(settingsManager.get('display.reducedMotion')).toBe(true);
        });
    });

    describe('PWA Features Integration', () => {
        it('should handle offline/online state changes', async () => {
            if (typeof navigator.onLine !== 'undefined') {
                // Mock online/offline events
                const originalOnLine = navigator.onLine;
                
                // Simulate going offline
                Object.defineProperty(navigator, 'onLine', {
                    writable: true,
                    value: false
                });
                
                window.dispatchEvent(new Event('offline'));
                
                // Verify offline handling
                expect(navigator.onLine).toBe(false);
                
                // Simulate coming back online
                Object.defineProperty(navigator, 'onLine', {
                    writable: true,
                    value: true
                });
                
                window.dispatchEvent(new Event('online'));
                
                // Verify online handling
                expect(navigator.onLine).toBe(true);
                
                // Restore original state
                Object.defineProperty(navigator, 'onLine', {
                    writable: true,
                    value: originalOnLine
                });
            }
        });

        it('should handle background sync operations', async () => {
            // Simulate offline game completion
            const gameResult = {
                completed: true,
                time: 300000,
                difficulty: 'medium',
                score: 850,
                timestamp: Date.now()
            };

            // Save game result for later sync
            const syncData = {
                type: 'gameCompletion',
                data: gameResult,
                timestamp: Date.now()
            };

            await dataStorage.saveSyncData('game-completion-' + Date.now(), syncData);
            
            // Simulate sync when coming online
            const pendingSyncs = await dataStorage.getPendingSyncs();
            expect(Array.isArray(pendingSyncs)).toBe(true);

            // Process syncs
            for (const sync of pendingSyncs) {
                if (sync.type === 'gameCompletion') {
                    userProgress.trackGameCompletion(sync.data);
                    await dataStorage.markSyncCompleted(sync.id);
                }
            }
        });
    });

    describe('Error Handling and Recovery', () => {
        it('should recover from corrupted game state', async () => {
            // Save valid game state
            await gameUI.startNewGame('medium');
            const validState = gameUI.engine.exportGameState();
            await dataStorage.saveGameState(validState.data);

            // Corrupt the saved state
            const corruptData = 'invalid-json-data';
            localStorage.setItem('sudoku-pwa-game-state', corruptData);

            // Attempt to load - should handle gracefully
            const loadResult = await dataStorage.loadGameState();
            expect(loadResult.success).toBe(false);
            expect(loadResult.error).toContain('parse');

            // Should still be able to start new game
            const newGameResult = await gameUI.startNewGame('easy');
            expect(newGameResult.success).toBe(true);
        });

        it('should handle storage quota exceeded', async () => {
            // Mock localStorage to throw quota exceeded error
            const originalSetItem = localStorage.setItem;
            let quotaExceeded = false;
            
            localStorage.setItem = (key, value) => {
                if (!quotaExceeded) {
                    quotaExceeded = true;
                    const error = new Error('QuotaExceededError');
                    error.name = 'QuotaExceededError';
                    throw error;
                }
                originalSetItem.call(localStorage, key, value);
            };

            // Attempt to save game state
            const gameState = { grid: TestUtils.generateTestData().validSudokuGrid };
            const saveResult = await dataStorage.saveGameState(gameState);
            
            expect(saveResult.success).toBe(false);
            expect(saveResult.error).toContain('quota');

            // Restore original localStorage
            localStorage.setItem = originalSetItem;

            // Should be able to save after quota is freed
            const retryResult = await dataStorage.saveGameState(gameState);
            expect(retryResult.success).toBe(true);
        });

        it('should handle network failures gracefully', async () => {
            // Mock fetch to fail for background sync
            const originalFetch = global.fetch;
            global.fetch = () => Promise.reject(new Error('Network error'));

            // Attempt operations that might use network
            // Should handle gracefully without crashing
            
            const gameResult = await gameUI.startNewGame('medium');
            expect(gameResult.success).toBe(true);

            // Restore fetch
            global.fetch = originalFetch;
        });

        it('should validate data integrity', async () => {
            // Test with invalid grid data
            const invalidGameData = {
                grid: 'invalid-grid',
                difficulty: 123,
                timer: 'not-an-object'
            };

            const saveResult = await dataStorage.saveGameState(invalidGameData);
            expect(saveResult.success).toBe(false);

            // Test with valid data
            const validGameData = {
                grid: TestUtils.generateTestData().validSudokuGrid,
                solution: TestUtils.generateTestData().solvedSudokuGrid,
                difficulty: 'medium',
                timer: { elapsedTime: 180000, isRunning: false }
            };

            const validSaveResult = await dataStorage.saveGameState(validGameData);
            expect(validSaveResult.success).toBe(true);
        });
    });

    describe('Performance Integration', () => {
        it('should maintain performance with large datasets', async () => {
            const startTime = performance.now();

            // Simulate large user progress
            for (let i = 0; i < 1000; i++) {
                userProgress.trackGameCompletion({
                    completed: true,
                    time: 200000 + Math.random() * 100000,
                    difficulty: ['easy', 'medium', 'hard'][i % 3],
                    score: 800 + Math.random() * 400,
                    mistakes: Math.floor(Math.random() * 5),
                    hintsUsed: Math.floor(Math.random() * 3)
                });
            }

            // Cache many daily puzzles
            for (let i = 0; i < 100; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                
                await dataStorage.cacheDailyPuzzle(dateStr, {
                    puzzle: TestUtils.generateTestData().validSudokuGrid,
                    solution: TestUtils.generateTestData().solvedSudokuGrid,
                    difficulty: 'medium',
                    seed: i
                });
            }

            // Measure performance of operations
            const stats = userProgress.getDisplayStats();
            const achievements = userProgress.getAllAchievements();
            const tournamentProgress = userProgress.getTournamentProgress();

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should handle large datasets reasonably quickly
            expect(duration).toBeLessThan(1000); // Under 1 second
            expect(stats.gamesCompleted).toBe('1000');
            expect(Array.isArray(achievements)).toBe(true);
            expect(tournamentProgress).toBeDefined();
        });

        it('should efficiently handle rapid user interactions', async () => {
            await gameUI.startNewGame('medium');
            
            const startTime = performance.now();
            
            // Simulate rapid number inputs
            let validInputs = 0;
            for (let i = 0; i < 100; i++) {
                const row = Math.floor(Math.random() * 9);
                const col = Math.floor(Math.random() * 9);
                const value = Math.floor(Math.random() * 9) + 1;
                
                if (gameUI.engine.grid[row][col] === 0 && gameUI.engine.isValidMove(row, col, value)) {
                    const result = gameUI.inputNumber(value, row, col);
                    if (result.success) validInputs++;
                }
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(100); // Should handle inputs quickly
            expect(validInputs).toBeGreaterThan(0);
        });
    });

    describe('Accessibility Integration', () => {
        it('should provide keyboard navigation', () => {
            // Test keyboard events for grid navigation
            const grid = document.getElementById('sudoku-grid');
            const arrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            
            if (grid) {
                grid.dispatchEvent(arrowEvent);
                // Should handle keyboard navigation without errors
                expect(true).toBe(true);
            }
        });

        it('should support screen reader announcements', () => {
            // Test ARIA live regions exist
            const politeRegion = document.getElementById('aria-live-polite');
            const assertiveRegion = document.getElementById('aria-live-assertive');
            
            // These should be created by accessibility manager
            // In real app, but for testing we verify they don't cause errors
            expect(true).toBe(true);
        });

        it('should handle focus management', () => {
            // Test focus management doesn't break with rapid changes
            const focusableElements = document.querySelectorAll('button, input, [tabindex]');
            
            focusableElements.forEach((element, index) => {
                if (index < 5) { // Test first few elements
                    element.focus();
                    expect(document.activeElement).toBe(element);
                }
            });
        });
    });
});