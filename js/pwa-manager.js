class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = this.checkIfInstalled();
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.lastOnlineTime = Date.now();

        this.initializePWA();
    }

    initializePWA() {
        this.setupInstallPrompt();
        this.setupNetworkStatusTracking();
        this.setupServiceWorkerMessaging();
        this.setupBackgroundSync();
        this.setupPushNotifications();

        // Show install prompt after delay if not installed
        if (!this.isInstalled) {
            setTimeout(() => this.maybeShowInstallPrompt(), 30000); // 30 seconds
        }
    }

    // ====== INSTALL PROMPT ======

    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', e => {
            console.log('[PWA] Install prompt available');
            e.preventDefault();
            this.deferredPrompt = e;

            // Update UI to show install option
            this.updateInstallButton(true);
        });

        window.addEventListener('appinstalled', e => {
            console.log('[PWA] App installed successfully');
            this.isInstalled = true;
            this.deferredPrompt = null;

            this.updateInstallButton(false);
            this.showInstallSuccessMessage();

            // Track installation
            this.trackEvent('pwa_installed', {
                method: 'prompt',
                timestamp: Date.now()
            });
        });

        // Handle iOS standalone mode
        if (this.isIOSStandalone()) {
            this.isInstalled = true;
            this.showIOSInstallMessage();
        }
    }

    updateInstallButton(show) {
        const installBtn = document.getElementById('install-app-btn');
        const installBanner = document.getElementById('install-banner');

        if (installBtn) {
            installBtn.style.display = show ? 'flex' : 'none';
            installBtn.addEventListener('click', () => this.showInstallPrompt());
        }

        if (installBanner) {
            installBanner.style.display = show ? 'block' : 'none';
        }
    }

    async showInstallPrompt() {
        if (!this.deferredPrompt) {
            this.showManualInstallInstructions();
            return;
        }

        try {
            const { outcome } = await this.deferredPrompt.prompt();
            console.log('[PWA] Install prompt result:', outcome);

            this.trackEvent('install_prompt_result', { outcome });

            if (outcome === 'accepted') {
                this.deferredPrompt = null;
            }
        } catch (error) {
            console.error('[PWA] Install prompt failed:', error);
            this.showManualInstallInstructions();
        }
    }

    maybeShowInstallPrompt() {
        if (this.isInstalled || !this.deferredPrompt) { return; }

        // Check if user has dismissed install prompt recently
        const lastDismissed = localStorage.getItem('pwa-install-dismissed');
        if (lastDismissed) {
            const daysSinceDismissed = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissed < 7) { return; } // Don't show for 7 days after dismissal
        }

        // Check engagement metrics
        const stats = window.userProgress?.getDisplayStats();
        const gamesPlayed = parseInt(stats?.gamesPlayed?.replace(/,/g, '') || '0');

        if (gamesPlayed >= 3) { // Show after 3 games played
            this.showInstallBanner();
        }
    }

    showInstallBanner() {
        const banner = this.createInstallBanner();
        document.body.appendChild(banner);

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (banner.parentNode) {
                banner.remove();
            }
        }, 10000);
    }

    createInstallBanner() {
        const banner = document.createElement('div');
        banner.id = 'install-banner';
        banner.className = 'install-banner';
        banner.innerHTML = `
            <div class="install-banner-content">
                <div class="install-banner-icon">📱</div>
                <div class="install-banner-text">
                    <h3>Install Sudoku Master</h3>
                    <p>Get the full app experience with offline play</p>
                </div>
                <div class="install-banner-actions">
                    <button class="install-btn primary" onclick="window.pwaManager.showInstallPrompt()">
                        Install
                    </button>
                    <button class="install-btn secondary" onclick="window.pwaManager.dismissInstallPrompt()">
                        Later
                    </button>
                </div>
            </div>
        `;

        // Add styles
        banner.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            right: 20px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 1000;
            animation: slideUp 0.3s ease-out;
            border: 1px solid #e0e0e0;
        `;

        return banner;
    }

    dismissInstallPrompt() {
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
        const banner = document.getElementById('install-banner');
        if (banner) { banner.remove(); }

        this.trackEvent('install_prompt_dismissed');
    }

    showManualInstallInstructions() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);

        let instructions = '';

        if (isIOS) {
            instructions = `
                <h3>Install on iOS</h3>
                <ol>
                    <li>Tap the Share button <span style="font-size: 1.2em;">📤</span></li>
                    <li>Scroll down and tap "Add to Home Screen"</li>
                    <li>Tap "Add" to install the app</li>
                </ol>
            `;
        } else if (isAndroid) {
            instructions = `
                <h3>Install on Android</h3>
                <ol>
                    <li>Tap the menu button (⋮) in your browser</li>
                    <li>Select "Add to Home screen" or "Install app"</li>
                    <li>Tap "Install" to add the app</li>
                </ol>
            `;
        } else {
            instructions = `
                <h3>Install on Desktop</h3>
                <ol>
                    <li>Look for the install icon in your address bar</li>
                    <li>Or use the menu to "Install Sudoku Master"</li>
                    <li>Follow the prompts to install</li>
                </ol>
            `;
        }

        this.showModal('Install App', instructions);
    }

    // ====== NETWORK STATUS TRACKING ======

    setupNetworkStatusTracking() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        this.updateNetworkStatus();
        this.createNetworkStatusIndicator();
    }

    handleOnline() {
        console.log('[PWA] Network: Online');
        this.isOnline = true;
        this.lastOnlineTime = Date.now();

        this.updateNetworkStatus();
        this.processSyncQueue();
        this.showToast('Back online! Syncing data...', 'success');

        // Trigger background sync
        this.scheduleBackgroundSync('sudoku-progress-sync');
    }

    handleOffline() {
        console.log('[PWA] Network: Offline');
        this.isOnline = false;

        this.updateNetworkStatus();
        this.showToast('You\'re offline. Don\'t worry, you can still play!', 'info');
    }

    updateNetworkStatus() {
        const statusIndicator = document.getElementById('network-status');
        const connectionStatus = document.querySelector('.connection-status');

        if (statusIndicator) {
            statusIndicator.classList.toggle('online', this.isOnline);
            statusIndicator.classList.toggle('offline', !this.isOnline);
            statusIndicator.title = this.isOnline ? 'Online' : 'Offline';
        }

        if (connectionStatus) {
            if (this.isOnline) {
                connectionStatus.style.display = 'none';
            } else {
                connectionStatus.textContent = 'Offline Mode';
                connectionStatus.className = 'connection-status offline';
                connectionStatus.style.display = 'block';
            }
        }

        // Update page visibility indicator
        document.documentElement.setAttribute('data-connection', this.isOnline ? 'online' : 'offline');
    }

    createNetworkStatusIndicator() {
        if (document.getElementById('network-status')) { return; }

        const indicator = document.createElement('div');
        indicator.id = 'network-status';
        indicator.className = 'network-status';
        indicator.innerHTML = `
            <div class="network-dot"></div>
            <span class="network-text">Online</span>
        `;

        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            display: none;
            align-items: center;
            gap: 4px;
            z-index: 1000;
            transition: all 0.3s ease;
        `;

        // Add dot styles
        const style = document.createElement('style');
        style.textContent = `
            .network-status.offline { display: flex !important; }
            .network-status .network-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #4caf50;
            }
            .network-status.offline .network-dot {
                background: #f44336;
            }
            .network-status.offline .network-text::after {
                content: 'Offline';
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(indicator);
    }

    // ====== BACKGROUND SYNC ======

    setupBackgroundSync() {
        // Register for background sync when data needs to be synced
        this.syncQueue = this.loadSyncQueue();
    }

    scheduleBackgroundSync(tag, data = null) {
        if (!('serviceWorker' in navigator) || !('sync' in window.ServiceWorkerRegistration.prototype)) {
            console.warn('[PWA] Background sync not supported');
            return;
        }

        if (data) {
            this.addToSyncQueue(tag, data);
        }

        navigator.serviceWorker.ready.then(registration => registration.sync.register(tag)).then(() => {
            console.log('[PWA] Background sync scheduled:', tag);
        })
            .catch(error => {
                console.error('[PWA] Background sync failed:', error);
                // Fallback: try to sync immediately if online
                if (this.isOnline) {
                    this.processSyncQueue();
                }
            });
    }

    addToSyncQueue(tag, data) {
        this.syncQueue.push({
            tag,
            data,
            timestamp: Date.now()
        });
        this.saveSyncQueue();
    }

    async processSyncQueue() {
        if (!this.isOnline || this.syncQueue.length === 0) { return; }

        console.log('[PWA] Processing sync queue:', this.syncQueue.length, 'items');

        const processedItems = [];

        for (const item of this.syncQueue) {
            try {
                const success = await this.syncData(item.tag, item.data);
                if (success) {
                    processedItems.push(item);
                }
            } catch (error) {
                console.error('[PWA] Sync failed for item:', item.tag, error);
            }
        }

        // Remove successfully synced items
        this.syncQueue = this.syncQueue.filter(item => !processedItems.includes(item));
        this.saveSyncQueue();

        if (processedItems.length > 0) {
            this.showToast(`Synced ${processedItems.length} items`, 'success');
        }
    }

    async syncData(tag, data) {
        // Mock sync - in real implementation, this would sync with server
        console.log('[PWA] Syncing data:', tag, data);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        return true; // Success
    }

    loadSyncQueue() {
        try {
            const saved = localStorage.getItem('pwa-sync-queue');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('[PWA] Failed to load sync queue:', error);
            return [];
        }
    }

    saveSyncQueue() {
        try {
            localStorage.setItem('pwa-sync-queue', JSON.stringify(this.syncQueue));
        } catch (error) {
            console.error('[PWA] Failed to save sync queue:', error);
        }
    }

    // ====== SERVICE WORKER MESSAGING ======

    setupServiceWorkerMessaging() {
        if (!('serviceWorker' in navigator)) { return; }

        navigator.serviceWorker.addEventListener('message', event => {
            const { type, data } = event.data;

            switch (type) {
                case 'SYNC_SUCCESS':
                    this.handleSyncSuccess(data);
                    break;
                case 'SYNC_FAILED':
                    this.handleSyncFailed(data);
                    break;
                case 'CACHE_CLEARED':
                    this.handleCacheCleared(data);
                    break;
                default:
                    console.log('[PWA] Unknown SW message:', type, data);
            }
        });
    }

    sendMessageToSW(type, data = null) {
        if (!('serviceWorker' in navigator)) { return; }

        navigator.serviceWorker.ready.then(registration => {
            if (registration.active) {
                registration.active.postMessage({ type, data });
            }
        });
    }

    handleSyncSuccess(data) {
        console.log('[PWA] Sync successful:', data.type);
        this.showToast(`${data.type} synced successfully`, 'success');
    }

    handleSyncFailed(data) {
        console.error('[PWA] Sync failed:', data.type, data.error);
        this.showToast(`Failed to sync ${data.type}`, 'error');
    }

    handleCacheCleared(data) {
        console.log('[PWA] Cache cleared:', data.cacheName);
        if (data.success) {
            this.showToast('Cache cleared successfully', 'success');
        }
    }

    // ====== PUSH NOTIFICATIONS ======

    async setupPushNotifications() {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            console.warn('[PWA] Push notifications not supported');
            return;
        }

        // Check if notifications are enabled in settings
        if (window.settingsManager?.get('notifications.dailyReminder')) {
            await this.requestNotificationPermission();
        }

        // Listen for settings changes
        window.addEventListener('settingsChanged', event => {
            if (event.detail.path === 'notifications.dailyReminder') {
                if (event.detail.newValue) {
                    this.requestNotificationPermission();
                } else {
                    this.unsubscribeFromNotifications();
                }
            }
        });
    }

    async requestNotificationPermission() {
        try {
            const permission = await Notification.requestPermission();
            console.log('[PWA] Notification permission:', permission);

            if (permission === 'granted') {
                await this.subscribeToPushNotifications();
                this.scheduleDailyReminder();
            }

            return permission;
        } catch (error) {
            console.error('[PWA] Notification permission request failed:', error);
            return 'denied';
        }
    }

    async subscribeToPushNotifications() {
        try {
            const registration = await navigator.serviceWorker.ready;

            // Check if already subscribed
            const existingSubscription = await registration.pushManager.getSubscription();
            if (existingSubscription) {
                console.log('[PWA] Already subscribed to push notifications');
                return existingSubscription;
            }

            // Subscribe to push notifications
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array('your-vapid-public-key-here')
            });

            console.log('[PWA] Subscribed to push notifications');

            // Send subscription to server (in real implementation)
            // await this.sendSubscriptionToServer(subscription);

            return subscription;
        } catch (error) {
            console.error('[PWA] Push subscription failed:', error);
            return null;
        }
    }

    async unsubscribeFromNotifications() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();
                console.log('[PWA] Unsubscribed from push notifications');

                // Remove from server (in real implementation)
                // await this.removeSubscriptionFromServer(subscription);
            }
        } catch (error) {
            console.error('[PWA] Push unsubscription failed:', error);
        }
    }

    scheduleDailyReminder() {
        const reminderTime = window.settingsManager?.get('notifications.reminderTime') || '18:00';
        const [hours, minutes] = reminderTime.split(':').map(n => parseInt(n));

        const now = new Date();
        const reminderDate = new Date(now);
        reminderDate.setHours(hours, minutes, 0, 0);

        // If the time has passed today, schedule for tomorrow
        if (reminderDate <= now) {
            reminderDate.setDate(reminderDate.getDate() + 1);
        }

        const delay = reminderDate.getTime() - now.getTime();

        setTimeout(() => {
            this.showDailyReminder();
            // Schedule next reminder
            setTimeout(() => this.scheduleDailyReminder(), 24 * 60 * 60 * 1000);
        }, delay);

        console.log('[PWA] Daily reminder scheduled for:', reminderDate.toLocaleString());
    }

    showDailyReminder() {
        if (Notification.permission === 'granted' && !document.hasFocus()) {
            new Notification('Sudoku Master', {
                body: 'Time for your daily Sudoku challenge! 🧩',
                icon: '/images/icons/icon-192x192.png',
                tag: 'daily-reminder',
                requireInteraction: true
            });
        }
    }

    // ====== UTILITY METHODS ======

    checkIfInstalled() {
        // Check for various install indicators
        return window.matchMedia('(display-mode: standalone)').matches
               || window.navigator.standalone === true
               || document.referrer.includes('android-app://');
    }

    isIOSStandalone() {
        return window.navigator.standalone === true;
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    trackEvent(eventName, data = {}) {
        // Analytics tracking - implement based on your analytics provider
        console.log('[PWA] Event:', eventName, data);

        // Example: Send to analytics service
        // gtag('event', eventName, data);
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `pwa-toast ${type}`;
        toast.textContent = message;

        const colors = {
            success: '#4caf50',
            error: '#f44336',
            info: '#2196f3',
            warning: '#ff9800'
        };

        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 2000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 0.9rem;
            max-width: 90vw;
            text-align: center;
            animation: slideUp 0.3s ease-out;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showModal(title, content, actions = []) {
        const modal = document.createElement('div');
        modal.className = 'pwa-modal';
        modal.innerHTML = `
            <div class="pwa-modal-backdrop"></div>
            <div class="pwa-modal-content">
                <div class="pwa-modal-header">
                    <h3>${title}</h3>
                    <button class="pwa-modal-close">&times;</button>
                </div>
                <div class="pwa-modal-body">
                    ${content}
                </div>
                <div class="pwa-modal-actions">
                    ${actions.map(action => `
                        <button class="pwa-modal-action ${action.class || ''}" data-action="${action.action}">
                            ${action.text}
                        </button>
                    `).join('')}
                    <button class="pwa-modal-action secondary" data-action="close">Close</button>
                </div>
            </div>
        `;

        // Add styles
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 3000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Handle actions
        modal.addEventListener('click', e => {
            const { action } = e.target.dataset;
            if (action === 'close' || e.target.classList.contains('pwa-modal-backdrop') || e.target.classList.contains('pwa-modal-close')) {
                modal.remove();
            }
        });

        document.body.appendChild(modal);
        return modal;
    }

    // Public API methods

    async installApp() {
        return this.showInstallPrompt();
    }

    getInstallStatus() {
        return {
            isInstalled: this.isInstalled,
            canInstall: !!this.deferredPrompt,
            hasPrompt: !!this.deferredPrompt
        };
    }

    getNetworkStatus() {
        return {
            isOnline: this.isOnline,
            lastOnlineTime: this.lastOnlineTime,
            syncQueueSize: this.syncQueue.length
        };
    }

    clearCache(cacheName = null) {
        if (cacheName) {
            this.sendMessageToSW('CLEAR_CACHE', { cacheName });
        } else {
            // Clear all caches
            this.sendMessageToSW('CLEAR_CACHE', { cacheName: 'all' });
        }
    }

    async checkForUpdates() {
        if (!('serviceWorker' in navigator)) { return false; }

        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.update();
            return true;
        } catch (error) {
            console.error('[PWA] Update check failed:', error);
            return false;
        }
    }
}

// CSS Animations
const pwaStyles = document.createElement('style');
pwaStyles.textContent = `
    @keyframes slideUp {
        from { transform: translate(-50%, 100%); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
    }
    
    @keyframes slideDown {
        from { transform: translate(-50%, 0); opacity: 1; }
        to { transform: translate(-50%, 100%); opacity: 0; }
    }
    
    .install-banner {
        animation: slideUp 0.3s ease-out;
    }
    
    .install-banner-content {
        display: flex;
        align-items: center;
        padding: 16px;
        gap: 12px;
    }
    
    .install-banner-icon {
        font-size: 2rem;
    }
    
    .install-banner-text h3 {
        margin: 0 0 4px 0;
        font-size: 1rem;
        font-weight: 600;
    }
    
    .install-banner-text p {
        margin: 0;
        font-size: 0.875rem;
        color: #666;
    }
    
    .install-banner-actions {
        display: flex;
        gap: 8px;
        margin-left: auto;
    }
    
    .install-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .install-btn.primary {
        background: #2196F3;
        color: white;
    }
    
    .install-btn.secondary {
        background: #f5f5f5;
        color: #666;
    }
    
    .install-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    
    .pwa-modal {
        animation: fadeIn 0.2s ease-out;
    }
    
    .pwa-modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
    }
    
    .pwa-modal-content {
        background: white;
        border-radius: 12px;
        max-width: 400px;
        width: 90vw;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        position: relative;
    }
    
    .pwa-modal-header {
        padding: 20px 20px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .pwa-modal-header h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
    }
    
    .pwa-modal-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
    }
    
    .pwa-modal-close:hover {
        background: #f0f0f0;
    }
    
    .pwa-modal-body {
        padding: 20px;
    }
    
    .pwa-modal-body ol {
        padding-left: 20px;
    }
    
    .pwa-modal-body li {
        margin-bottom: 8px;
        line-height: 1.5;
    }
    
    .pwa-modal-actions {
        padding: 0 20px 20px;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
    }
    
    .pwa-modal-action {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s ease;
    }
    
    .pwa-modal-action.primary {
        background: #2196F3;
        color: white;
    }
    
    .pwa-modal-action.secondary {
        background: #f5f5f5;
        color: #666;
    }
    
    .pwa-modal-action:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    [data-connection="offline"] {
        filter: saturate(0.8);
    }
    
    .connection-status {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        padding: 8px;
        text-align: center;
        font-size: 0.875rem;
        z-index: 1000;
        display: none;
    }
    
    .connection-status.offline {
        background: #f44336;
        color: white;
        display: block;
    }
    
    .connection-status.online {
        background: #4caf50;
        color: white;
    }
`;

document.head.appendChild(pwaStyles);

// Make available globally
if (typeof window !== 'undefined') {
    window.PWAManager = PWAManager;
}
