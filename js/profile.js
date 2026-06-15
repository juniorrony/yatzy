import { currentUser, getMyProfile, FIREBASE_READY } from './firebase.js';
import { toast } from './ui.js';

// ─── OPEN ─────────────────────────────────────────────────────────────────────
export async function openProfile() {
  const user = currentUser();
  if (!user) {
    document.getElementById('auth-backdrop').classList.add('show');
    return;
  }
  document.getElementById('profile-backdrop').classList.add('show');
  await loadProfile(user);
}

// ─── LOAD ─────────────────────────────────────────────────────────────────────
async function loadProfile(user) {
  // Avatar
  const avatarEl = document.getElementById('profile-avatar');
  const initials = (user.displayName || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
  avatarEl.innerHTML = user.photoURL
    ? `<img src="${user.photoURL}" alt="">`
    : initials;

  // Name
  document.getElementById('profile-name').textContent = user.displayName || 'Anonymous';

  // Stats placeholder while loading
  document.getElementById('profile-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">—</div><div class="stat-label">Games played</div></div>
    <div class="stat-card"><div class="stat-value gold">—</div><div class="stat-label">High score</div></div>
    <div class="stat-card"><div class="stat-value">—</div><div class="stat-label">Total score</div></div>
    <div class="stat-card"><div class="stat-value green">—</div><div class="stat-label">Avg score</div></div>
  `;

  if (!FIREBASE_READY) return;

  const profile = await getMyProfile();
  if (!profile) return;

  // Joined date
  const joinedEl = document.getElementById('profile-joined');
  if (profile.joinedAt?.toDate) {
    const d = profile.joinedAt.toDate();
    joinedEl.textContent = `Joined ${d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
  }

  // Stats
  const games = profile.gamesPlayed || 0;
  const high  = profile.highScore   || 0;
  const total = profile.totalScore  || 0;
  const avg   = games > 0 ? Math.round(total / games) : 0;

  document.getElementById('profile-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${games}</div>
      <div class="stat-label">Games played</div>
    </div>
    <div class="stat-card">
      <div class="stat-value gold">${high}</div>
      <div class="stat-label">High score</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${total.toLocaleString()}</div>
      <div class="stat-label">Total score</div>
    </div>
    <div class="stat-card">
      <div class="stat-value green">${avg}</div>
      <div class="stat-label">Avg score</div>
    </div>
  `;

  // Friend code
  if (profile.friendCode) {
    document.getElementById('profile-friend-code').textContent = profile.friendCode;
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
export function initProfile() {
  document.getElementById('profile-close-btn').addEventListener('click', () => {
    document.getElementById('profile-backdrop').classList.remove('show');
  });
  document.getElementById('profile-backdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('profile-backdrop'))
      document.getElementById('profile-backdrop').classList.remove('show');
  });
  document.getElementById('profile-copy-code-btn').addEventListener('click', () => {
    const code = document.getElementById('profile-friend-code').textContent;
    if (code && code !== '———') {
      navigator.clipboard.writeText(code)
        .then(() => toast('Friend code copied!', 'success'));
    }
  });
}
