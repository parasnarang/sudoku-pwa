class TournamentUI {
    constructor() {
        this.currentTournamentId = this.generateWeeklyTournamentId();
        this.selectedLevel = null;
        
        this.levelData = [
            { name: "Coral Beach", icon: "🏖️", difficulty: "easy" },
            { name: "Palm Cove", icon: "🌴", difficulty: "easy" },
            { name: "Sunset Bay", icon: "🌅", difficulty: "easy" },
            { name: "Hidden Lagoon", icon: "🏞️", difficulty: "medium" },
            { name: "Tide Pools", icon: "🐚", difficulty: "medium" },
            { name: "Ocean View", icon: "🌊", difficulty: "medium" },
            { name: "Reef Gardens", icon: "🐠", difficulty: "medium" },
            { name: "Dolphin Point", icon: "🐬", difficulty: "hard" },
            { name: "Whale Watch", icon: "🐋", difficulty: "hard" },
            { name: "Storm Island", icon: "⛈️", difficulty: "hard" },
            { name: "Pirate Cove", icon: "🏴‍☠️", difficulty: "hard" },
            { name: "Volcano Peak", icon: "🌋", difficulty: "hard" },
            { name: "Crystal Caves", icon: "💎", difficulty: "expert" },
            { name: "Mystic Falls", icon: "🌊", difficulty: "expert" },
            { name: "Dragon's Lair", icon: "🐉", difficulty: "expert" },
            { name: "Phoenix Nest", icon: "🔥", difficulty: "expert" },
            { name: "Starlight Summit", icon: "⭐", difficulty: "expert" },
            { name: "Thunder Ridge", icon: "⚡", difficulty: "expert" },
            { name: "Frozen Peaks", icon: "🏔️", difficulty: "expert" },
            { name: "Shadow Valley", icon: "🌑", difficulty: "expert" },
            { name: "Golden Temple", icon: "🏛️", difficulty: "expert" },
            { name: "Master's Paradise", icon: "👑", difficulty: "expert" }
        ];
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.levelsCompleted = document.getElementById('levels-completed');
        this.participantsCount = document.getElementById('participants-count');
        this.tournamentTimeLeft = document.getElementById('tournament-time-left');
        this.tournamentCurrentScore = document.getElementById('tournament-current-score');
        this.currentRank = document.getElementById('current-rank');
        
        this.tournamentLevels = document.getElementById('tournament-levels');
        this.leaderboardBtn = document.getElementById('tournament-leaderboard-btn');
        this.rulesBtn = document.getElementById('tournament-rules-btn');
        
        // Level modal elements
        this.levelModal = document.getElementById('level-detail-modal');
        this.modalLevelIcon = document.getElementById('modal-level-icon');
        this.modalLevelName = document.getElementById('modal-level-name');
        this.modalLevelNumber = document.getElementById('modal-level-number');
        this.levelStatus = document.getElementById('level-status');
        this.levelConstraints = document.getElementById('level-constraints');
        this.levelRewards = document.getElementById('level-rewards');
        this.levelBestScore = document.getElementById('level-best-score');
        this.closeLevelModalBtn = document.getElementById('close-level-modal-btn');
        this.playLevelBtn = document.getElementById('play-level-btn');
        
        // Leaderboard modal elements
        this.leaderboardModal = document.getElementById('leaderboard-modal');
        this.leaderboardContent = document.getElementById('leaderboard-content');
        this.closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
    }

    setupEventListeners() {
        this.leaderboardBtn?.addEventListener('click', () => this.showLeaderboard());
        this.rulesBtn?.addEventListener('click', () => this.showRules());
        
        this.closeLevelModalBtn?.addEventListener('click', () => this.closeLevelModal());
        this.playLevelBtn?.addEventListener('click', () => this.playSelectedLevel());
        this.levelModal?.addEventListener('click', (e) => {
            if (e.target === this.levelModal) {
                this.closeLevelModal();
            }
        });
        
        this.closeLeaderboardBtn?.addEventListener('click', () => this.closeLeaderboard());
        this.leaderboardModal?.addEventListener('click', (e) => {
            if (e.target === this.leaderboardModal) {
                this.closeLeaderboard();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!this.levelModal?.classList.contains('hidden')) {
                    this.closeLevelModal();
                }
                if (!this.leaderboardModal?.classList.contains('hidden')) {
                    this.closeLeaderboard();
                }
            }
        });
    }

    initialize() {
        this.renderTournamentInfo();
        this.renderLevels();
        this.updateTimer();
        
        // Update timer every minute
        setInterval(() => this.updateTimer(), 60000);
    }

    generateWeeklyTournamentId() {
        const now = new Date();
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        return `weekly-${startOfWeek.getFullYear()}-${startOfWeek.getMonth()}-${startOfWeek.getDate()}`;
    }

    renderTournamentInfo() {
        if (!window.userProgress) return;
        
        const tournamentProgress = window.userProgress.getTournamentProgress();
        const completedLevels = tournamentProgress.completedLevels.length;
        
        // Update completed levels
        if (this.levelsCompleted) {
            this.levelsCompleted.textContent = completedLevels;
        }
        
        // Update tournament score
        if (this.tournamentCurrentScore) {
            this.tournamentCurrentScore.textContent = tournamentProgress.totalScore.toLocaleString();
        }
        
        // Update participants (simulated)
        if (this.participantsCount) {
            this.participantsCount.textContent = Math.floor(Math.random() * 50) + 75; // 75-125 players
        }
        
        // Update rank (simulated based on completed levels and score)
        if (this.currentRank) {
            const rank = this.calculateUserRank(completedLevels, tournamentProgress.totalScore);
            this.currentRank.textContent = `#${rank}`;
        }
    }

    calculateUserRank(completedLevels, totalScore) {
        // Simulate ranking based on progress
        if (completedLevels === 0) return Math.floor(Math.random() * 20) + 80;
        if (completedLevels < 5) return Math.floor(Math.random() * 15) + 50;
        if (completedLevels < 10) return Math.floor(Math.random() * 10) + 25;
        if (completedLevels < 15) return Math.floor(Math.random() * 8) + 10;
        if (completedLevels < 20) return Math.floor(Math.random() * 5) + 3;
        return Math.floor(Math.random() * 2) + 1;
    }

    updateTimer() {
        if (!this.tournamentTimeLeft) return;
        
        const now = new Date();
        const nextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 7);
        const timeRemaining = nextWeek.getTime() - now.getTime();
        
        if (timeRemaining > 0) {
            const days = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
            const hours = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            this.tournamentTimeLeft.textContent = `${days}d ${hours}h`;
        } else {
            this.tournamentTimeLeft.textContent = 'Ended';
        }
    }

    renderLevels() {
        if (!this.tournamentLevels || !window.userProgress) return;
        
        const tournamentProgress = window.userProgress.getTournamentProgress();
        const completedLevels = tournamentProgress.completedLevels;
        const currentLevel = tournamentProgress.currentLevel;
        
        this.tournamentLevels.innerHTML = '';
        
        for (let i = 1; i <= 22; i++) {
            const levelElement = this.createLevelElement(i, completedLevels, currentLevel);
            this.tournamentLevels.appendChild(levelElement);
        }
    }

    createLevelElement(levelNumber, completedLevels, currentLevel) {
        const levelData = this.levelData[levelNumber - 1];
        const isCompleted = completedLevels.includes(levelNumber);
        const isCurrent = levelNumber === currentLevel;
        const isLocked = levelNumber > currentLevel;
        
        const levelElement = document.createElement('div');
        levelElement.className = 'level-node';
        
        if (isCompleted) {
            levelElement.classList.add('completed');
        } else if (isCurrent) {
            levelElement.classList.add('current');
        } else if (isLocked) {
            levelElement.classList.add('locked');
        }
        
        const levelContent = document.createElement('div');
        levelContent.className = 'level-content';
        
        const levelIcon = document.createElement('div');
        levelIcon.className = 'level-icon';
        levelIcon.textContent = isLocked ? '🔒' : levelData.icon;
        
        const levelNum = document.createElement('div');
        levelNum.className = 'level-number';
        levelNum.textContent = levelNumber;
        
        levelContent.appendChild(levelIcon);
        levelContent.appendChild(levelNum);
        
        // Add stars for completed levels
        if (isCompleted) {
            const stars = this.getStarsForLevel(levelNumber);
            const starsElement = document.createElement('div');
            starsElement.className = 'level-stars';
            
            for (let i = 0; i < 3; i++) {
                const star = document.createElement('span');
                star.className = 'star';
                star.textContent = i < stars ? '⭐' : '☆';
                starsElement.appendChild(star);
            }
            
            levelElement.appendChild(starsElement);
        }
        
        // Add path connector (except for last level)
        if (levelNumber < 22) {
            const pathElement = document.createElement('div');
            pathElement.className = 'level-path';
            if (isCompleted) {
                pathElement.classList.add('completed');
            }
            levelElement.appendChild(pathElement);
        }
        
        levelElement.appendChild(levelContent);
        
        // Add click handler
        if (!isLocked) {
            levelElement.addEventListener('click', () => this.showLevelDetails(levelNumber));
        }
        
        return levelElement;
    }

    getStarsForLevel(levelNumber) {
        if (!window.userProgress) return 0;
        
        // Simulate star rating based on performance
        // In a real implementation, this would be stored with level completion data
        const hash = levelNumber * 37; // Simple hash for consistency
        return 1 + (hash % 3); // 1-3 stars
    }

    showLevelDetails(levelNumber) {
        if (!window.userProgress) return;
        
        const levelData = this.levelData[levelNumber - 1];
        const tournamentProgress = window.userProgress.getTournamentProgress();
        const isCompleted = tournamentProgress.completedLevels.includes(levelNumber);
        const isCurrent = levelNumber === tournamentProgress.currentLevel;
        
        this.selectedLevel = levelNumber;
        
        // Update modal header
        if (this.modalLevelIcon) {
            this.modalLevelIcon.textContent = levelData.icon;
        }
        
        if (this.modalLevelName) {
            this.modalLevelName.textContent = levelData.name;
        }
        
        if (this.modalLevelNumber) {
            this.modalLevelNumber.textContent = `Level ${levelNumber}`;
        }
        
        // Update status
        this.updateLevelStatus(levelNumber, isCompleted, isCurrent);
        
        // Update constraints
        this.updateLevelConstraints(levelNumber);
        
        // Update rewards
        this.updateLevelRewards(levelNumber);
        
        // Update best score
        this.updateLevelBestScore(levelNumber, isCompleted);
        
        // Update play button
        this.updatePlayButton(levelNumber, isCompleted, isCurrent);
        
        // Show modal
        this.levelModal?.classList.remove('hidden');
    }

    updateLevelStatus(levelNumber, isCompleted, isCurrent) {
        if (!this.levelStatus) return;
        
        let statusHTML = '';
        
        if (isCompleted) {
            const stars = this.getStarsForLevel(levelNumber);
            const starDisplay = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
            statusHTML = `
                <div class="status-badge completed">✅ Completed</div>
                <div style="margin-top: 0.5rem; font-size: 1.5rem;">${starDisplay}</div>
            `;
        } else if (isCurrent) {
            statusHTML = '<div class="status-badge available">🎯 Available</div>';
        } else {
            statusHTML = '<div class="status-badge locked">🔒 Locked</div>';
        }
        
        this.levelStatus.innerHTML = statusHTML;
    }

    updateLevelConstraints(levelNumber) {
        if (!this.levelConstraints) return;
        
        const constraints = this.getLevelConstraints(levelNumber);
        
        let constraintsHTML = '<h4>Level Constraints</h4>';
        
        constraints.forEach(constraint => {
            constraintsHTML += `
                <div class="constraint-item">
                    <span class="constraint-icon">${constraint.icon}</span>
                    <span>${constraint.text}</span>
                </div>
            `;
        });
        
        this.levelConstraints.innerHTML = constraintsHTML;
    }

    getLevelConstraints(levelNumber) {
        const constraints = [];
        
        // Add constraints based on level
        if (levelNumber > 15) {
            constraints.push({
                icon: '⏱️',
                text: `Time limit: ${Math.max(5, 15 - levelNumber)} minutes`
            });
        }
        
        if (levelNumber > 18) {
            constraints.push({
                icon: '🚫',
                text: 'No hints allowed'
            });
        }
        
        if (levelNumber > 20) {
            constraints.push({
                icon: '💯',
                text: 'Perfect play required (no mistakes)'
            });
        }
        
        if (constraints.length === 0) {
            constraints.push({
                icon: '🎯',
                text: 'Standard Sudoku rules apply'
            });
        }
        
        return constraints;
    }

    updateLevelRewards(levelNumber) {
        if (!this.levelRewards) return;
        
        const rewards = this.getLevelRewards(levelNumber);
        
        let rewardsHTML = '<h4>Completion Rewards</h4>';
        
        rewards.forEach(reward => {
            rewardsHTML += `
                <div class="reward-item">
                    <span class="reward-icon">${reward.icon}</span>
                    <span>${reward.text}</span>
                </div>
            `;
        });
        
        this.levelRewards.innerHTML = rewardsHTML;
    }

    getLevelRewards(levelNumber) {
        const basePoints = levelNumber * 100 + Math.floor(levelNumber / 5) * 250;
        
        const rewards = [
            {
                icon: '💎',
                text: `${basePoints.toLocaleString()} Tournament Points`
            }
        ];
        
        // Bonus rewards for milestones
        if (levelNumber % 5 === 0) {
            rewards.push({
                icon: '🏆',
                text: 'Milestone Achievement'
            });
        }
        
        if (levelNumber === 22) {
            rewards.push({
                icon: '👑',
                text: 'Tournament Champion Title'
            });
        }
        
        return rewards;
    }

    updateLevelBestScore(levelNumber, isCompleted) {
        if (!this.levelBestScore) return;
        
        if (!isCompleted) {
            this.levelBestScore.innerHTML = '';
            return;
        }
        
        // Simulate best score data
        const bestScore = (levelNumber * 1000 + Math.floor(Math.random() * 500)) * (1 + levelNumber * 0.1);
        const bestTime = Math.floor(Math.random() * 600000) + 180000; // 3-13 minutes
        
        const formatTime = (ms) => {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };
        
        this.levelBestScore.innerHTML = `
            <h4>Your Best Performance</h4>
            <div class="stat-row">
                <span class="stat-label">Score</span>
                <span class="stat-value">${Math.floor(bestScore).toLocaleString()}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Time</span>
                <span class="stat-value">${formatTime(bestTime)}</span>
            </div>
        `;
    }

    updatePlayButton(levelNumber, isCompleted, isCurrent) {
        if (!this.playLevelBtn) return;
        
        if (isCompleted) {
            this.playLevelBtn.innerHTML = '<span>🔄 Replay Level</span>';
            this.playLevelBtn.disabled = false;
        } else if (isCurrent) {
            this.playLevelBtn.innerHTML = '<span>🚀 Start Level</span>';
            this.playLevelBtn.disabled = false;
        } else {
            this.playLevelBtn.innerHTML = '<span>🔒 Locked</span>';
            this.playLevelBtn.disabled = true;
        }
    }

    playSelectedLevel() {
        if (!this.selectedLevel || !window.gameUI) return;
        
        this.closeLevelModal();
        
        try {
            const puzzleData = window.gameUI.generator.generateTournamentLevel(
                this.selectedLevel,
                this.currentTournamentId
            );
            window.gameUI.startNewGame(puzzleData.difficulty, puzzleData);
        } catch (error) {
            console.error('Failed to start tournament level:', error);
            window.gameUI.showError('Failed to start tournament level. Please try again.');
        }
    }

    showLeaderboard() {
        if (!this.leaderboardContent) return;
        
        const leaderboardData = this.generateLeaderboardData();
        
        let leaderboardHTML = '';
        
        leaderboardData.forEach((player, index) => {
            const rank = index + 1;
            let rankClass = '';
            let rankDisplay = `#${rank}`;
            
            if (rank === 1) {
                rankClass = 'first';
                rankDisplay = '🥇';
            } else if (rank === 2) {
                rankClass = 'second';
                rankDisplay = '🥈';
            } else if (rank === 3) {
                rankClass = 'third';
                rankDisplay = '🥉';
            }
            
            leaderboardHTML += `
                <div class="leaderboard-item ${player.isUser ? 'current-user' : ''}">
                    <div class="leaderboard-rank ${rankClass}">${rankDisplay}</div>
                    <div class="leaderboard-player">
                        <div class="player-name">${player.name}</div>
                        <div class="player-levels">${player.levelsCompleted}/22 levels</div>
                    </div>
                    <div class="leaderboard-score">${player.score.toLocaleString()}</div>
                </div>
            `;
        });
        
        this.leaderboardContent.innerHTML = leaderboardHTML;
        this.leaderboardModal?.classList.remove('hidden');
    }

    generateLeaderboardData() {
        const userProgress = window.userProgress ? window.userProgress.getTournamentProgress() : 
                           { completedLevels: [], totalScore: 0 };
        
        const players = [];
        
        // Add current user
        players.push({
            name: 'You',
            levelsCompleted: userProgress.completedLevels.length,
            score: userProgress.totalScore,
            isUser: true
        });
        
        // Generate mock players
        const names = [
            'PuzzleMaster', 'SudokuPro', 'GridWizard', 'NumberNinja', 'LogicLord',
            'BrainBox', 'MindBender', 'ThinkTank', 'QuickSolver', 'MathGenius',
            'PatternKing', 'DigitDancer', 'CellCrusher', 'RowRuler', 'ColChamp'
        ];
        
        for (let i = 0; i < 14; i++) {
            const levelsCompleted = Math.floor(Math.random() * 22) + 1;
            const avgScorePerLevel = 1000 + Math.random() * 2000;
            
            players.push({
                name: names[i] || `Player${i + 1}`,
                levelsCompleted: levelsCompleted,
                score: Math.floor(levelsCompleted * avgScorePerLevel),
                isUser: false
            });
        }
        
        // Sort by score descending
        players.sort((a, b) => b.score - a.score);
        
        return players.slice(0, 15); // Top 15 players
    }

    showRules() {
        const rulesModal = document.createElement('div');
        rulesModal.className = 'day-detail-modal';
        rulesModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🏆 Tournament Rules</h3>
                    <button class="close-modal-btn" onclick="this.closest('.day-detail-modal').remove()">
                        <svg viewBox="0 0 24 24" width="24" height="24">
                            <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="challenge-stats">
                        <h4>🎯 How to Play</h4>
                        <p>Complete levels in order to progress through the tropical islands. Each level has unique constraints and rewards!</p>
                        
                        <h4>⭐ Star System</h4>
                        <p>Earn 1-3 stars based on your performance:</p>
                        <ul>
                            <li><strong>1 Star:</strong> Complete the puzzle</li>
                            <li><strong>2 Stars:</strong> Complete with few mistakes</li>
                            <li><strong>3 Stars:</strong> Perfect completion (no mistakes or hints)</li>
                        </ul>
                        
                        <h4>🏆 Scoring</h4>
                        <p>Tournament points are awarded based on:</p>
                        <ul>
                            <li>Level completion (base points)</li>
                            <li>Speed bonus for fast completion</li>
                            <li>Perfect play bonus</li>
                            <li>Difficulty multiplier</li>
                        </ul>
                        
                        <h4>⚠️ Special Constraints</h4>
                        <ul>
                            <li><strong>Levels 16-22:</strong> Time limits apply</li>
                            <li><strong>Levels 19-22:</strong> No hints allowed</li>
                            <li><strong>Levels 21-22:</strong> Perfect play required</li>
                        </ul>
                        
                        <h4>🔄 Tournament Reset</h4>
                        <p>Tournaments reset weekly. Complete all 22 levels to become Tournament Champion!</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(rulesModal);
    }

    closeLevelModal() {
        this.levelModal?.classList.add('hidden');
        this.selectedLevel = null;
    }

    closeLeaderboard() {
        this.leaderboardModal?.classList.add('hidden');
    }

    refresh() {
        this.renderTournamentInfo();
        this.renderLevels();
        this.updateTimer();
    }

    // Public API for external integration
    getCurrentTournament() {
        return {
            id: this.currentTournamentId,
            progress: window.userProgress ? window.userProgress.getTournamentProgress() : null
        };
    }

    completeLevel(level, score, stars = 1) {
        if (window.userProgress) {
            window.userProgress.updateTournamentProgress(level, score, true);
            this.refresh();
        }
    }
}

if (typeof window !== 'undefined') {
    window.TournamentUI = TournamentUI;
}