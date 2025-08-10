# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Progressive Web App (PWA) implementation of Sudoku with daily challenges, tournament mode, and complete offline functionality. The app features mobile-optimized responsive design and can be installed as a native app.

## Build and Development Commands

Since this is a vanilla JavaScript PWA project with no build system yet:

```bash
# Serve the application locally (requires a local server for service worker)
python3 -m http.server 8000
# or
npx serve .

# No build/lint/test commands configured yet - these should be added as the project develops
```

## Architecture and Structure

### Core Components

1. **Service Worker (sw.js)**: Handles offline functionality, caching strategies, and PWA installation
   - Cache-first for static assets
   - Network-first for dynamic content
   - Background sync for progress updates

2. **Game Engine (js/sudoku-engine.js)**: Core Sudoku logic
   - Grid validation (row, column, 3x3 box)
   - Backtracking solver algorithm
   - Game state management with undo/redo
   - Scoring system with difficulty multipliers

3. **Puzzle Generator (js/sudoku-generator.js)**: Creates puzzles
   - Date-based seeding for daily challenges
   - Difficulty levels: Easy (36-46 clues), Medium (32-35), Hard (28-31), Expert (22-27)
   - Ensures unique solutions

4. **Storage System (js/storage.js)**: Local data persistence
   - Game state auto-save every 30 seconds
   - User progress and statistics
   - 30-day puzzle cache for offline play

### Key Features to Implement

- **Daily Challenges**: Calendar view with streak tracking
- **Tournament Mode**: 22-level progression with themed UI
- **Offline Support**: Complete functionality without internet
- **Mobile Optimization**: Touch-friendly with minimum 44px targets

### Scoring System

- Base: 1000 points
- Difficulty multipliers: Easy(1x), Medium(1.5x), Hard(2x), Expert(3x)
- Mistake penalty: -100 points each
- Hint penalty: -10% per hint used

## Implementation Tasks

Follow the 12 tasks outlined in requirements.md in order:
1. Project setup & PWA foundation
2. Sudoku game engine
3. Puzzle generator
4. Game interface
5. Homepage & navigation
6. Daily challenges & calendar
7. Tournament mode
8. Data management & storage
9. Advanced PWA features
10. UI polish & animations
11. Testing & QA
12. Production build & deployment

## Performance Targets

- Lighthouse PWA score: 95+
- Load time: Under 3 seconds
- Puzzle generation: Under 1 second
- 60fps animations