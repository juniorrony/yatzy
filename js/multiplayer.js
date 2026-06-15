import { initializeApp, getApps }                   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc,
         collection, onSnapshot, arrayUnion,
         serverTimestamp, deleteDoc }                from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { currentUser, FIREBASE_READY }               from './firebase.js';
import { rollDice }                                  from './game.js';

// Re-use the already-initialised Firebase app
function getDB() {
  return getFirestore(getApps()[0]);
}

// ─── ROOM CODE ────────────────────────────────────────────────────────────────
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── STATE ────────────────────────────────────────────────────────────────────
let _roomCode     = null;
let _unsubscribe  = null;   // Firestore onSnapshot unsubscriber
let _onStateChange = null;  // callback → lobby.js / main.js

export function getRoomCode() { return _roomCode; }

// ─── CREATE ROOM ──────────────────────────────────────────────────────────────
export async function createRoom() {
  if (!FIREBASE_READY) return { error: 'Firebase not configured' };
  const user = currentUser();
  if (!user) return { error: 'Must be signed in to create a room' };

  const db   = getDB();
  const code = generateRoomCode();
  const ref  = doc(db, 'rooms', code);

  const hostPlayer = {
    uid:          user.uid,
    displayName:  user.displayName || 'Player',
    avatarUrl:    user.photoURL || null,
    scores:       {},
    yatzyBonuses: 0,
    ready:        true,
  };

  await setDoc(ref, {
    status:             'waiting',
    hostUid:            user.uid,
    playerUids:         [user.uid],
    currentPlayerIndex: 0,
    turn:               1,
    roll:               0,       // 0 = not rolled yet this turn
    dice:               [1,1,1,1,1],
    held:               [false,false,false,false,false],
    createdAt:          serverTimestamp(),
    lastActionAt:       serverTimestamp(),
  });

  // Players subcollection — index 0 = host
  await setDoc(doc(db, 'rooms', code, 'players', '0'), hostPlayer);

  _roomCode = code;
  return { success: true, code };
}

// ─── JOIN ROOM ────────────────────────────────────────────────────────────────
export async function joinRoom(code) {
  if (!FIREBASE_READY) return { error: 'Firebase not configured' };
  const user = currentUser();
  if (!user) return { error: 'Must be signed in to join a room' };

  const db     = getDB();
  const clean  = code.trim().toUpperCase();
  const ref    = doc(db, 'rooms', clean);
  const snap   = await getDoc(ref);

  if (!snap.exists())                        return { error: 'Room not found' };
  const data = snap.data();
  if (data.status !== 'waiting')             return { error: 'Game already started' };
  if (data.playerUids?.includes(user.uid))   return { error: 'Already in this room' };
  if ((data.playerUids?.length || 0) >= 4)  return { error: 'Room is full (max 4 players)' };

  // Find next available player slot
  const existingPlayers = await Promise.all(
    (data.playerUids || []).map((_, i) => getDoc(doc(db, 'rooms', clean, 'players', String(i))))
  );
  const nextIndex = existingPlayers.length;

  const newPlayer = {
    uid:          user.uid,
    displayName:  user.displayName || 'Player',
    avatarUrl:    user.photoURL || null,
    scores:       {},
    yatzyBonuses: 0,
    ready:        true,
  };

  await setDoc(doc(db, 'rooms', clean, 'players', String(nextIndex)), newPlayer);
  await updateDoc(ref, {
    playerUids:   arrayUnion(user.uid),
    lastActionAt: serverTimestamp(),
  });

  _roomCode = clean;
  return { success: true, code: clean, playerIndex: nextIndex };
}

// ─── LISTEN TO ROOM ───────────────────────────────────────────────────────────
export function listenToRoom(code, onState) {
  _onStateChange = onState;
  const db  = getDB();
  const ref = doc(db, 'rooms', code);

  if (_unsubscribe) _unsubscribe(); // clean up previous listener

  _unsubscribe = onSnapshot(ref, async snap => {
    if (!snap.exists()) { onState({ deleted: true }); return; }
    const room = snap.data();

    // Also fetch players subcollection
    const playerCount = room.playerUids?.length || 0;
    const playerDocs  = await Promise.all(
      Array.from({ length: playerCount }, (_, i) =>
        getDoc(doc(db, 'rooms', code, 'players', String(i)))
      )
    );
    const players = playerDocs.map(d => d.exists() ? d.data() : null).filter(Boolean);
    onState({ room, players });
  });

  return _unsubscribe;
}

// ─── STOP LISTENING ───────────────────────────────────────────────────────────
export function leaveRoom() {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
  _roomCode = null;
}

// ─── GAME ACTIONS (write to Firestore) ───────────────────────────────────────
export async function mpRoll(roomCode, currentDice, heldDice, currentRoll) {
  if (currentRoll > 3) return;
  const newDice = rollDice(currentDice, heldDice);
  const db = getDB();
  await updateDoc(doc(db, 'rooms', roomCode), {
    dice:         newDice,
    roll:         currentRoll + 1,
    lastActionAt: serverTimestamp(),
  });
}

export async function mpToggleHold(roomCode, held, index) {
  const newHeld = [...held];
  newHeld[index] = !newHeld[index];
  const db = getDB();
  await updateDoc(doc(db, 'rooms', roomCode), {
    held:         newHeld,
    lastActionAt: serverTimestamp(),
  });
}

export async function mpReleaseAll(roomCode) {
  const db = getDB();
  await updateDoc(doc(db, 'rooms', roomCode), {
    held:         [false,false,false,false,false],
    lastActionAt: serverTimestamp(),
  });
}

export async function mpScoreCategory(roomCode, playerIndex, playerData, cat, score, yatzyBonuses, players, currentPlayerIndex, turn) {
  const db  = getDB();
  const ref = doc(db, 'rooms', roomCode);

  // Update this player's scores in their subcollection doc
  const updatedScores = { ...playerData.scores, [cat]: score };
  await setDoc(doc(db, 'rooms', roomCode, 'players', String(playerIndex)), {
    ...playerData,
    scores:       updatedScores,
    yatzyBonuses,
  });

  // Work out next player
  const allDone = players.every((p, i) => {
    const scores = i === playerIndex ? updatedScores : p.scores;
    return Object.keys(scores).length === 13;
  });

  if (allDone) {
    await updateDoc(ref, { status: 'finished', lastActionAt: serverTimestamp() });
    return { finished: true };
  }

  let nextIndex = (currentPlayerIndex + 1) % players.length;
  let loops = 0;
  while (Object.keys(
    nextIndex === playerIndex ? updatedScores : players[nextIndex].scores
  ).length === 13 && loops < players.length) {
    nextIndex = (nextIndex + 1) % players.length;
    loops++;
  }

  const nextTurn = nextIndex === 0 ? turn + 1 : turn;

  await updateDoc(ref, {
    currentPlayerIndex: nextIndex,
    turn:               nextTurn,
    roll:               0,
    dice:               [1,1,1,1,1],
    held:               [false,false,false,false,false],
    lastActionAt:       serverTimestamp(),
  });

  // Auto-roll for next player (roll=1)
  const newDice = rollDice([1,1,1,1,1], [false,false,false,false,false]);
  await updateDoc(ref, { dice: newDice, roll: 1 });

  return { finished: false, nextIndex };
}

export async function mpStartGame(roomCode) {
  const db   = getDB();
  const ref  = doc(db, 'rooms', roomCode);
  const dice = rollDice([1,1,1,1,1], [false,false,false,false,false]);
  await updateDoc(ref, {
    status:             'playing',
    currentPlayerIndex: 0,
    turn:               1,
    roll:               1,
    dice,
    held:               [false,false,false,false,false],
    lastActionAt:       serverTimestamp(),
  });
}

export async function deleteRoom(roomCode) {
  const db = getDB();
  await deleteDoc(doc(db, 'rooms', roomCode));
}

// ─── HEARTBEAT ────────────────────────────────────────────────────────────────
// Writes a timestamp every 30s so others can detect disconnects
let _heartbeatInterval = null;
export function startHeartbeat(roomCode, playerIndex) {
  stopHeartbeat();
  _heartbeatInterval = setInterval(async () => {
    const db = getDB();
    try {
      await setDoc(
        doc(db, 'rooms', roomCode, 'players', String(playerIndex)),
        { lastSeen: serverTimestamp() }, { merge: true }
      );
    } catch (_) {}
  }, 30000);
}
export function stopHeartbeat() {
  if (_heartbeatInterval) { clearInterval(_heartbeatInterval); _heartbeatInterval = null; }
}
