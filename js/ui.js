import { grandTotal, upperSubtotal } from './game.js';
import { BONUS_TARGET } from './constants.js';

// ─── TOASTS ───────────────────────────────────────────────────────────────────
export function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────
export function confetti() {
  const colors = ['#ff6b35','#ffd166','#06d6a0','#118ab2','#f5c518','#ef476f'];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left: ${Math.random() * 100}vw;
      background: ${colors[i % colors.length]};
      --dur: ${1.2 + Math.random() * 1.5}s;
      --delay: ${Math.random() * 0.8}s;
      width: ${6 + Math.random() * 8}px;
      height: ${6 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
}

// ─── PLAYERS BAR ──────────────────────────────────────────────────────────────
export function renderPlayersBar(players, currentPlayer, turn) {
  const bar = document.getElementById('players-bar');
  bar.innerHTML = players.map((p, i) => {
    const gt = grandTotal(p);
    const active = i === currentPlayer ? ' active' : '';
    const done   = p.done ? ' done' : '';
    const tag    = p.done ? 'Finished' : `Turn ${turn}/13`;
    return `<div class="player-tab${active}${done}">
      <div class="player-name">${p.name}</div>
      <div class="player-score-display">${gt}</div>
      <div class="player-tag">${tag}</div>
    </div>`;
  }).join('');
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
export function renderHeader(turn, roll) {
  document.getElementById('hdr-turn').textContent = turn;
  document.getElementById('hdr-roll').textContent = roll;
  const btn = document.getElementById('roll-btn');
  if (roll > 3) {
    btn.textContent = 'Select category';
    btn.disabled = true;
  } else {
    btn.textContent = `Roll dice (${roll}/3)`;
    btn.disabled = false;
  }
}

// ─── BONUS METER ──────────────────────────────────────────────────────────────
export function renderBonusMeter(player) {
  const ust = upperSubtotal(player);
  const pct = Math.min(100, (ust / BONUS_TARGET) * 100);
  document.getElementById('bonus-fill').style.width = pct + '%';
  document.getElementById('bonus-progress-label').textContent = `${ust} / ${BONUS_TARGET}`;
}

// ─── AUTH WIDGET ──────────────────────────────────────────────────────────────
export function renderAuthWidget(currentUser, firebaseReady) {
  const w = document.getElementById('auth-widget');
  if (!firebaseReady) {
    w.innerHTML = `<button class="btn btn-ghost btn-sm" style="border-color:rgba(255,107,53,0.4);color:var(--accent)"
      id="setup-firebase-btn">⚠ Setup Firebase</button>`;
    document.getElementById('setup-firebase-btn')
      ?.addEventListener('click', () => document.getElementById('auth-backdrop').classList.add('show'));
    return;
  }
  if (currentUser) {
    const initials = (currentUser.displayName || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
    const avatar = currentUser.photoURL
      ? `<img class="auth-avatar" src="${currentUser.photoURL}" alt="">`
      : `<div class="auth-avatar-initials">${initials}</div>`;
    w.innerHTML = `${avatar}
      <span class="auth-name">${currentUser.displayName || 'User'}</span>
      <button class="btn btn-ghost btn-sm" id="signout-btn">Sign out</button>`;
  } else {
    w.innerHTML = `<button class="btn btn-ghost btn-sm" id="signin-widget-btn">Sign in</button>`;
    document.getElementById('signin-widget-btn')
      ?.addEventListener('click', () => document.getElementById('auth-backdrop').classList.add('show'));
  }
}

// ─── SCORE HISTORY ────────────────────────────────────────────────────────────
export function renderHistory(gameHistory) {
  const list = document.getElementById('history-list');
  if (!list.classList.contains('open')) return;
  if (gameHistory.length === 0) {
    list.innerHTML = '<div style="color:var(--text3);font-size:0.82em;padding:6px 0">No scores yet</div>';
    return;
  }
  list.innerHTML = gameHistory.slice().reverse().slice(0, 15).map(h =>
    `<div class="history-entry">
      <span>${h.player} — ${h.cat}${h.joker ? ' ⭐' : ''}</span>
      <span>${h.joker ? `${h.sc}+100` : h.sc}</span>
    </div>`
  ).join('');
}

// ─── FLASH ROW ────────────────────────────────────────────────────────────────
export function flashRow(cat, className = 'flash') {
  const row = document.querySelector(`[data-cat="${cat}"]`);
  if (!row) return;
  row.classList.add(className);
  setTimeout(() => row.classList.remove(className), 700);
}

// ─── GAME OVER MODAL ──────────────────────────────────────────────────────────
export function showGameOverModal(players, personalBest, currentUser, onOpenLeaderboard) {
  const sorted = [...players].sort((a, b) => grandTotal(b) - grandTotal(a));
  const winner = sorted[0];
  const winnerGt = grandTotal(winner);

  let pbMsg = '';
  if (!personalBest[winner.name] || winnerGt > personalBest[winner.name]) {
    personalBest[winner.name] = winnerGt;
    localStorage.setItem('yatzy_pb', JSON.stringify(personalBest));
    if (players.length === 1) pbMsg = `<div class="pb-badge">🏆 New personal best!</div>`;
  }

  let html = `<h2>${players.length > 1 ? 'Game Over!' : 'Well played!'}</h2>`;
  if (players.length > 1) html += `<div class="modal-sub">🏆 ${winner.name} wins!</div>`;
  html += pbMsg;

  if (players.length === 1) {
    const yb = winner.yatzyBonuses || 0;
    html += `<div class="final-big">${winnerGt}</div>`;
    if (yb > 0) html += `<div style="color:var(--gold);font-size:0.9em;margin-bottom:8px">includes ${yb}× Yatzy bonus (+${yb * 100})</div>`;
    if (personalBest[winner.name]) html += `<div style="color:var(--text3);font-size:0.85em;margin-bottom:20px">Personal best: ${personalBest[winner.name]}</div>`;
    if (!currentUser) {
      html += `<div style="font-size:0.82em;color:var(--text3);margin-bottom:16px">Sign in to save to the leaderboard</div>
        <button class="btn btn-ghost btn-sm" id="gameover-signin-btn" style="margin-bottom:12px">Sign in</button><br>`;
    }
  } else {
    html += `<table class="score-table" style="margin:20px 0">`;
    sorted.forEach((p, i) => {
      const gt = grandTotal(p);
      const yb = p.yatzyBonuses || 0;
      html += `<tr>
        <td>${['🥇','🥈','🥉'][i] || (i+1)} ${p.name}${yb > 0 ? ` <span style="color:var(--gold);font-size:0.85em">+${yb * 100} bonus</span>` : ''}</td>
        <td>${gt}</td>
      </tr>`;
    });
    html += `</table>`;
  }

  document.getElementById('gameover-content').innerHTML = html;

  document.getElementById('gameover-signin-btn')
    ?.addEventListener('click', () => document.getElementById('auth-backdrop').classList.add('show'));

  // Inject leaderboard button
  const actions = document.querySelector('#gameover-backdrop .modal-actions');
  if (actions) {
    document.getElementById('view-lb-btn')?.remove();
    const lbBtn = document.createElement('button');
    lbBtn.id = 'view-lb-btn';
    lbBtn.className = 'btn btn-ghost';
    lbBtn.textContent = '🏆 Leaderboard';
    lbBtn.addEventListener('click', () => {
      document.getElementById('gameover-backdrop').classList.remove('show');
      onOpenLeaderboard();
    });
    actions.prepend(lbBtn);
  }

  document.getElementById('gameover-backdrop').classList.add('show');
}

// renderSetup lives in main.js where it has access to state.
// ui.js intentionally does not export it.
