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

## Online Playing

Yatzy supports online multiplayer gameplay with the following features:

- **Multiplayer Support**: Play with up to 4 players simultaneously
- **Room System**: Create private rooms with unique 6-character codes or join existing rooms
- **Random Matchmaking**: Automatically find opponents when you want to play
- **Real-time Synchronization**: All game state changes are synchronized across all players in real-time
- **Firebase Integration**: Uses Google Firebase for authentication, data storage, and real-time database
- **Turn Timer**: 60-second timer for multiplayer turns to keep games moving
- **Leaderboard**: Track your scores globally, weekly, and against friends
- **Friend System**: Add friends using unique friend codes to play together

### How Online Play Works

1. **Sign in**: Use Google authentication to create your profile and save scores
2. **Choose Game Type**: Select between single-player or multiplayer mode
3. **Find or Create**: Create a private room, join a friend's room, or use random matchmaking
4. **Play Together**: Take turns rolling dice, holding dice, and scoring categories
5. **Track Progress**: View your personal best scores and compare with friends on the leaderboard

### Online Features

- **Cross-Platform**: Play on desktop, tablet, or mobile devices
- **Persistent Scores**: Your scores are saved and tracked across sessions
- **Social Features**: Add friends, share room codes, and compete on leaderboards
- **Smooth Experience**: Real-time updates ensure all players stay synchronized

Enjoy your game of Yatzy, whether you're playing solo or with friends online!

## Getting Started

Simply open `index.html` in your web browser to start playing!

## Game Controls

- **Click Dice**: Hold or release dice between rolls
- **Roll Dice**: Roll all non-held dice
- **Release All**: Release all held dice
- **Click Category**: Score your dice in that category
- **New Game**: Start a fresh game

Enjoy your game of Yatzy!