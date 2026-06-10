// Yatzy Game Logic
class YatzyGame {
    constructor() {
        this.dice = [1, 1, 1, 1, 1]; // Current dice values
        this.heldDice = [false, false, false, false, false]; // Which dice are held
        this.currentRoll = 1; // Current roll number (1-3)
        this.currentTurn = 1; // Current turn number (1-13)
        this.scores = {}; // Completed scores
        this.gameOver = false;
        
        // Initialize game
        this.initializeEventListeners();
        this.rollDice();
        this.updateDisplay();
    }

    initializeEventListeners() {
        // Dice click events
        document.querySelectorAll('.dice').forEach((dice, index) => {
            dice.addEventListener('click', () => this.toggleHold(index));
        });

        // Button events
        document.getElementById('roll-btn').addEventListener('click', () => this.rollDice());
        document.getElementById('release-all-btn').addEventListener('click', () => this.releaseAllDice());
        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());
        document.getElementById('play-again-btn').addEventListener('click', () => this.newGame());

        // Scorecard click events
        document.querySelectorAll('.score-row').forEach(row => {
            row.addEventListener('click', () => {
                const category = row.dataset.category;
                if (category && !this.scores[category] && this.currentRoll > 1) {
                    this.scoreCategory(category);
                }
            });
        });
    }

    rollDice() {
        if (this.currentRoll > 3 || this.gameOver) return;

        // Add rolling animation
        document.querySelectorAll('.dice').forEach((dice, index) => {
            if (!this.heldDice[index]) {
                dice.classList.add('rolling');
                // Generate new dice value
                this.dice[index] = Math.floor(Math.random() * 6) + 1;
            }
        });

        // Remove animation after delay
        setTimeout(() => {
            document.querySelectorAll('.dice').forEach(dice => {
                dice.classList.remove('rolling');
            });
            this.updateDiceDisplay();
            this.updatePotentialScores();
        }, 600);

        this.currentRoll++;
        this.updateDisplay();
    }

    toggleHold(index) {
        if (this.currentRoll === 1 || this.gameOver) return;
        
        this.heldDice[index] = !this.heldDice[index];
        this.updateDiceDisplay();
    }

    releaseAllDice() {
        this.heldDice = [false, false, false, false, false];
        this.updateDiceDisplay();
    }

    updateDiceDisplay() {
        this.dice.forEach((value, index) => {
            const diceElement = document.querySelector(`#dice-${index}`);
            const diceContainer = document.querySelector(`[data-index="${index}"]`);
            
            // Update dice face
            diceElement.className = `dice-face face-${value}`;
            diceElement.innerHTML = '';
            
            // Add dots based on value
            for (let i = 0; i < value; i++) {
                const dot = document.createElement('div');
                dot.className = 'dot';
                diceElement.appendChild(dot);
            }

            // Update held state
            if (this.heldDice[index]) {
                diceContainer.classList.add('held');
            } else {
                diceContainer.classList.remove('held');
            }
        });
    }

    scoreCategory(category) {
        const score = this.calculateScore(category);
        this.scores[category] = score;
        
        // Update scorecard
        document.getElementById(`score-${category}`).textContent = score;
        document.querySelector(`[data-category="${category}"]`).classList.add('scored');
        
        // Add animation
        document.querySelector(`[data-category="${category}"]`).classList.add('score-animation');
        setTimeout(() => {
            document.querySelector(`[data-category="${category}"]`).classList.remove('score-animation');
        }, 500);

        // Move to next turn
        this.nextTurn();
        this.updateTotals();
        this.updateDisplay();
    }

    calculateScore(category) {
        const counts = this.getDiceCounts();
        const sum = this.dice.reduce((a, b) => a + b, 0);

        switch (category) {
            case 'ones': return counts[1] * 1;
            case 'twos': return counts[2] * 2;
            case 'threes': return counts[3] * 3;
            case 'fours': return counts[4] * 4;
            case 'fives': return counts[5] * 5;
            case 'sixes': return counts[6] * 6;
            case 'three-of-a-kind':
                return Object.values(counts).some(count => count >= 3) ? sum : 0;
            case 'four-of-a-kind':
                return Object.values(counts).some(count => count >= 4) ? sum : 0;
            case 'full-house':
                const values = Object.values(counts).filter(count => count > 0).sort();
                return (values.length === 2 && values[0] === 2 && values[1] === 3) ? 25 : 0;
            case 'small-straight':
                return this.hasSmallStraight() ? 30 : 0;
            case 'large-straight':
                return this.hasLargeStraight() ? 40 : 0;
            case 'yatzy':
                return Object.values(counts).some(count => count === 5) ? 50 : 0;
            case 'chance':
                return sum;
            default:
                return 0;
        }
    }

    getDiceCounts() {
        const counts = {};
        for (let i = 1; i <= 6; i++) {
            counts[i] = 0;
        }
        this.dice.forEach(die => counts[die]++);
        return counts;
    }

    hasSmallStraight() {
        const unique = [...new Set(this.dice)].sort();
        const straights = [
            [1, 2, 3, 4],
            [2, 3, 4, 5],
            [3, 4, 5, 6]
        ];
        return straights.some(straight => 
            straight.every(num => unique.includes(num))
        );
    }

    hasLargeStraight() {
        const unique = [...new Set(this.dice)].sort();
        return (unique.length === 5 && 
                ((unique[0] === 1 && unique[4] === 5) || 
                 (unique[0] === 2 && unique[4] === 6)));
    }

    updatePotentialScores() {
        if (this.gameOver) return;

        const categories = [
            'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
            'three-of-a-kind', 'four-of-a-kind', 'full-house',
            'small-straight', 'large-straight', 'yatzy', 'chance'
        ];

        categories.forEach(category => {
            if (!this.scores[category]) {
                const potential = this.calculateScore(category);
                document.getElementById(`potential-${category}`).textContent = potential;
                
                // Highlight available categories
                const row = document.querySelector(`[data-category="${category}"]`);
                if (this.currentRoll > 1) {
                    row.classList.add('available');
                } else {
                    row.classList.remove('available');
                }
            }
        });
    }

    updateTotals() {
        // Upper section
        const upperCategories = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
        const upperTotal = upperCategories.reduce((total, category) => {
            return total + (this.scores[category] || 0);
        }, 0);

        document.getElementById('upper-subtotal').textContent = upperTotal;

        // Bonus calculation
        const bonus = upperTotal >= 63 ? 35 : 0;
        document.getElementById('bonus').textContent = bonus;
        document.getElementById('upper-total').textContent = upperTotal + bonus;

        // Lower section
        const lowerCategories = [
            'three-of-a-kind', 'four-of-a-kind', 'full-house',
            'small-straight', 'large-straight', 'yatzy', 'chance'
        ];
        const lowerTotal = lowerCategories.reduce((total, category) => {
            return total + (this.scores[category] || 0);
        }, 0);

        document.getElementById('lower-total').textContent = lowerTotal;

        // Grand total
        const grandTotal = upperTotal + bonus + lowerTotal;
        document.getElementById('grand-total').textContent = grandTotal;
    }

    nextTurn() {
        this.currentTurn++;
        this.currentRoll = 1;
        this.heldDice = [false, false, false, false, false];
        
        // Check if game is over
        if (this.currentTurn > 13) {
            this.endGame();
        } else {
            this.rollDice();
        }
    }

    endGame() {
        this.gameOver = true;
        const finalScore = document.getElementById('grand-total').textContent;
        document.getElementById('final-score').textContent = finalScore;
        document.getElementById('game-over-modal').classList.remove('hidden');
        
        // Disable roll button
        document.getElementById('roll-btn').disabled = true;
    }

    newGame() {
        // Reset all game state
        this.dice = [1, 1, 1, 1, 1];
        this.heldDice = [false, false, false, false, false];
        this.currentRoll = 1;
        this.currentTurn = 1;
        this.scores = {};
        this.gameOver = false;

        // Reset UI
        document.getElementById('game-over-modal').classList.add('hidden');
        document.getElementById('roll-btn').disabled = false;
        
        // Clear scorecard
        document.querySelectorAll('.score-cell').forEach(cell => {
            if (cell.id.startsWith('score-')) {
                cell.textContent = '-';
            } else {
                cell.textContent = '0';
            }
        });

        document.querySelectorAll('.potential-cell').forEach(cell => {
            cell.textContent = '0';
        });

        document.querySelectorAll('.score-row').forEach(row => {
            row.classList.remove('scored', 'available');
        });

        // Start new game
        this.rollDice();
        this.updateDisplay();
    }

    updateDisplay() {
        document.getElementById('current-turn').textContent = this.currentTurn;
        document.getElementById('current-roll').textContent = this.currentRoll;
        
        // Update roll button
        const rollBtn = document.getElementById('roll-btn');
        if (this.currentRoll > 3) {
            rollBtn.textContent = 'Select Category';
            rollBtn.disabled = true;
        } else {
            rollBtn.textContent = `Roll Dice (${this.currentRoll}/3)`;
            rollBtn.disabled = false;
        }
    }
}

// Start the game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new YatzyGame();
});