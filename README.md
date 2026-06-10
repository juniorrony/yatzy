# Yatzy Game

A complete browser-based implementation of the classic Yatzy (Yahtzee) dice game.

## How to Play

1. **Objective**: Score the highest total by rolling five dice and achieving specific combinations.

2. **Game Flow**:
   - Roll the dice up to 3 times per turn
   - Click dice to hold them between rolls
   - Choose a scoring category after your rolls
   - Complete all 13 categories to finish the game

3. **Scoring Categories**:

### Upper Section
- **Ones through Sixes**: Sum of all dice showing that number
- **Bonus**: 35 points if upper section totals 63 or more

### Lower Section
- **Three of a Kind**: Sum of all dice (if at least 3 match)
- **Four of a Kind**: Sum of all dice (if at least 4 match)
- **Full House**: 25 points (3 of one number, 2 of another)
- **Small Straight**: 30 points (4 consecutive numbers)
- **Large Straight**: 40 points (5 consecutive numbers)
- **Yatzy**: 50 points (all 5 dice the same)
- **Chance**: Sum of all dice

## Features

- **Visual Dice**: Click to hold/release dice between rolls
- **Live Scoring**: See potential scores before committing
- **Responsive Design**: Works on desktop and mobile
- **Smooth Animations**: Rolling effects and visual feedback
- **Complete Rules**: All official Yatzy scoring implemented

## Getting Started

Simply open `index.html` in your web browser to start playing!

## Game Controls

- **Click Dice**: Hold or release dice between rolls
- **Roll Dice**: Roll all non-held dice
- **Release All**: Release all held dice
- **Click Category**: Score your dice in that category
- **New Game**: Start a fresh game

## Technical Details

- Pure HTML5, CSS3, and Vanilla JavaScript
- No external dependencies
- Responsive design for all screen sizes
- Local game state management

Enjoy your game of Yatzy!