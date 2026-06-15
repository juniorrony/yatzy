// ─── CATEGORIES ───────────────────────────────────────────────────────────────
export const CATS = [
  { id: 'ones',            name: 'Ones',            section: 'upper' },
  { id: 'twos',            name: 'Twos',            section: 'upper' },
  { id: 'threes',          name: 'Threes',          section: 'upper' },
  { id: 'fours',           name: 'Fours',           section: 'upper' },
  { id: 'fives',           name: 'Fives',           section: 'upper' },
  { id: 'sixes',           name: 'Sixes',           section: 'upper' },
  { id: 'three-of-a-kind', name: 'Three of a Kind', section: 'lower' },
  { id: 'four-of-a-kind',  name: 'Four of a Kind',  section: 'lower' },
  { id: 'full-house',      name: 'Full House',      section: 'lower' },
  { id: 'small-straight',  name: 'Small Straight',  section: 'lower' },
  { id: 'large-straight',  name: 'Large Straight',  section: 'lower' },
  { id: 'yatzy',           name: 'Yatzy',           section: 'lower' },
  { id: 'chance',          name: 'Chance',          section: 'lower' },
];

export const UPPER_CATS = CATS.filter(c => c.section === 'upper').map(c => c.id);
export const LOWER_CATS = CATS.filter(c => c.section === 'lower').map(c => c.id);

// ─── PIP POSITIONS ────────────────────────────────────────────────────────────
export const PIPS = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

export const DEFAULT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
export const MAX_SCORE     = 1600;
export const BONUS_TARGET  = 63;
export const BONUS_AMOUNT  = 35;
export const YATZY_SCORE   = 50;
export const YATZY_BONUS   = 100;
