import { CATS } from './constants.js';
import { toast } from './ui.js';
import {
  calcScore, calcJokerScore,
  upperSubtotal, bonusAmount, lowerTotal, yatzyBonusTotal, grandTotal,
  isJokerRoll, getJokerForcedCategory, bestSuggestion
} from './game.js';

// ─── SCORECARD ────────────────────────────────────────────────────────────────
export function renderScorecard(player, dice, roll, onScore) {
  const body    = document.getElementById('scorecard-body');
  const joker   = roll > 1 && isJokerRoll(player, dice);
  const jForced = joker ? getJokerForcedCategory(player, dice) : null;
  const { id: bestId } = roll > 1 ? bestSuggestion(player, dice) : {};

  const rowHtml = (cat) => {
    const sc     = player.scores[cat.id];
    const scored = sc !== undefined;
    let pot = null;
    if (!scored && roll > 1) {
      pot = joker ? calcJokerScore(cat.id, dice) : calcScore(cat.id, dice);
    }

    let cls = 'score-row';
    if (scored)                                       cls += ' scored';
    else if (pot !== null)                            cls += ' available';
    if (!scored && cat.id === bestId && roll > 1)     cls += ' best-suggestion';
    if (joker && jForced && cat.id === jForced.cat && !scored) cls += ' joker-forced';

    const potCls  = pot > 0 ? 'row-potential bright' : 'row-potential';
    const star    = cat.id === 'yatzy' && scored && sc === 50 ? ' ⭐' : '';

    return `<div class="${cls}" data-cat="${cat.id}">
      <div class="row-name">${cat.name}${star}</div>
      <div class="row-score">${scored ? sc : '—'}</div>
      <div class="${potCls}">${pot !== null ? pot : ''}</div>
    </div>`;
  };

  const ust = upperSubtotal(player);
  const bon = bonusAmount(player);
  const lt  = lowerTotal(player);
  const ybt = yatzyBonusTotal(player);
  const gt  = grandTotal(player);

  let html = '';

  // Upper section
  html += `<div class="section-sep">Upper Section</div>`;
  CATS.filter(c => c.section === 'upper').forEach(c => { html += rowHtml(c); });
  html += `<div class="total-row"><div class="row-name">Subtotal</div><div class="row-score">${ust}</div><div></div></div>`;
  html += `<div class="total-row"><div class="row-name">Bonus (63+)</div><div class="row-score" style="color:var(--gold)">${bon}</div><div></div></div>`;

  // Lower section
  html += `<div class="section-sep">Lower Section</div>`;
  CATS.filter(c => c.section === 'lower').forEach(c => { html += rowHtml(c); });

  // Yatzy bonus line
  if (player.scores['yatzy'] !== undefined) {
    const yb = player.yatzyBonuses || 0;
    html += `<div class="yatzy-bonus-row">
      <div class="row-name">⭐ Yatzy bonus ×${yb}</div>
      <div class="row-score">+${yb * 100}</div>
      <div></div>
    </div>`;
  }

  html += `<div class="total-row"><div class="row-name">Lower total</div><div class="row-score">${lt + ybt}</div><div></div></div>`;
  html += `<div class="grand-row"><div class="row-name">Grand Total</div><div class="row-score">${gt}</div><div></div></div>`;

  body.innerHTML = html;

  // Attach click handlers
  body.querySelectorAll('.score-row').forEach(row => {
    row.addEventListener('click', () => {
      const cat = row.dataset.cat;
      if (!cat || roll === 1 || player.scores[cat] !== undefined) return;

      if (joker) {
        if (jForced && cat !== jForced.cat && player.scores[jForced.cat] === undefined) {
          toast(`Must score ${CATS.find(c => c.id === jForced.cat).name} first!`, 'warn');
          return;
        }
        onScore(cat, true);
        return;
      }

      onScore(cat, false);
    });
  });
}

// ─── JOKER BANNER ─────────────────────────────────────────────────────────────
export function renderJokerBanner(player, dice, roll) {
  const banner = document.getElementById('joker-banner');
  const show   = roll > 1 && isJokerRoll(player, dice);
  banner.classList.toggle('show', show);
}

// ─── SUGGESTION ───────────────────────────────────────────────────────────────
export function renderSuggestion(player, dice, roll) {
  const el = document.getElementById('suggestion');
  if (roll === 1) { el.classList.add('hidden'); return; }
  const { id, val } = bestSuggestion(player, dice);
  if (!id) { el.classList.add('hidden'); return; }
  const cat = CATS.find(c => c.id === id);
  el.classList.remove('hidden');
  document.getElementById('suggestion-text').innerHTML =
    `Score <strong>${cat.name}</strong> for <strong>${val} pts</strong>`;
}
