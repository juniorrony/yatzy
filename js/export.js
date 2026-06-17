import { CATS } from './constants.js';
import { grandTotal, upperSubtotal, bonusAmount, lowerTotal, yatzyBonusTotal } from './game.js';

// ─── BUILD SCORECARD TEXT ─────────────────────────────────────────────────────
function buildText(players) {
  const line  = (s = '') => s;
  const pad   = (s, n = 20) => String(s).padEnd(n);
  const rpad  = (s, n = 10) => String(s).padStart(n);

  const header = ['Category', ...players.map(p => p.name)].map((s, i) => i === 0 ? pad(s) : rpad(s)).join('');
  const divider = '─'.repeat(header.length);

  const rows = CATS.map(cat => {
    const cells = [pad(cat.name), ...players.map(p => rpad(p.scores[cat.id] ?? '—'))];
    return cells.join('');
  });

  const totals = (label, fn) =>
    [pad(label), ...players.map(p => rpad(fn(p)))].join('');

  return [
    'YATZY SCORECARD',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    divider,
    header,
    divider,
    '  UPPER SECTION',
    ...CATS.filter(c => c.section === 'upper').map(cat =>
      [pad('  ' + cat.name), ...players.map(p => rpad(p.scores[cat.id] ?? '—'))].join('')
    ),
    divider,
    totals('  Subtotal', upperSubtotal),
    totals('  Bonus (+35 if ≥63)', bonusAmount),
    divider,
    '  LOWER SECTION',
    ...CATS.filter(c => c.section === 'lower').map(cat =>
      [pad('  ' + cat.name), ...players.map(p => rpad(p.scores[cat.id] ?? '—'))].join('')
    ),
    totals('  Yatzy bonuses', p => `+${yatzyBonusTotal(p)}`),
    divider,
    totals('GRAND TOTAL', grandTotal),
    divider,
  ].join('\n');
}

// ─── BUILD CSV ────────────────────────────────────────────────────────────────
function buildCSV(players) {
  const escape = v => `"${String(v).replace(/"/g, '""')}"`;
  const header = ['Category', ...players.map(p => p.name)].map(escape).join(',');

  const rows = CATS.map(cat => {
    return [escape(cat.name), ...players.map(p => escape(p.scores[cat.id] ?? ''))].join(',');
  });

  const totals = [
    ['Upper subtotal', ...players.map(upperSubtotal)],
    ['Bonus', ...players.map(bonusAmount)],
    ['Yatzy bonuses', ...players.map(yatzyBonusTotal)],
    ['Grand total', ...players.map(grandTotal)],
  ].map(row => row.map(escape).join(','));

  return [header, ...rows, '', ...totals].join('\n');
}

// ─── DOWNLOAD ─────────────────────────────────────────────────────────────────
function download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportText(players) {
  download(buildText(players), `yatzy-${timestamp()}.txt`, 'text/plain');
}

export function exportCSV(players) {
  download(buildCSV(players), `yatzy-${timestamp()}.csv`, 'text/csv');
}

function timestamp() {
  return new Date().toISOString().slice(0, 10);
}
