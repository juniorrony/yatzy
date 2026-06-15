import { CATS, UPPER_CATS, LOWER_CATS, BONUS_TARGET, BONUS_AMOUNT, YATZY_BONUS } from './constants.js';

// ─── PLAYER FACTORY ───────────────────────────────────────────────────────────
export function makePlayer(name) {
  return { name, scores: {}, yatzyBonuses: 0, done: false };
}

// ─── DICE HELPERS ─────────────────────────────────────────────────────────────
export function diceCounts(d) {
  const c = {};
  for (let i = 1; i <= 6; i++) c[i] = 0;
  d.forEach(v => c[v]++);
  return c;
}

export function diceSum(d) {
  return d.reduce((a, b) => a + b, 0);
}

export function rollDice(current, held) {
  return current.map((v, i) => held[i] ? v : Math.floor(Math.random() * 6) + 1);
}

// ─── SCORING ──────────────────────────────────────────────────────────────────
export function calcScore(cat, d) {
  const c = diceCounts(d);
  const s = diceSum(d);
  const vals = Object.values(c).filter(x => x > 0).sort((a, b) => a - b);

  switch (cat) {
    case 'ones':   return c[1] * 1;
    case 'twos':   return c[2] * 2;
    case 'threes': return c[3] * 3;
    case 'fours':  return c[4] * 4;
    case 'fives':  return c[5] * 5;
    case 'sixes':  return c[6] * 6;
    case 'three-of-a-kind': return Object.values(c).some(v => v >= 3) ? s : 0;
    case 'four-of-a-kind':  return Object.values(c).some(v => v >= 4) ? s : 0;
    case 'full-house':
      return vals.length === 2 && vals[0] === 2 && vals[1] === 3 ? 25 : 0;
    case 'small-straight': {
      const u = [...new Set(d)].sort((a, b) => a - b);
      return [[1,2,3,4],[2,3,4,5],[3,4,5,6]].some(st => st.every(n => u.includes(n))) ? 30 : 0;
    }
    case 'large-straight': {
      const u = [...new Set(d)].sort((a, b) => a - b);
      return u.length === 5 && ((u[0] === 1 && u[4] === 5) || (u[0] === 2 && u[4] === 6)) ? 40 : 0;
    }
    case 'yatzy':  return Object.values(c).some(v => v === 5) ? 50 : 0;
    case 'chance': return s;
    default:       return 0;
  }
}

export function calcJokerScore(cat, d) {
  const s = diceSum(d);
  const c = diceCounts(d);
  switch (cat) {
    case 'ones':            return c[1] * 1;
    case 'twos':            return c[2] * 2;
    case 'threes':          return c[3] * 3;
    case 'fours':           return c[4] * 4;
    case 'fives':           return c[5] * 5;
    case 'sixes':           return c[6] * 6;
    case 'three-of-a-kind': return s;
    case 'four-of-a-kind':  return s;
    case 'full-house':      return 25;
    case 'small-straight':  return 30;
    case 'large-straight':  return 40;
    case 'chance':          return s;
    default:                return 0;
  }
}

// ─── TOTALS ───────────────────────────────────────────────────────────────────
export function upperSubtotal(p) {
  return UPPER_CATS.reduce((t, c) => t + (p.scores[c] || 0), 0);
}

export function bonusAmount(p) {
  return upperSubtotal(p) >= BONUS_TARGET ? BONUS_AMOUNT : 0;
}

export function lowerTotal(p) {
  return LOWER_CATS.reduce((t, c) => t + (p.scores[c] || 0), 0);
}

export function yatzyBonusTotal(p) {
  return (p.yatzyBonuses || 0) * YATZY_BONUS;
}

export function grandTotal(p) {
  return upperSubtotal(p) + bonusAmount(p) + lowerTotal(p) + yatzyBonusTotal(p);
}

// ─── JOKER RULES ──────────────────────────────────────────────────────────────
export function isJokerRoll(p, d) {
  return Object.values(diceCounts(d)).some(v => v === 5) && p.scores['yatzy'] === 50;
}

export function getJokerForcedCategory(p, d) {
  const dieValue = d[0];
  const upperMap = { 1:'ones', 2:'twos', 3:'threes', 4:'fours', 5:'fives', 6:'sixes' };
  const matchingUpper = upperMap[dieValue];

  // 1. Matching upper section first
  if (p.scores[matchingUpper] === undefined)
    return { cat: matchingUpper, forced: true, type: 'upper' };

  // 2. Any open lower category
  const lowerOpen = ['three-of-a-kind','four-of-a-kind','full-house','small-straight','large-straight','chance'];
  for (const c of lowerOpen) {
    if (p.scores[c] === undefined) return { cat: c, forced: false, type: 'lower' };
  }

  // 3. Any open upper category (will score 0)
  for (const c of UPPER_CATS) {
    if (p.scores[c] === undefined) return { cat: c, forced: false, type: 'upperZero' };
  }

  return null;
}

// ─── SUGGESTION ───────────────────────────────────────────────────────────────
export function bestSuggestion(p, d) {
  if (isJokerRoll(p, d)) {
    const jf = getJokerForcedCategory(p, d);
    if (jf) {
      const val = jf.type === 'upperZero' ? 0 : calcJokerScore(jf.cat, d);
      return { id: jf.cat, val };
    }
  }
  let best = null, bestVal = -1;
  CATS.forEach(({ id }) => {
    if (p.scores[id] !== undefined) return;
    const v = calcScore(id, d);
    if (v > bestVal) { bestVal = v; best = id; }
  });
  return { id: best, val: bestVal };
}

export function allCategoriesScored(p) {
  return Object.keys(p.scores).length === 13;
}
