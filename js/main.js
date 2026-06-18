import { CATS, DEFAULT_NAMES, YATZY_BONUS } from './constants.js';
import { makePlayer, rollDice, calcScore, calcJokerScore,
         upperSubtotal, grandTotal, isJokerRoll,
         getJokerForcedCategory, allCategoriesScored, bestSuggestion } from './game.js';
import { renderDice, animateDice }    from './dice.js';
import { renderScorecard, renderJokerBanner, renderSuggestion } from './scorecard.js';
import { toast, confetti, renderPlayersBar, renderHeader,
         renderBonusMeter, renderAuthWidget, renderHistory,
         flashRow, showGameOverModal } from './ui.js';
import { openLeaderboard, initLeaderboard } from './leaderboard.js';
import { openProfile, initProfile }         from './profile.js';
import { openLobby, initLobby, checkUrlRoomCode, renderOnlineGame, closeLobby } from './lobby.js';
import { listenToRoom, getRoomCode }         from './multiplayer.js';
import { FIREBASE_READY, currentUser, onAuthChange,
         signInWithGoogle, signOutUser, saveScore } from './firebase.js';
import { playRoll, playHold, playScore, playZero, playBonus,
         playYatzy, playUndo, playTimerWarn,
         isMuted, toggleMute }               from './sounds.js';
import { exportText, exportCSV }             from './export.js';

// ─── STATE ────────────────────────────────────────────────────────────────────
let players       = [];
let currentPlayer = 0;
let dice          = [1, 1, 1, 1, 1];
let held          = [false, false, false, false, false];
let roll          = 1;
let turn          = 1;
let undoState     = null;
let gameHistory   = [];
let personalBest  = JSON.parse(localStorage.getItem('yatzy_pb') || '{}');
let setupN        = 1;

// ─── TURN TIMER STATE ─────────────────────────────────────────────────────────
const TIMER_SECONDS  = 60;
let _timerInterval   = null;
let _timerRemaining  = TIMER_SECONDS;
let _timerEnabled    = false; // only on for multiplayer local games

// ─── FULL RENDER ──────────────────────────────────────────────────────────────
function render() {
  const p = players[currentPlayer];
  renderDice(dice, held, toggleHold);
  renderScorecard(p, dice, roll, onScore);
  renderPlayersBar(players, currentPlayer, turn);
  renderBonusMeter(p);
  renderJokerBanner(p, dice, roll);
  renderSuggestion(p, dice, roll);
  renderHeader(turn, roll);
}

// ─── DICE ACTIONS ─────────────────────────────────────────────────────────────
function doRoll() {
  if (roll >= 3 || players[currentPlayer]?.done) return;
  dice = rollDice(dice, held);
  roll++;
  playRoll();
  animateDice(held);
  resetTimer();
  setTimeout(render, 100);
}

function toggleHold(i) {
  if (roll === 1 || players[currentPlayer]?.done) return;
  held[i] = !held[i];
  playHold();
  renderDice(dice, held, toggleHold);
  renderSuggestion(players[currentPlayer], dice, roll);
}

function releaseAll() {
  held = [false, false, false, false, false];
  renderDice(dice, held, toggleHold);
}

// ─── SCORING ──────────────────────────────────────────────────────────────────
function onScore(cat, isJoker) {
  const p = players[currentPlayer];
  if (p.scores[cat] !== undefined || roll === 1) return;

  // Zero-score confirmation
  const wouldBeZero = !isJoker && calcScore(cat, dice) === 0;
  if (wouldBeZero) {
    const catName = CATS.find(c => c.id === cat).name;
    if (!confirm(`Score 0 for ${catName}?\nThis wastes a category slot.`)) return;
  }

  // Save undo snapshot
  undoState = {
    cat, currentPlayer, turn, roll,
    dice: [...dice], held: [...held],
    yatzyBonuses: p.yatzyBonuses,
    wasJoker: isJoker,
    _bonusToasted: p._bonusToasted,
  };

  let sc;
  if (isJoker) {
    p.yatzyBonuses = (p.yatzyBonuses || 0) + 1;
    sc = calcJokerScore(cat, dice);
    flashRow(cat, 'yatzy-flash');
    playYatzy();
    toast(`⭐ Bonus Yatzy! +100 bonus, ${CATS.find(c => c.id === cat).name}: ${sc} pts`, 'success');
    confetti();
  } else {
    sc = calcScore(cat, dice);
    flashRow(cat, 'flash');
    const catName = CATS.find(c => c.id === cat).name;
    if (sc === 50 && cat === 'yatzy') { playYatzy(); toast('🎉 YATZY! 50 points!', 'success'); confetti(); }
    else if (sc === 0)                  { playZero();  toast(`${catName}: 0 pts`, 'info'); }
    else                                { playScore(); toast(`${catName}: ${sc} pts`, 'success'); }
  }

  p.scores[cat] = sc;

  // Upper bonus check
  if (!p._bonusToasted && upperSubtotal(p) >= 63) {
    p._bonusToasted = true;
    playBonus();
    setTimeout(() => toast('🎯 Upper bonus earned! +35 pts', 'success'), 400);
  }

  gameHistory.push({ player: p.name, cat: CATS.find(c => c.id === cat).name, sc, turn, joker: isJoker });
  document.getElementById('undo-btn').disabled = false;
  renderHistory(gameHistory);
  stopTimer();
  advanceTurn();
}

function undoScore() {
  if (!undoState) return;
  const { cat, currentPlayer: cp, yatzyBonuses, wasJoker, _bonusToasted } = undoState;
  delete players[cp].scores[cat];
  if (wasJoker) players[cp].yatzyBonuses = yatzyBonuses;
  if (_bonusToasted !== undefined) players[cp]._bonusToasted = _bonusToasted;
  currentPlayer = cp;
  dice  = [...undoState.dice];
  held  = [...undoState.held];
  roll  = undoState.roll;
  turn  = undoState.turn;
  undoState = null;
  document.getElementById('undo-btn').disabled = true;
  gameHistory.pop();
  renderHistory(gameHistory);
  playUndo();
  render();
  toast('Score undone', 'info');
}

// ─── TURN MANAGEMENT ──────────────────────────────────────────────────────────
function advanceTurn() {
  if (players.every(allCategoriesScored)) { endGame(); return; }

  let nextP = (currentPlayer + 1) % players.length;
  let loops = 0;
  while (allCategoriesScored(players[nextP]) && loops < players.length) {
    nextP = (nextP + 1) % players.length;
    loops++;
  }
  currentPlayer = nextP;
  turn++;
  dice = [1, 1, 1, 1, 1];
  held = [false, false, false, false, false];
  roll = 1;
  doRoll();
}

// ─── GAME OVER ────────────────────────────────────────────────────────────────
async function endGame() {
  const winner = [...players].sort((a, b) => grandTotal(b) - grandTotal(a))[0];
  const total  = grandTotal(winner);
  const ust    = upperSubtotal(winner);

  const result = await saveScore(winner, total, ust);
  if (result?.success) { /* toast already shown by saveScore */ }
  else if (!currentUser()) {
    // guest — silent, prompt shown in modal
  }

  showGameOverModal(players, personalBest, currentUser(), openLeaderboard);
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
function renderSetupModal() {
  document.getElementById('count-btns').querySelectorAll('.count-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.n) === setupN);
  });
  const user = currentUser();
  const inp  = document.getElementById('player-inputs');
  inp.innerHTML = '';
  for (let i = 0; i < setupN; i++) {
    const defaultVal = i === 0 && user ? (user.displayName || DEFAULT_NAMES[i]) : DEFAULT_NAMES[i];
    inp.innerHTML += `<div class="player-input-row">
      <input class="player-input" type="text" placeholder="${DEFAULT_NAMES[i]}"
             value="${defaultVal}" id="pname-${i}" maxlength="16">
    </div>`;
  }
}

function startGame(names) {
  players       = names.map(makePlayer);
  currentPlayer = 0;
  turn          = 1;
  dice          = [1, 1, 1, 1, 1];
  held          = [false, false, false, false, false];
  roll          = 1;
  undoState     = null;
  gameHistory   = [];
  _timerEnabled = names.length > 1;
  document.getElementById('setup-backdrop').classList.remove('show');
  document.getElementById('gameover-backdrop').classList.remove('show');
  document.getElementById('undo-btn').disabled = true;
  document.getElementById('view-lb-btn')?.remove();
  doRoll();
  render();
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────
document.getElementById('roll-btn').addEventListener('click', doRoll);
document.getElementById('release-btn').addEventListener('click', releaseAll);
document.getElementById('undo-btn').addEventListener('click', undoScore);

document.getElementById('lb-header-btn').addEventListener('click', openLeaderboard);
document.getElementById('online-btn').addEventListener('click', openLobby);

document.getElementById('new-game-btn').addEventListener('click', () => {
  document.getElementById('setup-backdrop').classList.add('show');
  renderSetupModal();
});

document.getElementById('replay-same-btn').addEventListener('click', () => {
  document.getElementById('view-lb-btn')?.remove();
  startGame(players.map(p => p.name));
});

document.getElementById('new-players-btn').addEventListener('click', () => {
  document.getElementById('view-lb-btn')?.remove();
  document.getElementById('gameover-backdrop').classList.remove('show');
  document.getElementById('setup-backdrop').classList.add('show');
  renderSetupModal();
});

// Auth modal
document.getElementById('google-signin-btn').addEventListener('click', async () => {
  const result = await signInWithGoogle();
  if (result.success) {
    document.getElementById('auth-backdrop').classList.remove('show');
    toast('Signed in!', 'success');
  } else {
    toast('Sign-in failed', 'warn');
  }
});
document.getElementById('guest-continue-btn').addEventListener('click', () => {
  document.getElementById('auth-backdrop').classList.remove('show');
});
document.getElementById('auth-close-btn').addEventListener('click', () => {
  document.getElementById('auth-backdrop').classList.remove('show');
});

// ─── TURN TIMER ───────────────────────────────────────────────────────────────
function startTimer() {
  if (!_timerEnabled) return;
  stopTimer();
  _timerRemaining = TIMER_SECONDS;
  renderTimerUI();
  _timerInterval = setInterval(() => {
    _timerRemaining--;
    renderTimerUI();
    if (_timerRemaining <= 10) playTimerWarn();
    if (_timerRemaining <= 0) { stopTimer(); autoScore(); }
  }, 1000);
}

function stopTimer() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  renderTimerUI();
}

function resetTimer() {
  if (_timerEnabled) startTimer();
}

function renderTimerUI() {
  const el = document.getElementById('turn-timer');
  if (!el) return;
  if (!_timerEnabled || !_timerInterval) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.textContent   = `⏱ ${_timerRemaining}s`;
  el.className     = 'turn-timer' + (_timerRemaining <= 10 ? ' urgent' : '');
}

function autoScore() {
  if (roll < 1) return;
  const p = players[currentPlayer];
  const { id } = bestSuggestion(p, dice);
  if (id) { toast('⏱ Time up! Auto-scoring…', 'warn'); onScore(id, false); }
}

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const modalOpen = ['setup-backdrop','auth-backdrop','lb-backdrop',
    'profile-backdrop','lobby-backdrop'].some(id =>
      document.getElementById(id)?.classList.contains('show'));
  if (modalOpen) return;

  switch (e.key) {
    case 'r': case 'R':
      doRoll(); break;
    case '1': case '2': case '3': case '4': case '5':
      toggleHold(parseInt(e.key) - 1); break;
    case 'u': case 'U':
      undoScore(); break;
    case 'Enter': {
      e.preventDefault();
      if (roll < 1) return;
      const p = players[currentPlayer];
      const { id } = bestSuggestion(p, dice);
      if (id) onScore(id, false);
      break;
    }
    case 'm': case 'M': {
      const muted = toggleMute();
      toast(muted ? '🔇 Sound off' : '🔊 Sound on', 'info');
      const btn = document.getElementById('mute-btn');
      if (btn) { btn.classList.toggle('muted', muted); btn.title = muted ? 'Unmute (M)' : 'Mute (M)'; }
      break;
    }
  }
});

// ─── MUTE BUTTON ──────────────────────────────────────────────────────────────
document.getElementById('mute-btn')?.addEventListener('click', () => {
  const muted = toggleMute();
  const btn = document.getElementById('mute-btn');
  btn.classList.toggle('muted', muted);
  btn.title = muted ? 'Unmute (M)' : 'Mute (M)';
  toast(muted ? '🔇 Sound off' : '🔊 Sound on', 'info');
});
if (isMuted()) document.getElementById('mute-btn')?.classList.add('muted');

// ─── EXPORT ───────────────────────────────────────────────────────────────────
document.getElementById('export-txt-btn')?.addEventListener('click', () => {
  if (!players.length) { toast('No game to export', 'info'); return; }
  exportText(players);
});
document.getElementById('export-csv-btn')?.addEventListener('click', () => {
  if (!players.length) { toast('No game to export', 'info'); return; }
  exportCSV(players);
});

// ─── AUTH STATE ───────────────────────────────────────────────────────────────
onAuthChange(user => {
  renderAuthWidget(user, FIREBASE_READY);
  renderSetupModal();
  const pending = sessionStorage.getItem('pendingRoom');
  if (pending && user) {
    sessionStorage.removeItem('pendingRoom');
    openLobby();
    setTimeout(() => {
      document.getElementById('lobby-join-input').value = pending;
      document.getElementById('lobby-join-btn').click();
      toast('Joining room from previous session', 'info');
    }, 500);
  }
});

// Auth widget delegated events
document.getElementById('auth-widget').addEventListener('click', e => {
  if (e.target.closest('.auth-avatar, .auth-avatar-initials, .auth-name')) openProfile();
  if (e.target.id === 'signout-btn') signOutUser().then(() => toast('Signed out', 'info'));
});

// ─── LEADERBOARD / PROFILE / LOBBY ───────────────────────────────────────────
initLeaderboard();
initProfile();
initLobby();

// ─── INIT ─────────────────────────────────────────────────────────────────────
renderSetupModal();
checkUrlRoomCode();

document.getElementById('history-toggle').addEventListener('click', () => {
  const list = document.getElementById('history-list');
  const open = list.classList.toggle('open');
  document.getElementById('history-toggle').textContent =
    open ? 'Hide score history ▴' : 'Show score history ▾';
  renderHistory(gameHistory);
});

document.getElementById('count-btns').querySelectorAll('.count-btn').forEach(b => {
  b.addEventListener('click', () => { setupN = parseInt(b.dataset.n); renderSetupModal(); });
});

document.getElementById('start-btn').addEventListener('click', () => {
  const names = [];
  for (let i = 0; i < setupN; i++) {
    const v = document.getElementById(`pname-${i}`)?.value.trim();
    names.push(v || DEFAULT_NAMES[i]);
  }
  startGame(names);
});
