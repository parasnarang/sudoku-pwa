/**
 * Unit Tests for User Progress System
 * Tests achievements, statistics tracking, and tournament progress
 */

describe('User Progress System', () => {
    let userProgress;
    let mockStorage;
    let testData;

    beforeAll(() => {
        testData = TestUtils.generateTestData();
    });

    beforeEach(() => {
        mockStorage = {
            saveUserProgress: TestUtils.mockFunction(() => Promise.resolve({ success: true })),
            loadUserProgress: TestUtils.mockFunction(() => Promise.resolve({ 
                success: true, 
                data: { stats: testData.userProgressData.stats, achievements: [] }
            })),
            updateUserProgress: TestUtils.mockFunction(() => Promise.resolve({ success: true }))
        };
        
        userProgress = new UserProgress(mockStorage);
    });

    afterEach(() => {
        TestUtils.cleanup();
    });

    describe('Initialization', () => {
        it('should initialize with default stats', () => {
            expect(userProgress.stats).toBeDefined();
            expect(userProgress.stats.gamesPlayed).toBe(0);
            expect(userProgress.stats.gamesCompleted).toBe(0);
            expect(userProgress.stats.currentStreak).toBe(0);
            expect(userProgress.achievements).toBeDefined();
            expect(Array.isArray(userProgress.achievements)).toBe(true);
        });

        it('should load existing progress from storage', async () => {
            await userProgress.loadProgress();
            expect(mockStorage.loadUserProgress.wasCalledTimes(1)).toBe(true);
            expect(userProgress.stats.gamesPlayed).toBe(25);
            expect(userProgress.stats.gamesCompleted).toBe(20);
        });

        it('should handle storage loading errors', async () => {
            mockStorage.loadUserProgress = TestUtils.mockFunction(() => 
                Promise.resolve({ success: false, error: 'Storage error' })
            );
            
            await userProgress.loadProgress();
            // Should initialize with defaults on error
            expect(userProgress.stats.gamesPlayed).toBe(0);
        });
    });

    describe('Game Statistics Tracking', () => {
        it('should track game start', () => {
            userProgress.trackGameStart('medium');
            expect(userProgress.stats.gamesPlayed).toBe(1);
            expect(userProgress.stats.difficultyStats.medium.played).toBe(1);
        });

        it('should track game completion', () => {
            userProgress.trackGameStart('hard');
            const gameResult = {
                completed: true,
                time: 300000, // 5 minutes
                mistakes: 2,
                hintsUsed: 1,
                difficulty: 'hard',
                score: 850
            };
            
            userProgress.trackGameCompletion(gameResult);
            
            expect(userProgress.stats.gamesCompleted).toBe(1);
            expect(userProgress.stats.difficultyStats.hard.completed).toBe(1);
            expect(userProgress.stats.difficultyStats.hard.bestTime).toBe(300000);
            expect(userProgress.stats.currentStreak).toBe(1);
        });

        it('should update best times correctly', () => {
            const gameResult1 = { completed: true, time: 400000, difficulty: 'medium', score: 700 };
            const gameResult2 = { completed: true, time: 300000, difficulty: 'medium', score: 800 };
            const gameResult3 = { completed: true, time: 350000, difficulty: 'medium', score: 750 };
            
            userProgress.trackGameCompletion(gameResult1);
            expect(userProgress.stats.bestTime).toBe(400000);
            
            userProgress.trackGameCompletion(gameResult2);
            expect(userProgress.stats.bestTime).toBe(300000); // Should update to better time
            
            userProgress.trackGameCompletion(gameResult3);
            expect(userProgress.stats.bestTime).toBe(300000); // Should not change
        });

        it('should track streaks correctly', () => {
            // Win streak
            for (let i = 0; i < 5; i++) {
                userProgress.trackGameCompletion({ 
                    completed: true, 
                    difficulty: 'easy', 
                    time: 200000, 
                    score: 900 
                });
            }
            expect(userProgress.stats.currentStreak).toBe(5);
            expect(userProgress.stats.bestStreak).toBe(5);
            
            // Break streak
            userProgress.trackGameCompletion({ 
                completed: false, 
                difficulty: 'easy', 
                time: 0, 
                score: 0 
            });
            expect(userProgress.stats.currentStreak).toBe(0);
            expect(userProgress.stats.bestStreak).toBe(5); // Should preserve best
        });

        it('should calculate average completion times', () => {
            const times = [180000, 240000, 300000, 360000]; // 3, 4, 5, 6 minutes
            
            times.forEach(time => {
                userProgress.trackGameCompletion({
                    completed: true,
                    time: time,
                    difficulty: 'medium',
                    score: 800
                });
            });
            
            const avgTime = userProgress.getAverageCompletionTime();
            expect(avgTime).toBe(270000); // 4.5 minutes average
        });

        it('should track difficulty-specific statistics', () => {
            userProgress.trackGameCompletion({
                completed: true,
                time: 150000,
                difficulty: 'easy',
                score: 950
            });
            
            userProgress.trackGameCompletion({
                completed: true,
                time: 450000,
                difficulty: 'expert',
                score: 1200
            });
            
            expect(userProgress.stats.difficultyStats.easy.bestTime).toBe(150000);
            expect(userProgress.stats.difficultyStats.expert.bestTime).toBe(450000);
            expect(userProgress.stats.difficultyStats.easy.completed).toBe(1);
            expect(userProgress.stats.difficultyStats.expert.completed).toBe(1);
        });
    });

    describe('Achievement System', () => {
        beforeEach(() => {
            // Set up some base stats for achievement testing
            userProgress.stats = {
                ...userProgress.stats,
                gamesCompleted: 5,
                bestTime: 180000,
                currentStreak: 3,
                bestStreak: 8,
                totalHints: 10,
                totalMistakes: 15
            };
        });

        it('should check first win achievement', () => {
            userProgress.achievements = [];
            const newAchievements = userProgress.checkAchievements({
                completed: true,
                time: 300000,
                difficulty: 'easy',
                score: 800
            });
            
            expect(newAchievements).toContain('first_win');
        });

        it('should check speed achievements', () => {
            userProgress.achievements = [];
            userProgress.stats.bestTime = 0; // Reset best time
            
            const newAchievements = userProgress.checkAchievements({
                completed: true,
                time: 120000, // 2 minutes - speed demon time
                difficulty: 'medium',
                score: 1000
            });
            
            expect(newAchievements).toContain('speed_demon');
        });

        it('should check streak achievements', () => {
            userProgress.achievements = [];
            userProgress.stats.currentStreak = 9; // Just before triggering
            
            const newAchievements = userProgress.checkAchievements({
                completed: true,
                time: 250000,
                difficulty: 'medium',
                score: 850
            });
            
            expect(newAchievements).toContain('streak_master');
        });

        it('should check completion milestone achievements', () => {
            userProgress.achievements = [];
            userProgress.stats.gamesCompleted = 49; // Just before 50
            
            const newAchievements = userProgress.checkAchievements({
                completed: true,
                time: 300000,
                difficulty: 'hard',
                score: 900
            });
            
            expect(newAchievements).toContain('half_century');
        });

        it('should check perfect game achievements', () => {
            userProgress.achievements = [];
            
            const newAchievements = userProgress.checkAchievements({
                completed: true,
                time: 180000,
                mistakes: 0,
                hintsUsed: 0,
                difficulty: 'hard',
                score: 1500
            });
            
            expect(newAchievements).toContain('perfectionist');
        });

        it('should not award duplicate achievements', () => {
            userProgress.achievements = ['first_win'];
            
            const newAchievements = userProgress.checkAchievements({
                completed: true,
                time: 300000,
                difficulty: 'easy',
                score: 800
            });
            
            expect(newAchievements).not.toContain('first_win');
        });

        it('should provide achievement details', () => {
            const achievement = userProgress.getAchievement('speed_demon');
            expect(achievement).toBeDefined();
            expect(achievement.name).toBe('Speed Demon');
            expect(achievement.description).toContain('2 minutes');
            expect(achievement.icon).toBeDefined();
            expect(achievement.rarity).toBe('rare');
        });

        it('should get all available achievements', () => {
            const achievements = userProgress.getAllAchievements();
            expect(Array.isArray(achievements)).toBe(true);
            expect(achievements.length).toBeGreaterThan(10);
            
            const firstWin = achievements.find(a => a.id === 'first_win');
            expect(firstWin).toBeDefined();
        });

        it('should calculate achievement progress', () => {
            userProgress.stats.gamesCompleted = 25;
            const progress = userProgress.getAchievementProgress('half_century');
            
            expect(progress.current).toBe(25);
            expect(progress.target).toBe(50);
            expect(progress.percentage).toBe(50);
            expect(progress.completed).toBe(false);
        });
    });

    describe('Tournament Progress', () => {
        it('should initialize tournament progress', () => {
            const progress = userProgress.getTournamentProgress();
            expect(progress.completedLevels).toBeDefined();
            expect(progress.currentLevel).toBe(1);
            expect(progress.totalScore).toBe(0);
            expect(progress.weeklyRank).toBe(0);
        });

        it('should track tournament level completion', () => {
            const levelResult = {
                level: 3,
                score: 1200,
                time: 240000,
                mistakes: 1
            };
            
            userProgress.trackTournamentLevel(levelResult);
            
            const progress = userProgress.getTournamentProgress();
            expect(progress.completedLevels).toContain(3);
            expect(progress.currentLevel).toBe(4);
            expect(progress.totalScore).toBe(1200);
        });

        it('should calculate tournament rank', () => {
            // Complete several levels
            for (let level = 1; level <= 5; level++) {
                userProgress.trackTournamentLevel({
                    level: level,
                    score: 1000 + (level * 100),
                    time: 300000 - (level * 10000),
                    mistakes: 0
                });
            }
            
            const progress = userProgress.getTournamentProgress();
            expect(progress.totalScore).toBe(6500); // 1000+1100+1200+1300+1400
            expect(progress.completedLevels).toHaveLength(5);
        });

        it('should handle tournament reset', () => {
            // Complete some levels
            userProgress.trackTournamentLevel({ level: 1, score: 1000 });
            userProgress.trackTournamentLevel({ level: 2, score: 1100 });
            
            // Reset tournament
            userProgress.resetTournament();
            
            const progress = userProgress.getTournamentProgress();
            expect(progress.completedLevels).toHaveLength(0);
            expect(progress.currentLevel).toBe(1);
            expect(progress.totalScore).toBe(0);
        });

        it('should track weekly tournament participation', () => {
            const weekId = userProgress.getCurrentWeekId();
            
            userProgress.trackTournamentLevel({ level: 1, score: 1000 });
            
            const weeklyStats = userProgress.getWeeklyTournamentStats();
            expect(weeklyStats[weekId]).toBeDefined();
            expect(weeklyStats[weekId].score).toBe(1000);
            expect(weeklyStats[weekId].levelsCompleted).toBe(1);
        });
    });

    describe('Daily Challenges', () => {
        it('should track daily challenge completion', () => {
            const today = new Date().toISOString().split('T')[0];
            const challengeResult = {
                date: today,
                completed: true,
                time: 280000,
                score: 950,
                mistakes: 2
            };
            
            userProgress.trackDailyChallenge(challengeResult);
            
            const dailyStats = userProgress.getDailyChallengeStats();
            expect(dailyStats[today]).toBeDefined();
            expect(dailyStats[today].completed).toBe(true);
            expect(dailyStats[today].score).toBe(950);
        });

        it('should calculate daily challenge streak', () => {
            const today = new Date();
            
            // Complete challenges for 5 consecutive days
            for (let i = 0; i < 5; i++) {
                const challengeDate = new Date(today);
                challengeDate.setDate(today.getDate() - i);
                const dateStr = challengeDate.toISOString().split('T')[0];
                
                userProgress.trackDailyChallenge({
                    date: dateStr,
                    completed: true,
                    time: 300000,
                    score: 800
                });
            }
            
            const streak = userProgress.getDailyChallengeStreak();
            expect(streak).toBe(5);
        });

        it('should handle missed daily challenges', () => {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const twoDaysAgo = new Date(today);
            twoDaysAgo.setDate(today.getDate() - 2);
            
            // Complete today and two days ago, but miss yesterday
            userProgress.trackDailyChallenge({
                date: today.toISOString().split('T')[0],
                completed: true,
                score: 800
            });
            
            userProgress.trackDailyChallenge({
                date: twoDaysAgo.toISOString().split('T')[0],
                completed: true,
                score: 850
            });
            
            const streak = userProgress.getDailyChallengeStreak();
            expect(streak).toBe(1); // Should only count consecutive days from today
        });
    });

    describe('Statistics Display', () => {
        beforeEach(() => {
            userProgress.stats = {
                gamesPlayed: 150,
                gamesCompleted: 120,
                bestTime: 165000, // 2:45
                averageTime: 285000, // 4:45
                currentStreak: 8,
                bestStreak: 15,
                totalHints: 25,
                totalMistakes: 40,
                difficultyStats: {
                    easy: { played: 50, completed: 50, bestTime: 120000 },
                    medium: { played: 60, completed: 50, bestTime: 180000 },
                    hard: { played: 30, completed: 15, bestTime: 360000 },
                    expert: { played: 10, completed: 5, bestTime: 600000 }
                }
            };
        });

        it('should format display statistics correctly', () => {
            const stats = userProgress.getDisplayStats();
            
            expect(stats.gamesPlayed).toBe('150');
            expect(stats.gamesCompleted).toBe('120');
            expect(stats.completionRate).toBe('80%');
            expect(stats.bestTime).toBe('2:45');
            expect(stats.averageTime).toBe('4:45');
            expect(stats.currentStreak).toBe('8');
            expect(stats.bestStreak).toBe('15');
        });

        it('should calculate completion rates by difficulty', () => {
            const stats = userProgress.getCompletionStats();
            
            expect(stats.easy.rate).toBe(100); // 50/50
            expect(stats.medium.rate).toBeCloseTo(83.33); // 50/60
            expect(stats.hard.rate).toBe(50); // 15/30
            expect(stats.expert.rate).toBe(50); // 5/10
        });

        it('should get time-based statistics', () => {
            const timeStats = userProgress.getTimeStats();
            
            expect(timeStats.bestTime).toBe(165000);
            expect(timeStats.averageTime).toBe(285000);
            expect(timeStats.bestTimeFormatted).toBe('2:45');
            expect(timeStats.averageTimeFormatted).toBe('4:45');
        });

        it('should calculate performance trends', () => {
            // Add some recent game history
            const recentGames = [
                { time: 200000, score: 900, date: Date.now() - 86400000 }, // 1 day ago
                { time: 180000, score: 950, date: Date.now() - 172800000 }, // 2 days ago
                { time: 220000, score: 850, date: Date.now() - 259200000 }  // 3 days ago
            ];
            
            userProgress.gameHistory = recentGames;
            
            const trends = userProgress.getPerformanceTrends();
            expect(trends.timeImprovement).toBeDefined();
            expect(trends.scoreImprovement).toBeDefined();
            expect(trends.recentAverage).toBeDefined();
        });
    });

    describe('Data Persistence', () => {
        it('should save progress to storage', async () => {
            userProgress.stats.gamesPlayed = 25;
            userProgress.achievements = ['first_win'];
            
            await userProgress.saveProgress();
            
            expect(mockStorage.saveUserProgress.wasCalledTimes(1)).toBe(true);
            const savedData = mockStorage.saveUserProgress.calls[0][0];
            expect(savedData.stats.gamesPlayed).toBe(25);
            expect(savedData.achievements).toContain('first_win');
        });

        it('should handle save errors gracefully', async () => {
            mockStorage.saveUserProgress = TestUtils.mockFunction(() => 
                Promise.resolve({ success: false, error: 'Save failed' })
            );
            
            const result = await userProgress.saveProgress();
            expect(result.success).toBe(false);
        });

        it('should export progress data', () => {
            userProgress.stats.gamesPlayed = 30;
            userProgress.achievements = ['first_win', 'speed_demon'];
            
            const exported = userProgress.exportProgress();
            expect(exported.stats.gamesPlayed).toBe(30);
            expect(exported.achievements).toContain('speed_demon');
            expect(exported.version).toBeDefined();
            expect(exported.exportDate).toBeDefined();
        });

        it('should import progress data', () => {
            const importData = {
                stats: { gamesPlayed: 50, gamesCompleted: 40 },
                achievements: ['first_win', 'streak_master'],
                version: '1.0.0'
            };
            
            const result = userProgress.importProgress(importData);
            expect(result.success).toBe(true);
            expect(userProgress.stats.gamesPlayed).toBe(50);
            expect(userProgress.achievements).toContain('streak_master');
        });

        it('should validate import data format', () => {
            const invalidData = { invalid: 'format' };
            const result = userProgress.importProgress(invalidData);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid format');
        });
    });

    describe('Performance', () => {
        it('should handle large numbers of games efficiently', () => {
            const startTime = performance.now();
            
            // Simulate 1000 game completions
            for (let i = 0; i < 1000; i++) {
                userProgress.trackGameCompletion({
                    completed: true,
                    time: 200000 + Math.random() * 100000,
                    difficulty: ['easy', 'medium', 'hard'][i % 3],
                    score: 800 + Math.random() * 400
                });
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(100); // Should handle efficiently
            expect(userProgress.stats.gamesCompleted).toBe(1000);
        });

        it('should calculate statistics quickly', () => {
            // Set up substantial game history
            for (let i = 0; i < 500; i++) {
                userProgress.trackGameCompletion({
                    completed: true,
                    time: 180000 + Math.random() * 240000,
                    difficulty: 'medium',
                    score: 700 + Math.random() * 500
                });
            }
            
            const startTime = performance.now();
            
            const stats = userProgress.getDisplayStats();
            const trends = userProgress.getPerformanceTrends();
            const achievements = userProgress.checkAchievements({
                completed: true,
                time: 200000,
                difficulty: 'hard',
                score: 1000
            });
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(50); // Should calculate quickly
            expect(stats).toBeDefined();
            expect(trends).toBeDefined();
            expect(Array.isArray(achievements)).toBe(true);
        });
    });
});