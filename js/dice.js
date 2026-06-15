import { PIPS } from './constants.js';

// ─── SVG ──────────────────────────────────────────────────────────────────────
export function dieSVG(val, held) {
  const dots = PIPS[val] || [];
  const fill = held ? 'rgba(255,255,255,0.9)' : '#fffffe';
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    ${dots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${fill}"/>`).join('')}
  </svg>`;
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
export function renderDice(dice, held, onToggle) {
  const row = document.getElementById('dice-row');
  row.innerHTML = '';
  dice.forEach((val, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'die-wrap' + (held[i] ? ' held' : '');
    wrap.innerHTML = `
      <div class="die" id="die-${i}">${dieSVG(val, held[i])}</div>
      <div class="die-hold-label">${held[i] ? 'held' : 'hold'}</div>`;
    wrap.addEventListener('click', () => onToggle(i));
    row.appendChild(wrap);
  });
}

// ─── ANIMATE ──────────────────────────────────────────────────────────────────
export function animateDice(held) {
  document.querySelectorAll('.die-wrap').forEach((wrap, i) => {
    if (held[i]) return;
    const die = wrap.querySelector('.die');
    die.classList.remove('rolling');
    void die.offsetWidth; // force reflow
    die.classList.add('rolling');
    setTimeout(() => die.classList.remove('rolling'), 520);
  });
}
