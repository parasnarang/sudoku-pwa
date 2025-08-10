class CalendarUI {
    constructor() {
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.selectedDate = null;
        
        this.monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.monthYearDisplay = document.getElementById('calendar-month-year');
        this.completionDisplay = document.getElementById('calendar-completion');
        this.progressFill = document.getElementById('calendar-progress-fill');
        this.calendarGrid = document.getElementById('calendar-grid');
        this.streakDisplay = document.getElementById('current-streak-display');
        
        this.prevMonthBtn = document.getElementById('prev-month-btn');
        this.nextMonthBtn = document.getElementById('next-month-btn');
        this.todayBtn = document.getElementById('today-btn');
        
        this.perfectDays = document.getElementById('perfect-days');
        this.speedCompletions = document.getElementById('speed-completions');
        this.noHintDays = document.getElementById('no-hint-days');
        
        this.dayModal = document.getElementById('day-detail-modal');
        this.modalDate = document.getElementById('modal-date');
        this.modalStatus = document.getElementById('modal-status');
        this.modalStats = document.getElementById('modal-stats');
        this.closeModalBtn = document.getElementById('close-modal-btn');
        this.playChallengeBtn = document.getElementById('play-challenge-btn');
        this.viewSolutionBtn = document.getElementById('view-solution-btn');
    }

    setupEventListeners() {
        this.prevMonthBtn?.addEventListener('click', () => this.previousMonth());
        this.nextMonthBtn?.addEventListener('click', () => this.nextMonth());
        this.todayBtn?.addEventListener('click', () => this.goToToday());
        
        this.closeModalBtn?.addEventListener('click', () => this.closeModal());
        this.dayModal?.addEventListener('click', (e) => {
            if (e.target === this.dayModal) {
                this.closeModal();
            }
        });
        
        this.playChallengeBtn?.addEventListener('click', () => this.playSelectedChallenge());
        this.viewSolutionBtn?.addEventListener('click', () => this.viewSolution());
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.dayModal.classList.contains('hidden')) {
                this.closeModal();
            }
        });
    }

    initialize() {
        this.renderCalendar();
        this.updateStats();
    }

    renderCalendar() {
        if (!this.calendarGrid) return;
        
        this.updateMonthYearDisplay();
        this.generateCalendarDays();
        this.updateProgress();
    }

    updateMonthYearDisplay() {
        if (!this.monthYearDisplay) return;
        this.monthYearDisplay.textContent = `${this.monthNames[this.currentMonth]} ${this.currentYear}`;
    }

    generateCalendarDays() {
        if (!this.calendarGrid) return;
        
        this.calendarGrid.innerHTML = '';
        
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            const prevMonthDay = new Date(this.currentYear, this.currentMonth, -i);
            const dayElement = this.createDayElement(prevMonthDay.getDate(), true, prevMonthDay);
            this.calendarGrid.appendChild(dayElement);
        }
        
        // Add days of the current month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(this.currentYear, this.currentMonth, day);
            const dayElement = this.createDayElement(day, false, date);
            this.calendarGrid.appendChild(dayElement);
        }
        
        // Fill remaining cells for next month's days
        const totalCells = this.calendarGrid.children.length;
        const remainingCells = 42 - totalCells; // 6 weeks * 7 days
        
        for (let i = 1; i <= remainingCells; i++) {
            const nextMonthDay = new Date(this.currentYear, this.currentMonth + 1, i);
            const dayElement = this.createDayElement(i, true, nextMonthDay);
            this.calendarGrid.appendChild(dayElement);
        }
    }

    createDayElement(dayNumber, isOtherMonth, date) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = dayNumber;
        
        const today = new Date();
        const dateString = date.toISOString().split('T')[0];
        
        if (isOtherMonth) {
            dayElement.classList.add('other-month');
        } else {
            // Add status classes for current month days
            if (this.isSameDay(date, today)) {
                dayElement.classList.add('today');
            }
            
            if (date > today) {
                dayElement.classList.add('locked');
            } else {
                const challengeData = this.getChallengeData(dateString);
                
                if (challengeData.completed) {
                    dayElement.classList.add('completed');
                    
                    if (challengeData.perfect) {
                        dayElement.classList.add('perfect');
                    }
                } else if (date < today) {
                    dayElement.classList.add('missed');
                }
            }
            
            // Add click event for current month days
            dayElement.addEventListener('click', () => this.showDayDetails(date));
        }
        
        return dayElement;
    }

    getChallengeData(dateString) {
        if (!window.userProgress) {
            return { completed: false, perfect: false, score: 0, time: 0, mistakes: 0, hintsUsed: 0 };
        }
        
        const challenge = window.userProgress.stats.dailyChallenges[dateString];
        if (!challenge || !challenge.completed) {
            return { completed: false, perfect: false, score: 0, time: 0, mistakes: 0, hintsUsed: 0 };
        }
        
        return {
            completed: true,
            perfect: challenge.mistakes === 0 && challenge.hintsUsed === 0,
            score: challenge.score || 0,
            time: challenge.time || 0,
            mistakes: challenge.mistakes || 0,
            hintsUsed: challenge.hintsUsed || 0
        };
    }

    updateProgress() {
        if (!window.userProgress || !this.completionDisplay || !this.progressFill) return;
        
        const stats = window.userProgress.getCompletionStats(this.currentMonth, this.currentYear);
        
        this.completionDisplay.textContent = `${stats.completed}/${stats.total} completed`;
        this.progressFill.style.width = `${stats.percentage}%`;
    }

    updateStats() {
        if (!window.userProgress) return;
        
        const stats = window.userProgress.getDisplayStats();
        const monthlyStats = this.calculateMonthlyStats();
        
        // Update streak display
        if (this.streakDisplay) {
            this.streakDisplay.textContent = stats.currentStreak;
        }
        
        // Update monthly achievements
        if (this.perfectDays) {
            this.perfectDays.textContent = `${monthlyStats.perfectDays} Perfect Days`;
        }
        
        if (this.speedCompletions) {
            this.speedCompletions.textContent = `${monthlyStats.speedRuns} Speed Runs`;
        }
        
        if (this.noHintDays) {
            this.noHintDays.textContent = `${monthlyStats.noHintDays} No-Hint Days`;
        }
    }

    calculateMonthlyStats() {
        if (!window.userProgress) {
            return { perfectDays: 0, speedRuns: 0, noHintDays: 0 };
        }
        
        let perfectDays = 0;
        let speedRuns = 0;
        let noHintDays = 0;
        
        const dailyChallenges = window.userProgress.stats.dailyChallenges;
        
        // Get all days in current month
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(this.currentYear, this.currentMonth, day);
            const dateString = date.toISOString().split('T')[0];
            const challenge = dailyChallenges[dateString];
            
            if (challenge && challenge.completed) {
                if (challenge.mistakes === 0 && challenge.hintsUsed === 0) {
                    perfectDays++;
                }
                
                if (challenge.time && challenge.time < 300000) { // Under 5 minutes
                    speedRuns++;
                }
                
                if (challenge.hintsUsed === 0) {
                    noHintDays++;
                }
            }
        }
        
        return { perfectDays, speedRuns, noHintDays };
    }

    showDayDetails(date) {
        const today = new Date();
        const dateString = date.toISOString().split('T')[0];
        const challengeData = this.getChallengeData(dateString);
        
        this.selectedDate = date;
        
        // Update modal content
        if (this.modalDate) {
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            };
            this.modalDate.textContent = date.toLocaleDateString('en-US', options);
        }
        
        // Update status
        this.updateModalStatus(date, today, challengeData);
        
        // Update stats
        this.updateModalStats(challengeData);
        
        // Update action buttons
        this.updateModalActions(date, today, challengeData);
        
        // Show modal
        this.dayModal?.classList.remove('hidden');
    }

    updateModalStatus(date, today, challengeData) {
        if (!this.modalStatus) return;
        
        let statusHTML = '';
        
        if (date > today) {
            statusHTML = '<div class="status-badge locked">🔒 Locked</div>';
        } else if (challengeData.completed) {
            const badges = ['<div class="status-badge completed">✅ Completed</div>'];
            
            if (challengeData.perfect) {
                badges.push('<div class="status-badge perfect">💯 Perfect</div>');
            }
            
            statusHTML = badges.join('');
        } else if (this.isSameDay(date, today)) {
            statusHTML = '<div class="status-badge available">🎯 Today\'s Challenge</div>';
        } else {
            statusHTML = '<div class="status-badge missed">❌ Missed</div>';
        }
        
        this.modalStatus.innerHTML = statusHTML;
    }

    updateModalStats(challengeData) {
        if (!this.modalStats) return;
        
        if (!challengeData.completed) {
            this.modalStats.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No data available</p>';
            return;
        }
        
        const formatTime = (ms) => {
            if (!ms) return '00:00';
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };
        
        const statsHTML = `
            <div class="stat-row">
                <span class="stat-label">Score</span>
                <span class="stat-value">${challengeData.score.toLocaleString()}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Time</span>
                <span class="stat-value">${formatTime(challengeData.time)}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Mistakes</span>
                <span class="stat-value">${challengeData.mistakes}/3</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Hints Used</span>
                <span class="stat-value">${challengeData.hintsUsed}/3</span>
            </div>
        `;
        
        this.modalStats.innerHTML = statsHTML;
    }

    updateModalActions(date, today, challengeData) {
        if (!this.playChallengeBtn || !this.viewSolutionBtn) return;
        
        if (date > today) {
            // Future date - locked
            this.playChallengeBtn.textContent = 'Locked';
            this.playChallengeBtn.disabled = true;
            this.viewSolutionBtn.classList.add('hidden');
        } else if (challengeData.completed) {
            // Completed challenge
            this.playChallengeBtn.textContent = 'Play Again';
            this.playChallengeBtn.disabled = false;
            this.viewSolutionBtn.classList.remove('hidden');
        } else {
            // Available challenge
            this.playChallengeBtn.textContent = this.isSameDay(date, today) ? 'Play Today' : 'Play Challenge';
            this.playChallengeBtn.disabled = false;
            this.viewSolutionBtn.classList.add('hidden');
        }
    }

    playSelectedChallenge() {
        if (!this.selectedDate) return;
        
        this.closeModal();
        
        if (window.gameUI) {
            window.gameUI.startDailyChallenge(this.selectedDate);
        }
    }

    viewSolution() {
        // This would show the solution for completed challenges
        // Implementation would depend on how solutions are stored/displayed
        alert('Solution view feature coming soon!');
    }

    closeModal() {
        this.dayModal?.classList.add('hidden');
        this.selectedDate = null;
    }

    previousMonth() {
        if (this.currentMonth === 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else {
            this.currentMonth--;
        }
        this.renderCalendar();
        this.updateStats();
    }

    nextMonth() {
        if (this.currentMonth === 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else {
            this.currentMonth++;
        }
        this.renderCalendar();
        this.updateStats();
    }

    goToToday() {
        const today = new Date();
        this.currentMonth = today.getMonth();
        this.currentYear = today.getFullYear();
        this.renderCalendar();
        this.updateStats();
    }

    navigateToDate(date) {
        this.currentMonth = date.getMonth();
        this.currentYear = date.getFullYear();
        this.renderCalendar();
        this.updateStats();
        
        // Optionally show day details
        setTimeout(() => this.showDayDetails(date), 300);
    }

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    refresh() {
        this.renderCalendar();
        this.updateStats();
    }

    // Public API for router integration
    getCurrentMonth() {
        return {
            month: this.currentMonth,
            year: this.currentYear
        };
    }

    setCurrentMonth(month, year) {
        this.currentMonth = month;
        this.currentYear = year;
        this.renderCalendar();
        this.updateStats();
    }
}

if (typeof window !== 'undefined') {
    window.CalendarUI = CalendarUI;
}