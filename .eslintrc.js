module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module'
    },
    globals: {
        // Service Worker globals
        'self': 'readonly',
        'caches': 'readonly',
        'clients': 'readonly',
        'skipWaiting': 'readonly',
        
        // Test framework globals
        'describe': 'readonly',
        'it': 'readonly',
        'beforeAll': 'readonly',
        'beforeEach': 'readonly',
        'afterAll': 'readonly',
        'afterEach': 'readonly',
        'expect': 'readonly',
        'TestFramework': 'readonly',
        'TestUtils': 'readonly',
        
        // Game engine globals
        'SudokuEngine': 'readonly',
        'SudokuGenerator': 'readonly',
        'GameUI': 'readonly',
        'TournamentUI': 'readonly',
        'CalendarUI': 'readonly',
        'DataStorage': 'readonly',
        'UserProgress': 'readonly',
        'SettingsManager': 'readonly',
        'PWAManager': 'readonly',
        'AppRouter': 'readonly',
        'AnimationManager': 'readonly',
        'AccessibilityManager': 'readonly',
        'PerformanceMonitor': 'readonly',
        'ErrorHandler': 'readonly',
        
        // Global app instances
        'gameUI': 'writable',
        'tournamentUI': 'writable',
        'calendarUI': 'writable',
        'dataStorage': 'writable',
        'userProgress': 'writable',
        'settingsManager': 'writable',
        'pwaManager': 'writable',
        'router': 'writable',
        'animationManager': 'writable',
        'accessibilityManager': 'writable',
        'performanceMonitor': 'writable',
        'errorHandler': 'writable',
        
        // Browser globals
        'gc': 'readonly', // Optional garbage collection function
        'gtag': 'readonly' // Google Analytics
    },
    rules: {
        // Possible Errors
        'no-console': ['error', { allow: ['warn', 'error'] }],
        'no-debugger': 'error',
        'no-alert': 'off',
        
        // Best Practices
        'curly': ['error', 'multi-line'],
        'dot-notation': 'error',
        'eqeqeq': ['error', 'always'],
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-invalid-this': 'error',
        'no-lone-blocks': 'error',
        'no-loop-func': 'error',
        'no-magic-numbers': 'off', // Disabled for game development
        'no-multi-spaces': 'error',
        'no-new': 'warn', // Relaxed for DOM manipulation
        'no-new-func': 'error',
        'no-new-wrappers': 'error',
        'no-return-assign': 'error',
        'no-self-compare': 'error',
        'no-sequences': 'error',
        'no-throw-literal': 'error',
        'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
        'no-useless-call': 'error',
        'no-useless-concat': 'error',
        'no-useless-escape': 'warn', // Relaxed for regex patterns
        'no-prototype-builtins': 'warn', // Relaxed for object iteration
        'no-case-declarations': 'warn', // Relaxed for switch statements
        'no-constant-condition': 'warn', // Relaxed for intentional infinite loops
        'no-void': 'error',
        'prefer-promise-reject-errors': 'error',
        'radix': 'warn',
        
        // Variables
        'no-catch-shadow': 'off',
        'no-delete-var': 'error',
        'no-label-var': 'error',
        'no-restricted-globals': 'error',
        'no-shadow': 'error',
        'no-shadow-restricted-names': 'error',
        'no-undef': 'error',
        'no-undef-init': 'error',
        'no-undefined': 'off',
        'no-unused-vars': ['warn', { 
            vars: 'all',
            args: 'after-used',
            ignoreRestSiblings: false,
            argsIgnorePattern: '^_'
        }],
        'no-use-before-define': ['error', { functions: false, classes: true }],
        
        // Stylistic Issues
        'array-bracket-spacing': ['error', 'never'],
        'block-spacing': ['error', 'always'],
        'brace-style': ['error', '1tbs', { allowSingleLine: true }],
        'camelcase': ['error', { properties: 'always' }],
        'comma-dangle': ['error', 'never'],
        'comma-spacing': ['error', { before: false, after: true }],
        'comma-style': ['error', 'last'],
        'computed-property-spacing': ['error', 'never'],
        'consistent-this': ['error', 'self'],
        'eol-last': ['error', 'always'],
        'func-call-spacing': ['error', 'never'],
        'func-name-matching': 'error',
        'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
        'indent': ['error', 4, { SwitchCase: 1 }],
        'key-spacing': ['error', { beforeColon: false, afterColon: true }],
        'keyword-spacing': ['error', { before: true, after: true }],
        'line-comment-position': 'off',
        'linebreak-style': ['error', 'unix'],
        'max-depth': ['warn', 6],
        'max-len': 'off',
        'max-nested-callbacks': ['warn', 5],
        'max-params': ['warn', 7],
        'new-cap': ['error', { newIsCap: true, capIsNew: false }],
        'new-parens': 'error',
        'newline-per-chained-call': 'off',
        'no-array-constructor': 'error',
        'no-lonely-if': 'error',
        'no-mixed-operators': 'warn',
        'no-mixed-spaces-and-tabs': 'error',
        'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
        'no-negated-condition': 'warn', // Relaxed for game logic
        'no-nested-ternary': 'error',
        'no-new-object': 'error',
        'no-spaced-func': 'error',
        'no-trailing-spaces': 'error',
        'no-unneeded-ternary': 'error',
        'no-whitespace-before-property': 'error',
        'object-curly-spacing': ['error', 'always'],
        'one-var': ['error', 'never'],
        'one-var-declaration-per-line': ['error', 'always'],
        'operator-assignment': ['error', 'always'],
        'operator-linebreak': ['error', 'before'],
        'padded-blocks': ['error', 'never'],
        'quote-props': ['error', 'as-needed'],
        'quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
        'semi': ['error', 'always'],
        'semi-spacing': ['error', { before: false, after: true }],
        'space-before-blocks': ['error', 'always'],
        'space-before-function-paren': ['error', 'never'],
        'space-in-parens': ['error', 'never'],
        'space-infix-ops': 'error',
        'space-unary-ops': ['error', { words: true, nonwords: false }],
        'spaced-comment': ['error', 'always'],
        
        // ECMAScript 6
        'arrow-body-style': ['error', 'as-needed'],
        'arrow-parens': ['error', 'as-needed'],
        'arrow-spacing': ['error', { before: true, after: true }],
        'constructor-super': 'error',
        'generator-star-spacing': ['error', { before: false, after: true }],
        'no-class-assign': 'error',
        'no-confusing-arrow': ['error', { allowParens: true }],
        'no-const-assign': 'error',
        'no-dupe-class-members': 'error',
        'no-duplicate-imports': 'error',
        'no-new-symbol': 'error',
        'no-restricted-imports': 'error',
        'no-this-before-super': 'error',
        'no-useless-computed-key': 'error',
        'no-useless-constructor': 'error',
        'no-useless-rename': 'error',
        'no-var': 'error',
        'object-shorthand': ['error', 'always'],
        'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
        'prefer-const': 'error',
        'prefer-destructuring': ['error', {
            array: false,
            object: true
        }, {
            enforceForRenamedProperties: false
        }],
        'prefer-numeric-literals': 'error',
        'prefer-rest-params': 'error',
        'prefer-spread': 'error',
        'prefer-template': 'error',
        'require-yield': 'error',
        'rest-spread-spacing': ['error', 'never'],
        'sort-imports': 'off',
        'symbol-description': 'error',
        'template-curly-spacing': ['error', 'never'],
        'yield-star-spacing': ['error', { before: false, after: true }]
    },
    overrides: [
        {
            files: ['sw.js'],
            env: {
                browser: false,
                serviceworker: true
            },
            globals: {
                'importScripts': 'readonly'
            }
        },
        {
            files: ['test/**/*.js'],
            env: {
                browser: true,
                node: true,
                mocha: true
            },
            rules: {
                'no-unused-expressions': 'off',
                'max-nested-callbacks': 'off',
                'no-magic-numbers': 'off'
            }
        },
        {
            files: ['build/**/*.js', 'scripts/**/*.js'],
            env: {
                browser: false,
                node: true
            },
            rules: {
                'no-console': 'off',
                'no-magic-numbers': 'off'
            }
        },
        {
            files: ['js/error-handler.js', 'js/performance-monitor.js', 'js/storage.js'],
            rules: {
                'no-console': ['warn', { allow: ['warn', 'error', 'log'] }]
            }
        }
    ]
};