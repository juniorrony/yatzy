import { currentUser, FIREBASE_READY, saveScore }     from './firebase.js';
import { toast, confetti, showGameOverModal }          from './ui.js';
import { createRoom, joinRoom, listenToRoom, leaveRoom,
         mpRoll, mpToggleHold, mpReleaseAll,
         mpScoreCategory, mpStartGame, deleteRoom,
         startHeartbeat, stopHeartbeat, getRoomCode }  from './multiplayer.js';
import { renderDice, animateDice }                     from './dice.js';
import { renderScorecard, renderJokerBanner,
         renderSuggestion }                            from './scorecard.js';
import { grandTotal, upperSubtotal,
         calcScore, calcJokerScore,
         isJokerRoll, getJokerForcedCategory,
         yatzyBonusTotal }                             from './game.js';
import { CATS }                                        from './constants.js';

// ─── STATE ────────────────────────────────────────────────────────────────────
let _myPlayerIndex = -1;
let _unsubscribe   = null;
let _personalBest  = JSON.parse(localStorage.getItem('yatzy_pb') || '{}');
let _lastRoom      = null;   // latest room snapshot for UI use

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
function showModal(id)  { document.getElementById(id)?.classList.add('show'); }
function hideModal(id)  { document.getElementById(id)?.classList.remove('show'); }
function setLobbyView(id) {
  ['lobby-create-join','lobby-waiting','lobby-online-game'].forEach(v => {
    document.getElementById(v).style.display = v === id ? '' : 'none';
  });
}

// ─── OPEN LOBBY ───────────────────────────────────────────────────────────────
export function openLobby() {
  const user = currentUser();
  if (!user) {
    document.getElementById('auth-backdrop').classList.add('show');
    toast('Sign in to play online', 'info');
    return;
  }
  showModal('lobby-backdrop');
  setLobbyView('lobby-create-join');
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
async function handleCreate() {
  const btn = document.getElementById('lobby-create-btn');
  btn.disabled = true; btn.textContent = 'Creating...';
  const result = await createRoom();
  btn.disabled = false; btn.textContent = 'Create room';
  if (result.error) { toast(result.error, 'warn'); return; }
  _myPlayerIndex = 0;
  enterWaitingRoom(result.code);
}

// ─── JOIN ─────────────────────────────────────────────────────────────────────
async function handleJoin(code) {
  const btn = document.getElementById('lobby-join-btn');
  btn.disabled = true; btn.textContent = 'Joining...';
  const result = await joinRoom(code);
  btn.disabled = false; btn.textContent = 'Join';
  if (result.error) { toast(result.error, 'warn'); return; }
  _myPlayerIndex = result.playerIndex;
  enterWaitingRoom(result.code);
}

// ─── WAITING ROOM ─────────────────────────────────────────────────────────────
function enterWaitingRoom(code) {
  setLobbyView('lobby-waiting');
  const shareUrl = `${location.origin}${location.pathname}?room=${code}`;
  document.getElementById('room-code-display').textContent = code;
  document.getElementById('room-share-link').value = shareUrl;
  renderWaitingPlayers([]);

  _unsubscribe = listenToRoom(code, ({ room, players, deleted }) => {
    if (deleted) { toast('Room was closed', 'warn'); closeLobby(); return; }
    _lastRoom = { room, players };

    if (room.status === 'waiting') {
      renderWaitingPlayers(players);
      const isHost = room.hostUid === currentUser()?.uid;
      const startBtn = document.getElementById('lobby-start-btn');
      const waitMsg  = document.getElementById('waiting-for-host-msg');
      startBtn.style.display = isHost ? '' : 'none';
      waitMsg.style.display  = isHost ? 'none' : '';
      startBtn.disabled = players.length < 2;
    }

    if (room.status === 'playing') {
      // Switch to game view if not already there
      const gameView = document.getElementById('lobby-online-game');
      if (gameView.style.display === 'none') enterOnlineGame(code);
      renderOnlineGame(room, players);
    }

    if (room.status === 'finished') handleOnlineGameOver(players, room);
  });

  startHeartbeat(code, _myPlayerIndex);
}

function renderWaitingPlayers(players) {
  const el = document.getElementById('waiting-players-list');
  if (!players || players.length === 0) {
    el.innerHTML = '<div style="color:var(--text3);font-size:0.88em">Waiting for players...</div>';
    return;
  }
  el.innerHTML = players.map((p, i) => {
    const initials = (p.displayName || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
    const avatar = p.avatarUrl
      ? `<img class="lb-avatar" src="${p.avatarUrl}" alt="">`
      : `<div class="lb-avatar-initials">${initials}</div>`;
    const you = p.uid === currentUser()?.uid ? ' <span style="color:var(--accent);font-size:0.8em">(you)</span>' : '';
    const host = i === 0 ? ' <span style="color:var(--gold);font-size:0.75em">HOST</span>' : '';
    return `<div class="waiting-player">${avatar}<span class="waiting-player-name">${p.displayName}${you}${host}</span></div>`;
  }).join('');
}

// ─── ONLINE GAME ──────────────────────────────────────────────────────────────
function enterOnlineGame(code) {
  setLobbyView('lobby-online-game');
  // The onSnapshot listener is already running from enterWaitingRoom
  // It now drives the online game UI
}

export function renderOnlineGame(room, players) {
  if (!room || !players) return;
  _lastRoom = { room, players };

  const myP      = players[_myPlayerIndex];
  const currP    = players[room.currentPlayerIndex];
  const isMyTurn = room.currentPlayerIndex === _myPlayerIndex;
  const dice     = room.dice || [1,1,1,1,1];
  const held     = room.held || [false,false,false,false,false];
  const roll     = room.roll || 1;

  // Turn indicator
  const indicator = document.getElementById('online-turn-indicator');
  indicator.textContent = isMyTurn
    ? '🎲 Your turn'
    : `⏳ ${currP?.displayName || 'Opponent'}'s turn`;
  indicator.className = 'online-turn-indicator' + (isMyTurn ? ' my-turn' : ' their-turn');

  // Dice — only interactive on your turn and after first roll
  renderDice(dice, held, (i) => {
    if (!isMyTurn || roll < 1) return;
    mpToggleHold(code, held, i);
  });

  // Roll button
  const rollBtn = document.getElementById('online-roll-btn');
  rollBtn.disabled = !isMyTurn || roll >= 3;
  rollBtn.textContent = roll === 0 || roll >= 3
    ? (isMyTurn && roll >= 3 ? 'Select a category' : 'Roll dice')
    : `Roll dice (${roll}/3)`;

  // Release all
  document.getElementById('online-release-btn').style.display = isMyTurn ? '' : 'none';

  // Scorecard for current player being viewed (default: you)
  if (myP) {
    renderScorecard(myP, dice, roll, (cat, isJoker) => {
      if (!isMyTurn || roll < 1) { toast("It's not your turn", 'info'); return; }
      handleOnlineScore(code, cat, isJoker, room, players);
    });
    renderJokerBanner(myP, dice, roll);
    renderSuggestion(myP, dice, roll);
  }

  // Players tabs
  renderOnlinePlayers(players, room.currentPlayerIndex, room.turn);
}

function renderOnlinePlayers(players, currentIndex, turn) {
  const bar = document.getElementById('online-players-bar');
  bar.innerHTML = players.map((p, i) => {
    const gt     = grandTotal(p);
    const active = i === currentIndex ? ' active' : '';
    const isYou  = p.uid === currentUser()?.uid ? ' (you)' : '';
    return `<div class="player-tab${active}">
      <div class="player-name">${p.displayName}${isYou}</div>
      <div class="player-score-display">${gt}</div>
      <div class="player-tag">Turn ${turn}/13</div>
    </div>`;
  }).join('');
}

// ─── ONLINE SCORE ─────────────────────────────────────────────────────────────
async function handleOnlineScore(code, cat, isJoker, room, players) {
  const myP   = players[_myPlayerIndex];
  const dice  = room.dice;
  if (!myP || myP.scores[cat] !== undefined) return;

  let sc;
  let newBonuses = myP.yatzyBonuses || 0;
  if (isJoker) {
    newBonuses++;
    sc = calcJokerScore(cat, dice);
    toast(`⭐ Bonus Yatzy! +100, ${CATS.find(c => c.id === cat).name}: ${sc}`, 'success');
    confetti();
  } else {
    sc = calcScore(cat, dice);
    const catName = CATS.find(c => c.id === cat).name;
    if (sc === 50 && cat === 'yatzy') { toast('🎉 YATZY!', 'success'); confetti(); }
    else if (sc === 0) toast(`${catName}: 0 pts`, 'info');
    else toast(`${catName}: ${sc} pts`, 'success');
  }

  const result = await mpScoreCategory(
    code, _myPlayerIndex, myP, cat, sc, newBonuses,
    players, room.currentPlayerIndex, room.turn
  );

  if (result.finished) handleOnlineGameOver(players, room);
}

// ─── GAME OVER ────────────────────────────────────────────────────────────────
async function handleOnlineGameOver(players, room) {
  stopHeartbeat();
  // Save signed-in player's score
  const myP = players[_myPlayerIndex];
  if (myP && currentUser()) {
    await saveScore(myP, grandTotal(myP), upperSubtotal(myP));
  }

  // Build a players-like array for showGameOverModal
  showGameOverModal(players, _personalBest, currentUser(), () => {
    import('./leaderboard.js').then(({ openLeaderboard }) => openLeaderboard());
  });

  hideModal('lobby-backdrop');
  closeLobby();
}

// ─── CLOSE / CLEANUP ──────────────────────────────────────────────────────────
export function closeLobby() {
  stopHeartbeat();
  leaveRoom();
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
  hideModal('lobby-backdrop');
  _myPlayerIndex = -1;
  _lastRoom = null;
}

// ─── URL ROOM CODE ON LOAD ────────────────────────────────────────────────────
export function checkUrlRoomCode() {
  const params = new URLSearchParams(location.search);
  const code   = params.get('room');
  if (code) {
    // Clean URL without reloading
    history.replaceState({}, '', location.pathname);
    // Wait for auth then auto-join
    const tryJoin = () => {
      const user = currentUser();
      if (!user) {
        document.getElementById('auth-backdrop').classList.add('show');
        toast(`Sign in to join room ${code}`, 'info');
        // Store code for after sign-in
        sessionStorage.setItem('pendingRoom', code);
        return;
      }
      showModal('lobby-backdrop');
      setLobbyView('lobby-create-join');
      document.getElementById('lobby-join-input').value = code;
      handleJoin(code);
    };
    setTimeout(tryJoin, 800); // give Firebase auth time to resolve
  }

  // Also check if there's a pending room from before sign-in
  const pending = sessionStorage.getItem('pendingRoom');
  if (pending && currentUser()) {
    sessionStorage.removeItem('pendingRoom');
    showModal('lobby-backdrop');
    setLobbyView('lobby-create-join');
    document.getElementById('lobby-join-input').value = pending;
    handleJoin(pending);
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
export function initLobby() {
  // Create
  document.getElementById('lobby-create-btn').addEventListener('click', handleCreate);

  // Join
  document.getElementById('lobby-join-btn').addEventListener('click', () => {
    const code = document.getElementById('lobby-join-input').value.trim().toUpperCase();
    if (code.length !== 6) { toast('Enter a 6-character room code', 'warn'); return; }
    handleJoin(code);
  });
  document.getElementById('lobby-join-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('lobby-join-btn').click();
  });

  // Copy room code
  document.getElementById('copy-room-code-btn').addEventListener('click', () => {
    const code = document.getElementById('room-code-display').textContent;
    navigator.clipboard.writeText(code).then(() => toast('Code copied!', 'success'));
  });

  // Copy share link
  document.getElementById('copy-room-link-btn').addEventListener('click', () => {
    const link = document.getElementById('room-share-link').value;
    navigator.clipboard.writeText(link).then(() => toast('Link copied!', 'success'));
  });

  // Start game (host only)
  document.getElementById('lobby-start-btn').addEventListener('click', async () => {
    const code = getRoomCode();
    if (!code) return;
    const btn = document.getElementById('lobby-start-btn');
    btn.disabled = true; btn.textContent = 'Starting...';
    await mpStartGame(code);
  });

  // Leave waiting room
  document.getElementById('lobby-leave-btn').addEventListener('click', async () => {
    const code = getRoomCode();
    const user = currentUser();
    if (code && user && _lastRoom?.room?.hostUid === user.uid) {
      await deleteRoom(code);
    }
    closeLobby();
  });

  // Close lobby backdrop
  document.getElementById('lobby-backdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('lobby-backdrop')) closeLobby();
  });

  // Online game controls
  document.getElementById('online-roll-btn').addEventListener('click', () => {
    const code = getRoomCode();
    if (!code || !_lastRoom) return;
    const { room } = _lastRoom;
    if (room.currentPlayerIndex !== _myPlayerIndex) return;
    mpRoll(code, room.dice, room.held, room.roll);
  });

  document.getElementById('online-release-btn').addEventListener('click', () => {
    const code = getRoomCode();
    if (!code) return;
    mpReleaseAll(code);
  });

  // Wire onSnapshot to renderOnlineGame when in playing state
  // (listenToRoom callback already calls renderOnlineGame via enterWaitingRoom)
}

// ─── PATCH listenToRoom to also call renderOnlineGame ─────────────────────────
// We override the onState callback inside enterWaitingRoom to handle both
// waiting and playing states — this is already done above via the closure.
// Export so main.js can call after auth resolves
export { handleJoin };
