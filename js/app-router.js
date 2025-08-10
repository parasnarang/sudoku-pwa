class AppRouter {
    constructor() {
        this.routes = {
            '/': 'homepage',
            '/daily': 'calendar-page',
            '/daily/:date': 'calendar-page',
            '/tournament': 'tournament-page',
            '/tournament/:level': 'tournament-page',
            '/game': 'game-page',
            '/game/:type': 'game-page',
            '/profile': 'profile-page',
            '/achievements': 'profile-page'
        };

        this.currentRoute = null;
        this.params = {};
        this.isNavigating = false;

        this.initializeRouter();
    }

    initializeRouter() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', e => {
            if (e.state) {
                this.navigateToRoute(e.state.route, e.state.params, false);
            } else {
                this.navigateToRoute('/', {}, false);
            }
        });

        // Handle initial page load
        const initialRoute = this.parseCurrentURL();
        this.navigateToRoute(initialRoute.path, initialRoute.params, false);
    }

    parseCurrentURL() {
        const path = window.location.pathname;
        const { search } = window.location;
        const { hash } = window.location;

        // Extract parameters from URL
        const params = {};

        // Parse query parameters
        if (search) {
            const urlParams = new URLSearchParams(search);
            urlParams.forEach((value, key) => {
                params[key] = value;
            });
        }

        // Parse hash parameters for client-side routing
        let routePath = path === '/' && hash ? hash.slice(1) : path;
        if (routePath === '') { routePath = '/'; }

        // Extract route parameters (like :date in /daily/:date)
        const routeParams = this.extractRouteParams(routePath);
        Object.assign(params, routeParams.params);

        return {
            path: routeParams.route,
            params
        };
    }

    extractRouteParams(path) {
        for (const [routePattern, pageId] of Object.entries(this.routes)) {
            const regex = this.routeToRegex(routePattern);
            const match = path.match(regex);

            if (match) {
                const params = {};
                const paramNames = this.getParamNames(routePattern);

                paramNames.forEach((paramName, index) => {
                    params[paramName] = match[index + 1];
                });

                return {
                    route: routePattern,
                    params,
                    pageId
                };
            }
        }

        // Default to home if no route matches
        return {
            route: '/',
            params: {},
            pageId: 'homepage'
        };
    }

    routeToRegex(route) {
        const escaped = route.replace(/\//g, '\\/');
        const withParams = escaped.replace(/:[^\/]+/g, '([^\/]+)');
        return new RegExp(`^${withParams}$`);
    }

    getParamNames(route) {
        const matches = route.match(/:([^\/]+)/g);
        return matches ? matches.map(match => match.slice(1)) : [];
    }

    navigateTo(path, params = {}, addToHistory = true) {
        if (this.isNavigating) { return; }

        this.navigateToRoute(path, params, addToHistory);
    }

    async navigateToRoute(routePath, params = {}, addToHistory = true) {
        if (this.isNavigating) { return; }

        this.isNavigating = true;

        try {
            // Show loading state
            this.showLoadingState();

            const routeInfo = this.extractRouteParams(routePath);
            const targetPageId = routeInfo.pageId;

            // Update URL if needed
            if (addToHistory) {
                const url = this.buildURL(routePath, params);
                window.history.pushState(
                    { route: routePath, params },
                    '',
                    url
                );
            }

            // Update current route info
            this.currentRoute = routePath;
            this.params = { ...params, ...routeInfo.params };

            // Handle special routing logic
            await this.handleRouteTransition(targetPageId, this.params);

            // Update page visibility with animation
            await this.switchToPage(targetPageId);

            // Update navigation state
            this.updateNavigation(targetPageId);

            // Update page title and header
            this.updatePageHeader(targetPageId, this.params);

            // Trigger route change event
            this.dispatchRouteChange(routePath, this.params);
        } catch (error) {
            console.error('Navigation error:', error);
        } finally {
            this.isNavigating = false;
            this.hideLoadingState();
        }
    }

    buildURL(routePath, params) {
        let url = routePath;

        // Replace route parameters
        Object.entries(params).forEach(([key, value]) => {
            url = url.replace(`:${key}`, value);
        });

        // Add query parameters for remaining params
        const queryParams = Object.entries(params)
            .filter(([key]) => !routePath.includes(`:${key}`))
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);

        if (queryParams.length > 0) {
            url += `?${queryParams.join('&')}`;
        }

        return url;
    }

    async handleRouteTransition(pageId, params) {
        // Handle special cases for different pages
        switch (pageId) {
            case 'calendar-page':
                if (params.date && window.gameUI) {
                    // Auto-start daily challenge for specific date
                    const challengeDate = new Date(params.date);
                    if (!isNaN(challengeDate.getTime())) {
                        window.gameUI.startDailyChallenge(challengeDate);
                        return; // Will show game page instead
                    }
                }
                break;

            case 'tournament-page':
                if (params.level && window.gameUI && window.tournamentUI) {
                    // Auto-start tournament level
                    const level = parseInt(params.level);
                    if (level >= 1 && level <= 22) {
                        setTimeout(() => {
                            window.tournamentUI.showLevelDetails(level);
                        }, 300);
                    }
                }
                break;

            case 'game-page':
                if (params.type && window.gameUI) {
                    switch (params.type) {
                        case 'daily':
                            window.gameUI.startDailyChallenge();
                            break;
                        case 'new':
                        case 'random':
                            window.gameUI.startNewGame('medium');
                            break;
                    }
                }
                break;
        }
    }

    async switchToPage(targetPageId) {
        const currentPage = document.querySelector('.page.active');
        const targetPage = document.getElementById(targetPageId);

        if (!targetPage) {
            console.error('Target page not found:', targetPageId);
            return;
        }

        if (currentPage === targetPage) {
            return; // Already on the target page
        }

        // Add transition classes
        if (currentPage) {
            currentPage.classList.add('page-exit');
        }
        targetPage.classList.add('page-enter');

        // Small delay to ensure classes are applied
        await new Promise(resolve => requestAnimationFrame(resolve));

        // Switch pages
        if (currentPage) {
            currentPage.classList.remove('active', 'page-exit');
        }
        targetPage.classList.add('active');
        targetPage.classList.remove('page-enter');

        // Trigger page-specific initialization
        this.initializePage(targetPageId);
    }

    initializePage(pageId) {
        // Trigger page-specific setup
        const event = new CustomEvent('pageInitialized', {
            detail: { pageId, params: this.params }
        });
        document.dispatchEvent(event);

        // Handle specific page initialization
        switch (pageId) {
            case 'homepage':
                this.initializeHomepage();
                break;
            case 'calendar-page':
                this.initializeCalendar();
                break;
            case 'tournament-page':
                this.initializeTournament();
                break;
            case 'profile-page':
                this.initializeProfile();
                break;
        }
    }

    initializeHomepage() {
        // Update homepage statistics
        if (window.userProgress) {
            const stats = window.userProgress.getDisplayStats();
            const completionStats = window.userProgress.getCompletionStats();

            // Update UI elements
            document.getElementById('best-score').textContent = stats.bestScore;
            document.getElementById('win-streak').textContent = stats.currentStreak;
            document.getElementById('tournament-score').textContent = stats.tournamentScore;

            // Update tournament timer (placeholder)
            this.updateTournamentTimer();
        }
    }

    initializeCalendar() {
        if (!window.calendarUI) {
            window.calendarUI = new CalendarUI();
        }

        // Handle date parameter for direct navigation
        if (this.params.date) {
            const targetDate = new Date(this.params.date);
            if (!isNaN(targetDate.getTime())) {
                window.calendarUI.navigateToDate(targetDate);
            }
        } else {
            window.calendarUI.initialize();
        }
    }

    initializeTournament() {
        if (!window.tournamentUI) {
            window.tournamentUI = new TournamentUI();
        }

        window.tournamentUI.initialize();

        // Handle level parameter for direct navigation
        if (this.params.level) {
            const level = parseInt(this.params.level);
            if (level >= 1 && level <= 22) {
                setTimeout(() => {
                    window.tournamentUI.showLevelDetails(level);
                }, 300);
            }
        }
    }

    initializeProfile() {
        if (window.userProgress && window.settingsManager) {
            this.updateProfileStats();
            this.setupSettingsControls();
            this.updateStorageInfo();
            this.updatePWAFeatures();
        }
    }

    updateProfileStats() {
        const stats = window.userProgress.getDisplayStats();

        document.getElementById('profile-games-played').textContent = stats.gamesPlayed;
        document.getElementById('profile-achievements-count').textContent = stats.achievements;
        document.getElementById('profile-current-streak').textContent = stats.currentStreak;

        // Determine player level based on games completed
        const gamesCompleted = parseInt(stats.gamesCompleted.replace(/,/g, ''));
        let level = 'Beginner';
        if (gamesCompleted >= 100) { level = 'Expert'; } else if (gamesCompleted >= 50) { level = 'Advanced'; } else if (gamesCompleted >= 20) { level = 'Intermediate'; } else if (gamesCompleted >= 5) { level = 'Novice'; }

        document.getElementById('profile-level').textContent = `${level} Level`;
    }

    setupSettingsControls() {
        const settings = window.settingsManager;

        // Theme selector
        const themeSelect = document.getElementById('theme-select');
        themeSelect.value = settings.get('theme');
        themeSelect.addEventListener('change', e => {
            settings.setTheme(e.target.value);
        });

        // Font size selector
        const fontSizeSelect = document.getElementById('font-size-select');
        fontSizeSelect.value = settings.get('display.fontSize');
        fontSizeSelect.addEventListener('change', e => {
            settings.set('display.fontSize', e.target.value);
        });

        // Animation toggle
        const animationsToggle = document.getElementById('animations-toggle');
        animationsToggle.checked = settings.get('display.animations');
        animationsToggle.addEventListener('change', e => {
            settings.set('display.animations', e.target.checked);
        });

        // Reduced motion toggle
        const reducedMotionToggle = document.getElementById('reduced-motion-toggle');
        reducedMotionToggle.checked = settings.get('display.reducedMotion');
        reducedMotionToggle.addEventListener('change', e => {
            settings.set('display.reducedMotion', e.target.checked);
        });

        // Default difficulty
        const defaultDifficultySelect = document.getElementById('default-difficulty-select');
        defaultDifficultySelect.value = settings.get('difficulty.defaultDifficulty');
        defaultDifficultySelect.addEventListener('change', e => {
            settings.setDefaultDifficulty(e.target.value);
        });

        // Auto save toggle
        const autoSaveToggle = document.getElementById('auto-save-toggle');
        autoSaveToggle.checked = settings.get('gameplay.autoSave');
        autoSaveToggle.addEventListener('change', e => {
            settings.set('gameplay.autoSave', e.target.checked);
        });

        // Highlight errors toggle
        const highlightErrorsToggle = document.getElementById('highlight-errors-toggle');
        highlightErrorsToggle.checked = settings.get('gameplay.highlightErrors');
        highlightErrorsToggle.addEventListener('change', e => {
            settings.set('gameplay.highlightErrors', e.target.checked);
        });

        // Show timer toggle
        const showTimerToggle = document.getElementById('show-timer-toggle');
        showTimerToggle.checked = settings.get('gameplay.showTimer');
        showTimerToggle.addEventListener('change', e => {
            settings.set('gameplay.showTimer', e.target.checked);
        });

        // Sound enabled toggle
        const soundEnabledToggle = document.getElementById('sound-enabled-toggle');
        soundEnabledToggle.checked = settings.get('sound.enabled');
        soundEnabledToggle.addEventListener('change', e => {
            settings.setSoundEnabled(e.target.checked);
        });

        // Sound volume range
        const soundVolumeRange = document.getElementById('sound-volume-range');
        soundVolumeRange.value = settings.get('sound.volume');
        soundVolumeRange.addEventListener('input', e => {
            settings.setSoundVolume(parseFloat(e.target.value));
        });

        // Daily reminder toggle
        const dailyReminderToggle = document.getElementById('daily-reminder-toggle');
        dailyReminderToggle.checked = settings.get('notifications.dailyReminder');
        dailyReminderToggle.addEventListener('change', e => {
            settings.set('notifications.dailyReminder', e.target.checked);
        });

        // Reminder time input
        const reminderTimeInput = document.getElementById('reminder-time-input');
        reminderTimeInput.value = settings.get('notifications.reminderTime');
        reminderTimeInput.addEventListener('change', e => {
            settings.setNotificationTime(e.target.value);
        });

        // Achievement notifications toggle
        const achievementNotificationsToggle = document.getElementById('achievement-notifications-toggle');
        achievementNotificationsToggle.checked = settings.get('notifications.achievements');
        achievementNotificationsToggle.addEventListener('change', e => {
            settings.set('notifications.achievements', e.target.checked);
        });

        // Data management buttons
        this.setupDataManagementControls();
    }

    setupDataManagementControls() {
        // Backup data button
        document.getElementById('backup-data-btn').addEventListener('click', async() => {
            if (!window.dataStorage) { return; }

            try {
                const backup = await window.dataStorage.createBackup();
                if (backup.success) {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(backup.blob);
                    link.download = `sudoku-backup-${new Date().toISOString()
                        .split('T')[0]}.json`;
                    link.click();

                    this.showToast('Backup downloaded successfully!');
                } else {
                    this.showToast(`Failed to create backup: ${backup.error}`, 'error');
                }
            } catch (error) {
                this.showToast(`Backup failed: ${error.message}`, 'error');
            }
        });

        // Restore data button
        document.getElementById('restore-data-btn').addEventListener('click', () => {
            document.getElementById('restore-file-input').click();
        });

        document.getElementById('restore-file-input').addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file || !window.dataStorage) { return; }

            try {
                const text = await file.text();
                const backupData = JSON.parse(text);

                const result = await window.dataStorage.restoreFromBackup(backupData);
                if (result.success) {
                    this.showToast('Data restored successfully! Reloading...');
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    this.showToast(`Restore failed: ${result.error}`, 'error');
                }
            } catch (error) {
                this.showToast('Invalid backup file', 'error');
            }
        });

        // Reset data button
        document.getElementById('reset-data-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
                if (confirm('This will delete all your progress, settings, and achievements. Continue?')) {
                    this.resetAllData();
                }
            }
        });

        // Cleanup storage button
        document.getElementById('cleanup-storage-btn').addEventListener('click', async() => {
            if (!window.dataStorage) { return; }

            try {
                const result = await window.dataStorage.cleanupStorage();
                if (result.success) {
                    this.showToast(`Cleanup completed! Removed ${Object.values(result.cleaned).reduce((a, b) => a + b, 0)} items`);
                    this.updateStorageInfo();
                } else {
                    this.showToast(`Cleanup failed: ${result.error}`, 'error');
                }
            } catch (error) {
                this.showToast(`Cleanup failed: ${error.message}`, 'error');
            }
        });
    }

    async updateStorageInfo() {
        if (!window.dataStorage) { return; }

        try {
            const quota = await window.dataStorage.getStorageQuota();
            const usagePercent = quota.quota > 0 ? Math.round((quota.usage / quota.quota) * 100) : 0;

            const storageBar = document.getElementById('storage-usage-bar');
            const storageDetails = document.getElementById('storage-details');

            storageBar.style.width = `${Math.min(usagePercent, 100)}%`;

            const formatBytes = bytes => {
                if (bytes === 0) { return '0 Bytes'; }
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
            };

            storageDetails.textContent = `${formatBytes(quota.usage)} used of ${formatBytes(quota.quota)} (${usagePercent}%)`;
        } catch (error) {
            console.error('Failed to update storage info:', error);
            document.getElementById('storage-details').textContent = 'Storage info unavailable';
        }
    }

    async resetAllData() {
        try {
            if (window.dataStorage) {
                await window.dataStorage.clearAllData();
            }
            if (window.settingsManager) {
                await window.settingsManager.resetToDefaults();
            }

            this.showToast('All data reset successfully! Reloading...');
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            this.showToast(`Reset failed: ${error.message}`, 'error');
        }
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${type === 'error' ? '#f44336' : '#4caf50'};
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

    updatePWAFeatures() {
        if (!window.pwaManager) { return; }

        // Update install status
        const installStatus = window.pwaManager.getInstallStatus();
        const installStatusText = document.getElementById('install-status-text');
        const profileInstallBtn = document.getElementById('profile-install-btn');

        if (installStatus.isInstalled) {
            installStatusText.textContent = 'App is installed';
            profileInstallBtn.style.display = 'none';
            document.getElementById('install-date').textContent = 'Installed';
        } else if (installStatus.canInstall) {
            installStatusText.textContent = 'Ready to install';
            profileInstallBtn.style.display = 'block';
            profileInstallBtn.addEventListener('click', () => {
                window.pwaManager.showInstallPrompt();
            });
        } else {
            installStatusText.textContent = 'Install not available';
            profileInstallBtn.style.display = 'none';
        }

        // Update network status
        const networkStatus = window.pwaManager.getNetworkStatus();
        const networkStatusText = document.getElementById('network-status-text');
        const syncQueueStatus = document.getElementById('sync-queue-status');

        networkStatusText.textContent = networkStatus.isOnline ? 'Online' : 'Offline';
        syncQueueStatus.textContent = `Sync queue: ${networkStatus.syncQueueSize} items`;

        // Update notification status
        const notificationStatus = document.getElementById('notification-status');
        const enableNotificationsBtn = document.getElementById('enable-notifications-btn');

        if ('Notification' in window) {
            const { permission } = Notification;
            notificationStatus.textContent = permission === 'granted' ? 'Enabled' : 'Disabled';

            if (permission === 'default') {
                enableNotificationsBtn.textContent = 'Enable Notifications';
                enableNotificationsBtn.addEventListener('click', () => {
                    window.pwaManager.requestNotificationPermission();
                });
            } else if (permission === 'denied') {
                enableNotificationsBtn.textContent = 'Blocked';
                enableNotificationsBtn.disabled = true;
            } else {
                enableNotificationsBtn.textContent = 'Enabled';
                enableNotificationsBtn.disabled = true;
            }
        } else {
            notificationStatus.textContent = 'Not supported';
            enableNotificationsBtn.style.display = 'none';
        }

        // Update check button
        document.getElementById('check-updates-btn').addEventListener('click', async() => {
            const button = document.getElementById('check-updates-btn');
            button.textContent = 'Checking...';
            button.disabled = true;

            try {
                const hasUpdate = await window.pwaManager.checkForUpdates();
                if (hasUpdate) {
                    this.showToast('Update available! Please refresh the page.', 'info');
                } else {
                    this.showToast('App is up to date', 'success');
                }
            } catch (error) {
                this.showToast('Failed to check for updates', 'error');
            }

            button.textContent = 'Check for Updates';
            button.disabled = false;
        });

        // Update service worker status
        const swStatus = document.getElementById('sw-status');
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                swStatus.textContent = registration.active ? 'Active' : 'Inactive';
            }).catch(() => {
                swStatus.textContent = 'Not registered';
            });
        } else {
            swStatus.textContent = 'Not supported';
        }
    }

    updateTournamentTimer() {
        // Calculate time remaining in current tournament
        const now = new Date();
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const timeRemaining = weekEnd.getTime() - now.getTime();

        if (timeRemaining > 0) {
            const days = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
            const hours = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

            const timerElement = document.getElementById('tournament-timer');
            if (timerElement) {
                timerElement.textContent = `${days}d ${hours.toString().padStart(2, '0')}h`;
            }
        }
    }

    updateNavigation(activePageId) {
        // Update bottom navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === activePageId) {
                item.classList.add('active');
            }
        });
    }

    updatePageHeader(pageId, params) {
        const titles = {
            homepage: 'Sudoku Master',
            'calendar-page': 'Daily Challenges',
            'tournament-page': 'Tournament',
            'game-page': 'Sudoku',
            'profile-page': 'Profile'
        };

        const title = titles[pageId] || 'Sudoku Master';
        document.getElementById('page-title').textContent = title;

        // Update back button visibility
        const backBtn = document.getElementById('back-btn');
        if (pageId === 'homepage') {
            backBtn.classList.add('hidden');
        } else {
            backBtn.classList.remove('hidden');
        }
    }

    showLoadingState() {
        // Add loading indicator
        const loader = document.createElement('div');
        loader.id = 'route-loader';
        loader.className = 'route-loader';
        loader.innerHTML = '<div class="route-loader-spinner"></div>';
        document.body.appendChild(loader);
    }

    hideLoadingState() {
        const loader = document.getElementById('route-loader');
        if (loader) {
            loader.remove();
        }
    }

    dispatchRouteChange(route, params) {
        const event = new CustomEvent('routeChanged', {
            detail: { route, params }
        });
        window.dispatchEvent(event);
    }

    // Public API methods
    getCurrentRoute() {
        return {
            route: this.currentRoute,
            params: { ...this.params }
        };
    }

    goBack() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            this.navigateTo('/');
        }
    }

    // Shortcut methods for common navigation
    goToHome() {
        this.navigateTo('/');
    }

    goToDaily(date = null) {
        if (date) {
            const dateString = date instanceof Date ? date.toISOString().split('T')[0] : date;
            this.navigateTo(`/daily/${dateString}`);
        } else {
            this.navigateTo('/daily');
        }
    }

    goToTournament(level = null) {
        if (level) {
            this.navigateTo(`/tournament/${level}`);
        } else {
            this.navigateTo('/tournament');
        }
    }

    goToGame(type = null) {
        if (type) {
            this.navigateTo(`/game/${type}`);
        } else {
            this.navigateTo('/game');
        }
    }

    goToProfile() {
        this.navigateTo('/profile');
    }
}

if (typeof window !== 'undefined') {
    window.AppRouter = AppRouter;
}
