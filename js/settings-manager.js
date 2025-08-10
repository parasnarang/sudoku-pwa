class SettingsManager {
    constructor(dataStorage = null) {
        this.dataStorage = dataStorage;

        this.defaultSettings = {
            version: '1.0.0',
            theme: 'light', // light, dark, auto
            sound: {
                enabled: true,
                volume: 0.7,
                cellClick: true,
                completion: true,
                error: true,
                hint: true
            },
            gameplay: {
                autoSave: true,
                highlightErrors: true,
                highlightIdentical: true,
                highlightRegions: true,
                autoNotes: false,
                notesMode: false,
                showTimer: true,
                pauseOnFocusLoss: true
            },
            display: {
                animations: true,
                transitions: true,
                reducedMotion: false,
                fontSize: 'medium', // small, medium, large
                colorScheme: 'default', // default, high-contrast, colorblind-friendly
                showGridLines: true,
                showProgress: true
            },
            difficulty: {
                defaultDifficulty: 'medium',
                showHints: true,
                maxHints: 3,
                allowMistakes: 3,
                enableUndoRedo: true
            },
            privacy: {
                analytics: false,
                crashReporting: true,
                personalizedAds: false,
                dataSaving: false
            },
            notifications: {
                dailyReminder: true,
                tournamentUpdates: true,
                achievements: true,
                reminderTime: '18:00'
            }
        };

        this.settings = { ...this.defaultSettings };
        this.settingsChangeListeners = [];

        this.loadSettings();
    }

    async loadSettings() {
        try {
            let result;
            if (this.dataStorage) {
                result = await this.dataStorage.loadSettings();
            } else {
                const saved = localStorage.getItem('sudoku-settings');
                result = saved ? { success: true, data: JSON.parse(saved) } : { success: false };
            }

            if (result.success) {
                this.settings = this.mergeSettings(this.defaultSettings, result.data);
                this.applySettings();
                this.notifySettingsChanged('all');
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.settings = { ...this.defaultSettings };
        }
    }

    async saveSettings() {
        try {
            if (this.dataStorage) {
                const result = await this.dataStorage.saveSettings(this.settings);
                if (!result.success) {
                    console.error('Failed to save settings:', result.error);
                    return result;
                }
            } else {
                localStorage.setItem('sudoku-settings', JSON.stringify(this.settings));
            }

            return { success: true };
        } catch (error) {
            console.error('Failed to save settings:', error);
            return { success: false, error: error.message };
        }
    }

    mergeSettings(defaults, saved) {
        const merged = { ...defaults };

        Object.keys(saved).forEach(key => {
            if (typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])) {
                merged[key] = { ...defaults[key], ...saved[key] };
            } else {
                merged[key] = saved[key];
            }
        });

        return merged;
    }

    // ====== GETTERS AND SETTERS ======

    get(path) {
        const keys = path.split('.');
        let value = this.settings;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }

        return value;
    }

    async set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.settings;

        for (const key of keys) {
            if (!(key in target) || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key];
        }

        const oldValue = target[lastKey];
        target[lastKey] = value;

        const result = await this.saveSettings();
        if (result.success) {
            this.applySettings();
            this.notifySettingsChanged(path, value, oldValue);
        }

        return result;
    }

    async toggle(path) {
        const currentValue = this.get(path);
        if (typeof currentValue === 'boolean') {
            return await this.set(path, !currentValue);
        }
        return { success: false, error: 'Value is not boolean' };
    }

    // ====== SPECIFIC SETTING METHODS ======

    async setTheme(theme) {
        if (!['light', 'dark', 'auto'].includes(theme)) {
            return { success: false, error: 'Invalid theme' };
        }
        return await this.set('theme', theme);
    }

    async setSoundEnabled(enabled) {
        return await this.set('sound.enabled', enabled);
    }

    async setSoundVolume(volume) {
        if (volume < 0 || volume > 1) {
            return { success: false, error: 'Volume must be between 0 and 1' };
        }
        return await this.set('sound.volume', volume);
    }

    async setDefaultDifficulty(difficulty) {
        if (!['easy', 'medium', 'hard', 'expert'].includes(difficulty)) {
            return { success: false, error: 'Invalid difficulty' };
        }
        return await this.set('difficulty.defaultDifficulty', difficulty);
    }

    async setNotificationTime(time) {
        // Validate time format (HH:MM)
        if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
            return { success: false, error: 'Invalid time format' };
        }
        return await this.set('notifications.reminderTime', time);
    }

    // ====== APPLY SETTINGS ======

    applySettings() {
        this.applyTheme();
        this.applyDisplay();
        this.applyAccessibility();
        this.applyGameplay();
    }

    applyTheme() {
        const theme = this.get('theme');
        const root = document.documentElement;

        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            root.setAttribute('data-theme', theme);
        }
    }

    applyDisplay() {
        const root = document.documentElement;

        // Animations
        if (!this.get('display.animations')) {
            root.style.setProperty('--animation-duration', '0ms');
        } else {
            root.style.removeProperty('--animation-duration');
        }

        // Reduced motion
        if (this.get('display.reducedMotion')) {
            root.classList.add('reduced-motion');
        } else {
            root.classList.remove('reduced-motion');
        }

        // Font size
        const fontSize = this.get('display.fontSize');
        root.setAttribute('data-font-size', fontSize);

        // Color scheme
        const colorScheme = this.get('display.colorScheme');
        root.setAttribute('data-color-scheme', colorScheme);
    }

    applyAccessibility() {
        const root = document.documentElement;

        // High contrast mode
        if (this.get('display.colorScheme') === 'high-contrast') {
            root.classList.add('high-contrast');
        } else {
            root.classList.remove('high-contrast');
        }

        // Reduced motion for users with motion sensitivity
        if (this.get('display.reducedMotion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            root.classList.add('reduced-motion');
        }
    }

    applyGameplay() {
        // Gameplay settings are applied directly by game components
        // This method can be used to set up global gameplay behaviors
    }

    // ====== EVENT HANDLING ======

    addSettingsChangeListener(callback) {
        this.settingsChangeListeners.push(callback);
    }

    removeSettingsChangeListener(callback) {
        const index = this.settingsChangeListeners.indexOf(callback);
        if (index > -1) {
            this.settingsChangeListeners.splice(index, 1);
        }
    }

    notifySettingsChanged(path, newValue = null, oldValue = null) {
        const event = {
            path,
            newValue: newValue !== null ? newValue : this.get(path),
            oldValue,
            timestamp: Date.now(),
            settings: this.getAllSettings()
        };

        this.settingsChangeListeners.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Settings change listener error:', error);
            }
        });

        // Dispatch global event
        window.dispatchEvent(new CustomEvent('settingsChanged', {
            detail: event
        }));
    }

    // ====== BACKUP AND RESTORE ======

    getAllSettings() {
        return { ...this.settings };
    }

    async restoreSettings(settingsData) {
        try {
            if (!settingsData || typeof settingsData !== 'object') {
                return { success: false, error: 'Invalid settings data' };
            }

            this.settings = this.mergeSettings(this.defaultSettings, settingsData);

            const result = await this.saveSettings();
            if (result.success) {
                this.applySettings();
                this.notifySettingsChanged('all');
            }

            return result;
        } catch (error) {
            console.error('Failed to restore settings:', error);
            return { success: false, error: error.message };
        }
    }

    async resetToDefaults() {
        try {
            this.settings = { ...this.defaultSettings };

            const result = await this.saveSettings();
            if (result.success) {
                this.applySettings();
                this.notifySettingsChanged('all');
            }

            return result;
        } catch (error) {
            console.error('Failed to reset settings:', error);
            return { success: false, error: error.message };
        }
    }

    // ====== EXPORT AND IMPORT ======

    exportSettings() {
        return {
            version: this.settings.version,
            settings: this.getAllSettings(),
            exportDate: new Date().toISOString(),
            appVersion: '1.0.0'
        };
    }

    async importSettings(exportedData) {
        try {
            if (!exportedData || !exportedData.settings) {
                return { success: false, error: 'Invalid export data' };
            }

            // Version compatibility check
            if (exportedData.version && exportedData.version !== this.settings.version) {
                console.warn(`Importing settings from version ${exportedData.version} to ${this.settings.version}`);
            }

            return await this.restoreSettings(exportedData.settings);
        } catch (error) {
            console.error('Failed to import settings:', error);
            return { success: false, error: error.message };
        }
    }

    // ====== VALIDATION ======

    validateSettings(settings) {
        const errors = [];

        // Theme validation
        if (settings.theme && !['light', 'dark', 'auto'].includes(settings.theme)) {
            errors.push('Invalid theme value');
        }

        // Sound volume validation
        if (settings.sound?.volume !== undefined && (settings.sound.volume < 0 || settings.sound.volume > 1)) {
            errors.push('Sound volume must be between 0 and 1');
        }

        // Difficulty validation
        if (settings.difficulty?.defaultDifficulty && !['easy', 'medium', 'hard', 'expert'].includes(settings.difficulty.defaultDifficulty)) {
            errors.push('Invalid default difficulty');
        }

        // Notification time validation
        if (settings.notifications?.reminderTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(settings.notifications.reminderTime)) {
            errors.push('Invalid notification time format');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // ====== UTILITY METHODS ======

    isDarkMode() {
        const theme = this.get('theme');
        if (theme === 'dark') { return true; }
        if (theme === 'light') { return false; }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    getDisplaySettings() {
        return this.get('display');
    }

    getGameplaySettings() {
        return this.get('gameplay');
    }

    getSoundSettings() {
        return this.get('sound');
    }
}

// Auto-detect system preferences
if (typeof window !== 'undefined') {
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (window.settingsManager && window.settingsManager.get('theme') === 'auto') {
            window.settingsManager.applyTheme();
        }
    });

    // Listen for reduced motion preference
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => {
        if (window.settingsManager) {
            window.settingsManager.applyAccessibility();
        }
    });

    window.SettingsManager = SettingsManager;
}
