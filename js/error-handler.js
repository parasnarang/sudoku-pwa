/**
 * Global Error Handler and Recovery System
 * Provides comprehensive error handling, logging, and recovery mechanisms
 */

class ErrorHandler {
    constructor() {
        this.errors = [];
        this.recoveryStrategies = new Map();
        this.maxErrorHistory = 100;
        this.isInitialized = false;
        this.errorCounts = new Map();
        this.lastErrorTime = new Map();
        this.rateLimitWindow = 60000; // 1 minute
        this.maxErrorsPerWindow = 10;
        
        this.setupErrorListeners();
        this.registerRecoveryStrategies();
        this.isInitialized = true;
    }

    setupErrorListeners() {
        // JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: Date.now(),
                source: 'window.error'
            });
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'promise-rejection',
                message: event.reason?.message || 'Unhandled promise rejection',
                stack: event.reason?.stack,
                reason: event.reason,
                timestamp: Date.now(),
                source: 'unhandledrejection'
            });
        });

        // Resource loading errors
        document.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleError({
                    type: 'resource-error',
                    message: `Failed to load resource: ${event.target.tagName}`,
                    source: event.target.src || event.target.href || 'unknown',
                    element: event.target.tagName,
                    timestamp: Date.now()
                });
            }
        }, true);

        // Network errors (for fetch requests)
        this.interceptFetch();
        
        // Custom application errors
        window.addEventListener('app-error', (event) => {
            this.handleError({
                type: 'application',
                ...event.detail,
                timestamp: Date.now(),
                source: 'app-error'
            });
        });
    }

    interceptFetch() {
        const originalFetch = window.fetch;
        
        window.fetch = async (...args) => {
            try {
                const response = await originalFetch.apply(window, args);
                
                if (!response.ok) {
                    this.handleError({
                        type: 'network-error',
                        message: `HTTP ${response.status}: ${response.statusText}`,
                        url: args[0],
                        status: response.status,
                        statusText: response.statusText,
                        timestamp: Date.now(),
                        source: 'fetch'
                    });
                }
                
                return response;
            } catch (error) {
                this.handleError({
                    type: 'network-error',
                    message: error.message,
                    url: args[0],
                    stack: error.stack,
                    timestamp: Date.now(),
                    source: 'fetch'
                });
                throw error;
            }
        };
    }

    handleError(errorData) {
        // Rate limiting to prevent error spam
        if (this.isRateLimited(errorData)) {
            return;
        }

        // Add to error history
        this.errors.unshift(errorData);
        if (this.errors.length > this.maxErrorHistory) {
            this.errors = this.errors.slice(0, this.maxErrorHistory);
        }

        // Update error counts
        const errorKey = `${errorData.type}:${errorData.message}`;
        this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
        this.lastErrorTime.set(errorKey, Date.now());

        // Log the error
        this.logError(errorData);

        // Attempt recovery
        this.attemptRecovery(errorData);

        // Notify performance monitor if available
        if (window.performanceMonitor) {
            window.performanceMonitor.trackError(errorData);
        }

        // Store error for analytics
        this.storeErrorForAnalytics(errorData);
    }

    isRateLimited(errorData) {
        const errorKey = `${errorData.type}:${errorData.message}`;
        const lastTime = this.lastErrorTime.get(errorKey) || 0;
        const now = Date.now();
        
        if (now - lastTime < this.rateLimitWindow) {
            const count = this.errorCounts.get(errorKey) || 0;
            if (count >= this.maxErrorsPerWindow) {
                return true;
            }
        } else {
            // Reset count if outside window
            this.errorCounts.set(errorKey, 0);
        }
        
        return false;
    }

    logError(errorData) {
        const logMessage = this.formatErrorMessage(errorData);
        
        // Console logging with appropriate level
        switch (errorData.type) {
            case 'javascript':
            case 'promise-rejection':
                console.error('🚨', logMessage, errorData);
                break;
            case 'network-error':
                console.warn('🌐', logMessage, errorData);
                break;
            case 'resource-error':
                console.warn('📁', logMessage, errorData);
                break;
            case 'application':
                console.error('⚙️', logMessage, errorData);
                break;
            default:
                console.log('❓', logMessage, errorData);
        }
    }

    formatErrorMessage(errorData) {
        let message = `[${errorData.type.toUpperCase()}] ${errorData.message}`;
        
        if (errorData.filename) {
            message += ` (${errorData.filename}:${errorData.lineno}:${errorData.colno})`;
        }
        
        if (errorData.url) {
            message += ` URL: ${errorData.url}`;
        }
        
        if (errorData.source) {
            message += ` Source: ${errorData.source}`;
        }
        
        return message;
    }

    registerRecoveryStrategies() {
        // Storage quota exceeded
        this.recoveryStrategies.set('quota-exceeded', async (errorData) => {
            console.log('🧹 Attempting storage cleanup for quota exceeded error');
            
            if (window.dataStorage) {
                try {
                    const cleanupResult = await window.dataStorage.cleanupStorage();
                    if (cleanupResult.success) {
                        console.log('✅ Storage cleanup successful');
                        return { success: true, action: 'storage-cleanup' };
                    }
                } catch (cleanupError) {
                    console.error('Failed to cleanup storage:', cleanupError);
                }
            }
            
            return { success: false, action: 'storage-cleanup' };
        });

        // Network error recovery
        this.recoveryStrategies.set('network-error', async (errorData) => {
            console.log('🔄 Attempting network error recovery');
            
            // Check if we're back online
            if (!navigator.onLine) {
                console.log('📵 Still offline, queueing for later sync');
                return { success: false, action: 'queue-for-sync' };
            }
            
            // Retry the request if it's a temporary failure
            if (errorData.status >= 500 || errorData.status === 0) {
                console.log('🔁 Retrying network request');
                return { success: false, action: 'retry-later' };
            }
            
            return { success: false, action: 'no-recovery' };
        });

        // Corrupted data recovery
        this.recoveryStrategies.set('corrupted-data', async (errorData) => {
            console.log('🔧 Attempting corrupted data recovery');
            
            if (window.dataStorage) {
                try {
                    // Try to restore from backup
                    const backupData = localStorage.getItem('sudoku-pwa-backup-data');
                    if (backupData) {
                        const parsed = JSON.parse(backupData);
                        const restoreResult = await window.dataStorage.restoreFromBackup(parsed);
                        if (restoreResult.success) {
                            console.log('✅ Data restored from backup');
                            return { success: true, action: 'restore-from-backup' };
                        }
                    }
                    
                    // Clear corrupted data and start fresh
                    await window.dataStorage.clearAllData();
                    console.log('🗑️ Corrupted data cleared, starting fresh');
                    return { success: true, action: 'clear-and-restart' };
                } catch (error) {
                    console.error('Failed to recover corrupted data:', error);
                }
            }
            
            return { success: false, action: 'manual-intervention' };
        });

        // Game state corruption recovery
        this.recoveryStrategies.set('game-state-error', async (errorData) => {
            console.log('🎮 Attempting game state recovery');
            
            if (window.gameUI && window.dataStorage) {
                try {
                    // Try to load a backup game state
                    const backupState = await window.dataStorage.loadGameStateBackup();
                    if (backupState.success) {
                        const importResult = window.gameUI.engine.importGameState(backupState.data);
                        if (importResult.success) {
                            console.log('✅ Game state restored from backup');
                            return { success: true, action: 'restore-game-backup' };
                        }
                    }
                    
                    // Clear current state and offer to start new game
                    await window.dataStorage.clearGameState();
                    console.log('🎯 Game state cleared, ready for new game');
                    this.showRecoveryNotification('Game state was corrupted and has been reset. You can start a new game.');
                    return { success: true, action: 'reset-game-state' };
                } catch (error) {
                    console.error('Failed to recover game state:', error);
                }
            }
            
            return { success: false, action: 'manual-intervention' };
        });

        // Memory leak recovery
        this.recoveryStrategies.set('memory-leak', async (errorData) => {
            console.log('🧠 Attempting memory leak recovery');
            
            try {
                // Clear large caches
                if (window.dataStorage) {
                    await window.dataStorage.cleanupExpiredCache();
                }
                
                // Clear performance monitor history
                if (window.performanceMonitor) {
                    window.performanceMonitor.cleanup();
                }
                
                // Force garbage collection if available
                if (typeof gc === 'function') {
                    gc();
                }
                
                console.log('🧹 Memory cleanup completed');
                return { success: true, action: 'memory-cleanup' };
            } catch (error) {
                console.error('Failed to recover from memory leak:', error);
                return { success: false, action: 'manual-intervention' };
            }
        });
    }

    async attemptRecovery(errorData) {
        const recoveryKey = this.getRecoveryKey(errorData);
        const strategy = this.recoveryStrategies.get(recoveryKey);
        
        if (strategy) {
            console.log(`🔧 Attempting recovery strategy: ${recoveryKey}`);
            
            try {
                const result = await strategy(errorData);
                
                if (result.success) {
                    console.log(`✅ Recovery successful: ${result.action}`);
                    this.logRecoverySuccess(errorData, result);
                } else {
                    console.warn(`⚠️ Recovery failed: ${result.action}`);
                    this.logRecoveryFailure(errorData, result);
                }
                
                return result;
            } catch (recoveryError) {
                console.error('🚨 Recovery strategy itself failed:', recoveryError);
                this.handleError({
                    type: 'recovery-failure',
                    message: `Recovery strategy failed: ${recoveryError.message}`,
                    originalError: errorData,
                    stack: recoveryError.stack,
                    timestamp: Date.now(),
                    source: 'error-handler'
                });
            }
        }
        
        return { success: false, action: 'no-strategy' };
    }

    getRecoveryKey(errorData) {
        if (errorData.message?.includes('QuotaExceededError') || errorData.message?.includes('quota exceeded')) {
            return 'quota-exceeded';
        }
        
        if (errorData.type === 'network-error') {
            return 'network-error';
        }
        
        if (errorData.message?.includes('JSON') || errorData.message?.includes('parse')) {
            return 'corrupted-data';
        }
        
        if (errorData.message?.includes('game state') || errorData.source?.includes('game')) {
            return 'game-state-error';
        }
        
        if (errorData.message?.includes('memory') || errorData.message?.includes('heap')) {
            return 'memory-leak';
        }
        
        return 'default';
    }

    logRecoverySuccess(errorData, result) {
        const recoveryLog = {
            originalError: errorData,
            recovery: result,
            timestamp: Date.now(),
            success: true
        };
        
        // Store in recovery log
        const recoveryHistory = JSON.parse(localStorage.getItem('sudoku-pwa-recovery-log') || '[]');
        recoveryHistory.unshift(recoveryLog);
        
        // Keep only recent recovery attempts
        const trimmedHistory = recoveryHistory.slice(0, 50);
        localStorage.setItem('sudoku-pwa-recovery-log', JSON.stringify(trimmedHistory));
    }

    logRecoveryFailure(errorData, result) {
        const recoveryLog = {
            originalError: errorData,
            recovery: result,
            timestamp: Date.now(),
            success: false
        };
        
        // Store in recovery log
        const recoveryHistory = JSON.parse(localStorage.getItem('sudoku-pwa-recovery-log') || '[]');
        recoveryHistory.unshift(recoveryLog);
        
        const trimmedHistory = recoveryHistory.slice(0, 50);
        localStorage.setItem('sudoku-pwa-recovery-log', JSON.stringify(trimmedHistory));
        
        // Show user notification for critical failures
        if (this.isCriticalError(errorData)) {
            this.showCriticalErrorNotification(errorData, result);
        }
    }

    isCriticalError(errorData) {
        const criticalTypes = ['javascript', 'promise-rejection', 'application'];
        const criticalMessages = ['Cannot read', 'undefined', 'null', 'TypeError'];
        
        return criticalTypes.includes(errorData.type) ||
               criticalMessages.some(msg => errorData.message?.includes(msg));
    }

    showCriticalErrorNotification(errorData, recoveryResult) {
        const notification = document.createElement('div');
        notification.className = 'critical-error-notification';
        notification.innerHTML = `
            <div class="error-notification-content">
                <div class="error-icon">⚠️</div>
                <div class="error-details">
                    <div class="error-title">Application Error Detected</div>
                    <div class="error-message">An error occurred and automatic recovery failed. The app may not work correctly.</div>
                    <div class="error-actions">
                        <button class="error-btn error-btn-primary" onclick="window.location.reload()">Reload App</button>
                        <button class="error-btn error-btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Dismiss</button>
                    </div>
                </div>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 400px;
            background: #ffebee;
            border: 2px solid #f44336;
            border-radius: 8px;
            padding: 20px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
        
        document.body.appendChild(notification);
    }

    showRecoveryNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'recovery-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4caf50;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    storeErrorForAnalytics(errorData) {
        try {
            const analyticsData = {
                error: {
                    type: errorData.type,
                    message: errorData.message,
                    source: errorData.source,
                    timestamp: errorData.timestamp
                },
                context: {
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    },
                    online: navigator.onLine,
                    storage: this.getStorageInfo()
                }
            };
            
            // Store for later transmission
            const analyticsQueue = JSON.parse(localStorage.getItem('sudoku-pwa-analytics-queue') || '[]');
            analyticsQueue.push(analyticsData);
            
            // Keep only recent items
            const trimmedQueue = analyticsQueue.slice(-100);
            localStorage.setItem('sudoku-pwa-analytics-queue', JSON.stringify(trimmedQueue));
        } catch (error) {
            // Silently fail analytics storage to prevent recursive errors
            console.warn('Failed to store error for analytics:', error.message);
        }
    }

    getStorageInfo() {
        try {
            const storage = {
                localStorageUsed: 0,
                sessionStorageUsed: 0
            };
            
            // Calculate localStorage usage
            let localStorageSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    localStorageSize += localStorage[key].length;
                }
            }
            storage.localStorageUsed = localStorageSize;
            
            // Calculate sessionStorage usage
            let sessionStorageSize = 0;
            for (let key in sessionStorage) {
                if (sessionStorage.hasOwnProperty(key)) {
                    sessionStorageSize += sessionStorage[key].length;
                }
            }
            storage.sessionStorageUsed = sessionStorageSize;
            
            return storage;
        } catch (error) {
            return { error: 'Cannot access storage info' };
        }
    }

    // Public API methods

    reportError(message, context = {}) {
        this.handleError({
            type: 'application',
            message: message,
            context: context,
            timestamp: Date.now(),
            source: 'manual-report'
        });
    }

    getErrorHistory(limit = 10) {
        return this.errors.slice(0, limit);
    }

    getErrorStatistics() {
        const stats = {
            total: this.errors.length,
            byType: {},
            recentErrors: this.errors.slice(0, 5),
            topErrors: []
        };
        
        // Count by type
        this.errors.forEach(error => {
            stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
        });
        
        // Get top errors by frequency
        const errorFrequency = new Map();
        this.errors.forEach(error => {
            const key = `${error.type}:${error.message}`;
            errorFrequency.set(key, (errorFrequency.get(key) || 0) + 1);
        });
        
        stats.topErrors = Array.from(errorFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([error, count]) => ({ error, count }));
        
        return stats;
    }

    clearErrorHistory() {
        this.errors = [];
        this.errorCounts.clear();
        this.lastErrorTime.clear();
        localStorage.removeItem('sudoku-pwa-recovery-log');
        localStorage.removeItem('sudoku-pwa-analytics-queue');
        console.log('✅ Error history cleared');
    }

    isHealthy() {
        const recentErrors = this.errors.filter(error => 
            Date.now() - error.timestamp < 60000 // Last minute
        );
        
        const criticalRecentErrors = recentErrors.filter(error =>
            this.isCriticalError(error)
        );
        
        return {
            healthy: criticalRecentErrors.length < 3,
            recentErrors: recentErrors.length,
            criticalErrors: criticalRecentErrors.length,
            lastError: this.errors[0] || null
        };
    }

    // Advanced recovery features
    async performHealthCheck() {
        const healthStatus = {
            timestamp: Date.now(),
            healthy: true,
            issues: []
        };
        
        try {
            // Check storage health
            if (window.dataStorage) {
                try {
                    await window.dataStorage.saveGameState({ test: 'health-check' });
                    await window.dataStorage.loadGameState();
                } catch (error) {
                    healthStatus.healthy = false;
                    healthStatus.issues.push('Storage system unhealthy');
                }
            }
            
            // Check memory usage
            if (performance.memory) {
                const memoryUsage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
                if (memoryUsage > 0.9) {
                    healthStatus.healthy = false;
                    healthStatus.issues.push('High memory usage detected');
                }
            }
            
            // Check for repeated errors
            const errorHealth = this.isHealthy();
            if (!errorHealth.healthy) {
                healthStatus.healthy = false;
                healthStatus.issues.push(`${errorHealth.criticalErrors} critical errors in last minute`);
            }
            
            console.log('🏥 Health check completed:', healthStatus);
            return healthStatus;
        } catch (error) {
            console.error('Health check failed:', error);
            return {
                timestamp: Date.now(),
                healthy: false,
                issues: ['Health check system failure'],
                error: error.message
            };
        }
    }

    async performEmergencyReset() {
        console.log('🚨 Performing emergency reset...');
        
        try {
            // Clear all data
            if (window.dataStorage) {
                await window.dataStorage.clearAllData();
            }
            
            // Clear error history
            this.clearErrorHistory();
            
            // Clear caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }
            
            // Unregister service worker
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.unregister()));
            }
            
            console.log('✅ Emergency reset completed');
            
            // Show notification and reload
            this.showRecoveryNotification('Emergency reset completed. Reloading application...');
            
            setTimeout(() => {
                window.location.reload(true);
            }, 2000);
            
            return { success: true, action: 'emergency-reset' };
        } catch (error) {
            console.error('Emergency reset failed:', error);
            return { success: false, error: error.message };
        }
    }
}

// Global error handler utilities
const ErrorUtils = {
    // Wrap async functions with error handling
    asyncWrapper: (fn) => {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                if (window.errorHandler) {
                    window.errorHandler.reportError(`Async function error: ${error.message}`, {
                        functionName: fn.name,
                        arguments: args,
                        stack: error.stack
                    });
                }
                throw error;
            }
        };
    },
    
    // Wrap sync functions with error handling
    syncWrapper: (fn) => {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                if (window.errorHandler) {
                    window.errorHandler.reportError(`Function error: ${error.message}`, {
                        functionName: fn.name,
                        arguments: args,
                        stack: error.stack
                    });
                }
                throw error;
            }
        };
    },
    
    // Safe JSON parsing
    safeJSONParse: (str, fallback = null) => {
        try {
            return JSON.parse(str);
        } catch (error) {
            if (window.errorHandler) {
                window.errorHandler.reportError('JSON parse error', {
                    input: str?.substring(0, 100),
                    error: error.message
                });
            }
            return fallback;
        }
    },
    
    // Safe JSON stringifying
    safeJSONStringify: (obj, fallback = '{}') => {
        try {
            return JSON.stringify(obj);
        } catch (error) {
            if (window.errorHandler) {
                window.errorHandler.reportError('JSON stringify error', {
                    objectType: typeof obj,
                    error: error.message
                });
            }
            return fallback;
        }
    }
};

// Global error handling styles
const errorHandlerStyles = document.createElement('style');
errorHandlerStyles.textContent = `
    .error-notification-content {
        display: flex;
        align-items: flex-start;
        gap: 15px;
    }
    
    .error-icon {
        font-size: 24px;
        flex-shrink: 0;
    }
    
    .error-title {
        font-weight: 600;
        margin-bottom: 8px;
        color: #d32f2f;
    }
    
    .error-message {
        margin-bottom: 15px;
        line-height: 1.4;
        color: #666;
    }
    
    .error-actions {
        display: flex;
        gap: 10px;
    }
    
    .error-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s;
    }
    
    .error-btn-primary {
        background: #f44336;
        color: white;
    }
    
    .error-btn-primary:hover {
        background: #d32f2f;
    }
    
    .error-btn-secondary {
        background: #e0e0e0;
        color: #333;
    }
    
    .error-btn-secondary:hover {
        background: #d5d5d5;
    }
    
    .recovery-notification {
        animation: slideInDown 0.3s ease-out;
    }
    
    @keyframes slideInDown {
        from {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }
`;

document.head.appendChild(errorHandlerStyles);

// Make available globally
if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
    window.ErrorUtils = ErrorUtils;
}