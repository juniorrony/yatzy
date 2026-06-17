import { getApps }                                    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, setDoc, getDoc, deleteDoc,
         onSnapshot, collection, query, where,
         limit, getDocs, updateDoc,
         serverTimestamp }                             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { currentUser, FIREBASE_READY }                from './firebase.js';
import { createRoom, joinRoom }                       from './multiplayer.js';

function getDB() { return getFirestore(getApps()[0]); }

// ─── STATE ────────────────────────────────────────────────────────────────────
let _unsubQueue    = null;   // onSnapshot on our own queue entry
let _searching     = false;
let _onMatched     = null;   // callback(roomCode)
let _onCancelled   = null;   // callback()
let _pollInterval  = null;
const QUEUE_TIMEOUT_MS = 45000; // give up after 45s

// ─── ENTER QUEUE ─────────────────────────────────────────────────────────────
export async function enterQueue(onMatched, onCancelled) {
  if (!FIREBASE_READY) return { error: 'Firebase not configured' };
  const user = currentUser();
  if (!user) return { error: 'Must be signed in' };
  if (_searching) return { error: 'Already searching' };

  _onMatched   = onMatched;
  _onCancelled = onCancelled;
  _searching   = true;

  const db  = getDB();
  const uid = user.uid;

  // Write our queue entry
  await setDoc(doc(db, 'matchmaking', uid), {
    uid,
    displayName: user.displayName || 'Player',
    avatarUrl:   user.photoURL || null,
    status:      'waiting',
    joinedAt:    serverTimestamp(),
  });

  // Listen to our own entry — someone else will write roomCode to it when matched
  _unsubQueue = onSnapshot(doc(db, 'matchmaking', uid), async snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.roomCode) {
      // We were matched by someone else — join their room
      await _cleanup(uid);
      _onMatched?.(data.roomCode, false); // false = not host
    }
  });

  // Also actively poll for waiting opponents every 2s
  _pollInterval = setInterval(() => _pollForOpponent(uid), 2000);

  // Timeout fallback
  setTimeout(() => {
    if (_searching) cancelQueue('No opponents found. Try again later.');
  }, QUEUE_TIMEOUT_MS);

  // Poll immediately
  await _pollForOpponent(uid);

  return { success: true };
}

// ─── POLL FOR OPPONENT ───────────────────────────────────────────────────────
async function _pollForOpponent(myUid) {
  if (!_searching) return;
  const db = getDB();

  // Find any other waiting player
  const q = query(
    collection(db, 'matchmaking'),
    where('status', '==', 'waiting'),
    limit(5)
  );
  const snap = await getDocs(q);
  const opponents = snap.docs
    .map(d => d.data())
    .filter(d => d.uid !== myUid);

  if (opponents.length === 0) return;

  // Pick the first opponent
  const opponent = opponents[0];

  // Race condition prevention:
  // Lower UID always creates the room. Both clients independently reach this.
  const iAmHost = myUid < opponent.uid;

  if (iAmHost) {
    // I create the room and write the code to both queue entries
    const result = await createRoom();
    if (result.error) return;
    const roomCode = result.code;

    // Join opponent into the room
    await joinRoom(roomCode); // adds me already via createRoom
    // Write roomCode to opponent's queue entry so their listener fires
    await updateDoc(doc(db, 'matchmaking', opponent.uid), {
      status:   'matched',
      roomCode,
    });
    // Mark my entry matched too (prevents double-matching)
    await updateDoc(doc(db, 'matchmaking', myUid), {
      status:   'matched',
      roomCode,
    });

    await _cleanup(myUid);
    _onMatched?.(roomCode, true); // true = host
  }
  // If I'm not the host, my onSnapshot listener will fire when the host
  // writes roomCode to my entry — handled in enterQueue above.
}

// ─── CANCEL ──────────────────────────────────────────────────────────────────
export async function cancelQueue(reason) {
  if (!_searching) return;
  const user = currentUser();
  if (user) {
    const db = getDB();
    try { await deleteDoc(doc(db, 'matchmaking', user.uid)); } catch (_) {}
  }
  await _cleanup(user?.uid);
  _onCancelled?.(reason);
}

async function _cleanup(uid) {
  _searching = false;
  if (_unsubQueue)   { _unsubQueue(); _unsubQueue = null; }
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}

export function isSearching() { return _searching; }
