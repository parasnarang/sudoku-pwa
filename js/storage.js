class DataStorage {
    constructor() {
        this.version = '1.0.0';
        this.prefix = 'sudoku-pwa';
        this.maxCacheAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        this.autoSaveInterval = 30000; // 30 seconds
        this.maxStorageItems = 100;
        
        this.storageKeys = {
            gameState: `${this.prefix}-current-game`,
            userStats: `${this.prefix}-user-stats`,
            settings: `${this.prefix}-settings`,
            dailyCache: `${this.prefix}-daily-cache`,
            tournamentProgress: `${this.prefix}-tournament-progress`,
            achievements: `${this.prefix}-achievements`,
            puzzleCache: `${this.prefix}-puzzle-cache`,
            metadata: `${this.prefix}-metadata`,
            backup: `${this.prefix}-backup`,
            version: `${this.prefix}-version`
        };

        this.isInitialized = false;
        this.autoSaveTimer = null;
        this.compressionSupported = false;
        
        this.initializeStorage();
    }

    async initializeStorage() {
        try {
            // Check if compression is supported
            this.compressionSupported = 'CompressionStream' in window;
            
            // Run version migration if needed
            await this.migrateData();
            
            // Initialize metadata
            await this.initializeMetadata();
            
            // Start periodic cleanup
            this.startPeriodicCleanup();
            
            this.isInitialized = true;
            console.log('Data storage initialized successfully');
            
        } catch (error) {
            console.error('Storage initialization failed:', error);
            this.isInitialized = false;
        }
    }

    // ====== GAME STATE MANAGEMENT ======

    async saveGameState(gameData, puzzleData = null) {
        try {
            const gameState = {
                version: this.version,
                timestamp: Date.now(),
                gameData: gameData,
                puzzleData: puzzleData,
                sessionId: this.generateSessionId(),
                checksum: this.generateChecksum(gameData)
            };

            const compressed = await this.compressData(gameState);
            localStorage.setItem(this.storageKeys.gameState, compressed);
            
            this.updateMetadata('lastGameSave', Date.now());
            
            return { success: true };
        } catch (error) {
            console.error('Failed to save game state:', error);
            return { success: false, error: error.message };
        }
    }

    async loadGameState() {
        try {
            const stored = localStorage.getItem(this.storageKeys.gameState);
            if (!stored) return { success: false, error: 'No saved game found' };

            const gameState = await this.decompressData(stored);
            
            // Validate checksum
            if (!this.validateChecksum(gameState.gameData, gameState.checksum)) {
                console.warn('Game state checksum validation failed');
            }
            
            // Check if game state is too old (7 days)
            const age = Date.now() - gameState.timestamp;
            if (age > 7 * 24 * 60 * 60 * 1000) {
                this.clearGameState();
                return { success: false, error: 'Saved game expired' };
            }

            return {
                success: true,
                gameData: gameState.gameData,
                puzzleData: gameState.puzzleData,
                timestamp: gameState.timestamp
            };
        } catch (error) {
            console.error('Failed to load game state:', error);
            return { success: false, error: error.message };
        }
    }

    clearGameState() {
        try {
            localStorage.removeItem(this.storageKeys.gameState);
            this.updateMetadata('lastGameClear', Date.now());
            return { success: true };
        } catch (error) {
            console.error('Failed to clear game state:', error);
            return { success: false, error: error.message };
        }
    }

    // ====== USER PROGRESS MANAGEMENT ======

    async saveUserProgress(progressData) {
        try {
            const userProgress = {
                version: this.version,
                timestamp: Date.now(),
                data: progressData,
                checksum: this.generateChecksum(progressData)
            };

            const compressed = await this.compressData(userProgress);
            localStorage.setItem(this.storageKeys.userStats, compressed);
            
            this.updateMetadata('lastProgressSave', Date.now());
            
            return { success: true };
        } catch (error) {
            console.error('Failed to save user progress:', error);
            return { success: false, error: error.message };
        }
    }

    async loadUserProgress() {
        try {
            const stored = localStorage.getItem(this.storageKeys.userStats);
            if (!stored) return { success: false, error: 'No user progress found' };

            const userProgress = await this.decompressData(stored);
            
            // Validate checksum
            if (!this.validateChecksum(userProgress.data, userProgress.checksum)) {
                console.warn('User progress checksum validation failed');
            }

            return {
                success: true,
                data: userProgress.data,
                timestamp: userProgress.timestamp
            };
        } catch (error) {
            console.error('Failed to load user progress:', error);
            return { success: false, error: error.message };
        }
    }

    // ====== SETTINGS MANAGEMENT ======

    saveSettings(settings) {
        try {
            const settingsData = {
                version: this.version,
                timestamp: Date.now(),
                data: settings
            };

            localStorage.setItem(this.storageKeys.settings, JSON.stringify(settingsData));
            this.updateMetadata('lastSettingsSave', Date.now());
            
            return { success: true };
        } catch (error) {
            console.error('Failed to save settings:', error);
            return { success: false, error: error.message };
        }
    }

    loadSettings() {
        try {
            const stored = localStorage.getItem(this.storageKeys.settings);
            if (!stored) return { success: false, error: 'No settings found' };

            const settingsData = JSON.parse(stored);
            
            return {
                success: true,
                data: settingsData.data,
                timestamp: settingsData.timestamp
            };
        } catch (error) {
            console.error('Failed to load settings:', error);
            return { success: false, error: error.message };
        }
    }

    // ====== DAILY PUZZLE CACHE ======

    async cacheDailyPuzzle(date, puzzleData) {
        try {
            const dateKey = this.formatDateKey(date);
            const cacheData = {
                date: dateKey,
                timestamp: Date.now(),
                puzzleData: puzzleData,
                checksum: this.generateChecksum(puzzleData)
            };

            // Get existing cache
            let cache = await this.loadDailyCache();
            if (!cache.success) {
                cache = { data: {} };
            }

            // Add new puzzle to cache
            cache.data[dateKey] = cacheData;

            // Clean old entries (keep only 30 days)
            cache.data = this.cleanOldCacheEntries(cache.data);

            // Save updated cache
            const compressed = await this.compressData(cache.data);
            localStorage.setItem(this.storageKeys.dailyCache, compressed);
            
            this.updateMetadata('lastCacheUpdate', Date.now());
            
            return { success: true };
        } catch (error) {
            console.error('Failed to cache daily puzzle:', error);
            return { success: false, error: error.message };
        }
    }

    async loadCachedDailyPuzzle(date) {
        try {
            const dateKey = this.formatDateKey(date);
            const cache = await this.loadDailyCache();
            
            if (!cache.success || !cache.data[dateKey]) {
                return { success: false, error: 'Puzzle not cached' };
            }

            const cachedPuzzle = cache.data[dateKey];
            
            // Check if cache is too old
            const age = Date.now() - cachedPuzzle.timestamp;
            if (age > this.maxCacheAge) {
                // Remove old entry
                delete cache.data[dateKey];
                await this.saveDailyCache(cache.data);
                return { success: false, error: 'Cached puzzle expired' };
            }

            // Validate checksum
            if (!this.validateChecksum(cachedPuzzle.puzzleData, cachedPuzzle.checksum)) {
                console.warn('Cached puzzle checksum validation failed');
            }

            return {
                success: true,
                puzzleData: cachedPuzzle.puzzleData,
                timestamp: cachedPuzzle.timestamp
            };
        } catch (error) {
            console.error('Failed to load cached puzzle:', error);
            return { success: false, error: error.message };
        }
    }

    async loadDailyCache() {
        try {
            const stored = localStorage.getItem(this.storageKeys.dailyCache);
            if (!stored) return { success: false, error: 'No cache found' };

            const cacheData = await this.decompressData(stored);
            return { success: true, data: cacheData };
        } catch (error) {
            console.error('Failed to load daily cache:', error);
            return { success: false, error: error.message };
        }
    }

    async saveDailyCache(cacheData) {
        try {
            const compressed = await this.compressData(cacheData);
            localStorage.setItem(this.storageKeys.dailyCache, compressed);
            return { success: true };
        } catch (error) {
            console.error('Failed to save daily cache:', error);
            return { success: false, error: error.message };
        }
    }

    // ====== BACKUP AND RESTORE ======

    async createBackup() {
        try {
            const backupData = {
                version: this.version,
                timestamp: Date.now(),
                data: {}
            };

            // Collect all data
            const gameState = await this.loadGameState();
            const userProgress = await this.loadUserProgress();
            const settings = this.loadSettings();
            const achievements = this.loadAchievements();
            const tournamentProgress = this.loadTournamentProgress();

            if (gameState.success) backupData.data.gameState = gameState;
            if (userProgress.success) backupData.data.userProgress = userProgress;
            if (settings.success) backupData.data.settings = settings;
            if (achievements.success) backupData.data.achievements = achievements;
            if (tournamentProgress.success) backupData.data.tournamentProgress = tournamentProgress;

            // Create backup
            const compressed = await this.compressData(backupData);
            const backupBlob = new Blob([compressed], { type: 'application/json' });
            
            // Save to localStorage as well
            localStorage.setItem(this.storageKeys.backup, compressed);
            this.updateMetadata('lastBackup', Date.now());

            return {
                success: true,
                blob: backupBlob,
                size: backupBlob.size,
                timestamp: backupData.timestamp
            };
        } catch (error) {
            console.error('Failed to create backup:', error);
            return { success: false, error: error.message };
        }
    }

    async restoreFromBackup(backupData) {
        try {
            let parsedData;
            
            if (typeof backupData === 'string') {
                parsedData = await this.decompressData(backupData);
            } else if (backupData instanceof Blob) {
                const text = await backupData.text();
                parsedData = await this.decompressData(text);
            } else {
                parsedData = backupData;
            }

            // Validate backup format
            if (!parsedData.version || !parsedData.data) {
                throw new Error('Invalid backup format');
            }

            const results = {};

            // Restore each data type
            if (parsedData.data.gameState && parsedData.data.gameState.success) {
                results.gameState = await this.saveGameState(
                    parsedData.data.gameState.gameData,
                    parsedData.data.gameState.puzzleData
                );
            }

            if (parsedData.data.userProgress && parsedData.data.userProgress.success) {
                results.userProgress = await this.saveUserProgress(parsedData.data.userProgress.data);
            }

            if (parsedData.data.settings && parsedData.data.settings.success) {
                results.settings = this.saveSettings(parsedData.data.settings.data);
            }

            if (parsedData.data.achievements && parsedData.data.achievements.success) {
                results.achievements = this.saveAchievements(parsedData.data.achievements.data);
            }

            if (parsedData.data.tournamentProgress && parsedData.data.tournamentProgress.success) {
                results.tournamentProgress = this.saveTournamentProgress(parsedData.data.tournamentProgress.data);
            }

            this.updateMetadata('lastRestore', Date.now());

            return {
                success: true,
                results: results,
                backupVersion: parsedData.version,
                backupTimestamp: parsedData.timestamp
            };
        } catch (error) {
            console.error('Failed to restore backup:', error);
            return { success: false, error: error.message };
        }
    }

    // ====== STORAGE QUOTA MANAGEMENT ======

    async getStorageQuota() {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                return {
                    supported: true,
                    quota: estimate.quota,
                    usage: estimate.usage,
                    available: estimate.quota - estimate.usage,
                    usageDetails: estimate.usageDetails
                };
            } else {
                // Fallback: estimate localStorage usage
                const usage = this.estimateLocalStorageUsage();
                return {
                    supported: false,
                    quota: 10 * 1024 * 1024, // Assume 10MB limit
                    usage: usage,
                    available: (10 * 1024 * 1024) - usage,
                    usageDetails: { localStorage: usage }
                };
            }
        } catch (error) {
            console.error('Failed to get storage quota:', error);
            return {
                supported: false,
                quota: 0,
                usage: 0,
                available: 0,
                error: error.message
            };
        }
    }

    estimateLocalStorageUsage() {
        let total = 0;
        for (const key in localStorage) {
            if (key.startsWith(this.prefix)) {
                total += localStorage[key].length + key.length;
            }
        }
        return total;
    }

    async cleanupStorage(aggressive = false) {
        try {
            const cleaned = {
                dailyCache: 0,
                puzzleCache: 0,
                oldBackups: 0,
                expiredData: 0
            };

            // Clean daily cache
            const cache = await this.loadDailyCache();
            if (cache.success) {
                const originalSize = Object.keys(cache.data).length;
                cache.data = this.cleanOldCacheEntries(cache.data);
                cleaned.dailyCache = originalSize - Object.keys(cache.data).length;
                await this.saveDailyCache(cache.data);
            }

            // Clean old game states
            const gameState = await this.loadGameState();
            if (gameState.success) {
                const age = Date.now() - gameState.timestamp;
                if (age > 7 * 24 * 60 * 60 * 1000) { // 7 days
                    this.clearGameState();
                    cleaned.expiredData++;
                }
            }

            // In aggressive mode, clean more data
            if (aggressive) {
                // Remove old backups except the most recent
                const backupKeys = Object.keys(localStorage)
                    .filter(key => key.startsWith(`${this.prefix}-backup-`))
                    .sort()
                    .slice(0, -1); // Keep only the last one

                backupKeys.forEach(key => {
                    localStorage.removeItem(key);
                    cleaned.oldBackups++;
                });
            }

            this.updateMetadata('lastCleanup', Date.now());

            return { success: true, cleaned: cleaned };
        } catch (error) {
            console.error('Storage cleanup failed:', error);
            return { success: false, error: error.message };
        }
    }

    // ====== AUTO-SAVE FUNCTIONALITY ======

    startAutoSave(gameUI) {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        this.autoSaveTimer = setInterval(async () => {
            if (gameUI?.engine && !gameUI.engine.gameState.isCompleted && !gameUI.engine.gameState.isFailed) {
                try {
                    const gameData = gameUI.engine.exportGameState();
                    await this.saveGameState(gameData, gameUI.currentPuzzle);
                    
                    // Dispatch auto-save event
                    window.dispatchEvent(new CustomEvent('autoSaveCompleted', {
                        detail: { timestamp: Date.now() }
                    }));
                } catch (error) {
                    console.error('Auto-save failed:', error);
                    window.dispatchEvent(new CustomEvent('autoSaveFailed', {
                        detail: { error: error.message }
                    }));
                }
            }
        }, this.autoSaveInterval);
    }

    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    // ====== UTILITY FUNCTIONS ======

    formatDateKey(date) {
        const d = date instanceof Date ? date : new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    cleanOldCacheEntries(cacheData) {
        const now = Date.now();
        const cleaned = {};
        
        Object.entries(cacheData).forEach(([key, entry]) => {
            const age = now - entry.timestamp;
            if (age <= this.maxCacheAge) {
                cleaned[key] = entry;
            }
        });
        
        return cleaned;
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    generateChecksum(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    validateChecksum(data, checksum) {
        return this.generateChecksum(data) === checksum;
    }

    async compressData(data) {
        try {
            const jsonString = JSON.stringify(data);
            
            if (!this.compressionSupported) {
                return jsonString;
            }

            const stream = new CompressionStream('gzip');
            const writer = stream.writable.getWriter();
            const reader = stream.readable.getReader();

            writer.write(new TextEncoder().encode(jsonString));
            writer.close();

            const chunks = [];
            let done = false;

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    chunks.push(value);
                }
            }

            const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
            let offset = 0;
            for (const chunk of chunks) {
                compressed.set(chunk, offset);
                offset += chunk.length;
            }

            return btoa(String.fromCharCode(...compressed));
        } catch (error) {
            console.warn('Compression failed, using uncompressed data:', error);
            return JSON.stringify(data);
        }
    }

    async decompressData(compressedData) {
        try {
            if (!this.compressionSupported || !compressedData.includes('/')) {
                // Not compressed or compression not supported
                return JSON.parse(compressedData);
            }

            const binaryString = atob(compressedData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const stream = new DecompressionStream('gzip');
            const writer = stream.writable.getWriter();
            const reader = stream.readable.getReader();

            writer.write(bytes);
            writer.close();

            const chunks = [];
            let done = false;

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    chunks.push(value);
                }
            }

            const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
            let offset = 0;
            for (const chunk of chunks) {
                decompressed.set(chunk, offset);
                offset += chunk.length;
            }

            const jsonString = new TextDecoder().decode(decompressed);
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('Decompression failed, trying as regular JSON:', error);
            return JSON.parse(compressedData);
        }
    }

    // ====== ACHIEVEMENTS & TOURNAMENT DATA ======

    saveAchievements(achievementsData) {
        try {
            const data = {
                version: this.version,
                timestamp: Date.now(),
                data: achievementsData
            };

            localStorage.setItem(this.storageKeys.achievements, JSON.stringify(data));
            return { success: true };
        } catch (error) {
            console.error('Failed to save achievements:', error);
            return { success: false, error: error.message };
        }
    }

    loadAchievements() {
        try {
            const stored = localStorage.getItem(this.storageKeys.achievements);
            if (!stored) return { success: false, error: 'No achievements found' };

            const data = JSON.parse(stored);
            return { success: true, data: data.data, timestamp: data.timestamp };
        } catch (error) {
            console.error('Failed to load achievements:', error);
            return { success: false, error: error.message };
        }
    }

    saveTournamentProgress(progressData) {
        try {
            const data = {
                version: this.version,
                timestamp: Date.now(),
                data: progressData
            };

            localStorage.setItem(this.storageKeys.tournamentProgress, JSON.stringify(data));
            return { success: true };
        } catch (error) {
            console.error('Failed to save tournament progress:', error);
            return { success: false, error: error.message };
        }
    }

    loadTournamentProgress() {
        try {
            const stored = localStorage.getItem(this.storageKeys.tournamentProgress);
            if (!stored) return { success: false, error: 'No tournament progress found' };

            const data = JSON.parse(stored);
            return { success: true, data: data.data, timestamp: data.timestamp };
        } catch (error) {
            console.error('Failed to load tournament progress:', error);
            return { success: false, error: error.message };
        }
    }

    // ====== METADATA AND MIGRATION ======

    async initializeMetadata() {
        const metadata = {
            version: this.version,
            initialized: Date.now(),
            lastCleanup: Date.now(),
            storageUsage: await this.getStorageQuota()
        };

        localStorage.setItem(this.storageKeys.metadata, JSON.stringify(metadata));
    }

    updateMetadata(key, value) {
        try {
            const stored = localStorage.getItem(this.storageKeys.metadata);
            const metadata = stored ? JSON.parse(stored) : {};
            
            metadata[key] = value;
            metadata.lastUpdate = Date.now();
            
            localStorage.setItem(this.storageKeys.metadata, JSON.stringify(metadata));
        } catch (error) {
            console.error('Failed to update metadata:', error);
        }
    }

    async migrateData() {
        try {
            const storedVersion = localStorage.getItem(this.storageKeys.version);
            
            if (!storedVersion || storedVersion !== this.version) {
                console.log(`Migrating data from ${storedVersion || 'unknown'} to ${this.version}`);
                
                // Perform any necessary data migrations here
                // For now, just update the version
                localStorage.setItem(this.storageKeys.version, this.version);
                
                this.updateMetadata('lastMigration', Date.now());
                this.updateMetadata('migratedFrom', storedVersion || 'unknown');
            }
        } catch (error) {
            console.error('Data migration failed:', error);
        }
    }

    startPeriodicCleanup() {
        // Run cleanup every 24 hours
        setInterval(async () => {
            const quota = await this.getStorageQuota();
            
            // If usage is over 80% of quota, run cleanup
            if (quota.usage / quota.quota > 0.8) {
                console.log('Storage usage high, running cleanup...');
                await this.cleanupStorage(true);
            } else {
                // Regular cleanup
                await this.cleanupStorage(false);
            }
        }, 24 * 60 * 60 * 1000);
    }

    // ====== PUBLIC API ======

    async getStorageInfo() {
        const quota = await this.getStorageQuota();
        const metadata = JSON.parse(localStorage.getItem(this.storageKeys.metadata) || '{}');
        
        const info = {
            version: this.version,
            initialized: this.isInitialized,
            quota: quota,
            metadata: metadata,
            keys: Object.keys(localStorage).filter(key => key.startsWith(this.prefix))
        };

        return info;
    }

    async exportAllData() {
        try {
            const backup = await this.createBackup();
            if (backup.success) {
                return {
                    success: true,
                    data: backup.blob,
                    size: backup.size,
                    timestamp: backup.timestamp
                };
            } else {
                return backup;
            }
        } catch (error) {
            console.error('Failed to export data:', error);
            return { success: false, error: error.message };
        }
    }

    async clearAllData() {
        try {
            const keys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
            keys.forEach(key => localStorage.removeItem(key));
            
            this.stopAutoSave();
            
            // Reinitialize
            await this.initializeStorage();
            
            return { success: true, clearedKeys: keys.length };
        } catch (error) {
            console.error('Failed to clear all data:', error);
            return { success: false, error: error.message };
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.DataStorage = DataStorage;
}