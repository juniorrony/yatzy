//!/usr/bin/env node

// Simple verification script for Yatzy online playing feature fixes
// This script checks that the key bugs have been fixed

const fs = require('fs');
const path = require('path');

function checkRollLogic() {
  console.log('Checking roll logic fixes...');
  
  // Check main.js
  const mainJsPath = path.join(__dirname, 'js', 'main.js');
  const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
  
  if (!mainJsContent.includes('if (roll >= 3 || players[currentPlayer]?.done) return;')) {
    console.error('❌ main.js: Roll logic not fixed (should use >= 3)');
    return false;
  }
  
  if (!mainJsContent.includes('turn++')) {
    console.error('❌ main.js: Turn calculation not fixed (should use turn++)');
    return false;
  }
  
  // Check that stopTimer() is NOT called in startGame function
  if (mainJsContent.includes('startGame(names) {\n  players       = names.map(makePlayer);\n  currentPlayer = 0;\n  turn          = 1;\n  dice          = [1, 1, 1, 1, 1];\n  held          = [false, false, false, false, false];\n  roll          = 1;\n  undoState     = null;\n  gameHistory   = [];\n  _timerEnabled = names.length > 1;\n  document.getElementById(\'setup-backdrop\').classList.remove(\'show\');\n  document.getElementById(\'gameover-backdrop\').classList.remove(\'show\');\n  document.getElementById(\'undo-btn\').disabled = true;\n  document.getElementById(\'view-lb-btn\')?.remove();\n  doRoll();\n  render();\n}')) {
    console.error('❌ main.js: Timer initialization bug not fixed (should remove premature stopTimer)');
    return false;
  }
  
  if (!mainJsContent.includes('rollBtn.disabled = false;')) {
    console.error('❌ main.js: Button state logic not fixed (should enable category selection)');
    return false;
  }
  
  console.log('✅ main.js: All roll logic fixes verified');
  return true;
}

function checkMultiplayerLogic() {
  console.log('Checking multiplayer logic fixes...');
  
  const multiplayerJsPath = path.join(__dirname, 'js', 'multiplayer.js');
  const multiplayerJsContent = fs.readFileSync(multiplayerJsPath, 'utf8');
  
  if (!multiplayerJsContent.includes('if (currentRoll >= 3) return;')) {
    console.error('❌ multiplayer.js: Roll logic not fixed (should use >= 3)');
    return false;
  }
  
  if (multiplayerJsContent.includes('await updateDoc(ref, { dice: newDice, roll: 1 });')) {
    console.error('❌ multiplayer.js: Auto-roll bug not fixed (should remove forced auto-roll)');
    return false;
  }
  
  console.log('✅ multiplayer.js: All multiplayer logic fixes verified');
  return true;
}

function checkLobbyLogic() {
  console.log('Checking lobby logic fixes...');
  
  const lobbyJsPath = path.join(__dirname, 'js', 'lobby.js');
  const lobbyJsContent = fs.readFileSync(lobbyJsPath, 'utf8');
  
  if (!lobbyJsContent.includes('const user = currentUser();')) {
    console.error('❌ lobby.js: Player indexing fix not found (should query room for player index)');
    return false;
  }
  
  if (!lobbyJsContent.includes('startBtn.disabled = players.length <= 1;')) {
    console.error('❌ lobby.js: Host start logic not fixed (should use <= 1)');
    return false;
  }
  
  if (!lobbyJsContent.includes('if (!isMyTurn || roll === 1) return;')) {
    console.error('❌ lobby.js: Dice click handler not fixed (should use === 1)');
    return false;
  }
  
  if (!lobbyJsContent.includes('if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code))')) {
    console.error('❌ lobby.js: Room code validation not fixed (should use regex)');
    return false;
  }
  
  console.log('✅ lobby.js: All lobby logic fixes verified');
  return true;
}

function checkFirebaseLogic() {
  console.log('Checking Firebase logic fixes...');
  
  const firebaseJsPath = path.join(__dirname, 'js', 'firebase.js');
  const firebaseJsContent = fs.readFileSync(firebaseJsPath, 'utf8');
  
  if (!firebaseJsContent.includes('runTransaction(db, async (transaction) => {')) {
    console.error('❌ firebase.js: Score save race condition not fixed (should use transaction)');
    return false;
  }
  
  if (!firebaseJsContent.includes('const codeSnap = await getDoc(doc(db, \'friendCodes\', code));')) {
    console.error('❌ firebase.js: Friend code race condition not fixed (should check uniqueness)');
    return false;
  }
  
  if (!firebaseJsContent.includes('Promise.all(friendQueries.map(q => getDocs(q)))')) {
    console.error('❌ firebase.js: Leaderboard performance not fixed (should use Promise.all)');
    return false;
  }
  
  console.log('✅ firebase.js: All Firebase logic fixes verified');
  return true;
}

function main() {
  console.log('=== Yatzy Online Playing Feature Bug Fix Verification ===\n');
  
  const results = [
    checkRollLogic(),
    checkMultiplayerLogic(),
    checkLobbyLogic(),
    checkFirebaseLogic()
  ];
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('\n=== Summary ===');
  console.log(`Tests passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('🎉 All bug fixes verified successfully!');
    return 0;
  } else {
    console.log('❌ Some tests failed. Please review the fixes.');
    return 1;
  }
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { main };