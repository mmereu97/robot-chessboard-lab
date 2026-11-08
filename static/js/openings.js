// =================== openings: a game against Stockfish, with the openings it can still become ===================
// The 3,865 named openings of lichess-org/chess-openings (CC0), taken from chess-analysis-board by
// tools/openings/build.js. During the game the list keeps only the openings whose line still passes through
// the position on the board (by position, so transpositions count), and shrinks with every move. Pick one and
// its ghosts show where your pieces go; Stockfish can play along with it. Loaded after app.js, whose state it uses.
let OPS = null, opSide = 'w', exPick = -1, exFamily = null, exCache = null;
const OP_MAIN = {   // the line learnt first in the best-known families; the others get the busiest path
  'Italian Game': 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3',
  'Ruy Lopez': 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3',
  'Scotch Game': 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5',
  'Sicilian Defense': 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Be7',
  'French Defense': 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7',
  'Caro-Kann Defense': 'e4 c6 d4 d5 Nd2 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7',
  'Scandinavian Defense': 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6',
  "Queen's Gambit Declined": 'd4 Nf6 c4 e6 Nf3 d5 Nc3 Be7 Bg5 O-O e3 Nbd7',
  'London System': 'd4 d5 Nf3 Nf6 Bf4 c5 e3 Nc6 Nbd2 e6 c3',
};
const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const stored = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
if (stored('robo-opside') === 'b') opSide = 'b';
if (stored('robo-opelo')) $('opElo').value = stored('robo-opelo');
if (stored('robo-opghosts')) $('opGhosts').value = stored('robo-opghosts');
if (stored('robo-opadv') === '1') $('opAdv').checked = true;
if (stored('robo-exalong') === '0') $('exAlong').checked = false;
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
// the White systems are found under other names too ("Queen's Pawn Game: London System"): they get their own family
const familyOf = name => (/London System/.exec(name) || /Colle System/.exec(name) || /Torre Attack/.exec(name) || [name.split(/[:,]/)[0].trim()])[0];
const moveId = m => m.from + '-' + m.to + (m.promo || '');
// moves numbered as in a game, starting at ply `from`: 3...Bf5 4.Ng3
function movesText(moves, from = 0, upTo = 99) {
  const out = moves.slice(from, from + upTo).map((m, k) => {
    const p = from + k, n = (p >> 1) + 1;
    return p % 2 === 0 ? `${n}.${m}` : k === 0 ? `${n}...${m}` : m;
  });
  return out.join(' ') + (moves.length > from + upTo ? ' …' : '');
}
const keyOf = st => st.b.map(p => p || '.').join('') + (st.white ? 'w' : 'b');
const opElo = () => Math.max(100, Math.min(3000, Math.round(+$('opElo').value) || 550));
function loadOpenings() {
  if (OPS) return Promise.resolve(OPS);
  return fetch('data/openings.json').then(r => r.json()).then(d => {
    OPS = d; OPS.family = d.name.map(familyOf); OPS.split = d.moves.map(m => m.split(' '));
    // each line as moves (from-to) and as its final position, to recognise it whatever the move order
    OPS.ids = []; OPS.final = []; OPS.finalKey = [];
    for (const line of OPS.split) {
      let st = CH.fromFEN(PUZZLES[0].fen, true); const ids = [];
      for (const san of line) { const m = CH.findSan(st, san); ids.push(moveId(m)); st = CH.make(st, m); }
      OPS.ids.push(ids); OPS.final.push(st.b); OPS.finalKey.push(keyOf(st));
    }
    OPS.byMoves = new Map(d.moves.map((m, i) => [m, i]));
    return d;
  });
}
// of some lines of one family, the one to follow: chosen above, or the one that stays longest on their busiest path
function mainOf(f, list, track) {
  const want = OP_MAIN[f] && OPS.byMoves.get(OP_MAIN[f]);
  if (want !== undefined && list.includes(want)) return want;
  if (track && list.some(i => track.has(i))) list = list.filter(i => track.has(i));
  const count = new Map();
  for (const i of list) for (let p = 1; p <= OPS.split[i].length; p++) { const k = OPS.split[i].slice(0, p).join(' '); count.set(k, (count.get(k) || 0) + 1); }
  let best = list[0], bs = -1;
  for (const i of list) {
    const m = OPS.split[i]; if (m.length > 16) continue;
    let sc = /: Main Line$/.test(OPS.name[i]) ? 2 : 0;
    for (let p = 1; p <= m.length; p++) sc += count.get(m.slice(0, p).join(' ')) / list.length;
    if (sc > bs) { bs = sc; best = i; }
  }
  return best;
}
// --- where the game stands: the positions it went through, the opening reached, the ones still possible ---
// A line is still possible while every move played so far, by each side, is one of that line's moves for that
// side, in any order: 1.d4 d5 2.Bf4 e6 still becomes the London lines that play Nf3 before Bf4. The opening
// reached is the longest line whose final position the game has passed through.
function exploreState() {
  const g = game, moves = g && (g.pz.explore || g.pz.name === 'Openings') ? (g.moves || []) : [];
  const sig = moves.map(moveId).join(',');
  if (exCache && exCache.sig === sig) return exCache;
  let st = CH.fromFEN(PUZZLES[0].fen, true); const seen = new Set([keyOf(st)]);
  for (const m of moves) { st = CH.make(st, m); seen.add(keyOf(st)); }
  const played = [new Map(), new Map()];   // White's moves, Black's moves: how many times each
  moves.forEach((m, p) => { const k = moveId(m), c = played[p % 2]; c.set(k, (c.get(k) || 0) + 1); });
  const n = moves.length, possible = [], left = new Map(), track = new Set();
  let reached = -1;
  for (let i = 0; i < OPS.name.length; i++) {
    if (seen.has(OPS.finalKey[i]) && (reached < 0 || OPS.split[i].length >= OPS.split[reached].length)) reached = i;
    if (OPS.split[i].length <= n) continue;
    const use = [new Map(played[0]), new Map(played[1])], todo = [];
    OPS.ids[i].forEach((k, p) => { const c = use[p % 2]; if (c.get(k)) c.set(k, c.get(k) - 1); else todo.push(p); });
    if (todo.length && [...use[0].values(), ...use[1].values()].every(v => v === 0)) {
      possible.push(i); left.set(i, todo);
      if (todo[0] >= n) track.add(i);   // the line's own first moves are the ones played: the same move order
    }
  }
  return (exCache = { sig, n, possible, set: new Set(possible), left, track, reached });
}
const stillOn = (i, s) => i >= 0 && s.set.has(i);
// the next move of the followed line for the side to move: its first move not played yet that is legal now
function lineMove(i, s, st) {
  if (!stillOn(i, s)) return null;
  const side = st.white ? 0 : 1, L = CH.legal(st);
  for (const p of s.left.get(i)) {
    if (p % 2 !== side) continue;
    const m = L.find(x => moveId(x) === OPS.ids[i][p]);
    if (m) return m;
  }
  return null;
}
function bookReply(g) {
  if (!$('exAlong').checked || !OPS) return null;
  return lineMove(exPick, exploreState(), g.st);
}
// --- the panel ---
function exploreRefresh() {
  if (!OPS || mode !== 'openings') return;
  const s = exploreState(), g = game, inGame = !!(g && g.pz.explore);
  if (exPick >= 0 && !stillOn(exPick, s)) { exPick = -1; }
  $('opSide').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.side === opSide));
  $('exNowName').textContent = s.reached >= 0 ? `${OPS.name[s.reached]} (${OPS.eco[s.reached]})` : s.n ? 'No named opening yet' : 'Starting position';
  $('exNowMoves').textContent = s.n ? movesText(g.history) : inGame ? 'Pick an opening below: its ghosts show where your pieces go.' : 'Press New game, then pick an opening below: its ghosts show where your pieces go.';
  if (!s.possible.length && s.n) $('exNowMoves').textContent += ' · out of the book: no named opening goes on from here.';
  // the line you follow, and its next move for you
  $('exPick').hidden = exPick < 0;
  if (exPick >= 0) {
    const st = g ? g.st : CH.fromFEN(PUZZLES[0].fen, true), yours = (s.n % 2 === 0) === (opSide === 'w'), m = lineMove(exPick, s, st);
    $('exPickName').textContent = OPS.name[exPick];
    const mine = s.left.get(exPick).filter(p => (p % 2 === 0) === (opSide === 'w')).map(p => OPS.split[exPick][p]);
    $('exPickMoves').textContent = movesText(OPS.split[exPick]) + (mine.length ? `  ·  yours still to play: ${mine.join(', ')}` : '');
    const can = inGame && g.phase === 'user' && g.view === null && yours && m;
    $('exPlay').hidden = !inGame || !yours;
    $('exPlay').disabled = !can;
    $('exPlay').textContent = m && yours ? `Play ${(s.n >> 1) + 1}${s.n % 2 ? '...' : '.'}${CH.san(st, m)}` : 'Play';
  }
  renderList(s);
}
function renderList(s) {
  const q = $('opAdv').checked ? $('opSearch').value.trim().toLowerCase() : '';
  const words = q ? q.split(/\s+/).map(w => w.replace(/^\d+\.+/, '')) : [];
  const list = s.possible.filter(i => !words.length || words.every(w => (OPS.name[i] + ' ' + OPS.eco[i] + ' ' + OPS.moves[i]).toLowerCase().includes(w)));
  const fam = {};
  for (const i of list) (fam[OPS.family[i]] = fam[OPS.family[i]] || []).push(i);
  // first the families that go on in the move order played, then those reached by another order
  const onTrack = f => fam[f].some(i => s.track.has(i));
  const fams = Object.keys(fam).sort((a, b) => onTrack(b) - onTrack(a) || fam[b].length - fam[a].length || a.localeCompare(b));
  const near = fams.filter(onTrack).length, far = fams.length - near;
  $('exCount').textContent = `${near} famil${near === 1 ? 'y' : 'ies'}` + (far ? `, and ${far} by another move order` : '');
  const sig = s.sig + '|' + q + '|' + exPick + '|' + exFamily + '|' + $('opAdv').checked;
  if ($('opList').dataset.sig === sig) return;   // nothing changed: keep the scroll where it is
  $('opList').dataset.sig = sig;
  let html = '';
  fams.forEach((f, k) => {
    if (k === near && near < fams.length) html += '<p class="op-div">By another move order</p>';
    const L = fam[f], on = exPick >= 0 && OPS.family[exPick] === f, open = $('opAdv').checked && (exFamily === f || words.length);
    const main = mainOf(f, L, s.track);
    html += `<button class="op-row${on && !open ? ' on' : ''}" type="button" data-fam="${esc(f)}"><span class="n">${L.length}</span>${$('opAdv').checked ? `<span class="fam-open">${open ? '▾' : '▸'}</span> ` : ''}${esc(f)}<small>${movesText(OPS.split[main], 0, 8)}</small></button>`;
    if (open) html += L.slice().sort((a, b) => OPS.split[a].length - OPS.split[b].length || OPS.name[a].localeCompare(OPS.name[b])).slice(0, 80).map(i => {
      const short = OPS.name[i].startsWith(f + ':') ? OPS.name[i].slice(f.length + 1).trim() : OPS.name[i];
      return `<button class="op-row sub${i === exPick ? ' on' : ''}" type="button" data-op="${i}"><span class="n">${OPS.eco[i]}</span>${esc(short)}<small>${movesText(OPS.split[i], 0, 8)}</small></button>`;
    }).join('');
  });
  $('opList').innerHTML = html || '<p class="op-empty">No named opening goes on from this position.</p>';
}
// --- choices ---
function showOpenings() {
  $('exCount').textContent = 'loading…';
  loadOpenings().then(() => { exCache = null; if (!(game && game.pz.explore)) request('start'); else exploreRefresh(); })
    .catch(e => { console.error(e); $('opList').innerHTML = '<p class="op-empty">The list of openings could not be loaded.</p>'; });
}
function openingFor(key) {
  if (key === 'start') return { ...PUZZLES[0], player: opSide, name: 'Openings', desc: 'Choose your colour and Stockfish’s Elo, then press New game.' };
  const elo = opElo();
  return { name: 'Opening practice', desc: `You play ${opSide === 'w' ? 'White' : 'Black'} against Stockfish at Elo ${elo}. Pick an opening on the right to see its ghosts.`,
    fen: PUZZLES[0].fen, explore: true, bot: { elo, human: opSide } };
}
$('opStart').addEventListener('click', () => {
  if (!OPS) return;
  if (game && game.pz.explore && game.history.length && game.phase !== 'done' && !confirm('Leave this game for a new one?')) return;
  $('botElo').value = opElo(); saveElo(opElo()); exCache = null;
  request('opgame');
});
$('opSide').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.dataset.side === opSide) return;
  // your colour always at the bottom: before a game the board turns, during one a new game starts with that colour
  const g = game, playing = g && g.pz.explore && g.phase !== 'done';
  if (playing && g.history.length > 2 && !confirm(`Start a new game as ${b.dataset.side === 'w' ? 'White' : 'Black'}?`)) return;
  opSide = b.dataset.side; store('robo-opside', opSide);
  if (playing) { $('botElo').value = opElo(); saveElo(opElo()); exCache = null; request('opgame'); } else request('start');
});
$('opList').addEventListener('click', e => {
  const b = e.target.closest('.op-row'); if (!b) return;
  const s = exploreState();
  if (b.dataset.op) exPick = +b.dataset.op;
  else {
    const f = b.dataset.fam;
    exFamily = $('opAdv').checked && exFamily === f ? null : f;
    exPick = mainOf(f, s.possible.filter(i => OPS.family[i] === f), s.track);
  }
  exploreRefresh();
});
$('exPlay').addEventListener('click', () => {
  const g = game; if (!g || !g.pz.explore || g.phase !== 'user' || anim) return;
  const m = lineMove(exPick, exploreState(), g.st); if (m) moveOrAsk([m]);
});
$('exDrop').addEventListener('click', () => { exPick = -1; exploreRefresh(); });
$('opSearch').addEventListener('input', () => { $('opList').scrollTop = 0; exploreRefresh(); });
$('opAdv').addEventListener('change', () => { store('robo-opadv', $('opAdv').checked ? '1' : '0'); $('opSearch').hidden = !$('opAdv').checked; exploreRefresh(); });
$('opSearch').hidden = !$('opAdv').checked;
$('exAlong').addEventListener('change', () => store('robo-exalong', $('exAlong').checked ? '1' : '0'));
$('opGhosts').addEventListener('change', () => store('robo-opghosts', $('opGhosts').value));
$('opElo').addEventListener('change', () => { $('opElo').value = opElo(); store('robo-opelo', $('opElo').value); });
// faint ghosts where your pieces are going on the followed line, a stronger one with a ring for your next move
function drawGhosts(g) {
  if (!OPS || mode !== 'openings' || exPick < 0 || g.view !== null || g.result || !(g.pz.explore || g.pz.name === 'Openings')) return;
  const s = exploreState(); if (!stillOn(exPick, s)) return;
  const how = $('opGhosts').value, b = g.st.b, white = opSide === 'w', final = OPS.final[exPick];
  const mine = p => p && (p === p.toUpperCase()) === white;
  const ghost = (sq, t, a) => {
    pieceAlpha = a; ctx.globalAlpha = a;
    drawPiece({ t, white: t === t.toUpperCase() }, { x: TRAY_W + (sq & 7) + 0.5, y: (sq >> 3) + 0.5 }, 0);
    pieceAlpha = 1; ctx.globalAlpha = 1;
  };
  const next = g.st.white === white ? lineMove(exPick, s, g.st) : null;
  // Black's pieces are dark on dark squares too: a little less transparent, and every ghost gets a dotted outline
  if (how === 'all') final.forEach((t, sq) => {
    if (!mine(t) || b[sq] === t || (next && next.to === sq)) return;
    ghost(sq, t, white ? 0.3 : 0.42);
    ctx.strokeStyle = tok['--muted']; ctx.globalAlpha = 0.7; ctx.lineWidth = 0.025; ctx.setLineDash([0.05, 0.06]);
    ctx.beginPath(); ctx.arc(sqX(sq), sqY(sq), 0.44, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  });
  if (next && how !== 'off') {
    ghost(next.to, b[next.from], 0.62);
    ctx.strokeStyle = tok['--accent']; ctx.lineWidth = 0.05; ctx.setLineDash([0.1, 0.07]);
    ctx.beginPath(); ctx.arc(sqX(next.to), sqY(next.to), 0.47, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(sqX(next.from), sqY(next.from), 0.47, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
}
