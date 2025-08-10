class PerformanceMonitor {
    constructor() {
        this.metrics = {
            pageLoad: {},
            navigation: {},
            rendering: {},
            memory: {},
            network: {},
            user: {},
            errors: []
        };

        this.observers = {};
        this.startTime = performance.now();
        this.isSupported = this.checkSupport();
        this.thresholds = {
            fcp: 1500, // First Contentful Paint
            lcp: 2500, // Largest Contentful Paint
            fid: 100, // First Input Delay
            cls: 0.1, // Cumulative Layout Shift
            ttfb: 800, // Time to First Byte
            memory: 50 * 1024 * 1024 // 50MB
        };

        if (this.isSupported) {
            this.initialize();
        }
    }

    checkSupport() {
        return !!(
            performance
            && performance.mark
            && performance.measure
            && performance.getEntriesByType
        );
    }

    initialize() {
        this.setupPerformanceObservers();
        this.measurePageLoad();
        this.trackNetworkInformation();
        this.setupErrorTracking();
        this.startMemoryMonitoring();
        this.setupUserInteractionTracking();

        // Report metrics periodically
        setInterval(() => this.reportMetrics(), 30000); // Every 30 seconds
    }

    setupPerformanceObservers() {
        // Largest Contentful Paint
        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver(list => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    this.metrics.pageLoad.lcp = Math.round(lastEntry.startTime);
                    this.checkThreshold('lcp', this.metrics.pageLoad.lcp);
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                this.observers.lcp = lcpObserver;
            } catch (e) {
                console.warn('LCP observer not supported');
            }

            // First Input Delay
            try {
                const fidObserver = new PerformanceObserver(list => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        this.metrics.pageLoad.fid = Math.round(entry.processingStart - entry.startTime);
                        this.checkThreshold('fid', this.metrics.pageLoad.fid);
                    });
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
                this.observers.fid = fidObserver;
            } catch (e) {
                console.warn('FID observer not supported');
            }

            // Cumulative Layout Shift
            try {
                const clsObserver = new PerformanceObserver(list => {
                    let clsValue = 0;
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    });
                    this.metrics.pageLoad.cls = Math.round(clsValue * 1000) / 1000;
                    this.checkThreshold('cls', this.metrics.pageLoad.cls);
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
                this.observers.cls = clsObserver;
            } catch (e) {
                console.warn('CLS observer not supported');
            }

            // Long Tasks
            try {
                const longTaskObserver = new PerformanceObserver(list => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        const taskData = {
                            duration: Math.round(entry.duration),
                            startTime: Math.round(entry.startTime),
                            name: entry.name
                        };

                        this.metrics.rendering.longTasks = this.metrics.rendering.longTasks || [];
                        this.metrics.rendering.longTasks.push(taskData);

                        // Alert on tasks over 50ms
                        if (entry.duration > 50) {
                            this.trackIssue('long-task', `Task took ${Math.round(entry.duration)}ms`);
                        }
                    });
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.longTask = longTaskObserver;
            } catch (e) {
                console.warn('Long task observer not supported');
            }

            // Navigation timing
            try {
                const navObserver = new PerformanceObserver(list => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        this.metrics.navigation = {
                            type: entry.type,
                            redirectCount: entry.redirectCount,
                            duration: Math.round(entry.duration),
                            domContentLoaded: Math.round(entry.domContentLoadedEventEnd - entry.fetchStart),
                            loadComplete: Math.round(entry.loadEventEnd - entry.fetchStart)
                        };
                    });
                });
                navObserver.observe({ entryTypes: ['navigation'] });
                this.observers.navigation = navObserver;
            } catch (e) {
                console.warn('Navigation observer not supported');
            }
        }
    }

    measurePageLoad() {
        // Wait for page to be fully loaded
        if (document.readyState === 'complete') {
            this.calculatePageLoadMetrics();
        } else {
            window.addEventListener('load', () => {
                setTimeout(() => this.calculatePageLoadMetrics(), 0);
            });
        }
    }

    calculatePageLoadMetrics() {
        if (!performance.timing) { return; }

        const { timing } = performance;
        const { navigation } = performance;

        this.metrics.pageLoad = {
            ...this.metrics.pageLoad,
            ttfb: timing.responseStart - timing.fetchStart,
            domLoading: timing.domLoading - timing.fetchStart,
            domComplete: timing.domComplete - timing.fetchStart,
            loadComplete: timing.loadEventEnd - timing.fetchStart,
            navigationType: navigation.type,
            redirectCount: navigation.redirectCount
        };

        // First Contentful Paint
        const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
        if (fcpEntry) {
            this.metrics.pageLoad.fcp = Math.round(fcpEntry.startTime);
            this.checkThreshold('fcp', this.metrics.pageLoad.fcp);
        }

        // Time to Interactive (approximate)
        this.estimateTimeToInteractive();
    }

    estimateTimeToInteractive() {
        // Simple TTI estimation based on when main thread becomes quiet
        const longTasks = performance.getEntriesByType('longtask');
        const lastLongTask = longTasks[longTasks.length - 1];

        if (lastLongTask) {
            this.metrics.pageLoad.tti = Math.round(lastLongTask.startTime + lastLongTask.duration);
        } else if (this.metrics.pageLoad.domComplete) {
            this.metrics.pageLoad.tti = this.metrics.pageLoad.domComplete;
        }
    }

    trackNetworkInformation() {
        if ('navigator' in window && 'connection' in navigator) {
            const { connection } = navigator;
            this.metrics.network = {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };

            connection.addEventListener('change', () => {
                this.metrics.network.effectiveType = connection.effectiveType;
                this.metrics.network.downlink = connection.downlink;
                this.metrics.network.rtt = connection.rtt;

                if (connection.effectiveType === 'slow-2g') {
                    this.trackIssue('slow-connection', 'User on slow 2G connection');
                }
            });
        }
    }

    startMemoryMonitoring() {
        if ('memory' in performance) {
            const updateMemoryMetrics = () => {
                const { memory } = performance;
                this.metrics.memory = {
                    usedJSHeapSize: memory.usedJSHeapSize,
                    totalJSHeapSize: memory.totalJSHeapSize,
                    jsHeapSizeLimit: memory.jsHeapSizeLimit,
                    usagePercentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
                };

                // Alert on high memory usage
                if (memory.usedJSHeapSize > this.thresholds.memory) {
                    this.trackIssue('high-memory-usage', `Memory usage: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`);
                }
            };

            updateMemoryMetrics();
            setInterval(updateMemoryMetrics, 10000); // Every 10 seconds
        }
    }

    setupUserInteractionTracking() {
        // Track interaction to next paint
        let interactionCount = 0;
        const interactionTypes = ['click', 'keydown', 'touchstart'];

        interactionTypes.forEach(type => {
            document.addEventListener(type, e => {
                interactionCount++;
                this.measureInteractionDelay(e, type);
            }, { passive: true });
        });

        // Track scroll performance
        let lastScrollTime = 0;
        let scrollFrameDrops = 0;

        document.addEventListener('scroll', () => {
            const now = performance.now();
            const deltaTime = now - lastScrollTime;

            if (lastScrollTime > 0 && deltaTime > 32) { // More than 2 frames at 60fps
                scrollFrameDrops++;
            }

            lastScrollTime = now;
            this.metrics.user.scrollFrameDrops = scrollFrameDrops;
        }, { passive: true });
    }

    measureInteractionDelay(event, type) {
        const startTime = performance.now();

        requestAnimationFrame(() => {
            const endTime = performance.now();
            const delay = endTime - startTime;

            if (!this.metrics.user.interactionDelays) {
                this.metrics.user.interactionDelays = [];
            }

            this.metrics.user.interactionDelays.push({
                type,
                delay: Math.round(delay),
                timestamp: Date.now()
            });

            // Keep only recent interactions
            this.metrics.user.interactionDelays = this.metrics.user.interactionDelays
                .filter(interaction => Date.now() - interaction.timestamp < 60000); // Last minute
        });
    }

    setupErrorTracking() {
        // JavaScript errors
        window.addEventListener('error', event => {
            this.trackError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: Date.now()
            });
        });

        // Promise rejections
        window.addEventListener('unhandledrejection', event => {
            this.trackError({
                type: 'unhandled-promise',
                message: event.reason?.message || 'Unhandled promise rejection',
                stack: event.reason?.stack,
                timestamp: Date.now()
            });
        });

        // Resource loading errors
        document.addEventListener('error', event => {
            if (event.target !== window) {
                this.trackError({
                    type: 'resource',
                    message: `Failed to load ${event.target.tagName}`,
                    source: event.target.src || event.target.href,
                    timestamp: Date.now()
                });
            }
        }, true);
    }

    trackError(errorData) {
        this.metrics.errors.push(errorData);

        // Keep only recent errors
        this.metrics.errors = this.metrics.errors
            .filter(error => Date.now() - error.timestamp < 300000); // Last 5 minutes

        // Alert on critical errors
        console.error('Performance Monitor - Error tracked:', errorData);
    }

    trackIssue(type, message) {
        if (!this.metrics.issues) {
            this.metrics.issues = [];
        }

        this.metrics.issues.push({
            type,
            message,
            timestamp: Date.now(),
            url: window.location.href
        });

        console.warn(`Performance Issue - ${type}: ${message}`);
    }

    checkThreshold(metric, value) {
        const threshold = this.thresholds[metric];
        if (threshold && value > threshold) {
            this.trackIssue(`${metric}-threshold`, `${metric.toUpperCase()} is ${value}ms (threshold: ${threshold}ms)`);
        }
    }

    // Public API Methods

    mark(name) {
        if (this.isSupported) {
            performance.mark(name);
        }
    }

    measure(name, startMark, endMark) {
        if (this.isSupported) {
            try {
                performance.measure(name, startMark, endMark);
                const measure = performance.getEntriesByName(name)[0];
                return measure ? Math.round(measure.duration) : null;
            } catch (e) {
                console.warn('Failed to measure performance:', e);
                return null;
            }
        }
        return null;
    }

    measureFunction(fn, name) {
        const startTime = performance.now();
        const result = fn();
        const endTime = performance.now();
        const duration = endTime - startTime;

        if (!this.metrics.user.functionTimings) {
            this.metrics.user.functionTimings = {};
        }

        if (!this.metrics.user.functionTimings[name]) {
            this.metrics.user.functionTimings[name] = [];
        }

        this.metrics.user.functionTimings[name].push(Math.round(duration));

        // Keep only recent measurements
        if (this.metrics.user.functionTimings[name].length > 100) {
            this.metrics.user.functionTimings[name] = this.metrics.user.functionTimings[name].slice(-50);
        }

        return result;
    }

    async measureAsync(asyncFn, name) {
        const startTime = performance.now();
        const result = await asyncFn();
        const endTime = performance.now();
        const duration = endTime - startTime;

        if (!this.metrics.user.asyncTimings) {
            this.metrics.user.asyncTimings = {};
        }

        if (!this.metrics.user.asyncTimings[name]) {
            this.metrics.user.asyncTimings[name] = [];
        }

        this.metrics.user.asyncTimings[name].push(Math.round(duration));

        return result;
    }

    trackUserAction(action, metadata = {}) {
        if (!this.metrics.user.actions) {
            this.metrics.user.actions = [];
        }

        this.metrics.user.actions.push({
            action,
            metadata,
            timestamp: Date.now(),
            navigationCount: this.metrics.user.actions?.length || 0
        });

        // Keep only recent actions
        if (this.metrics.user.actions.length > 200) {
            this.metrics.user.actions = this.metrics.user.actions.slice(-100);
        }
    }

    trackPageView(page, loadTime) {
        if (!this.metrics.user.pageViews) {
            this.metrics.user.pageViews = [];
        }

        this.metrics.user.pageViews.push({
            page,
            loadTime: Math.round(loadTime),
            timestamp: Date.now()
        });
    }

    // Game-specific tracking methods

    trackGameStart(difficulty) {
        this.mark('game-start');
        this.trackUserAction('game-start', { difficulty });
    }

    trackGameComplete(result) {
        this.mark('game-complete');
        const duration = this.measure('game-duration', 'game-start', 'game-complete');

        this.trackUserAction('game-complete', {
            ...result,
            duration
        });
    }

    trackPuzzleGeneration(difficulty) {
        return {
            start: () => this.mark(`puzzle-gen-start-${difficulty}`),
            end: () => {
                this.mark(`puzzle-gen-end-${difficulty}`);
                return this.measure(`puzzle-generation-${difficulty}`,
                    `puzzle-gen-start-${difficulty}`,
                    `puzzle-gen-end-${difficulty}`);
            }
        };
    }

    // Reporting and Analysis

    getMetrics() {
        return {
            ...this.metrics,
            timestamp: Date.now(),
            sessionDuration: Math.round(performance.now() - this.startTime),
            url: window.location.href,
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };
    }

    getPerformanceScore() {
        const weights = {
            fcp: 0.2,
            lcp: 0.25,
            fid: 0.2,
            cls: 0.15,
            ttfb: 0.2
        };

        let totalScore = 0;
        let totalWeight = 0;

        Object.entries(weights).forEach(([metric, weight]) => {
            const value = this.metrics.pageLoad[metric];
            if (value !== undefined) {
                const threshold = this.thresholds[metric];
                const score = Math.max(0, 100 - (value / threshold) * 100);
                totalScore += score * weight;
                totalWeight += weight;
            }
        });

        return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    }

    generateReport() {
        const metrics = this.getMetrics();
        const score = this.getPerformanceScore();

        return {
            score,
            metrics,
            recommendations: this.getRecommendations(),
            issues: this.metrics.issues || [],
            summary: {
                pageLoadTime: metrics.pageLoad.loadComplete,
                memoryUsage: metrics.memory.usedJSHeapSize,
                errorCount: metrics.errors.length,
                longTaskCount: metrics.rendering.longTasks?.length || 0
            }
        };
    }

    getRecommendations() {
        const recommendations = [];
        const { metrics } = this;

        if (metrics.pageLoad.fcp > this.thresholds.fcp) {
            recommendations.push({
                type: 'performance',
                message: 'First Contentful Paint is slow. Consider optimizing critical render path.',
                priority: 'high'
            });
        }

        if (metrics.pageLoad.lcp > this.thresholds.lcp) {
            recommendations.push({
                type: 'performance',
                message: 'Largest Contentful Paint is slow. Optimize images and remove render-blocking resources.',
                priority: 'high'
            });
        }

        if (metrics.memory.usagePercentage > 80) {
            recommendations.push({
                type: 'memory',
                message: 'High memory usage detected. Check for memory leaks.',
                priority: 'medium'
            });
        }

        if (metrics.rendering.longTasks?.length > 5) {
            recommendations.push({
                type: 'performance',
                message: 'Multiple long tasks detected. Consider code splitting or web workers.',
                priority: 'medium'
            });
        }

        if (metrics.errors.length > 0) {
            recommendations.push({
                type: 'reliability',
                message: `${metrics.errors.length} errors detected. Review error logs.`,
                priority: 'high'
            });
        }

        return recommendations;
    }

    reportMetrics() {
        const report = this.generateReport();

        // Log to console in development
        if (process?.env?.NODE_ENV === 'development') {
            console.log('Performance Report:', report);
        }

        // Send to analytics service (implement based on your needs)
        this.sendToAnalytics(report);
    }

    sendToAnalytics(report) {
        // Example implementation - replace with your analytics service
        try {
            // Check if gtag is available (Google Analytics)
            if (typeof window.gtag === 'function') {
                window.gtag('event', 'performance_report', {
                    customParameter: {
                        score: report.score,
                        loadTime: report.metrics.pageLoad.loadComplete,
                        memoryUsage: report.metrics.memory.usedJSHeapSize,
                        errorCount: report.metrics.errors.length
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to send analytics:', error);
        }
    }

    // Cleanup method
    cleanup() {
        // Disconnect all observers
        Object.values(this.observers).forEach(observer => {
            if (observer && observer.disconnect) {
                observer.disconnect();
            }
        });

        // Clear metrics
        this.metrics = {
            pageLoad: {},
            navigation: {},
            rendering: {},
            memory: {},
            network: {},
            user: {},
            errors: []
        };
    }
}

// Performance utilities
const PerformanceUtils = {
    // Debounce function for performance
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function for performance
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
        };
    },

    // Measure paint timing
    measurePaint: () => {
        if ('performance' in window) {
            const paintEntries = performance.getEntriesByType('paint');
            const paints = {};
            paintEntries.forEach(entry => {
                paints[entry.name] = Math.round(entry.startTime);
            });
            return paints;
        }
        return {};
    },

    // Check if page is visible
    isPageVisible: () => document.visibilityState === 'visible'
};

// Make available globally
if (typeof window !== 'undefined') {
    window.PerformanceMonitor = PerformanceMonitor;
    window.PerformanceUtils = PerformanceUtils;
}
