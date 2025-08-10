class SudokuGenerator {
    constructor() {
        this.engine = new SudokuEngine();
        this.cache = new Map();
        this.maxCacheSize = 100;
        
        this.difficultySettings = {
            easy: { minClues: 36, maxClues: 46, name: 'Easy' },
            medium: { minClues: 32, maxClues: 35, name: 'Medium' },
            hard: { minClues: 28, maxClues: 31, name: 'Hard' },
            expert: { minClues: 22, maxClues: 27, name: 'Expert' }
        };
        
        this.symmetryPatterns = [
            'central', 'horizontal', 'vertical', 'diagonal', 'rotational', 'none'
        ];
    }

    seededRandom(seed) {
        let x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    shuffleArray(array, seed = Math.random()) {
        const shuffled = [...array];
        let currentIndex = shuffled.length;
        
        while (currentIndex !== 0) {
            const randomIndex = Math.floor(this.seededRandom(seed + currentIndex) * currentIndex);
            currentIndex--;
            [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
        }
        
        return shuffled;
    }

    generateCompleteGrid(seed = Date.now()) {
        const grid = Array(9).fill(null).map(() => Array(9).fill(0));
        
        if (this.fillGrid(grid, seed)) {
            return grid;
        }
        
        throw new Error('Failed to generate complete grid');
    }

    fillGrid(grid, seed, startPos = 0) {
        if (startPos >= 81) {
            return true;
        }
        
        const row = Math.floor(startPos / 9);
        const col = startPos % 9;
        
        if (grid[row][col] !== 0) {
            return this.fillGrid(grid, seed, startPos + 1);
        }
        
        const numbers = this.shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9], seed + startPos);
        
        for (const num of numbers) {
            if (this.engine.isValidPlacement(grid, row, col, num)) {
                grid[row][col] = num;
                
                if (this.fillGrid(grid, seed, startPos + 1)) {
                    return true;
                }
                
                grid[row][col] = 0;
            }
        }
        
        return false;
    }

    generateBasePuzzle(seed = Date.now()) {
        const attempts = 10;
        
        for (let attempt = 0; attempt < attempts; attempt++) {
            try {
                const completeGrid = this.generateCompleteGrid(seed + attempt);
                return completeGrid;
            } catch (error) {
                continue;
            }
        }
        
        throw new Error('Failed to generate base puzzle after multiple attempts');
    }

    removeCellsSymmetrically(grid, cellsToRemove, symmetryType, seed) {
        const puzzle = grid.map(row => [...row]);
        const solution = grid.map(row => [...row]);
        
        const positions = [];
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                positions.push([row, col]);
            }
        }
        
        const shuffledPositions = this.shuffleArray(positions, seed);
        let removedCells = 0;
        
        for (const [row, col] of shuffledPositions) {
            if (removedCells >= cellsToRemove) break;
            
            const symmetricPositions = this.getSymmetricPositions(row, col, symmetryType);
            const canRemoveAll = symmetricPositions.every(([r, c]) => puzzle[r][c] !== 0);
            
            if (!canRemoveAll) continue;
            
            const originalValues = symmetricPositions.map(([r, c]) => puzzle[r][c]);
            
            symmetricPositions.forEach(([r, c]) => {
                puzzle[r][c] = 0;
            });
            
            if (this.engine.hasUniqueSolution(puzzle)) {
                removedCells += symmetricPositions.length;
            } else {
                symmetricPositions.forEach(([r, c], index) => {
                    puzzle[r][c] = originalValues[index];
                });
            }
        }
        
        return { puzzle, solution, removedCells: 81 - this.countFilledCells(puzzle) };
    }

    getSymmetricPositions(row, col, symmetryType) {
        const positions = [[row, col]];
        
        switch (symmetryType) {
            case 'central':
                positions.push([8 - row, 8 - col]);
                break;
            case 'horizontal':
                positions.push([row, 8 - col]);
                break;
            case 'vertical':
                positions.push([8 - row, col]);
                break;
            case 'diagonal':
                positions.push([col, row]);
                break;
            case 'rotational':
                positions.push([col, 8 - row]);
                positions.push([8 - row, 8 - col]);
                positions.push([8 - col, row]);
                break;
            case 'none':
            default:
                break;
        }
        
        return [...new Set(positions.map(pos => pos.join(','))).values()].map(pos => pos.split(',').map(Number));
    }

    countFilledCells(grid) {
        let count = 0;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] !== 0) {
                    count++;
                }
            }
        }
        return count;
    }

    generatePuzzle(difficulty = 'medium', seed = Date.now(), maxAttempts = 50) {
        const cacheKey = `${difficulty}-${seed}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const difficultyConfig = this.difficultySettings[difficulty];
        if (!difficultyConfig) {
            throw new Error(`Invalid difficulty: ${difficulty}`);
        }
        
        const targetClues = Math.floor(
            this.seededRandom(seed) * (difficultyConfig.maxClues - difficultyConfig.minClues + 1)
        ) + difficultyConfig.minClues;
        
        const maxCellsToRemove = 81 - targetClues;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const completeGrid = this.generateBasePuzzle(seed + attempt);
                const symmetryType = this.symmetryPatterns[
                    Math.floor(this.seededRandom(seed + attempt + 1000) * this.symmetryPatterns.length)
                ];
                
                const result = this.removeCellsSymmetrically(
                    completeGrid, 
                    maxCellsToRemove, 
                    symmetryType, 
                    seed + attempt
                );
                
                const clueCount = this.countFilledCells(result.puzzle);
                
                if (clueCount >= difficultyConfig.minClues && clueCount <= difficultyConfig.maxClues) {
                    const puzzleData = {
                        puzzle: result.puzzle,
                        solution: result.solution,
                        difficulty: difficulty,
                        clues: clueCount,
                        symmetry: symmetryType,
                        seed: seed,
                        generated: Date.now()
                    };
                    
                    this.addToCache(cacheKey, puzzleData);
                    return puzzleData;
                }
                
            } catch (error) {
                continue;
            }
        }
        
        throw new Error(`Failed to generate ${difficulty} puzzle after ${maxAttempts} attempts`);
    }

    async generateDailyPuzzle(date, difficulty = 'medium') {
        if (typeof date === 'string') {
            date = new Date(date);
        }
        
        if (!date || isNaN(date.getTime())) {
            throw new Error('Invalid date provided');
        }
        
        const dateString = date.toISOString().split('T')[0];
        const seed = this.dateToSeed(dateString);
        
        // Try to load from persistent cache first
        if (window.dataStorage) {
            const cached = await window.dataStorage.loadCachedDailyPuzzle(date);
            if (cached.success) {
                return cached.puzzleData;
            }
        }
        
        // Check memory cache
        const cacheKey = `daily-${dateString}-${difficulty}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const puzzleData = this.generatePuzzle(difficulty, seed);
            puzzleData.type = 'daily';
            puzzleData.date = dateString;
            
            // Cache in memory
            this.addToCache(cacheKey, puzzleData);
            
            // Cache in persistent storage
            if (window.dataStorage) {
                await window.dataStorage.cacheDailyPuzzle(date, puzzleData);
            }
            
            return puzzleData;
        } catch (error) {
            throw new Error(`Failed to generate daily puzzle for ${dateString}: ${error.message}`);
        }
    }

    dateToSeed(dateString) {
        let seed = 0;
        for (let i = 0; i < dateString.length; i++) {
            const char = dateString.charCodeAt(i);
            seed = ((seed << 5) - seed) + char;
            seed = seed & seed;
        }
        return Math.abs(seed);
    }

    generateTournamentLevel(level, tournamentSeed = Date.now()) {
        if (level < 1 || level > 22) {
            throw new Error('Tournament level must be between 1 and 22');
        }
        
        const difficulties = ['easy', 'easy', 'easy', 'medium', 'medium', 'medium', 
                            'medium', 'hard', 'hard', 'hard', 'hard', 'hard',
                            'expert', 'expert', 'expert', 'expert', 'expert', 'expert',
                            'expert', 'expert', 'expert', 'expert'];
        
        const difficulty = difficulties[level - 1];
        const seed = tournamentSeed + level * 1000;
        
        const cacheKey = `tournament-${tournamentSeed}-${level}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const puzzleData = this.generatePuzzle(difficulty, seed);
            puzzleData.type = 'tournament';
            puzzleData.level = level;
            puzzleData.tournamentSeed = tournamentSeed;
            
            // Add special constraints for higher levels
            if (level > 15) {
                puzzleData.timeLimit = Math.max(300, 900 - (level * 30)); // 5-15 minutes
            }
            if (level > 18) {
                puzzleData.noHints = true;
            }
            if (level > 20) {
                puzzleData.perfectPlay = true; // No mistakes allowed
            }
            
            this.addToCache(cacheKey, puzzleData);
            return puzzleData;
        } catch (error) {
            throw new Error(`Failed to generate tournament level ${level}: ${error.message}`);
        }
    }

    validatePuzzle(puzzle, solution) {
        if (!Array.isArray(puzzle) || puzzle.length !== 9 ||
            !puzzle.every(row => Array.isArray(row) && row.length === 9)) {
            return { valid: false, error: 'Invalid puzzle format' };
        }
        
        if (!Array.isArray(solution) || solution.length !== 9 ||
            !solution.every(row => Array.isArray(row) && row.length === 9)) {
            return { valid: false, error: 'Invalid solution format' };
        }
        
        if (!this.engine.isValidGrid(puzzle)) {
            return { valid: false, error: 'Puzzle contains invalid placements' };
        }
        
        if (!this.engine.isValidGrid(solution)) {
            return { valid: false, error: 'Solution contains invalid placements' };
        }
        
        const solutionCopy = solution.map(row => [...row]);
        if (!this.engine.solveSudoku(solutionCopy)) {
            return { valid: false, error: 'Solution is not solvable' };
        }
        
        if (!this.engine.hasUniqueSolution(puzzle)) {
            return { valid: false, error: 'Puzzle does not have a unique solution' };
        }
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (puzzle[row][col] !== 0 && puzzle[row][col] !== solution[row][col]) {
                    return { valid: false, error: 'Puzzle and solution do not match' };
                }
            }
        }
        
        return { valid: true };
    }

    analyzeDifficulty(puzzle) {
        const techniques = {
            nakedSingles: 0,
            hiddenSingles: 0,
            pointingPairs: 0,
            boxLineReduction: 0,
            nakedPairs: 0,
            hiddenPairs: 0,
            xWing: 0,
            advanced: 0
        };
        
        const clueCount = this.countFilledCells(puzzle);
        const emptyCount = 81 - clueCount;
        
        let estimatedDifficulty = 'easy';
        if (clueCount <= 27) estimatedDifficulty = 'expert';
        else if (clueCount <= 31) estimatedDifficulty = 'hard';
        else if (clueCount <= 35) estimatedDifficulty = 'medium';
        
        return {
            clues: clueCount,
            empties: emptyCount,
            estimatedDifficulty,
            techniques,
            score: this.calculateDifficultyScore(clueCount, techniques)
        };
    }

    calculateDifficultyScore(clueCount, techniques) {
        let score = (81 - clueCount) * 10;
        score += techniques.nakedSingles * 1;
        score += techniques.hiddenSingles * 2;
        score += techniques.pointingPairs * 5;
        score += techniques.boxLineReduction * 5;
        score += techniques.nakedPairs * 10;
        score += techniques.hiddenPairs * 15;
        score += techniques.xWing * 25;
        score += techniques.advanced * 50;
        
        return score;
    }

    addToCache(key, data) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, data);
    }

    clearCache() {
        this.cache.clear();
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            keys: Array.from(this.cache.keys())
        };
    }

    exportPuzzle(puzzleData, format = 'json') {
        switch (format) {
            case 'json':
                return JSON.stringify(puzzleData, null, 2);
            case 'string':
                return puzzleData.puzzle.map(row => row.join('')).join('');
            case 'array':
                return puzzleData.puzzle;
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    importPuzzle(data, format = 'json') {
        try {
            let puzzleData;
            
            switch (format) {
                case 'json':
                    puzzleData = typeof data === 'string' ? JSON.parse(data) : data;
                    break;
                case 'string':
                    if (data.length !== 81) {
                        throw new Error('String format must be exactly 81 characters');
                    }
                    const grid = [];
                    for (let i = 0; i < 9; i++) {
                        const row = [];
                        for (let j = 0; j < 9; j++) {
                            row.push(parseInt(data[i * 9 + j]) || 0);
                        }
                        grid.push(row);
                    }
                    puzzleData = { puzzle: grid };
                    break;
                case 'array':
                    puzzleData = { puzzle: data };
                    break;
                default:
                    throw new Error(`Unsupported import format: ${format}`);
            }
            
            const validation = this.validatePuzzle(puzzleData.puzzle, puzzleData.solution);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            
            return puzzleData;
        } catch (error) {
            throw new Error(`Failed to import puzzle: ${error.message}`);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SudokuGenerator;
} else if (typeof window !== 'undefined') {
    window.SudokuGenerator = SudokuGenerator;
}