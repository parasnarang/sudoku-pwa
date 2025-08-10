/**
 * Unit Tests for Data Storage System
 * Tests localStorage operations, game state persistence, and backup functionality
 */

describe('Data Storage System', () => {
    let storage;
    let mockGameUI;
    let testData;

    beforeAll(() => {
        testData = TestUtils.generateTestData();
    });

    beforeEach(() => {
        storage = new DataStorage();
        mockGameUI = {
            engine: {
                exportGameState: TestUtils.mockFunction(() => ({
                    success: true,
                    data: { grid: testData.validSudokuGrid, difficulty: 'medium' }
                }))
            }
        };
    });

    afterEach(() => {
        TestUtils.cleanup();
        localStorage.clear();
    });

    describe('Initialization', () => {
        it('should initialize with correct version and prefix', () => {
            expect(storage.version).toBe('1.0.0');
            expect(storage.prefix).toBe('sudoku-pwa');
            expect(storage.maxCacheAge).toBeGreaterThan(0);
        });

        it('should initialize storage on setup', async () => {
            const result = await storage.initializeStorage();
            expect(result.success).toBe(true);
        });

        it('should handle storage initialization errors', async () => {
            // Mock localStorage to throw error
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = () => { throw new Error('Storage full'); };
            
            const result = await storage.initializeStorage();
            expect(result.success).toBe(false);
            expect(result.error).toContain('Storage full');
            
            // Restore original
            localStorage.setItem = originalSetItem;
        });
    });

    describe('Game State Persistence', () => {
        const mockGameData = {
            grid: testData.validSudokuGrid,
            solution: testData.solvedSudokuGrid,
            difficulty: 'medium',
            timer: { elapsedTime: 180000 }
        };

        it('should save game state successfully', async () => {
            const result = await storage.saveGameState(mockGameData);
            expect(result.success).toBe(true);
            expect(result.timestamp).toBeDefined();
        });

        it('should load saved game state', async () => {
            await storage.saveGameState(mockGameData);
            const result = await storage.loadGameState();
            
            expect(result.success).toBe(true);
            expect(result.gameData.grid).toEqual(mockGameData.grid);
            expect(result.gameData.difficulty).toBe('medium');
        });

        it('should handle missing game state', async () => {
            const result = await storage.loadGameState();
            expect(result.success).toBe(false);
            expect(result.error).toContain('No saved game found');
        });

        it('should clear game state', async () => {
            await storage.saveGameState(mockGameData);
            const clearResult = await storage.clearGameState();
            expect(clearResult.success).toBe(true);
            
            const loadResult = await storage.loadGameState();
            expect(loadResult.success).toBe(false);
        });

        it('should auto-save game periodically', async () => {
            storage.startAutoSave(mockGameUI);
            expect(storage.autoSaveInterval).toBeDefined();
            
            // Wait for auto-save to trigger
            await TestUtils.wait(storage.autoSaveInterval + 100);
            
            expect(mockGameUI.engine.exportGameState.calls.length).toBeGreaterThan(0);
            
            storage.stopAutoSave();
        });

        it('should compress game data when saving', async () => {
            const result = await storage.saveGameState(mockGameData);
            expect(result.success).toBe(true);
            
            // Check if compressed data is smaller than original
            const savedKey = `${storage.prefix}-game-state`;
            const savedData = localStorage.getItem(savedKey);
            const originalSize = JSON.stringify(mockGameData).length;
            
            expect(savedData.length).toBeLessThan(originalSize);
        });
    });

    describe('User Progress Tracking', () => {
        const mockProgress = {
            stats: testData.userProgressData.stats,
            achievements: ['first_win', 'speed_demon'],
            settings: { theme: 'dark', difficulty: 'hard' }
        };

        it('should save user progress', async () => {
            const result = await storage.saveUserProgress(mockProgress);
            expect(result.success).toBe(true);
        });

        it('should load user progress', async () => {
            await storage.saveUserProgress(mockProgress);
            const result = await storage.loadUserProgress();
            
            expect(result.success).toBe(true);
            expect(result.data.stats.gamesPlayed).toBe(25);
            expect(result.data.achievements).toContain('first_win');
        });

        it('should merge progress data', async () => {
            await storage.saveUserProgress(mockProgress);
            
            const updateData = {
                stats: { gamesPlayed: 30, newStat: 'test' },
                achievements: ['new_achievement']
            };
            
            const result = await storage.updateUserProgress(updateData);
            expect(result.success).toBe(true);
            
            const loadResult = await storage.loadUserProgress();
            expect(loadResult.data.stats.gamesPlayed).toBe(30);
            expect(loadResult.data.achievements).toContain('new_achievement');
            expect(loadResult.data.achievements).toContain('first_win'); // Should preserve existing
        });
    });

    describe('Daily Challenge Cache', () => {
        const mockPuzzleData = {
            puzzle: testData.validSudokuGrid,
            solution: testData.solvedSudokuGrid,
            difficulty: 'medium',
            seed: 123456
        };

        it('should cache daily puzzle', async () => {
            const date = new Date().toISOString().split('T')[0];
            const result = await storage.cacheDailyPuzzle(date, mockPuzzleData);
            expect(result.success).toBe(true);
        });

        it('should retrieve cached daily puzzle', async () => {
            const date = new Date().toISOString().split('T')[0];
            await storage.cacheDailyPuzzle(date, mockPuzzleData);
            
            const result = await storage.getCachedDailyPuzzle(date);
            expect(result.success).toBe(true);
            expect(result.data.difficulty).toBe('medium');
            expect(result.data.seed).toBe(123456);
        });

        it('should handle missing cached puzzle', async () => {
            const result = await storage.getCachedDailyPuzzle('2024-01-01');
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should clean up expired cache entries', async () => {
            const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago
            const oldDateStr = oldDate.toISOString().split('T')[0];
            
            await storage.cacheDailyPuzzle(oldDateStr, mockPuzzleData);
            
            const cleanupResult = await storage.cleanupExpiredCache();
            expect(cleanupResult.success).toBe(true);
            expect(cleanupResult.cleaned.dailyPuzzles).toBeGreaterThan(0);
            
            // Verify old cache was removed
            const getResult = await storage.getCachedDailyPuzzle(oldDateStr);
            expect(getResult.success).toBe(false);
        });
    });

    describe('Settings Management', () => {
        const mockSettings = {
            theme: 'dark',
            difficulty: 'hard',
            sound: { enabled: true, volume: 0.8 },
            display: { animations: true, fontSize: 'large' }
        };

        it('should save settings', async () => {
            const result = await storage.saveSettings(mockSettings);
            expect(result.success).toBe(true);
        });

        it('should load settings', async () => {
            await storage.saveSettings(mockSettings);
            const result = await storage.loadSettings();
            
            expect(result.success).toBe(true);
            expect(result.data.theme).toBe('dark');
            expect(result.data.sound.volume).toBe(0.8);
        });

        it('should handle missing settings', async () => {
            const result = await storage.loadSettings();
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should update individual settings', async () => {
            await storage.saveSettings(mockSettings);
            
            const result = await storage.updateSetting('theme', 'light');
            expect(result.success).toBe(true);
            
            const loadResult = await storage.loadSettings();
            expect(loadResult.data.theme).toBe('light');
            expect(loadResult.data.difficulty).toBe('hard'); // Should preserve other settings
        });
    });

    describe('Backup and Restore', () => {
        const mockData = {
            gameState: { grid: testData.validSudokuGrid, difficulty: 'medium' },
            userProgress: testData.userProgressData,
            settings: { theme: 'dark', sound: { enabled: true } }
        };

        beforeEach(async () => {
            await storage.saveGameState(mockData.gameState);
            await storage.saveUserProgress(mockData.userProgress);
            await storage.saveSettings(mockData.settings);
        });

        it('should create backup', async () => {
            const result = await storage.createBackup();
            expect(result.success).toBe(true);
            expect(result.blob).toBeInstanceOf(Blob);
            
            // Verify backup contains data
            const text = await result.blob.text();
            const backupData = JSON.parse(text);
            expect(backupData.version).toBe(storage.version);
            expect(backupData.data).toBeDefined();
        });

        it('should restore from backup', async () => {
            const backupResult = await storage.createBackup();
            const backupText = await backupResult.blob.text();
            const backupData = JSON.parse(backupText);
            
            // Clear existing data
            await storage.clearAllData();
            
            // Restore from backup
            const restoreResult = await storage.restoreFromBackup(backupData);
            expect(restoreResult.success).toBe(true);
            
            // Verify data was restored
            const gameState = await storage.loadGameState();
            const userProgress = await storage.loadUserProgress();
            const settings = await storage.loadSettings();
            
            expect(gameState.success).toBe(true);
            expect(userProgress.success).toBe(true);
            expect(settings.success).toBe(true);
        });

        it('should handle invalid backup data', async () => {
            const invalidBackup = { invalid: 'data' };
            const result = await storage.restoreFromBackup(invalidBackup);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid backup format');
        });

        it('should handle version mismatch in backup', async () => {
            const backupResult = await storage.createBackup();
            const backupText = await backupResult.blob.text();
            const backupData = JSON.parse(backupText);
            
            backupData.version = '0.5.0'; // Old version
            
            const result = await storage.restoreFromBackup(backupData);
            expect(result.success).toBe(false);
            expect(result.error).toContain('version');
        });
    });

    describe('Storage Quota Management', () => {
        it('should get storage quota information', async () => {
            const quota = await storage.getStorageQuota();
            expect(quota.usage).toBeGreaterThan(-1);
            expect(quota.quota).toBeGreaterThan(-1);
            expect(quota.available).toBeDefined();
        });

        it('should detect low storage space', async () => {
            // Mock navigator.storage.estimate to return low quota
            const originalEstimate = navigator.storage?.estimate;
            if (navigator.storage) {
                navigator.storage.estimate = () => Promise.resolve({
                    usage: 950000000, // 950MB used
                    quota: 1000000000  // 1GB total
                });
            }
            
            const isLow = await storage.isStorageLow();
            expect(isLow).toBe(true);
            
            // Restore original
            if (navigator.storage && originalEstimate) {
                navigator.storage.estimate = originalEstimate;
            }
        });

        it('should cleanup storage when full', async () => {
            // Fill storage with test data
            for (let i = 0; i < 50; i++) {
                await storage.cacheDailyPuzzle(`2024-01-${i.toString().padStart(2, '0')}`, {
                    puzzle: testData.validSudokuGrid,
                    solution: testData.solvedSudokuGrid
                });
            }
            
            const cleanupResult = await storage.cleanupStorage();
            expect(cleanupResult.success).toBe(true);
            expect(Object.values(cleanupResult.cleaned).some(count => count > 0)).toBe(true);
        });
    });

    describe('Data Migration', () => {
        it('should detect old data format', () => {
            localStorage.setItem('sudoku-old-key', 'old-data');
            const hasOldData = storage.hasOldFormatData();
            expect(hasOldData).toBe(true);
        });

        it('should migrate old data format', async () => {
            // Set up old format data
            localStorage.setItem('sudoku-game', JSON.stringify(testData.validSudokuGrid));
            localStorage.setItem('sudoku-progress', JSON.stringify({ score: 100 }));
            
            const result = await storage.migrateOldData();
            expect(result.success).toBe(true);
            expect(result.migrated).toBeGreaterThan(0);
            
            // Verify old keys are removed
            expect(localStorage.getItem('sudoku-game')).toBeNull();
        });

        it('should handle migration errors', async () => {
            // Set up corrupted old data
            localStorage.setItem('sudoku-game', 'invalid-json');
            
            const result = await storage.migrateOldData();
            expect(result.success).toBe(false);
            expect(result.error).toContain('Migration failed');
        });
    });

    describe('Error Handling and Recovery', () => {
        it('should handle localStorage quota exceeded', async () => {
            // Mock localStorage to throw QuotaExceededError
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = () => {
                const error = new Error('QuotaExceededError');
                error.name = 'QuotaExceededError';
                throw error;
            };
            
            const result = await storage.saveGameState(testData.validSudokuGrid);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Storage quota exceeded');
            
            // Restore original
            localStorage.setItem = originalSetItem;
        });

        it('should handle corrupted data gracefully', async () => {
            // Save corrupted data directly
            localStorage.setItem(`${storage.prefix}-game-state`, 'corrupted-data');
            
            const result = await storage.loadGameState();
            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to parse');
        });

        it('should recover from storage errors', async () => {
            // Simulate storage error
            const originalGetItem = localStorage.getItem;
            localStorage.getItem = () => { throw new Error('Storage error'); };
            
            const result = await storage.loadGameState();
            expect(result.success).toBe(false);
            
            // Restore and verify recovery
            localStorage.getItem = originalGetItem;
            await storage.saveGameState(testData.validSudokuGrid);
            
            const recoveryResult = await storage.loadGameState();
            expect(recoveryResult.success).toBe(true);
        });

        it('should validate data integrity', async () => {
            const validData = { grid: testData.validSudokuGrid, difficulty: 'medium' };
            const invalidData = { grid: 'invalid', difficulty: 123 };
            
            expect(storage.validateGameStateData(validData)).toBe(true);
            expect(storage.validateGameStateData(invalidData)).toBe(false);
            expect(storage.validateGameStateData(null)).toBe(false);
        });
    });

    describe('Performance', () => {
        it('should save data quickly', async () => {
            const startTime = performance.now();
            
            await storage.saveGameState(testData.validSudokuGrid);
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(50); // Should complete in under 50ms
        });

        it('should load data quickly', async () => {
            await storage.saveGameState(testData.validSudokuGrid);
            
            const startTime = performance.now();
            
            await storage.loadGameState();
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(30); // Should complete in under 30ms
        });

        it('should handle large datasets efficiently', async () => {
            const largeData = {
                grid: testData.validSudokuGrid,
                history: new Array(1000).fill(testData.validSudokuGrid),
                metadata: { notes: 'a'.repeat(10000) }
            };
            
            const startTime = performance.now();
            
            await storage.saveGameState(largeData);
            await storage.loadGameState();
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(200); // Should handle large data reasonably fast
        });
    });
});