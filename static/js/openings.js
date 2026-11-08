// =================== openings: pick one, and play it with ghosts showing where your pieces go ===================
// The 3,865 named openings of lichess-org/chess-openings (CC0), taken from chess-analysis-board by
// tools/openings/build.js. You play one side, the robot plays the other side's book moves, and a wrong
// move is refused. Loaded after app.js, whose functions and state it uses.
let OPS = null, opFamily = null, opCurrent = -1, opBotPz = null;
const OP_POPULAR = ['Italian Game', 'Ruy Lopez', 'Scotch Game', 'Sicilian Defense', 'French Defense', 'Caro-Kann Defense', 'Scandinavian Defense',
  "Queen's Gambit Declined", 'Slav Defense', "King's Indian Defense", 'London System', 'English Opening'];
const opDone = new Set();
try { JSON.parse(localStorage.getItem('robo-openings') || '[]').forEach(k => opDone.add(k)); } catch (e) {}
try { const f = localStorage.getItem('robo-opfamily'); if (f) opFamily = f; } catch (e) {}
try { const v = localStorage.getItem('robo-opghosts'); if (v) $('opGhosts').value = v; } catch (e) {}
try { const v = localStorage.getItem('robo-opcolor'); if (v) $('opColor').value = v; } catch (e) {}
const opId = i => OPS.eco[i] + ' ' + OPS.moves[i];   // names repeat with other move orders; the moves do not
const opFamilyOf = name => name.split(/[:,]/)[0].trim();
function opMovesText(moves, upTo = 99) {
  return moves.slice(0, upTo).map((m, k) => (k % 2 ? '' : (k / 2 + 1) + '.') + m).join(' ') + (moves.length > upTo ? ' …' : '');
}
// a defence is learnt with Black, everything else with White, unless you choose
function opPlayer(i) {
  const c = $('opColor').value;
  return c === 'w' || c === 'b' ? c : /Defen[cs]e|Countergambit|Counterattack/.test(OPS.family[i]) ? 'b' : 'w';
}
function loadOpenings() {
  if (OPS) return Promise.resolve(OPS);
  return fetch('data/openings.json').then(r => r.json()).then(d => {
    OPS = d; OPS.family = d.name.map(opFamilyOf); OPS.split = d.moves.map(m => m.split(' '));
    OPS.families = {};
    d.name.forEach((n, i) => (OPS.families[OPS.family[i]] = OPS.families[OPS.family[i]] || []).push(i));
    return d;
  });
}
function showOpenings() {
  $('opList').innerHTML = '<p class="op-empty">Loading the openings…</p>';
  loadOpenings().then(() => {
    renderOpenings();
    if (opCurrent >= 0) request('op' + opCurrent); else request('start');
  }).catch(e => { console.error(e); $('opList').innerHTML = '<p class="op-empty">The list of openings could not be loaded.</p>'; });
}
function openingFor(key) {
  if (key === 'botop') return opBotPz;
  if (key === 'start') return { ...PUZZLES[0], name: 'Pick an opening', desc: 'Choose one on the right. Ghosts on the board show where your pieces are going.' };
  const i = +key.slice(2), moves = OPS.split[i], player = opPlayer(i), yours = moves.filter((m, k) => (k % 2 === 0) === (player === 'w')).length;
  return { name: OPS.name[i], desc: `${OPS.eco[i]} · ${yours} move${yours === 1 ? '' : 's'} for you · you play ${player === 'w' ? 'White' : 'Black'}, the robot the other side.`,
    fen: PUZZLES[0].fen, op: { i, moves, player }, player };
}
// --- the list on the right: families, the openings of one family, or what a search finds ---
function opRow(i, short) {
  const done = opDone.has(opId(i)), name = short && OPS.name[i].startsWith(OPS.family[i] + ':') ? OPS.name[i].slice(OPS.family[i].length + 1).trim() : OPS.name[i];
  return `<button class="op-row${i === opCurrent ? ' on' : ''}" type="button" data-op="${i}" title="${opMovesText(OPS.split[i])}">`
    + `<span class="n">${OPS.eco[i]}${done ? ' <span class="ok">✓</span>' : ''}</span>${esc(name)}<small>${opMovesText(OPS.split[i], 8)}</small></button>`;
}
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function renderOpenings() {
  if (!OPS) return;
  const q = $('opSearch').value.trim().toLowerCase();
  $('opChips').innerHTML = OP_POPULAR.filter(f => OPS.families[f]).map(f => `<button class="op-chip${f === opFamily && !q ? ' on' : ''}" type="button" data-fam="${esc(f)}">${esc(f)}</button>`).join('');
  let html = '';
  if (q) {
    // every word must be found in the name, the ECO code or the moves
    const words = q.split(/\s+/), hits = [];
    for (let i = 0; i < OPS.name.length && hits.length < 150; i++) {
      const hay = (OPS.name[i] + ' ' + OPS.eco[i] + ' ' + OPS.moves[i]).toLowerCase();
      if (words.every(w => hay.includes(w.replace(/^\d+\.+/, '')))) hits.push(i);
    }
    html = hits.length ? hits.map(i => opRow(i, false)).join('') + (hits.length === 150 ? '<p class="op-empty">Only the first 150: type more to narrow it down.</p>' : '')
      : '<p class="op-empty">No opening matches.</p>';
  } else if (opFamily && OPS.families[opFamily]) {
    const list = OPS.families[opFamily].slice().sort((a, b) => OPS.split[a].length - OPS.split[b].length || OPS.name[a].localeCompare(OPS.name[b]));
    const done = list.filter(i => opDone.has(opId(i))).length;
    html = `<button class="op-row op-back" type="button" data-back="1">← All openings <span class="n">${done}/${list.length}</span></button>` + list.map(i => opRow(i, true)).join('');
  } else {
    const fams = Object.keys(OPS.families).sort((a, b) => OPS.families[b].length - OPS.families[a].length || a.localeCompare(b));
    html = fams.map(f => {
      const list = OPS.families[f], done = list.filter(i => opDone.has(opId(i))).length, first = list.reduce((a, b) => OPS.split[b].length < OPS.split[a].length ? b : a);
      return `<button class="op-row" type="button" data-fam="${esc(f)}"><span class="n">${done ? `<span class="ok">${done}</span>/` : ''}${list.length}</span>${esc(f)}<small>${opMovesText(OPS.split[first], 6)}</small></button>`;
    }).join('');
  }
  $('opList').innerHTML = html;
  $('opCount').textContent = `· ${OPS.name.length.toLocaleString('en')}`;
  const on = $('opList').querySelector('.op-row.on'); if (on) on.scrollIntoView({ block: 'nearest' });
}
function setFamily(f) { opFamily = f; try { if (f) localStorage.setItem('robo-opfamily', f); else localStorage.removeItem('robo-opfamily'); } catch (e) {} $('opList').scrollTop = 0; renderOpenings(); }
$('opList').addEventListener('click', e => {
  const b = e.target.closest('.op-row'); if (!b) return;
  if (b.dataset.back) { setFamily(null); return; }
  if (b.dataset.fam) { setFamily(b.dataset.fam); return; }
  opCurrent = +b.dataset.op; renderOpenings(); request('op' + opCurrent);
});
$('opChips').addEventListener('click', e => { const b = e.target.closest('.op-chip'); if (!b) return; $('opSearch').value = ''; setFamily(b.dataset.fam); });
$('opSearch').addEventListener('input', () => { $('opList').scrollTop = 0; renderOpenings(); });
$('opColor').addEventListener('change', () => { try { localStorage.setItem('robo-opcolor', $('opColor').value); } catch (e) {} if (game && game.op) request('op' + opCurrent); });
$('opGhosts').addEventListener('change', () => { try { localStorage.setItem('robo-opghosts', $('opGhosts').value); } catch (e) {} });
// --- practising: the robot plays the other side's book moves, and only the book move is taken ---
const opYourTurn = g => g.st.white === (g.op.player === 'w');
function startOpening(g) {
  const pz = g.pz;
  let st = startSt(pz);
  for (const san of pz.op.moves) st = CH.make(st, CH.findSan(st, san));
  g.op = { ...pz.op, final: st.b, misses: 0, missAt: -1 };
  opCurrent = pz.op.i; renderOpenings();
  $('gMode').textContent = `You play ${pz.op.player === 'w' ? 'White' : 'Black'} · the robot plays the book`;
  if (!opYourTurn(g)) openingNext(g);
}
function openingNext(g) {
  const o = g.op, i = g.history.length;
  if (i >= o.moves.length) {
    g.result = 'win'; g.phase = 'done';
    g.winMsg = `${g.pz.name}: learnt. ` + (o.misses ? `${o.misses} wrong ${o.misses === 1 ? 'try' : 'tries'} on the way.` : 'Not one wrong move!');
    refreshGame(); return;
  }
  if (opYourTurn(g)) { g.phase = 'user'; refreshGame(); return; }
  g.phase = 'robot'; refreshGame();
  setTimeout(() => { if (game === g && g.phase === 'robot') playMove(CH.findSan(g.st, o.moves[i])); }, 350);
}
function openingMove(g) { const i = g.history.length; return i < g.op.moves.length ? CH.findSan(g.st, g.op.moves[i]) : null; }
function openingAccepts(g, m) {
  const want = openingMove(g);
  if (want && want.from === m.from && want.to === m.to && (want.promo || '') === (m.promo || '')) { g.op.missAt = -1; return true; }
  g.op.misses++; g.op.missAt = g.history.length; g.sel = -1;
  g.note = { text: `Not the move of this opening. The ghost shows where to go.`, until: performance.now() + 2600 };
  refreshGame(); setTimeout(() => { if (game === g) refreshGame(); }, 2700);
  return false;
}
function cheerOpening(g) {
  const fresh = !opDone.has(opId(g.op.i));
  opDone.add(opId(g.op.i));
  try { localStorage.setItem('robo-openings', JSON.stringify([...opDone])); } catch (e) {}
  renderOpenings();
  celebrate(fresh ? 'Opening learnt!' : 'Played again!', g.op.misses ? `${g.op.misses} wrong ${g.op.misses === 1 ? 'try' : 'tries'}` : 'Not one wrong move');
}
// faint ghosts where your pieces are going, a stronger one with a ring for your next move
function drawGhosts(g) {
  if (!g.op || g.view !== null || g.result) return;
  const how = $('opGhosts').value, o = g.op, b = g.st.b, white = o.player === 'w';
  const mine = p => p && (p === p.toUpperCase()) === white;
  const ghost = (sq, t, a) => {
    pieceAlpha = a; ctx.globalAlpha = a;
    drawPiece({ t, white: t === t.toUpperCase() }, { x: TRAY_W + (sq & 7) + 0.5, y: (sq >> 3) + 0.5 }, 0);
    pieceAlpha = 1; ctx.globalAlpha = 1;
  };
  const next = opYourTurn(g) ? openingMove(g) : null;
  // Black's pieces are dark on dark squares too: a little less transparent, and every ghost gets a dotted outline
  if (how === 'all') o.final.forEach((t, sq) => {
    if (!mine(t) || b[sq] === t || (next && next.to === sq)) return;
    ghost(sq, t, white ? 0.3 : 0.42);
    ctx.strokeStyle = tok['--muted']; ctx.globalAlpha = 0.7; ctx.lineWidth = 0.025; ctx.setLineDash([0.05, 0.06]);
    ctx.beginPath(); ctx.arc(sqX(sq), sqY(sq), 0.44, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  });
  if (next && (how !== 'off' || o.missAt === g.history.length)) {
    ghost(next.to, b[next.from], 0.62);
    ctx.strokeStyle = tok['--accent']; ctx.lineWidth = 0.05; ctx.setLineDash([0.1, 0.07]);
    ctx.beginPath(); ctx.arc(sqX(next.to), sqY(next.to), 0.47, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(sqX(next.from), sqY(next.from), 0.47, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
}
// learnt: go on from here against Stockfish, at the Elo set under Play Stockfish
$('gOpPlay').addEventListener('click', () => {
  const g = game; if (!g || !g.op || anim) return;
  const elo = Math.max(100, Math.min(3000, Math.round(+$('botElo').value) || 550)), human = g.op.player;
  opBotPz = { name: 'Playing Stockfish', desc: `From the ${g.pz.name}. Elo ${elo}. You play ${human === 'w' ? 'White' : 'Black'}.`,
    fen: fenOf(g.st).split(' ')[0], st0: g.st, side: g.st.white ? 'w' : 'b', bot: { elo, human } };
  request('botop');
});
