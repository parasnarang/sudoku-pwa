class AccessibilityManager {
    constructor() {
        this.keyboardNavigationEnabled = true;
        this.screenReaderEnabled = this.detectScreenReader();
        this.focusManagementStack = [];
        this.announcementQueue = [];
        this.currentFocus = null;
        this.keyboardShortcuts = new Map();

        this.initializeAccessibility();
    }

    initializeAccessibility() {
        this.setupARIA();
        this.setupKeyboardNavigation();
        this.setupFocusManagement();
        this.setupScreenReaderSupport();
        this.setupKeyboardShortcuts();
        this.createSkipLinks();
        this.enhanceFormAccessibility();
        this.setupLiveRegions();
    }

    detectScreenReader() {
        // Detect common screen readers
        const userAgent = navigator.userAgent.toLowerCase();
        return (
            window.speechSynthesis
            || userAgent.includes('nvda')
            || userAgent.includes('jaws')
            || userAgent.includes('dragon')
            || userAgent.includes('voiceover')
            || navigator.userAgent.includes('NVDA')
            || navigator.userAgent.includes('JAWS')
        );
    }

    setupARIA() {
        // Set main landmarks
        const main = document.querySelector('main');
        if (main) {
            main.setAttribute('role', 'main');
            main.setAttribute('aria-label', 'Sudoku game content');
        }

        const nav = document.querySelector('nav');
        if (nav) {
            nav.setAttribute('role', 'navigation');
            nav.setAttribute('aria-label', 'Main navigation');
        }

        const header = document.querySelector('header');
        if (header) {
            header.setAttribute('role', 'banner');
        }

        // Setup page titles
        this.updatePageTitle();

        // Setup game grid ARIA
        this.setupGameGridARIA();

        // Setup modal ARIA
        this.setupModalARIA();

        // Setup form ARIA
        this.setupFormARIA();
    }

    setupGameGridARIA() {
        const gameGrid = document.getElementById('sudoku-grid');
        if (!gameGrid) { return; }

        gameGrid.setAttribute('role', 'grid');
        gameGrid.setAttribute('aria-label', 'Sudoku puzzle grid');
        gameGrid.setAttribute('aria-describedby', 'sudoku-instructions');

        // Add instructions
        const instructions = document.createElement('div');
        instructions.id = 'sudoku-instructions';
        instructions.className = 'sr-only';
        instructions.textContent = 'Use arrow keys to navigate the grid. Press numbers 1-9 to fill cells. Press Delete or 0 to clear cells. Press N for notes mode, H for hint, U to undo.';
        gameGrid.parentNode.insertBefore(instructions, gameGrid);

        // Setup grid cells
        this.updateGridCellsARIA();
    }

    updateGridCellsARIA() {
        const cells = document.querySelectorAll('.sudoku-cell');
        cells.forEach((cell, index) => {
            const row = Math.floor(index / 9) + 1;
            const col = (index % 9) + 1;

            cell.setAttribute('role', 'gridcell');
            cell.setAttribute('tabindex', index === 0 ? '0' : '-1');
            cell.setAttribute('aria-label', `Row ${row}, Column ${col}`);
            cell.setAttribute('aria-describedby', 'sudoku-instructions');

            // Update cell content description
            this.updateCellDescription(cell, index);
        });
    }

    updateCellDescription(cell, index) {
        const row = Math.floor(index / 9) + 1;
        const col = (index % 9) + 1;
        const value = cell.textContent.trim();
        const isOriginal = cell.classList.contains('original');
        const isSelected = cell.classList.contains('selected');

        let description = `Row ${row}, Column ${col}`;

        if (value) {
            description += `, ${isOriginal ? 'given' : 'entered'} number ${value}`;
        } else {
            description += ', empty cell';
        }

        if (isSelected) {
            description += ', selected';
        }

        if (cell.classList.contains('error')) {
            description += ', invalid entry';
        }

        if (cell.classList.contains('hint')) {
            description += ', hint provided';
        }

        cell.setAttribute('aria-label', description);
    }

    setupModalARIA() {
        const modals = document.querySelectorAll('[id*="modal"], .modal');
        modals.forEach(modal => {
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');

            const title = modal.querySelector('h2, h3, .modal-title');
            if (title) {
                const titleId = title.id || `modal-title-${Date.now()}`;
                title.id = titleId;
                modal.setAttribute('aria-labelledby', titleId);
            }

            const content = modal.querySelector('.modal-body, .modal-content');
            if (content) {
                const contentId = content.id || `modal-content-${Date.now()}`;
                content.id = contentId;
                modal.setAttribute('aria-describedby', contentId);
            }
        });
    }

    setupFormARIA() {
        // Associate labels with form controls
        const formControls = document.querySelectorAll('input, select, textarea');
        formControls.forEach(control => {
            const label = document.querySelector(`label[for="${control.id}"]`)
                          || control.closest('.setting-item')?.querySelector('label');

            if (label && !control.getAttribute('aria-labelledby')) {
                const labelId = label.id || `label-${Date.now()}`;
                label.id = labelId;
                control.setAttribute('aria-labelledby', labelId);
            }

            // Add required indicators
            if (control.required) {
                control.setAttribute('aria-required', 'true');
            }

            // Add invalid state
            if (control.classList.contains('error') || control.getAttribute('aria-invalid')) {
                control.setAttribute('aria-invalid', 'true');
            }
        });

        // Setup toggle switches
        const toggles = document.querySelectorAll('input[type="checkbox"]');
        toggles.forEach(toggle => {
            toggle.setAttribute('role', 'switch');
            toggle.setAttribute('aria-checked', toggle.checked);

            toggle.addEventListener('change', () => {
                toggle.setAttribute('aria-checked', toggle.checked);
                this.announce(`${toggle.getAttribute('aria-label') || 'Setting'} ${toggle.checked ? 'enabled' : 'disabled'}`);
            });
        });
    }

    setupKeyboardNavigation() {
        // Grid navigation
        this.setupGridKeyboardNavigation();

        // Tab navigation
        this.setupTabNavigation();

        // Modal navigation
        this.setupModalKeyboardNavigation();

        // General keyboard shortcuts
        document.addEventListener('keydown', e => this.handleGlobalKeyboard(e));
    }

    setupGridKeyboardNavigation() {
        const gameGrid = document.getElementById('sudoku-grid');
        if (!gameGrid) { return; }

        gameGrid.addEventListener('keydown', e => {
            if (!gameGrid.contains(document.activeElement)) { return; }

            const currentCell = document.activeElement;
            const currentIndex = Array.from(gameGrid.children).indexOf(currentCell);

            if (currentIndex === -1) { return; }

            const row = Math.floor(currentIndex / 9);
            const col = currentIndex % 9;
            let newIndex = currentIndex;

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    newIndex = Math.max(0, currentIndex - 9);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    newIndex = Math.min(80, currentIndex + 9);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    newIndex = col > 0 ? currentIndex - 1 : currentIndex;
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    newIndex = col < 8 ? currentIndex + 1 : currentIndex;
                    break;
                case 'Home':
                    e.preventDefault();
                    newIndex = row * 9; // First cell in row
                    break;
                case 'End':
                    e.preventDefault();
                    newIndex = row * 9 + 8; // Last cell in row
                    break;
                case 'PageUp':
                    e.preventDefault();
                    newIndex = col; // First cell in column
                    break;
                case 'PageDown':
                    e.preventDefault();
                    newIndex = 72 + col; // Last cell in column
                    break;
            }

            if (newIndex !== currentIndex) {
                this.focusCell(newIndex);
                this.announceGridPosition(newIndex);
            }
        });
    }

    setupTabNavigation() {
        // Enhanced tab navigation for better UX
        document.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                this.handleTabNavigation(e);
            }
        });
    }

    setupModalKeyboardNavigation() {
        document.addEventListener('keydown', e => {
            const activeModal = document.querySelector('[role="dialog"]:not(.hidden)');
            if (!activeModal) { return; }

            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeModal(activeModal);
            }

            // Trap focus within modal
            if (e.key === 'Tab') {
                this.trapFocus(activeModal, e);
            }
        });
    }

    setupKeyboardShortcuts() {
        // Game shortcuts
        this.addKeyboardShortcut('h', () => {
            if (window.gameUI) {
                window.gameUI.useHint();
                this.announce('Hint requested');
            }
        }, 'Get hint');

        this.addKeyboardShortcut('u', () => {
            if (window.gameUI) {
                window.gameUI.undoMove();
                this.announce('Last move undone');
            }
        }, 'Undo last move');

        this.addKeyboardShortcut('n', () => {
            if (window.gameUI) {
                window.gameUI.toggleNotesMode();
                const { notesMode } = window.gameUI;
                this.announce(`Notes mode ${notesMode ? 'enabled' : 'disabled'}`);
            }
        }, 'Toggle notes mode');

        this.addKeyboardShortcut(' ', () => {
            if (window.gameUI) {
                window.gameUI.pauseGame();
                this.announce('Game paused');
            }
        }, 'Pause game');

        // Navigation shortcuts
        this.addKeyboardShortcut('Alt+1', () => {
            window.appRouter?.navigateTo('/');
            this.announce('Home page');
        }, 'Go to home');

        this.addKeyboardShortcut('Alt+2', () => {
            window.appRouter?.navigateTo('/daily');
            this.announce('Daily challenges page');
        }, 'Go to daily challenges');

        this.addKeyboardShortcut('Alt+3', () => {
            window.appRouter?.navigateTo('/tournament');
            this.announce('Tournament page');
        }, 'Go to tournament');

        this.addKeyboardShortcut('Alt+4', () => {
            window.appRouter?.navigateTo('/profile');
            this.announce('Profile page');
        }, 'Go to profile');

        // Accessibility shortcuts
        this.addKeyboardShortcut('Alt+?', () => {
            this.showKeyboardShortcuts();
        }, 'Show keyboard shortcuts');
    }

    addKeyboardShortcut(key, callback, description) {
        this.keyboardShortcuts.set(key, { callback, description });
    }

    handleGlobalKeyboard(e) {
        const key = this.getKeyString(e);
        const shortcut = this.keyboardShortcuts.get(key);

        if (shortcut) {
            e.preventDefault();
            shortcut.callback();
        }
    }

    getKeyString(e) {
        const parts = [];
        if (e.ctrlKey) { parts.push('Ctrl'); }
        if (e.altKey) { parts.push('Alt'); }
        if (e.shiftKey) { parts.push('Shift'); }
        parts.push(e.key);
        return parts.join('+');
    }

    setupFocusManagement() {
        // Track focus changes
        document.addEventListener('focusin', e => {
            this.currentFocus = e.target;
        });

        // Handle focus restoration
        document.addEventListener('focusout', e => {
            // Restore focus if it leaves the document
            setTimeout(() => {
                if (!document.activeElement || document.activeElement === document.body) {
                    this.restoreFocus();
                }
            }, 0);
        });
    }

    setupScreenReaderSupport() {
        // Create live regions for announcements
        this.createLiveRegions();

        // Enhanced screen reader support
        if (this.screenReaderEnabled) {
            this.enableScreenReaderFeatures();
        }
    }

    createLiveRegions() {
        // Polite announcements
        const politeRegion = document.createElement('div');
        politeRegion.id = 'aria-live-polite';
        politeRegion.setAttribute('aria-live', 'polite');
        politeRegion.setAttribute('aria-atomic', 'true');
        politeRegion.className = 'sr-only';
        document.body.appendChild(politeRegion);

        // Assertive announcements
        const assertiveRegion = document.createElement('div');
        assertiveRegion.id = 'aria-live-assertive';
        assertiveRegion.setAttribute('aria-live', 'assertive');
        assertiveRegion.setAttribute('aria-atomic', 'true');
        assertiveRegion.className = 'sr-only';
        document.body.appendChild(assertiveRegion);

        // Status region
        const statusRegion = document.createElement('div');
        statusRegion.id = 'aria-status';
        statusRegion.setAttribute('role', 'status');
        statusRegion.setAttribute('aria-live', 'polite');
        statusRegion.className = 'sr-only';
        document.body.appendChild(statusRegion);
    }

    createSkipLinks() {
        const skipNav = document.createElement('a');
        skipNav.href = '#main-content';
        skipNav.textContent = 'Skip to main content';
        skipNav.className = 'skip-link';
        skipNav.style.cssText = `
            position: absolute;
            top: -40px;
            left: 6px;
            background: #000;
            color: white;
            padding: 8px;
            text-decoration: none;
            border-radius: 4px;
            z-index: 9999;
            transition: top 0.3s;
        `;

        skipNav.addEventListener('focus', () => {
            skipNav.style.top = '6px';
        });

        skipNav.addEventListener('blur', () => {
            skipNav.style.top = '-40px';
        });

        document.body.insertBefore(skipNav, document.body.firstChild);

        // Skip to game grid
        const skipToGame = document.createElement('a');
        skipToGame.href = '#sudoku-grid';
        skipToGame.textContent = 'Skip to game grid';
        skipToGame.className = 'skip-link';
        skipToGame.style.cssText = skipNav.style.cssText;
        skipToGame.style.left = '150px';

        skipToGame.addEventListener('focus', () => {
            skipToGame.style.top = '6px';
        });

        skipToGame.addEventListener('blur', () => {
            skipToGame.style.top = '-40px';
        });

        document.body.insertBefore(skipToGame, skipNav.nextSibling);
    }

    // Focus Management Methods

    focusCell(index) {
        const cells = document.querySelectorAll('.sudoku-cell');
        if (cells[index]) {
            // Update tabindex
            cells.forEach(cell => cell.setAttribute('tabindex', '-1'));
            cells[index].setAttribute('tabindex', '0');
            cells[index].focus();

            // Update cell descriptions
            this.updateCellDescription(cells[index], index);
        }
    }

    saveFocus() {
        this.focusManagementStack.push(document.activeElement);
    }

    restoreFocus() {
        const lastFocus = this.focusManagementStack.pop();
        if (lastFocus && document.contains(lastFocus)) {
            lastFocus.focus();
        }
    }

    trapFocus(container, event) {
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            if (document.activeElement === firstFocusable) {
                event.preventDefault();
                lastFocusable.focus();
            }
        } else if (document.activeElement === lastFocusable) {
            event.preventDefault();
            firstFocusable.focus();
        }
    }

    // Announcement Methods

    announce(message, priority = 'polite') {
        const regionId = priority === 'assertive' ? 'aria-live-assertive' : 'aria-live-polite';
        const region = document.getElementById(regionId);

        if (region) {
            region.textContent = message;

            // Clear after a short delay to allow for new announcements
            setTimeout(() => {
                region.textContent = '';
            }, 1000);
        }
    }

    announceStatus(message) {
        const statusRegion = document.getElementById('aria-status');
        if (statusRegion) {
            statusRegion.textContent = message;
        }
    }

    announceGridPosition(index) {
        const row = Math.floor(index / 9) + 1;
        const col = (index % 9) + 1;
        const cell = document.querySelectorAll('.sudoku-cell')[index];
        const value = cell?.textContent.trim();

        let message = `Row ${row}, Column ${col}`;
        if (value) {
            message += `, contains ${value}`;
        } else {
            message += `, empty`;
        }

        this.announceStatus(message);
    }

    // Game Event Handlers

    onGameStart(difficulty) {
        this.announce(`New ${difficulty} game started`);
        this.updatePageTitle(`Sudoku - ${difficulty} game`);
    }

    onGameComplete(result) {
        const message = `Congratulations! Puzzle completed in ${this.formatTime(result.time)} with ${result.mistakes} mistakes. Score: ${result.score}`;
        this.announce(message, 'assertive');
    }

    onGamePause() {
        this.announce('Game paused');
    }

    onGameResume() {
        this.announce('Game resumed');
    }

    onNumberEntry(number, isCorrect) {
        if (isCorrect) {
            this.announce(`Entered ${number}`);
        } else {
            this.announce(`Invalid entry: ${number}`, 'assertive');
        }
    }

    onHintUsed(number, position) {
        const row = Math.floor(position / 9) + 1;
        const col = (position % 9) + 1;
        this.announce(`Hint: ${number} at row ${row}, column ${col}`);
    }

    onAchievementUnlocked(achievement) {
        this.announce(`Achievement unlocked: ${achievement.name}`, 'assertive');
    }

    // Utility Methods

    updatePageTitle(title = 'Sudoku Master') {
        document.title = title;
        const h1 = document.getElementById('page-title');
        if (h1) {
            h1.textContent = title;
        }
    }

    formatTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes} minutes and ${seconds} seconds`;
    }

    closeModal(modal) {
        modal.classList.add('hidden');
        this.restoreFocus();
        this.announce('Dialog closed');
    }

    showKeyboardShortcuts() {
        const shortcuts = Array.from(this.keyboardShortcuts.entries())
            .map(([key, { description }]) => `${key}: ${description}`)
            .join('\n');

        const modal = document.createElement('div');
        modal.className = 'accessibility-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'shortcuts-title');

        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
                    <button class="close-btn" aria-label="Close dialog">&times;</button>
                </div>
                <div class="modal-body">
                    <pre style="white-space: pre-wrap; font-family: monospace;">${shortcuts}</pre>
                </div>
            </div>
        `;

        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const closeBtn = modal.querySelector('.close-btn');
        const closeModal = () => {
            modal.remove();
            this.restoreFocus();
        };

        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', e => {
            if (e.target === modal.querySelector('.modal-backdrop')) {
                closeModal();
            }
        });

        document.addEventListener('keydown', function handleEscape(e) {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        });

        this.saveFocus();
        document.body.appendChild(modal);
        closeBtn.focus();
    }

    enableScreenReaderFeatures() {
        // Add more descriptive content for screen readers
        document.body.setAttribute('data-screen-reader', 'true');

        // Enhance grid descriptions
        const gameGrid = document.getElementById('sudoku-grid');
        if (gameGrid) {
            const description = document.createElement('div');
            description.className = 'sr-only';
            description.innerHTML = `
                <p>This is a 9x9 Sudoku grid. Fill each row, column, and 3x3 box with numbers 1-9.</p>
                <p>Use arrow keys to navigate, number keys to enter values, and keyboard shortcuts for game functions.</p>
            `;
            gameGrid.parentNode.insertBefore(description, gameGrid);
        }
    }

    // High Contrast Mode Support
    setupHighContrast() {
        // Detect high contrast mode
        const supportsHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

        if (supportsHighContrast) {
            document.body.classList.add('high-contrast');
        }

        // Listen for changes
        window.matchMedia('(prefers-contrast: high)').addEventListener('change', e => {
            document.body.classList.toggle('high-contrast', e.matches);
        });
    }

    // Color Blind Support
    setupColorBlindSupport() {
        // Add patterns and symbols for color differentiation
        const style = document.createElement('style');
        style.textContent = `
            [data-color-scheme="colorblind-friendly"] .sudoku-cell.error {
                background-image: repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px);
            }
            
            [data-color-scheme="colorblind-friendly"] .sudoku-cell.hint {
                border: 2px dashed currentColor;
            }
            
            [data-color-scheme="colorblind-friendly"] .sudoku-cell.selected {
                outline: 3px solid currentColor;
            }
        `;
        document.head.appendChild(style);
    }

    // Public API
    setGameReference(gameUI) {
        this.gameUI = gameUI;

        // Hook into game events
        if (gameUI) {
            // Override game methods to add accessibility
            const originalSelectCell = gameUI.selectCell.bind(gameUI);
            gameUI.selectCell = index => {
                originalSelectCell(index);
                this.announceGridPosition(index);
                this.updateCellDescription(document.querySelectorAll('.sudoku-cell')[index], index);
            };

            const originalInputNumber = gameUI.inputNumber.bind(gameUI);
            gameUI.inputNumber = number => {
                const result = originalInputNumber(number);
                if (gameUI.selectedCell !== null) {
                    this.onNumberEntry(number, !result?.error);
                }
                return result;
            };
        }
    }

    updateGameState(gameState) {
        // Update ARIA descriptions based on game state
        this.updateGridCellsARIA();

        // Update live regions with game status
        if (gameState.isCompleted) {
            this.onGameComplete(gameState);
        }
    }

    cleanup() {
        // Remove event listeners and clean up
        this.keyboardShortcuts.clear();
        this.focusManagementStack = [];
        this.announcementQueue = [];
    }
}

// CSS for accessibility features
const accessibilityStyles = document.createElement('style');
accessibilityStyles.textContent = `
    /* Screen reader only content */
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    /* Skip links */
    .skip-link:focus {
        position: absolute;
        top: 6px !important;
        left: 6px;
        background: #000;
        color: white;
        padding: 8px;
        text-decoration: none;
        border-radius: 4px;
        z-index: 9999;
    }

    /* Focus indicators */
    :focus {
        outline: 2px solid var(--focus-color, #2196F3);
        outline-offset: 2px;
    }

    .sudoku-cell:focus {
        outline: 3px solid var(--focus-color, #2196F3);
        outline-offset: 1px;
    }

    /* High contrast mode */
    @media (prefers-contrast: high) {
        :root {
            --focus-color: #000;
        }
        
        .sudoku-cell {
            border-width: 2px;
        }
        
        button {
            border: 2px solid currentColor;
        }
    }

    /* Reduced motion preferences */
    @media (prefers-reduced-motion: reduce) {
        * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
        }
    }

    /* Large text support */
    @media (min-resolution: 192dpi) {
        body {
            font-size: 18px;
        }
        
        .sudoku-cell {
            font-size: 1.5rem;
        }
    }

    /* Keyboard navigation indicators */
    [data-keyboard-navigation="true"] button:focus,
    [data-keyboard-navigation="true"] .interactive:focus {
        box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.3);
    }
`;

document.head.appendChild(accessibilityStyles);

// Make available globally
if (typeof window !== 'undefined') {
    window.AccessibilityManager = AccessibilityManager;
}
