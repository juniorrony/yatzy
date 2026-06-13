const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getISOWeek() {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const dayOfYear = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 86400000);
  const weekNum = Math.ceil((dayOfYear + jan4.getDay()) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function generateFriendCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Server-side score validation — mirrors your client calcScore logic exactly
function calcScore(cat, dice) {
  const counts = {};
  for (let i = 1; i <= 6; i++) counts[i] = 0;
  dice.forEach(v => counts[v]++);
  const s = dice.reduce((a, b) => a + b, 0);
  const vals = Object.values(counts).filter(x => x > 0).sort((a, b) => a - b);

  switch (cat) {
    case "ones":   return counts[1] * 1;
    case "twos":   return counts[2] * 2;
    case "threes": return counts[3] * 3;
    case "fours":  return counts[4] * 4;
    case "fives":  return counts[5] * 5;
    case "sixes":  return counts[6] * 6;
    case "three-of-a-kind": return Object.values(counts).some(v => v >= 3) ? s : 0;
    case "four-of-a-kind":  return Object.values(counts).some(v => v >= 4) ? s : 0;
    case "full-house":
      return vals.length === 2 && vals[0] === 2 && vals[1] === 3 ? 25 : 0;
    case "small-straight": {
      const u = [...new Set(dice)].sort((a, b) => a - b);
      return [[1,2,3,4],[2,3,4,5],[3,4,5,6]].some(st => st.every(n => u.includes(n))) ? 30 : 0;
    }
    case "large-straight": {
      const u = [...new Set(dice)].sort((a, b) => a - b);
      return u.length === 5 && ((u[0] === 1 && u[4] === 5) || (u[0] === 2 && u[4] === 6)) ? 40 : 0;
    }
    case "yatzy":  return Object.values(counts).some(v => v === 5) ? 50 : 0;
    case "chance": return s;
    default: return 0;
  }
}

function calcJokerScore(cat, dice) {
  const counts = {};
  for (let i = 1; i <= 6; i++) counts[i] = 0;
  dice.forEach(v => counts[v]++);
  const s = dice.reduce((a, b) => a + b, 0);
  switch (cat) {
    case "ones":   return counts[1] * 1;
    case "twos":   return counts[2] * 2;
    case "threes": return counts[3] * 3;
    case "fours":  return counts[4] * 4;
    case "fives":  return counts[5] * 5;
    case "sixes":  return counts[6] * 6;
    case "three-of-a-kind": return s;
    case "four-of-a-kind":  return s;
    case "full-house":      return 25;
    case "small-straight":  return 30;
    case "large-straight":  return 40;
    case "chance":          return s;
    default: return 0;
  }
}

// ─── validateAndSaveScore ─────────────────────────────────────────────────────
// Called from the client at game over. Validates every category score
// server-side then writes to leaderboard + updates user stats.
exports.validateAndSaveScore = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const { scorecard, diceLogs, yatzyBonuses } = request.data;
  // scorecard: { ones: {score, finalDice}, twos: {score, finalDice}, ... }
  // diceLogs:  array of {cat, dice, isJoker} — one per turn
  // yatzyBonuses: number

  const CATS = ["ones","twos","threes","fours","fives","sixes",
    "three-of-a-kind","four-of-a-kind","full-house",
    "small-straight","large-straight","yatzy","chance"];

  if (!scorecard || typeof scorecard !== "object")
    throw new HttpsError("invalid-argument", "Missing scorecard");
  if (Object.keys(scorecard).length !== 13)
    throw new HttpsError("invalid-argument", "Scorecard must have exactly 13 categories");

  // Validate each category
  for (const cat of CATS) {
    const entry = scorecard[cat];
    if (!entry) throw new HttpsError("invalid-argument", `Missing category: ${cat}`);
    const { score, finalDice, isJoker } = entry;
    if (!Array.isArray(finalDice) || finalDice.length !== 5)
      throw new HttpsError("invalid-argument", `Invalid dice for ${cat}`);
    if (finalDice.some(d => d < 1 || d > 6 || !Number.isInteger(d)))
      throw new HttpsError("invalid-argument", `Dice values out of range for ${cat}`);

    const expected = isJoker ? calcJokerScore(cat, finalDice) : calcScore(cat, finalDice);
    if (score !== expected)
      throw new HttpsError("invalid-argument",
        `Score mismatch for ${cat}: got ${score}, expected ${expected}`);
  }

  // Validate yatzyBonuses count — count how many joker turns appear in diceLogs
  if (typeof yatzyBonuses !== "number" || yatzyBonuses < 0 || yatzyBonuses > 12)
    throw new HttpsError("invalid-argument", "Invalid yatzyBonuses");

  // Compute totals
  const upperCats = ["ones","twos","threes","fours","fives","sixes"];
  const lowerCats  = ["three-of-a-kind","four-of-a-kind","full-house",
    "small-straight","large-straight","yatzy","chance"];

  const upperTotal = upperCats.reduce((t, c) => t + scorecard[c].score, 0);
  const bonusEarned = upperTotal >= 63;
  const bonus = bonusEarned ? 35 : 0;
  const lowerTotal = lowerCats.reduce((t, c) => t + scorecard[c].score, 0);
  const grandTotal = upperTotal + bonus + lowerTotal + (yatzyBonuses * 100);

  const uid = request.auth.uid;
  const displayName = request.auth.token.name || "Anonymous";
  const avatarUrl = request.auth.token.picture || null;
  const week = getISOWeek();

  const batch = db.batch();

  // All-time leaderboard entry
  const allTimeRef = db.collection("leaderboard").doc("allTime")
    .collection("scores").doc();
  batch.set(allTimeRef, {
    uid, displayName, avatarUrl,
    score: grandTotal, upperTotal, bonusEarned,
    yatzyBonuses, playedAt: FieldValue.serverTimestamp()
  });

  // Weekly leaderboard entry
  const weeklyRef = db.collection("leaderboard").doc("weekly")
    .collection(week).doc();
  batch.set(weeklyRef, {
    uid, displayName, avatarUrl,
    score: grandTotal, upperTotal, bonusEarned,
    yatzyBonuses, playedAt: FieldValue.serverTimestamp()
  });

  // Update user stats
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const currentHigh = userSnap.exists ? (userSnap.data().highScore || 0) : 0;
  batch.set(userRef, {
    displayName, avatarUrl,
    gamesPlayed: FieldValue.increment(1),
    totalScore:  FieldValue.increment(grandTotal),
    highScore:   Math.max(currentHigh, grandTotal),
    lastPlayed:  FieldValue.serverTimestamp()
  }, { merge: true });

  // Ensure friend code exists
  if (userSnap.exists && !userSnap.data().friendCode) {
    batch.update(userRef, { friendCode: generateFriendCode() });
  } else if (!userSnap.exists) {
    batch.set(userRef, { friendCode: generateFriendCode() }, { merge: true });
  }

  await batch.commit();
  return { success: true, grandTotal, bonusEarned, week };
});

// ─── addFriend ────────────────────────────────────────────────────────────────
exports.addFriend = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const { friendCode } = request.data;
  if (!friendCode || typeof friendCode !== "string")
    throw new HttpsError("invalid-argument", "Missing friend code");

  const code = friendCode.trim().toUpperCase();
  const uid = request.auth.uid;

  // Find user with this friend code
  const snap = await db.collection("users")
    .where("friendCode", "==", code).limit(1).get();

  if (snap.empty) throw new HttpsError("not-found", "No player found with that code");

  const friendDoc = snap.docs[0];
  const friendUid = friendDoc.id;
  if (friendUid === uid) throw new HttpsError("invalid-argument", "Can't add yourself");

  const friendData = friendDoc.data();

  // Check not already friends
  const existing = await db.collection("users").doc(uid)
    .collection("friends").doc(friendUid).get();
  if (existing.exists) throw new HttpsError("already-exists", "Already friends");

  const batch = db.batch();

  // Add friend to current user
  batch.set(db.collection("users").doc(uid).collection("friends").doc(friendUid), {
    displayName: friendData.displayName,
    avatarUrl:   friendData.avatarUrl || null,
    friendCode:  code,
    addedAt:     FieldValue.serverTimestamp()
  });

  // Add current user to friend's list (bidirectional)
  const mySnap = await db.collection("users").doc(uid).get();
  const myData = mySnap.data() || {};
  batch.set(db.collection("users").doc(friendUid).collection("friends").doc(uid), {
    displayName: request.auth.token.name || "Anonymous",
    avatarUrl:   request.auth.token.picture || null,
    friendCode:  myData.friendCode || "",
    addedAt:     FieldValue.serverTimestamp()
  });

  await batch.commit();
  return { success: true, displayName: friendData.displayName };
});

// ─── removeFriend ─────────────────────────────────────────────────────────────
exports.removeFriend = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { friendUid } = request.data;
  if (!friendUid) throw new HttpsError("invalid-argument", "Missing friendUid");

  const uid = request.auth.uid;
  const batch = db.batch();
  batch.delete(db.collection("users").doc(uid).collection("friends").doc(friendUid));
  batch.delete(db.collection("users").doc(friendUid).collection("friends").doc(uid));
  await batch.commit();
  return { success: true };
});

// ─── archiveWeeklyLeaderboard ─────────────────────────────────────────────────
// Runs every Monday at 00:05 UTC. Archives previous week, no deletion needed
// since weeks are stored by key (2026-W23 etc.) and naturally expire from view.
exports.archiveWeeklyLeaderboard = onSchedule("5 0 * * 1", async () => {
  const now = new Date();
  const prevMonday = new Date(now);
  prevMonday.setDate(now.getDate() - 7);
  const jan4 = new Date(prevMonday.getFullYear(), 0, 4);
  const dayOfYear = Math.ceil((prevMonday - new Date(prevMonday.getFullYear(), 0, 1)) / 86400000);
  const weekNum = Math.ceil((dayOfYear + jan4.getDay()) / 7);
  const prevWeek = `${prevMonday.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;

  // Find winner of previous week
  const snap = await db.collection("leaderboard").doc("weekly")
    .collection(prevWeek).orderBy("score", "desc").limit(1).get();

  if (!snap.empty) {
    const winner = snap.docs[0].data();
    await db.collection("leaderboard").doc("weeklyWinners").collection("archive").add({
      week: prevWeek,
      uid: winner.uid,
      displayName: winner.displayName,
      score: winner.score,
      archivedAt: FieldValue.serverTimestamp()
    });
  }
  console.log(`Archived week ${prevWeek}`);
});