class AnimationManager {
    constructor() {
        this.animationQueue = [];
        this.isProcessing = false;
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.animationSettings = {
            duration: {
                instant: 0,
                fast: 150,
                normal: 300,
                slow: 500,
                lazy: 800
            },
            easing: {
                linear: 'linear',
                easeIn: 'ease-in',
                easeOut: 'ease-out',
                easeInOut: 'ease-in-out',
                bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
                sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
                spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }
        };

        this.setupAnimationStyles();
        this.bindMotionPreference();
        this.initializeInteractionAnimations();
    }

    setupAnimationStyles() {
        const styles = document.createElement('style');
        styles.id = 'animation-styles';
        styles.textContent = `
            /* Base Animation Classes */
            .animate-fade-in {
                animation: fadeIn var(--animation-duration, 300ms) var(--animation-easing, ease-out) both;
            }
            
            .animate-fade-out {
                animation: fadeOut var(--animation-duration, 300ms) var(--animation-easing, ease-in) both;
            }
            
            .animate-slide-in-up {
                animation: slideInUp var(--animation-duration, 300ms) var(--animation-easing, ease-out) both;
            }
            
            .animate-slide-in-down {
                animation: slideInDown var(--animation-duration, 300ms) var(--animation-easing, ease-out) both;
            }
            
            .animate-slide-in-left {
                animation: slideInLeft var(--animation-duration, 300ms) var(--animation-easing, ease-out) both;
            }
            
            .animate-slide-in-right {
                animation: slideInRight var(--animation-duration, 300ms) var(--animation-easing, ease-out) both;
            }
            
            .animate-bounce {
                animation: bounce var(--animation-duration, 600ms) var(--animation-easing, ease-out) both;
            }
            
            .animate-pulse {
                animation: pulse var(--animation-duration, 1000ms) var(--animation-easing, ease-in-out) infinite;
            }
            
            .animate-shake {
                animation: shake var(--animation-duration, 500ms) var(--animation-easing, ease-in-out) both;
            }
            
            .animate-zoom-in {
                animation: zoomIn var(--animation-duration, 300ms) var(--animation-easing, ease-out) both;
            }
            
            .animate-zoom-out {
                animation: zoomOut var(--animation-duration, 300ms) var(--animation-easing, ease-in) both;
            }
            
            .animate-flip {
                animation: flip var(--animation-duration, 600ms) var(--animation-easing, ease-in-out) both;
            }
            
            .animate-spin {
                animation: spin var(--animation-duration, 1000ms) linear infinite;
            }
            
            .animate-glow {
                animation: glow var(--animation-duration, 1500ms) var(--animation-easing, ease-in-out) infinite alternate;
            }

            /* Interactive States */
            .interactive {
                transition: all var(--animation-duration, 150ms) var(--animation-easing, ease-out);
                cursor: pointer;
            }
            
            .interactive:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            
            .interactive:active {
                transform: translateY(0) scale(0.98);
                box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            }
            
            .button-press {
                animation: buttonPress var(--animation-duration, 150ms) var(--animation-easing, ease-out);
            }
            
            .ripple {
                position: relative;
                overflow: hidden;
            }
            
            .ripple::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.5);
                transform: translate(-50%, -50%);
                transition: width 0.6s, height 0.6s;
            }
            
            .ripple:active::before {
                width: 300px;
                height: 300px;
            }

            /* Game-specific Animations */
            .sudoku-cell {
                transition: all var(--animation-duration, 150ms) var(--animation-easing, ease-out);
            }
            
            .sudoku-cell.animate-highlight {
                animation: cellHighlight var(--animation-duration, 400ms) var(--animation-easing, ease-out);
            }
            
            .sudoku-cell.animate-error {
                animation: cellError var(--animation-duration, 500ms) var(--animation-easing, ease-out);
            }
            
            .sudoku-cell.animate-success {
                animation: cellSuccess var(--animation-duration, 500ms) var(--animation-easing, ease-out);
            }
            
            .sudoku-cell.animate-hint {
                animation: cellHint var(--animation-duration, 800ms) var(--animation-easing, ease-out);
            }
            
            .number-entry {
                animation: numberEntry var(--animation-duration, 300ms) var(--animation-easing, bounce);
            }
            
            .achievement-unlock {
                animation: achievementUnlock var(--animation-duration, 800ms) var(--animation-easing, bounce);
            }
            
            .level-complete {
                animation: levelComplete var(--animation-duration, 1000ms) var(--animation-easing, bounce);
            }
            
            .streak-counter {
                animation: streakCounter var(--animation-duration, 500ms) var(--animation-easing, spring);
            }

            /* Page Transitions */
            .page-enter {
                animation: pageEnter var(--animation-duration, 400ms) var(--animation-easing, ease-out) both;
            }
            
            .page-exit {
                animation: pageExit var(--animation-duration, 300ms) var(--animation-easing, ease-in) both;
            }
            
            .modal-enter {
                animation: modalEnter var(--animation-duration, 300ms) var(--animation-easing, ease-out) both;
            }
            
            .modal-exit {
                animation: modalExit var(--animation-duration, 200ms) var(--animation-easing, ease-in) both;
            }

            /* Loading States */
            .skeleton {
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: skeletonLoading 1.5s infinite;
            }
            
            .loading-spinner {
                animation: spin var(--animation-duration, 1000ms) linear infinite;
            }
            
            .loading-dots::after {
                content: '';
                animation: loadingDots 1.5s infinite;
            }

            /* Keyframe Definitions */
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            @keyframes slideInUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            @keyframes slideInDown {
                from { transform: translateY(-100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            @keyframes slideInLeft {
                from { transform: translateX(-100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes bounce {
                0%, 20%, 53%, 80%, 100% { transform: translateY(0); }
                40%, 43% { transform: translateY(-30px); }
                70% { transform: translateY(-15px); }
                90% { transform: translateY(-4px); }
            }
            
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }
            
            @keyframes zoomIn {
                from { transform: scale(0.3); opacity: 0; }
                50% { opacity: 1; }
                to { transform: scale(1); }
            }
            
            @keyframes zoomOut {
                from { transform: scale(1); }
                50% { opacity: 1; transform: scale(0.3); }
                to { opacity: 0; }
            }
            
            @keyframes flip {
                0% { transform: perspective(400px) rotateY(0); }
                40% { transform: perspective(400px) translateZ(150px) rotateY(170deg); }
                50% { transform: perspective(400px) translateZ(150px) rotateY(190deg) scale(1.1); }
                80% { transform: perspective(400px) rotateY(360deg) scale(0.95); }
                100% { transform: perspective(400px) scale(1); }
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            @keyframes glow {
                from { box-shadow: 0 0 5px rgba(33, 150, 243, 0.3); }
                to { box-shadow: 0 0 20px rgba(33, 150, 243, 0.8), 0 0 30px rgba(33, 150, 243, 0.4); }
            }
            
            @keyframes buttonPress {
                0% { transform: scale(1); }
                50% { transform: scale(0.95); }
                100% { transform: scale(1); }
            }
            
            @keyframes cellHighlight {
                0% { background-color: transparent; }
                50% { background-color: rgba(33, 150, 243, 0.2); }
                100% { background-color: transparent; }
            }
            
            @keyframes cellError {
                0%, 100% { background-color: transparent; }
                50% { background-color: rgba(244, 67, 54, 0.3); }
            }
            
            @keyframes cellSuccess {
                0% { background-color: transparent; transform: scale(1); }
                50% { background-color: rgba(76, 175, 80, 0.3); transform: scale(1.05); }
                100% { background-color: transparent; transform: scale(1); }
            }
            
            @keyframes cellHint {
                0%, 100% { background-color: transparent; }
                25% { background-color: rgba(255, 193, 7, 0.4); }
                75% { background-color: rgba(255, 193, 7, 0.2); }
            }
            
            @keyframes numberEntry {
                0% { transform: scale(0.8); opacity: 0; }
                50% { transform: scale(1.1); opacity: 1; }
                100% { transform: scale(1); }
            }
            
            @keyframes achievementUnlock {
                0% { transform: scale(0) rotate(-180deg); opacity: 0; }
                50% { transform: scale(1.2) rotate(-90deg); opacity: 1; }
                100% { transform: scale(1) rotate(0deg); }
            }
            
            @keyframes levelComplete {
                0% { transform: scale(1) rotate(0deg); }
                25% { transform: scale(1.1) rotate(5deg); }
                50% { transform: scale(1.2) rotate(-5deg); }
                75% { transform: scale(1.1) rotate(3deg); }
                100% { transform: scale(1) rotate(0deg); }
            }
            
            @keyframes streakCounter {
                0% { transform: scale(1) translateY(0); }
                30% { transform: scale(1.3) translateY(-10px); }
                70% { transform: scale(1.1) translateY(-5px); }
                100% { transform: scale(1) translateY(0); }
            }
            
            @keyframes pageEnter {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes pageExit {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(-100%); opacity: 0; }
            }
            
            @keyframes modalEnter {
                from { transform: scale(0.7); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            
            @keyframes modalExit {
                from { transform: scale(1); opacity: 1; }
                to { transform: scale(0.7); opacity: 0; }
            }
            
            @keyframes skeletonLoading {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            
            @keyframes loadingDots {
                0%, 80%, 100% { opacity: 0; }
                40% { opacity: 1; }
            }

            /* Reduced Motion Support */
            @media (prefers-reduced-motion: reduce) {
                *, *::before, *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
                
                .animate-pulse,
                .animate-spin,
                .animate-glow {
                    animation: none;
                }
                
                .skeleton {
                    background: #f0f0f0;
                    animation: none;
                }
            }

            /* Dark mode animations */
            [data-theme="dark"] .skeleton {
                background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%);
                background-size: 200% 100%;
            }
            
            [data-theme="dark"] .animate-glow {
                animation: glowDark var(--animation-duration, 1500ms) var(--animation-easing, ease-in-out) infinite alternate;
            }
            
            @keyframes glowDark {
                from { box-shadow: 0 0 5px rgba(33, 150, 243, 0.2); }
                to { box-shadow: 0 0 20px rgba(33, 150, 243, 0.6), 0 0 30px rgba(33, 150, 243, 0.3); }
            }
        `;

        document.head.appendChild(styles);
    }

    bindMotionPreference() {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

        const handleChange = e => {
            this.prefersReducedMotion = e.matches;
            document.documentElement.style.setProperty(
                '--animation-duration',
                e.matches ? '0.01ms' : '300ms'
            );
        };

        mediaQuery.addEventListener('change', handleChange);
        handleChange(mediaQuery);
    }

    initializeInteractionAnimations() {
        // Add interactive classes to buttons and clickable elements
        this.addInteractiveClasses();

        // Setup ripple effects
        this.setupRippleEffects();

        // Setup hover animations
        this.setupHoverAnimations();

        // Setup focus animations
        this.setupFocusAnimations();
    }

    addInteractiveClasses() {
        const interactiveElements = document.querySelectorAll(
            'button, .nav-item, .challenge-card, .stat-card, .sudoku-cell, .number-btn, .action-btn, .level-node'
        );

        interactiveElements.forEach(element => {
            element.classList.add('interactive');
        });
    }

    setupRippleEffects() {
        const rippleElements = document.querySelectorAll('.number-btn, .action-btn, .nav-item');

        rippleElements.forEach(element => {
            element.classList.add('ripple');
        });
    }

    setupHoverAnimations() {
        // Enhanced hover effects for cards
        const cards = document.querySelectorAll('.challenge-card, .stat-card, .settings-section');

        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                if (!this.prefersReducedMotion) {
                    card.style.transform = 'translateY(-2px) scale(1.01)';
                    card.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                }
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
                card.style.boxShadow = '';
            });
        });
    }

    setupFocusAnimations() {
        // Enhanced focus states for accessibility
        const focusableElements = document.querySelectorAll('button, input, select, [tabindex]');

        focusableElements.forEach(element => {
            element.addEventListener('focus', () => {
                if (!this.prefersReducedMotion) {
                    element.style.outline = '2px solid var(--primary-color)';
                    element.style.outlineOffset = '2px';
                    element.style.boxShadow = '0 0 0 4px rgba(33, 150, 243, 0.2)';
                }
            });

            element.addEventListener('blur', () => {
                element.style.outline = '';
                element.style.outlineOffset = '';
                element.style.boxShadow = '';
            });
        });
    }

    // Animation API Methods

    animate(element, animation, options = {}) {
        if (this.prefersReducedMotion && !options.respectMotionPreference === false) {
            return Promise.resolve();
        }

        const {
            duration = 'normal',
            easing = 'smooth',
            delay = 0,
            fill = 'both',
            iterations = 1
        } = options;

        const animationName = `animate-${animation}`;

        return new Promise(resolve => {
            const handleAnimationEnd = () => {
                element.classList.remove(animationName);
                element.removeEventListener('animationend', handleAnimationEnd);
                resolve();
            };

            // Set custom properties
            element.style.setProperty('--animation-duration',
                typeof duration === 'number' ? `${duration}ms` : `${this.animationSettings.duration[duration]}ms`
            );
            element.style.setProperty('--animation-easing', this.animationSettings.easing[easing]);
            element.style.setProperty('--animation-delay', `${delay}ms`);
            element.style.setProperty('--animation-fill-mode', fill);
            element.style.setProperty('--animation-iteration-count', iterations);

            element.addEventListener('animationend', handleAnimationEnd);

            setTimeout(() => {
                element.classList.add(animationName);
            }, delay);
        });
    }

    // Game-specific animation methods

    animateNumberEntry(cell, number) {
        cell.textContent = number;
        return this.animate(cell, 'number-entry', { duration: 'fast', easing: 'bounce' });
    }

    animateCellError(cell) {
        this.animate(cell, 'shake', { duration: 'normal' });
        return this.animate(cell, 'error', { duration: 'normal' });
    }

    animateCellSuccess(cell) {
        return this.animate(cell, 'success', { duration: 'normal', easing: 'bounce' });
    }

    animateCellHint(cell) {
        return this.animate(cell, 'hint', { duration: 'slow' });
    }

    animateAchievementUnlock(element) {
        return this.animate(element, 'achievement-unlock', { duration: 'slow', easing: 'bounce' });
    }

    animateLevelComplete(element) {
        return this.animate(element, 'level-complete', { duration: 'lazy', easing: 'bounce' });
    }

    animateStreakCounter(element) {
        return this.animate(element, 'streak-counter', { duration: 'normal', easing: 'spring' });
    }

    // Page transition methods

    animatePageEnter(page) {
        return this.animate(page, 'page-enter', { duration: 'normal' });
    }

    animatePageExit(page) {
        return this.animate(page, 'page-exit', { duration: 'fast' });
    }

    animateModalEnter(modal) {
        return this.animate(modal, 'modal-enter', { duration: 'fast' });
    }

    animateModalExit(modal) {
        return this.animate(modal, 'modal-exit', { duration: 'fast' });
    }

    // Utility methods

    createSkeletonLoader(element, config = {}) {
        const {
            height = '20px',
            borderRadius = '4px',
            lines = 1,
            spacing = '8px'
        } = config;

        element.innerHTML = '';
        element.style.opacity = '0.7';

        for (let i = 0; i < lines; i++) {
            const skeletonLine = document.createElement('div');
            skeletonLine.className = 'skeleton';
            skeletonLine.style.height = height;
            skeletonLine.style.borderRadius = borderRadius;
            skeletonLine.style.marginBottom = i < lines - 1 ? spacing : '0';
            element.appendChild(skeletonLine);
        }
    }

    removeSkeletonLoader(element, content) {
        element.innerHTML = content;
        element.style.opacity = '';
        return this.animate(element, 'fade-in', { duration: 'fast' });
    }

    addLoadingState(button, text = 'Loading...') {
        const originalText = button.textContent;
        const originalDisabled = button.disabled;

        button.textContent = text;
        button.disabled = true;
        button.classList.add('loading');

        // Add spinner
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.style.cssText = `
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid transparent;
            border-top: 2px solid currentColor;
            border-radius: 50%;
            margin-right: 8px;
        `;
        button.insertBefore(spinner, button.firstChild);

        return {
            remove: () => {
                button.textContent = originalText;
                button.disabled = originalDisabled;
                button.classList.remove('loading');
                if (spinner.parentNode) {
                    spinner.remove();
                }
            }
        };
    }

    // Stagger animations
    staggerAnimate(elements, animation, options = {}) {
        const { staggerDelay = 50 } = options;

        return Promise.all(
            Array.from(elements).map((element, index) =>
                this.animate(element, animation, {
                    ...options,
                    delay: (options.delay || 0) + (index * staggerDelay)
                })
            )
        );
    }

    // Performance optimization
    enableGPUAcceleration(element) {
        element.style.transform = 'translateZ(0)';
        element.style.willChange = 'transform, opacity';
    }

    disableGPUAcceleration(element) {
        element.style.transform = '';
        element.style.willChange = '';
    }

    // Cleanup method
    cleanup() {
        const styleSheet = document.getElementById('animation-styles');
        if (styleSheet) {
            styleSheet.remove();
        }
    }

    // Public API for external use
    getDuration(name) {
        return this.animationSettings.duration[name] || this.animationSettings.duration.normal;
    }

    getEasing(name) {
        return this.animationSettings.easing[name] || this.animationSettings.easing.smooth;
    }

    isPrefersReducedMotion() {
        return this.prefersReducedMotion;
    }
}

// Global animation utilities
const AnimationUtils = {
    // Quick animation functions
    fadeIn: (element, duration = 300) => {
        if (window.animationManager) {
            return window.animationManager.animate(element, 'fade-in', { duration });
        }
        return Promise.resolve();
    },

    fadeOut: (element, duration = 300) => {
        if (window.animationManager) {
            return window.animationManager.animate(element, 'fade-out', { duration });
        }
        return Promise.resolve();
    },

    slideUp: (element, duration = 300) => {
        if (window.animationManager) {
            return window.animationManager.animate(element, 'slide-in-up', { duration });
        }
        return Promise.resolve();
    },

    bounce: (element, duration = 600) => {
        if (window.animationManager) {
            return window.animationManager.animate(element, 'bounce', { duration });
        }
        return Promise.resolve();
    },

    shake: (element, duration = 500) => {
        if (window.animationManager) {
            return window.animationManager.animate(element, 'shake', { duration });
        }
        return Promise.resolve();
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.AnimationManager = AnimationManager;
    window.AnimationUtils = AnimationUtils;
}
