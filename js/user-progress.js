class UserProgress {
    constructor(dataStorage = null) {
        this.dataStorage = dataStorage;
        this.storage = {
            stats: 'sudoku-user-stats',
            progress: 'sudoku-user-progress',
            settings: 'sudoku-user-settings'
        };
        
        this.defaultStats = {
            totalGamesPlayed: 0,
            totalGamesCompleted: 0,
            totalTime: 0,
            bestScore: 0,
            averageTime: 0,
            completionRate: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastPlayDate: null,
            difficultyStats: {
                easy: { played: 0, completed: 0, bestTime: null, bestScore: 0 },
                medium: { played: 0, completed: 0, bestTime: null, bestScore: 0 },
                hard: { played: 0, completed: 0, bestTime: null, bestScore: 0 },
                expert: { played: 0, completed: 0, bestTime: null, bestScore: 0 }
            },
            achievements: [],
            dailyChallenges: {},
            tournamentProgress: {
                currentLevel: 1,
                completedLevels: [],
                totalScore: 0,
                currentTournamentId: null
            }
        };
        
        this.achievements = [
            { id: 'first_win', name: 'First Victory', description: 'Complete your first puzzle', icon: '🎉' },
            { id: 'speed_demon', name: 'Speed Demon', description: 'Complete a puzzle in under 5 minutes', icon: '⚡' },
            { id: 'perfectionist', name: 'Perfectionist', description: 'Complete a puzzle without mistakes', icon: '💯' },
            { id: 'streak_3', name: 'Getting Warmed Up', description: 'Complete 3 daily challenges in a row', icon: '🔥' },
            { id: 'streak_7', name: 'Week Warrior', description: 'Complete 7 daily challenges in a row', icon: '👑' },
            { id: 'streak_30', name: 'Monthly Master', description: 'Complete 30 daily challenges in a row', icon: '🏆' },
            { id: 'all_difficulties', name: 'Jack of All Trades', description: 'Complete puzzles in all difficulty levels', icon: '🎯' },
            { id: 'expert_master', name: 'Expert Master', description: 'Complete 10 expert puzzles', icon: '🧠' },
            { id: 'tournament_champion', name: 'Tournament Champion', description: 'Complete all tournament levels', icon: '👑' }
        ];
        
        this.loadStats();
    }

    async loadStats() {
        try {
            let result;
            if (this.dataStorage) {
                result = await this.dataStorage.loadUserProgress();
            } else {
                // Fallback to localStorage
                const saved = localStorage.getItem(this.storage.stats);
                result = saved ? { success: true, data: JSON.parse(saved) } : { success: false };
            }
            
            this.stats = result.success ? { ...this.defaultStats, ...result.data } : { ...this.defaultStats };
            
            // Ensure all properties exist (for version compatibility)
            Object.keys(this.defaultStats).forEach(key => {
                if (!(key in this.stats)) {
                    this.stats[key] = this.defaultStats[key];
                }
            });
            
        } catch (error) {
            console.error('Error loading user stats:', error);
            this.stats = { ...this.defaultStats };
        }
    }

    async saveStats() {
        try {
            if (this.dataStorage) {
                const result = await this.dataStorage.saveUserProgress(this.stats);
                if (!result.success) {
                    console.error('Failed to save user progress:', result.error);
                }
            } else {
                // Fallback to localStorage
                localStorage.setItem(this.storage.stats, JSON.stringify(this.stats));
            }
        } catch (error) {
            console.error('Error saving user stats:', error);
        }
    }

    recordGameStart(difficulty = 'medium', gameType = 'regular') {
        this.stats.totalGamesPlayed++;
        this.stats.difficultyStats[difficulty].played++;
        
        if (gameType === 'daily') {
            const today = new Date().toISOString().split('T')[0];
            if (!this.stats.dailyChallenges[today]) {
                this.stats.dailyChallenges[today] = { started: true, completed: false, score: 0, time: 0 };
            }
        }
        
        this.saveStats();
    }

    recordGameComplete(gameResult) {
        const { difficulty, score, time, mistakes, hintsUsed, gameType, date } = gameResult;
        
        this.stats.totalGamesCompleted++;
        this.stats.totalTime += time;
        this.stats.averageTime = Math.round(this.stats.totalTime / this.stats.totalGamesCompleted);
        this.stats.completionRate = Math.round((this.stats.totalGamesCompleted / this.stats.totalGamesPlayed) * 100);
        
        // Update best score
        if (score > this.stats.bestScore) {
            this.stats.bestScore = score;
        }
        
        // Update difficulty stats
        const diffStats = this.stats.difficultyStats[difficulty];
        diffStats.completed++;
        
        if (!diffStats.bestTime || time < diffStats.bestTime) {
            diffStats.bestTime = time;
        }
        
        if (score > diffStats.bestScore) {
            diffStats.bestScore = score;
        }
        
        // Handle daily challenges
        if (gameType === 'daily') {
            this.recordDailyComplete(date || new Date().toISOString().split('T')[0], score, time);
        }
        
        // Update last play date and streak
        this.updateStreak(gameType);
        
        // Check for achievements
        this.checkAchievements(gameResult);
        
        this.saveStats();
        return this.stats;
    }

    recordDailyComplete(dateString, score, time) {
        this.stats.dailyChallenges[dateString] = {
            started: true,
            completed: true,
            score: score,
            time: time,
            completedAt: Date.now()
        };
    }

    updateStreak(gameType) {
        const today = new Date().toISOString().split('T')[0];
        
        if (gameType === 'daily') {
            this.stats.currentStreak = this.calculateCurrentStreak();
            
            if (this.stats.currentStreak > this.stats.longestStreak) {
                this.stats.longestStreak = this.stats.currentStreak;
            }
        }
        
        this.stats.lastPlayDate = today;
    }

    calculateCurrentStreak() {
        const today = new Date();
        const todayString = today.toISOString().split('T')[0];
        
        // Check if today's challenge is completed
        if (!this.stats.dailyChallenges[todayString]?.completed) {
            // If today isn't completed, check yesterday and count backwards
            const yesterday = new Date(today.getTime() - 86400000);
            const yesterdayString = yesterday.toISOString().split('T')[0];
            
            if (!this.stats.dailyChallenges[yesterdayString]?.completed) {
                return 0; // No current streak
            }
            
            return this.countConsecutiveDays(yesterday);
        }
        
        return this.countConsecutiveDays(today);
    }

    countConsecutiveDays(startDate) {
        let count = 0;
        let currentDate = new Date(startDate);
        
        while (true) {
            const dateString = currentDate.toISOString().split('T')[0];
            const challenge = this.stats.dailyChallenges[dateString];
            
            if (challenge && challenge.completed) {
                count++;
                // Move to previous day
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        return count;
    }

    checkAchievements(gameResult) {
        const { difficulty, score, time, mistakes, hintsUsed } = gameResult;
        const newAchievements = [];
        
        // First win
        if (!this.hasAchievement('first_win') && this.stats.totalGamesCompleted === 1) {
            newAchievements.push('first_win');
        }
        
        // Speed demon (under 5 minutes)
        if (!this.hasAchievement('speed_demon') && time < 300000) {
            newAchievements.push('speed_demon');
        }
        
        // Perfectionist (no mistakes)
        if (!this.hasAchievement('perfectionist') && mistakes === 0) {
            newAchievements.push('perfectionist');
        }
        
        // Streak achievements
        if (!this.hasAchievement('streak_3') && this.stats.currentStreak >= 3) {
            newAchievements.push('streak_3');
        }
        if (!this.hasAchievement('streak_7') && this.stats.currentStreak >= 7) {
            newAchievements.push('streak_7');
        }
        if (!this.hasAchievement('streak_30') && this.stats.currentStreak >= 30) {
            newAchievements.push('streak_30');
        }
        
        // All difficulties
        const allDiffCompleted = Object.values(this.stats.difficultyStats).every(stat => stat.completed > 0);
        if (!this.hasAchievement('all_difficulties') && allDiffCompleted) {
            newAchievements.push('all_difficulties');
        }
        
        // Expert master
        if (!this.hasAchievement('expert_master') && this.stats.difficultyStats.expert.completed >= 10) {
            newAchievements.push('expert_master');
        }
        
        // Add new achievements
        newAchievements.forEach(achievementId => {
            if (!this.stats.achievements.includes(achievementId)) {
                this.stats.achievements.push(achievementId);
            }
        });
        
        return newAchievements;
    }

    hasAchievement(achievementId) {
        return this.stats.achievements.includes(achievementId);
    }

    getAchievement(achievementId) {
        return this.achievements.find(a => a.id === achievementId);
    }

    getDailyProgress(month = new Date().getMonth(), year = new Date().getFullYear()) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const progress = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateString = date.toISOString().split('T')[0];
            const challenge = this.stats.dailyChallenges[dateString];
            
            progress.push({
                date: dateString,
                day: day,
                completed: challenge?.completed || false,
                score: challenge?.score || 0,
                time: challenge?.time || 0,
                isPast: date < new Date(),
                isToday: dateString === new Date().toISOString().split('T')[0]
            });
        }
        
        return progress;
    }

    getCompletionStats(month = new Date().getMonth(), year = new Date().getFullYear()) {
        const progress = this.getDailyProgress(month, year);
        const completed = progress.filter(p => p.completed).length;
        const available = progress.filter(p => p.isPast || p.isToday).length;
        
        return {
            completed,
            available,
            total: progress.length,
            percentage: available > 0 ? Math.round((completed / available) * 100) : 0
        };
    }

    getTournamentProgress() {
        return this.stats.tournamentProgress;
    }

    updateTournamentProgress(level, score, completed = false) {
        const tournament = this.stats.tournamentProgress;
        
        if (completed && !tournament.completedLevels.includes(level)) {
            tournament.completedLevels.push(level);
            tournament.totalScore += score;
            
            if (level >= tournament.currentLevel) {
                tournament.currentLevel = Math.min(22, level + 1);
            }
            
            // Check for tournament champion achievement
            if (tournament.completedLevels.length >= 22) {
                if (!this.hasAchievement('tournament_champion')) {
                    this.stats.achievements.push('tournament_champion');
                }
            }
        }
        
        this.saveStats();
        return tournament;
    }

    getStats() {
        return { ...this.stats };
    }

    resetStats() {
        this.stats = { ...this.defaultStats };
        this.saveStats();
    }

    exportData() {
        return {
            stats: this.stats,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };
    }

    importData(data) {
        try {
            if (data.stats) {
                this.stats = { ...this.defaultStats, ...data.stats };
                this.saveStats();
                return { success: true, message: 'Data imported successfully' };
            }
            return { success: false, error: 'Invalid data format' };
        } catch (error) {
            return { success: false, error: 'Failed to import data: ' + error.message };
        }
    }

    // Get formatted statistics for display
    getDisplayStats() {
        const formatTime = (ms) => {
            if (!ms) return '00:00';
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        return {
            gamesPlayed: this.stats.totalGamesPlayed.toLocaleString(),
            gamesCompleted: this.stats.totalGamesCompleted.toLocaleString(),
            completionRate: `${this.stats.completionRate}%`,
            bestScore: this.stats.bestScore.toLocaleString(),
            averageTime: formatTime(this.stats.averageTime),
            currentStreak: this.stats.currentStreak,
            longestStreak: this.stats.longestStreak,
            totalTime: formatTime(this.stats.totalTime),
            achievements: this.stats.achievements.length,
            tournamentLevel: this.stats.tournamentProgress.currentLevel,
            tournamentScore: this.stats.tournamentProgress.totalScore.toLocaleString()
        };
    }
}

if (typeof window !== 'undefined') {
    window.UserProgress = UserProgress;
}