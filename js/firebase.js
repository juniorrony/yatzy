import { initializeApp }                              from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup,
         signOut, onAuthStateChanged }                from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc,
         increment, serverTimestamp, collection,
         query, orderBy, limit, getDocs, where,
         writeBatch, deleteDoc }                      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Replace all values below with your project's Firebase config.
// Found at: Firebase Console → Project settings → Your apps → SDK setup
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDQE9zo0CS_yV7HTttEMLWXTGgcGXpjD1w",

  authDomain: "yatzy-d5d18.firebaseapp.com",

  projectId: "yatzy-d5d18",

  storageBucket: "yatzy-d5d18.firebasestorage.app",

  messagingSenderId: "902576814145",

  appId: "1:902576814145:web:003ef659c75e7b37feaec0",

  measurementId: "G-9Q3J34VL1M"

};

export const FIREBASE_READY = FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY';
 
let app, auth, db;
let _currentUser = null;
const _authListeners = [];
 
function getISOWeek() {
  const now    = new Date();
  const jan4   = new Date(now.getFullYear(), 0, 4);
  const doy    = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 86400000);
  const weekNum = Math.ceil((doy + jan4.getDay()) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
 
function generateFriendCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
 
// ─── INIT ─────────────────────────────────────────────────────────────────────
if (FIREBASE_READY) {
  app  = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db   = getFirestore(app);
 
  onAuthStateChanged(auth, async user => {
    _currentUser = user;
    if (user) await upsertUserProfile(user);
    _authListeners.forEach(fn => fn(user));
  });
}
 
async function upsertUserProfile(user) {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const code = generateFriendCode();
    await setDoc(ref, {
      displayName: user.displayName,
      avatarUrl:   user.photoURL,
      gamesPlayed: 0,
      highScore:   0,
      totalScore:  0,
      friendCode:  code,
      joinedAt:    serverTimestamp(),
    });
    await setDoc(doc(db, 'friendCodes', code), { uid: user.uid });
  } else if (!snap.data().friendCode) {
    const code = generateFriendCode();
    await updateDoc(ref, { friendCode: code });
    await setDoc(doc(db, 'friendCodes', code), { uid: user.uid });
  }
}
 
// ─── AUTH ─────────────────────────────────────────────────────────────────────
export function currentUser() { return _currentUser; }
 
export function onAuthChange(fn) {
  _authListeners.push(fn);
  // Fire immediately if already resolved
  if (_currentUser !== null || !FIREBASE_READY) fn(_currentUser);
}
 
export async function signInWithGoogle() {
  if (!FIREBASE_READY) return { error: 'Firebase not configured' };
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { error: e.message };
  }
}
 
export async function signOutUser() {
  if (!FIREBASE_READY) return;
  await signOut(auth);
}
 
// ─── SCORE SAVE ───────────────────────────────────────────────────────────────
export async function saveScore(playerObj, totalScore, upperTotal) {
  if (!FIREBASE_READY || !_currentUser) return { skipped: true };
  try {
    const week  = getISOWeek();
    const uid   = _currentUser.uid;
    const entry = {
      uid,
      displayName:  _currentUser.displayName || 'Anonymous',
      avatarUrl:    _currentUser.photoURL || null,
      score:        totalScore,
      yatzyBonuses: playerObj.yatzyBonuses || 0,
      bonusEarned:  upperTotal >= 63,
      playedAt:     serverTimestamp(),
    };
 
    const batch      = writeBatch(db);
    const userRef    = doc(db, 'users', uid);
    const userSnap   = await getDoc(userRef);
    const curHigh    = userSnap.exists() ? (userSnap.data().highScore || 0) : 0;
 
    // ── All-time: one doc per user (uid = doc ID), only update if new high ──
    const allTimeRef  = doc(db, 'leaderboard', 'allTime', 'scores', uid);
    const allTimeSnap = await getDoc(allTimeRef);
    const prevAllTime = allTimeSnap.exists() ? (allTimeSnap.data().score || 0) : 0;
    if (totalScore > prevAllTime) {
      batch.set(allTimeRef, entry);
    }
 
    // ── Weekly: one doc per user per week, only update if new weekly high ──
    const weeklyRef  = doc(db, 'weeklyScores', week, 'scores', uid);
    const weeklySnap = await getDoc(weeklyRef);
    const prevWeekly = weeklySnap.exists() ? (weeklySnap.data().score || 0) : 0;
    if (totalScore > prevWeekly) {
      batch.set(weeklyRef, { ...entry, week });
    }
 
    // ── User stats: always update ──
    batch.update(userRef, {
      gamesPlayed: increment(1),
      totalScore:  increment(totalScore),
      highScore:   Math.max(curHigh, totalScore),
      lastPlayed:  serverTimestamp(),
    });
 
    await batch.commit();
    return { success: true };
  } catch (e) {
    console.error('Firestore save error:', e);
    return { error: e.message };
  }
}
 
// ─── LEADERBOARD FETCH ────────────────────────────────────────────────────────
export async function fetchLeaderboard(tab) {
  if (!FIREBASE_READY) return [];
  try {
    if (tab === 'allTime') {
      const q    = query(collection(db, 'leaderboard', 'allTime', 'scores'), orderBy('score', 'desc'), limit(25));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
 
    if (tab === 'weekly') {
      const week = getISOWeek();
      const q    = query(collection(db, 'weeklyScores', week, 'scores'), orderBy('score', 'desc'), limit(25));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
 
    if (tab === 'friends') {
      if (!_currentUser) return [];
      const friendsSnap = await getDocs(collection(db, 'users', _currentUser.uid, 'friends'));
      const friendUids  = friendsSnap.docs.map(d => d.id);
      if (friendUids.length === 0) return [];
 
      const results = [];
      for (const fuid of friendUids) {
        const q = query(collection(db, 'leaderboard', 'allTime', 'scores'),
                        where('uid', '==', fuid), orderBy('score', 'desc'), limit(1));
        const s = await getDocs(q);
        if (!s.empty) results.push({ id: s.docs[0].id, ...s.docs[0].data() });
      }
      // Include self
      const myQ = query(collection(db, 'leaderboard', 'allTime', 'scores'),
                        where('uid', '==', _currentUser.uid), orderBy('score', 'desc'), limit(1));
      const myS = await getDocs(myQ);
      if (!myS.empty) results.push({ id: myS.docs[0].id, ...myS.docs[0].data() });
      return results.sort((a, b) => b.score - a.score);
    }
 
    return [];
  } catch (e) {
    console.error('Leaderboard fetch error:', e);
    return [];
  }
}
 
// ─── FRIENDS ──────────────────────────────────────────────────────────────────
export async function fetchFriends() {
  if (!FIREBASE_READY || !_currentUser) return [];
  try {
    const snap = await getDocs(collection(db, 'users', _currentUser.uid, 'friends'));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (e) { return []; }
}
 
export async function addFriend(code) {
  if (!FIREBASE_READY || !_currentUser) return { error: 'Not signed in' };
  try {
    const clean    = code.trim().toUpperCase();
    const codeSnap = await getDoc(doc(db, 'friendCodes', clean));
    if (!codeSnap.exists())               return { error: 'No player found with that code' };
    const friendUid = codeSnap.data().uid;
    if (friendUid === _currentUser.uid)   return { error: "That's your own code!" };
    const existing = await getDoc(doc(db, 'users', _currentUser.uid, 'friends', friendUid));
    if (existing.exists())                return { error: 'Already friends' };
    const fpSnap = await getDoc(doc(db, 'users', friendUid));
    if (!fpSnap.exists())                 return { error: 'Player profile not found' };
    const fp     = fpSnap.data();
    const mySnap = await getDoc(doc(db, 'users', _currentUser.uid));
    const myData = mySnap.data() || {};
    const batch  = writeBatch(db);
    batch.set(doc(db, 'users', _currentUser.uid, 'friends', friendUid), {
      displayName: fp.displayName || 'Player',
      avatarUrl:   fp.avatarUrl || null,
      friendCode:  clean,
      addedAt:     serverTimestamp(),
    });
    batch.set(doc(db, 'users', friendUid, 'friends', _currentUser.uid), {
      displayName: _currentUser.displayName || 'Player',
      avatarUrl:   _currentUser.photoURL || null,
      friendCode:  myData.friendCode || '',
      addedAt:     serverTimestamp(),
    });
    await batch.commit();
    return { success: true, displayName: fp.displayName };
  } catch (e) { console.error(e); return { error: 'Something went wrong' }; }
}
 
export async function removeFriend(friendUid) {
  if (!FIREBASE_READY || !_currentUser) return;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', _currentUser.uid, 'friends', friendUid));
    batch.delete(doc(db, 'users', friendUid, 'friends', _currentUser.uid));
    await batch.commit();
  } catch (e) { console.error(e); }
}
 
export async function getMyProfile() {
  if (!FIREBASE_READY || !_currentUser) return null;
  try {
    const snap = await getDoc(doc(db, 'users', _currentUser.uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) { return null; }
}
 
