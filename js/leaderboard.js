import { fetchLeaderboard, fetchFriends, addFriend, removeFriend,
         getMyProfile, currentUser, FIREBASE_READY } from './firebase.js';
import { toast } from './ui.js';

let currentTab = 'allTime';

// ─── OPEN ─────────────────────────────────────────────────────────────────────
export async function openLeaderboard() {
  document.getElementById('lb-backdrop').classList.add('show');
  await loadTab(currentTab);
}

// ─── TAB LOADER ───────────────────────────────────────────────────────────────
async function loadTab(tab) {
  currentTab = tab;

  document.querySelectorAll('.lb-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  const friendsSection = document.getElementById('friends-section');
  friendsSection.style.display = tab === 'friends' ? 'block' : 'none';
  if (tab === 'friends') await loadFriendsSection();

  const body = document.getElementById('lb-body');
  body.innerHTML = '<div class="lb-loading">Loading...</div>';

  if (!FIREBASE_READY) {
    body.innerHTML = '<div class="lb-empty">Add your Firebase config to enable the leaderboard.</div>';
    return;
  }

  const user = currentUser();
  if (!user && tab === 'friends') {
    body.innerHTML = '<div class="lb-empty">Sign in to view friend scores.</div>';
    return;
  }

  const entries = await fetchLeaderboard(tab);

  if (!entries || entries.length === 0) {
    body.innerHTML = tab === 'friends'
      ? '<div class="lb-empty">Add friends to see their scores here.</div>'
      : '<div class="lb-empty">No scores yet — be the first!</div>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  body.innerHTML = entries.map((e, i) => {
    const isMe     = user && e.uid === user.uid;
    const rank     = medals[i] || `${i + 1}`;
    const initials = (e.displayName || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
    const avatar   = e.avatarUrl
      ? `<img class="lb-avatar" src="${e.avatarUrl}" alt="">`
      : `<div class="lb-avatar-initials">${initials}</div>`;
    const badges = [
      e.bonusEarned ? '+B' : '',
      e.yatzyBonuses > 0 ? `⭐×${e.yatzyBonuses}` : '',
    ].filter(Boolean).join(' ');

    return `<div class="lb-entry">
      <div class="lb-rank">${rank}</div>
      ${avatar}
      <div>
        <div class="lb-name${isMe ? ' me' : ''}">${e.displayName || 'Anonymous'}${isMe ? ' (you)' : ''}</div>
        ${badges ? `<div class="lb-meta">${badges}</div>` : ''}
      </div>
      <div class="lb-score${isMe ? ' me' : ''}">${e.score}</div>
    </div>`;
  }).join('');
}

// ─── FRIENDS SECTION ──────────────────────────────────────────────────────────
async function loadFriendsSection() {
  const user = currentUser();
  if (!user) return;

  const profile = await getMyProfile();
  if (profile?.friendCode) {
    document.getElementById('my-friend-code').textContent = profile.friendCode;
  }

  const friends = await fetchFriends();
  const listEl  = document.getElementById('friends-list');

  if (!friends || friends.length === 0) {
    listEl.innerHTML = '<div class="lb-empty" style="padding:12px 0">No friends added yet.</div>';
    return;
  }

  listEl.innerHTML = friends.map(f => `
    <div class="friend-entry" id="fe-${f.uid}">
      <div class="friend-entry-name">
        ${f.displayName || 'Player'}
        <span style="color:var(--text3);font-size:0.8em;font-family:monospace">${f.friendCode || ''}</span>
      </div>
      <button class="remove-friend-btn" data-uid="${f.uid}">Remove</button>
    </div>`).join('');

  listEl.querySelectorAll('.remove-friend-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this friend?')) return;
      await removeFriend(btn.dataset.uid);
      document.getElementById(`fe-${btn.dataset.uid}`)?.remove();
      toast('Friend removed', 'info');
      await loadTab('friends');
    });
  });
}

// ─── BIND ALL EVENTS ──────────────────────────────────────────────────────────
export function initLeaderboard() {
  // Tab switching
  document.querySelectorAll('.lb-tab').forEach(b => {
    b.addEventListener('click', () => loadTab(b.dataset.tab));
  });

  // Close modal
  document.getElementById('lb-close-btn').addEventListener('click', () => {
    document.getElementById('lb-backdrop').classList.remove('show');
  });
  document.getElementById('lb-backdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('lb-backdrop'))
      document.getElementById('lb-backdrop').classList.remove('show');
  });

  // Copy friend code
  document.getElementById('copy-code-btn').addEventListener('click', () => {
    const code = document.getElementById('my-friend-code').textContent;
    if (code && code !== '———') {
      navigator.clipboard.writeText(code)
        .then(() => toast('Friend code copied!', 'success'));
    }
  });

  // Add friend
  document.getElementById('add-friend-btn').addEventListener('click', async () => {
    const input = document.getElementById('add-friend-input');
    const code  = input.value.trim().toUpperCase();
    if (code.length !== 6) { toast('Enter a 6-character code', 'warn'); return; }
    const btn   = document.getElementById('add-friend-btn');
    btn.disabled = true; btn.textContent = '...';
    const result = await addFriend(code);
    btn.disabled = false; btn.textContent = 'Add';
    if (result.error) { toast(result.error, 'warn'); return; }
    input.value = '';
    toast(`Added ${result.displayName}!`, 'success');
    await loadFriendsSection();
    await loadTab('friends');
  });

  document.getElementById('add-friend-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('add-friend-btn').click();
  });
}
