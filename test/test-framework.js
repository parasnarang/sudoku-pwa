/**
 * Lightweight Testing Framework for Sudoku PWA
 * No external dependencies - vanilla JavaScript testing
 */

class TestFramework {
    constructor() {
        this.tests = [];
        this.suites = {};
        this.results = {
            passed: 0,
            failed: 0,
            skipped: 0,
            total: 0
        };
        this.startTime = 0;
        this.currentSuite = null;
        this.beforeEachCallbacks = [];
        this.afterEachCallbacks = [];
        this.beforeAllCallbacks = [];
        this.afterAllCallbacks = [];
    }

    // Test Suite Management
    describe(suiteName, callback) {
        this.currentSuite = suiteName;
        this.suites[suiteName] = {
            tests: [],
            beforeEach: [],
            afterEach: [],
            beforeAll: [],
            afterAll: []
        };
        
        console.group(`📋 Test Suite: ${suiteName}`);
        callback();
        console.groupEnd();
        
        this.currentSuite = null;
    }

    // Individual Test Cases
    it(testName, testFn, options = {}) {
        const test = {
            name: testName,
            fn: testFn,
            suite: this.currentSuite,
            timeout: options.timeout || 5000,
            skip: options.skip || false,
            only: options.only || false
        };
        
        this.tests.push(test);
        
        if (this.currentSuite) {
            this.suites[this.currentSuite].tests.push(test);
        }
    }

    // Test Hooks
    beforeEach(callback) {
        if (this.currentSuite) {
            this.suites[this.currentSuite].beforeEach.push(callback);
        } else {
            this.beforeEachCallbacks.push(callback);
        }
    }

    afterEach(callback) {
        if (this.currentSuite) {
            this.suites[this.currentSuite].afterEach.push(callback);
        } else {
            this.afterEachCallbacks.push(callback);
        }
    }

    beforeAll(callback) {
        if (this.currentSuite) {
            this.suites[this.currentSuite].beforeAll.push(callback);
        } else {
            this.beforeAllCallbacks.push(callback);
        }
    }

    afterAll(callback) {
        if (this.currentSuite) {
            this.suites[this.currentSuite].afterAll.push(callback);
        } else {
            this.afterAllCallbacks.push(callback);
        }
    }

    // Async Test Runner
    async run() {
        this.startTime = performance.now();
        this.results = { passed: 0, failed: 0, skipped: 0, total: 0 };
        
        console.log('🚀 Starting Test Suite Execution...\n');

        // Run global beforeAll hooks
        await this.runHooks(this.beforeAllCallbacks);

        // Group tests by suite
        const testsBySuite = this.groupTestsBySuite();
        
        for (const [suiteName, suiteTests] of Object.entries(testsBySuite)) {
            await this.runTestSuite(suiteName, suiteTests);
        }

        // Run global afterAll hooks
        await this.runHooks(this.afterAllCallbacks);

        this.printResults();
        return this.results;
    }

    groupTestsBySuite() {
        const grouped = { 'Global': [] };
        
        for (const test of this.tests) {
            const suite = test.suite || 'Global';
            if (!grouped[suite]) {
                grouped[suite] = [];
            }
            grouped[suite].push(test);
        }
        
        return grouped;
    }

    async runTestSuite(suiteName, tests) {
        console.group(`📁 Running Suite: ${suiteName}`);
        
        // Run suite beforeAll hooks
        if (this.suites[suiteName]) {
            await this.runHooks(this.suites[suiteName].beforeAll);
        }

        for (const test of tests) {
            if (test.skip) {
                this.results.skipped++;
                this.results.total++;
                console.log(`⏭️  SKIP: ${test.name}`);
                continue;
            }

            await this.runSingleTest(test);
        }

        // Run suite afterAll hooks
        if (this.suites[suiteName]) {
            await this.runHooks(this.suites[suiteName].afterAll);
        }

        console.groupEnd();
    }

    async runSingleTest(test) {
        const testStartTime = performance.now();
        this.results.total++;

        try {
            // Run beforeEach hooks
            await this.runHooks(this.beforeEachCallbacks);
            if (test.suite && this.suites[test.suite]) {
                await this.runHooks(this.suites[test.suite].beforeEach);
            }

            // Run the actual test
            const testPromise = Promise.resolve(test.fn());
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Test timeout after ${test.timeout}ms`)), test.timeout);
            });

            await Promise.race([testPromise, timeoutPromise]);

            // Run afterEach hooks
            if (test.suite && this.suites[test.suite]) {
                await this.runHooks(this.suites[test.suite].afterEach);
            }
            await this.runHooks(this.afterEachCallbacks);

            const testDuration = (performance.now() - testStartTime).toFixed(2);
            this.results.passed++;
            console.log(`✅ PASS: ${test.name} (${testDuration}ms)`);

        } catch (error) {
            const testDuration = (performance.now() - testStartTime).toFixed(2);
            this.results.failed++;
            console.error(`❌ FAIL: ${test.name} (${testDuration}ms)`);
            console.error(`   Error: ${error.message}`);
            if (error.stack) {
                console.error(`   Stack: ${error.stack}`);
            }
        }
    }

    async runHooks(hooks) {
        for (const hook of hooks) {
            try {
                await hook();
            } catch (error) {
                console.error(`Hook execution failed: ${error.message}`);
            }
        }
    }

    printResults() {
        const totalTime = (performance.now() - this.startTime).toFixed(2);
        const passRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
        
        console.log('\n📊 Test Results Summary:');
        console.log('========================');
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`⏭️  Skipped: ${this.results.skipped}`);
        console.log(`📈 Total: ${this.results.total}`);
        console.log(`🎯 Pass Rate: ${passRate}%`);
        console.log(`⏱️  Duration: ${totalTime}ms`);
        
        if (this.results.failed > 0) {
            console.log('\n❗ Some tests failed. Check the output above for details.');
        } else {
            console.log('\n🎉 All tests passed!');
        }
    }
}

// Assertion Library
class Assertions {
    constructor(actual) {
        this.actual = actual;
    }

    // Basic Equality
    toBe(expected) {
        if (this.actual !== expected) {
            throw new Error(`Expected ${expected}, but got ${this.actual}`);
        }
        return this;
    }

    toEqual(expected) {
        if (!this.deepEqual(this.actual, expected)) {
            throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(this.actual)}`);
        }
        return this;
    }

    // Boolean Checks
    toBeTruthy() {
        if (!this.actual) {
            throw new Error(`Expected truthy value, but got ${this.actual}`);
        }
        return this;
    }

    toBeFalsy() {
        if (this.actual) {
            throw new Error(`Expected falsy value, but got ${this.actual}`);
        }
        return this;
    }

    // Null/Undefined
    toBeNull() {
        if (this.actual !== null) {
            throw new Error(`Expected null, but got ${this.actual}`);
        }
        return this;
    }

    toBeUndefined() {
        if (this.actual !== undefined) {
            throw new Error(`Expected undefined, but got ${this.actual}`);
        }
        return this;
    }

    toBeDefined() {
        if (this.actual === undefined) {
            throw new Error(`Expected value to be defined`);
        }
        return this;
    }

    // Type Checks
    toBeInstanceOf(constructor) {
        if (!(this.actual instanceof constructor)) {
            throw new Error(`Expected instance of ${constructor.name}, but got ${typeof this.actual}`);
        }
        return this;
    }

    // Number Comparisons
    toBeGreaterThan(expected) {
        if (this.actual <= expected) {
            throw new Error(`Expected ${this.actual} to be greater than ${expected}`);
        }
        return this;
    }

    toBeLessThan(expected) {
        if (this.actual >= expected) {
            throw new Error(`Expected ${this.actual} to be less than ${expected}`);
        }
        return this;
    }

    toBeCloseTo(expected, precision = 2) {
        const diff = Math.abs(this.actual - expected);
        const tolerance = Math.pow(10, -precision) / 2;
        if (diff > tolerance) {
            throw new Error(`Expected ${this.actual} to be close to ${expected} (precision: ${precision})`);
        }
        return this;
    }

    // Array/Object Checks
    toContain(expected) {
        if (Array.isArray(this.actual)) {
            if (!this.actual.includes(expected)) {
                throw new Error(`Expected array to contain ${expected}`);
            }
        } else if (typeof this.actual === 'string') {
            if (!this.actual.includes(expected)) {
                throw new Error(`Expected string to contain "${expected}"`);
            }
        } else {
            throw new Error(`toContain can only be used with arrays or strings`);
        }
        return this;
    }

    toHaveLength(expected) {
        if (!this.actual || typeof this.actual.length !== 'number') {
            throw new Error(`Expected value to have a length property`);
        }
        if (this.actual.length !== expected) {
            throw new Error(`Expected length ${expected}, but got ${this.actual.length}`);
        }
        return this;
    }

    toHaveProperty(property, value) {
        if (!(property in this.actual)) {
            throw new Error(`Expected object to have property "${property}"`);
        }
        if (value !== undefined && this.actual[property] !== value) {
            throw new Error(`Expected property "${property}" to be ${value}, but got ${this.actual[property]}`);
        }
        return this;
    }

    // Function Checks
    toThrow(expectedError) {
        if (typeof this.actual !== 'function') {
            throw new Error(`Expected a function, but got ${typeof this.actual}`);
        }

        try {
            this.actual();
            throw new Error(`Expected function to throw an error`);
        } catch (error) {
            if (expectedError) {
                if (typeof expectedError === 'string' && !error.message.includes(expectedError)) {
                    throw new Error(`Expected error message to contain "${expectedError}", but got "${error.message}"`);
                }
                if (expectedError instanceof RegExp && !expectedError.test(error.message)) {
                    throw new Error(`Expected error message to match ${expectedError}, but got "${error.message}"`);
                }
            }
        }
        return this;
    }

    // Async Checks
    async toResolve() {
        try {
            await this.actual;
        } catch (error) {
            throw new Error(`Expected promise to resolve, but it rejected with: ${error.message}`);
        }
        return this;
    }

    async toReject(expectedError) {
        try {
            await this.actual;
            throw new Error(`Expected promise to reject`);
        } catch (error) {
            if (expectedError) {
                if (typeof expectedError === 'string' && !error.message.includes(expectedError)) {
                    throw new Error(`Expected rejection message to contain "${expectedError}", but got "${error.message}"`);
                }
            }
        }
        return this;
    }

    // Helper Methods
    deepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (typeof a !== typeof b) return false;

        if (typeof a === 'object') {
            if (Array.isArray(a) !== Array.isArray(b)) return false;
            
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            
            if (keysA.length !== keysB.length) return false;
            
            for (const key of keysA) {
                if (!keysB.includes(key)) return false;
                if (!this.deepEqual(a[key], b[key])) return false;
            }
            
            return true;
        }

        return false;
    }
}

// Global Test Functions
function expect(actual) {
    return new Assertions(actual);
}

// Test Utilities
class TestUtils {
    static async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static mockFunction(implementation) {
        const mock = implementation || (() => {});
        mock.calls = [];
        mock.returnValues = [];
        
        const mockedFn = (...args) => {
            mock.calls.push(args);
            const result = mock.apply(this, args);
            mock.returnValues.push(result);
            return result;
        };
        
        mockedFn.calls = mock.calls;
        mockedFn.returnValues = mock.returnValues;
        mockedFn.wasCalledWith = (...expectedArgs) => {
            return mock.calls.some(call => 
                call.length === expectedArgs.length &&
                call.every((arg, i) => arg === expectedArgs[i])
            );
        };
        mockedFn.wasCalledTimes = (expectedTimes) => {
            return mock.calls.length === expectedTimes;
        };
        
        return mockedFn;
    }

    static createDOM(html) {
        const container = document.createElement('div');
        container.innerHTML = html;
        return container;
    }

    static cleanup() {
        // Remove any test DOM elements
        const testContainers = document.querySelectorAll('[data-test="true"]');
        testContainers.forEach(container => container.remove());
        
        // Clear any test data from localStorage
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('test-')) {
                localStorage.removeItem(key);
            }
        });
    }

    static generateTestData() {
        return {
            validSudokuGrid: [
                [5,3,0,0,7,0,0,0,0],
                [6,0,0,1,9,5,0,0,0],
                [0,9,8,0,0,0,0,6,0],
                [8,0,0,0,6,0,0,0,3],
                [4,0,0,8,0,3,0,0,1],
                [7,0,0,0,2,0,0,0,6],
                [0,6,0,0,0,0,2,8,0],
                [0,0,0,4,1,9,0,0,5],
                [0,0,0,0,8,0,0,7,9]
            ],
            solvedSudokuGrid: [
                [5,3,4,6,7,8,9,1,2],
                [6,7,2,1,9,5,3,4,8],
                [1,9,8,3,4,2,5,6,7],
                [8,5,9,7,6,1,4,2,3],
                [4,2,6,8,5,3,7,9,1],
                [7,1,3,9,2,4,8,5,6],
                [9,6,1,5,3,7,2,8,4],
                [2,8,7,4,1,9,6,3,5],
                [3,4,5,2,8,6,1,7,9]
            ],
            invalidSudokuGrid: [
                [5,5,0,0,7,0,0,0,0], // Duplicate 5 in first row
                [6,0,0,1,9,5,0,0,0],
                [0,9,8,0,0,0,0,6,0],
                [8,0,0,0,6,0,0,0,3],
                [4,0,0,8,0,3,0,0,1],
                [7,0,0,0,2,0,0,0,6],
                [0,6,0,0,0,0,2,8,0],
                [0,0,0,4,1,9,0,0,5],
                [0,0,0,0,8,0,0,7,9]
            ],
            userProgressData: {
                stats: {
                    gamesPlayed: 25,
                    gamesCompleted: 20,
                    bestTime: 180000,
                    averageTime: 300000,
                    currentStreak: 5,
                    bestStreak: 12,
                    totalHints: 15,
                    totalMistakes: 8,
                    difficultyStats: {
                        easy: { played: 8, completed: 8, bestTime: 120000 },
                        medium: { played: 10, completed: 9, bestTime: 180000 },
                        hard: { played: 5, completed: 3, bestTime: 420000 },
                        expert: { played: 2, completed: 0, bestTime: null }
                    }
                }
            }
        };
    }
}

// Global Test Instance
const testFramework = new TestFramework();
const describe = testFramework.describe.bind(testFramework);
const it = testFramework.it.bind(testFramework);
const beforeEach = testFramework.beforeEach.bind(testFramework);
const afterEach = testFramework.afterEach.bind(testFramework);
const beforeAll = testFramework.beforeAll.bind(testFramework);
const afterAll = testFramework.afterAll.bind(testFramework);

// Export for use
if (typeof window !== 'undefined') {
    window.TestFramework = TestFramework;
    window.TestUtils = TestUtils;
    window.testFramework = testFramework;
    window.describe = describe;
    window.it = it;
    window.expect = expect;
    window.beforeEach = beforeEach;
    window.afterEach = afterEach;
    window.beforeAll = beforeAll;
    window.afterAll = afterAll;
}

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestFramework;
    module.exports.TestUtils = TestUtils;
    module.exports.testFramework = testFramework;
    module.exports.describe = describe;
    module.exports.it = it;
    module.exports.expect = expect;
    module.exports.beforeEach = beforeEach;
    module.exports.afterEach = afterEach;
    module.exports.beforeAll = beforeAll;
    module.exports.afterAll = afterAll;
}