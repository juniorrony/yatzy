/**
 * reset-weekly.js
 * Runs every Monday via GitHub Actions.
 * 1. Finds the previous week's collection in weeklyScores/
 * 2. Records the winner in leaderboard/weeklyWinners/archive
 * 3. Deletes all documents from the previous week's collection
 *
 * Required GitHub Secrets:
 *   FIREBASE_PROJECT_ID    — e.g. yatzy-d5d18
 *   FIREBASE_CLIENT_EMAIL  — from your service account JSON
 *   FIREBASE_PRIVATE_KEY   — from your service account JSON (include \n chars)
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ─── INIT ─────────────────────────────────────────────────────────────────────
initializeApp({
  credential: cert({
    projectId:   process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getPreviousISOWeek() {
  const now  = new Date();
  const prev = new Date(now);
  prev.setDate(now.getDate() - 7);
  const jan4    = new Date(prev.getFullYear(), 0, 4);
  const doy     = Math.ceil((prev - new Date(prev.getFullYear(), 0, 1)) / 86400000);
  const weekNum = Math.ceil((doy + jan4.getDay()) / 7);
  return `${prev.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

async function deleteCollection(colRef, batchSize = 400) {
  const snap = await colRef.limit(batchSize).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  // Recurse if more docs remain
  if (snap.size === batchSize) {
    return snap.size + await deleteCollection(colRef, batchSize);
  }
  return snap.size;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function run() {
  const week    = getPreviousISOWeek();
  const scoresRef = db.collection('weeklyScores').doc(week).collection('scores');

  console.log(`Processing week: ${week}`);

  // 1. Find winner
  const snap = await scoresRef.orderBy('score', 'desc').limit(1).get();
  if (!snap.empty) {
    const winner = snap.docs[0].data();
    await db.collection('leaderboard')
      .doc('weeklyWinners')
      .collection('archive')
      .add({
        week,
        uid:         winner.uid,
        displayName: winner.displayName,
        avatarUrl:   winner.avatarUrl || null,
        score:       winner.score,
        archivedAt:  FieldValue.serverTimestamp(),
      });
    console.log(`Winner archived: ${winner.displayName} — ${winner.score}`);
  } else {
    console.log('No scores this week, nothing to archive.');
  }

  // 2. Delete all scores from that week
  const deleted = await deleteCollection(scoresRef);
  console.log(`Deleted ${deleted} documents from weeklyScores/${week}/scores`);
  console.log('Done.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
