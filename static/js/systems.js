// =================== systems: one setup of your pieces, played against whatever Stockfish does ===================
// A named opening depends on both players' moves; a system is a setup you build almost whatever the other side
// plays. Ghosts show the setup. On each of your turns Stockfish at full strength looks twice: for the best of the
// setup moves, and for the best move at all. If the setup move costs little, a green arrow shows it; if it would
// lose something, an orange arrow shows what to play first. Notes explain the usual deviations, and once the
// setup stands, the plan takes over. Loaded after openings.js, whose state and helpers it uses.
let exKind = 'named', sysId = 'london';
// setup and plan: a piece letter and a target square, or O-O; for Black, Black's own squares
const SYSTEMS = [
  { id: 'london', name: 'London System', color: 'w',
    setup: ['Pd4', 'Bf4', 'Pe3', 'Nf3', 'Pc3', 'Nd2', 'Bd3', 'O-O'], plan: ['Ne5', 'Qe2', 'Pe4'],
    idea: 'The most played system at club level: pawns on d4, e3 and c3 make a solid triangle, and the dark bishop goes out to f4 before e3 closes it in.',
    plans: 'Then Ne5 and Qf3 or Qe2, sometimes f4 for a kingside attack, or e4 to open the centre.' },
  { id: 'colle-z', name: 'Colle-Zukertort System', color: 'w',
    setup: ['Pd4', 'Nf3', 'Pe3', 'Bd3', 'Pb3', 'Bb2', 'Nd2', 'O-O'], plan: ['Ne5', 'Pf4', 'Qf3'],
    idea: 'Two bishops aimed at the black king: the one on d3 at h7, the one on b2 down the long diagonal. Named after Edgar Colle and Johannes Zukertort.',
    plans: 'Then Ne5, f4 and a kingside attack (Rf3–h3, Qf3), or c4 and dxc5 to open the long diagonal for the b2 bishop.' },
  { id: 'colle-k', name: 'Colle-Koltanowski System', color: 'w',
    setup: ['Pd4', 'Nf3', 'Pe3', 'Bd3', 'Pc3', 'Nd2', 'O-O'], plan: ['Qe2', 'Re1', 'Pe4'],
    idea: 'The Colle with c3 instead of b3: the queen\'s bishop stays at home for now, and everything prepares the push e4.',
    plans: 'Then Re1 or Qe2 and e4: the centre opens with your pieces already in place.' },
  { id: 'torre', name: 'Torre Attack', color: 'w',
    setup: ['Pd4', 'Nf3', 'Bg5', 'Pe3', 'Nd2', 'Pc3', 'Bd3', 'O-O'], plan: ['Qe2', 'Pe4'],
    idea: 'Like the London, but the bishop goes to g5, where it pins or harasses the black knight on f6.',
    plans: 'Then Qe2 and e4, or Bxf6 when it damages Black\'s pawns.' },
  { id: 'jobava', name: 'Jobava London', color: 'w',
    setup: ['Pd4', 'Nc3', 'Bf4', 'Pe3', 'Nf3', 'Bd3', 'O-O'], plan: ['Nb5', 'Qe2', 'Pe4'],
    idea: 'An aggressive London: the knight comes to c3 instead of the pawn, ready to jump to b5 and hit c7.',
    plans: 'Then Nb5 against c7, Qe2 and e4; strong players often castle long and push h4.' },
  { id: 'stonewall-a', name: 'Stonewall Attack', color: 'w',
    setup: ['Pd4', 'Pe3', 'Bd3', 'Pf4', 'Pc3', 'Nf3', 'Nd2', 'O-O'], plan: ['Ne5', 'Qf3', 'Rf3'],
    idea: 'Pawns on c3, d4, e3 and f4 make a wall; the knight sits on e5 and the pieces swing to the king\'s side.',
    plans: 'Then Ne5, Qf3 or Rf3–h3, sometimes g4: a direct attack on the castled king.' },
  { id: 'kia', name: 'King\'s Indian Attack', color: 'w', mine: true,
    setup: ['Nf3', 'Pg3', 'Bg2', 'O-O', 'Pd3', 'Nd2', 'Pe4', 'Re1'], plan: ['Pe5', 'Pc3', 'Ph4'],
    idea: 'The King\'s Indian played with the White pieces and an extra move: knight f3, fianchetto, castle, then d3 and e4.',
    plans: 'Then e5 to gain space, Nf1–h2–g4 or h4 and a kingside attack; against ...d5 and ...c5 this is the main line.' },
  { id: 'kid', name: 'King\'s Indian / Pirc setup', color: 'b', mine: true,
    setup: ['Nf6', 'Pg6', 'Bg7', 'O-O', 'Pd6', 'Nd7'], plan: ['Pe5', 'Pc5', 'Re8'],
    idea: 'Knight f6, fianchetto, castle, pawn d6: the same setup against almost anything. Against 1.d4 it is the King\'s Indian, against 1.e4 the Pirc.',
    plans: 'Then strike the centre with ...e5 (the classical way) or ...c5.' },
  { id: 'caro-slav', name: 'Caro-Kann / Slav', color: 'b',
    setup: ['Pc6', 'Pd5', 'Bf5', 'Pe6', 'Nf6', 'Nd7', 'Be7', 'O-O'], plan: ['Pc5', 'Qc7'],
    idea: 'Pawns on c6 and d5, and the light bishop out to f5 before ...e6 shuts it in. Against 1.e4 it is the Caro-Kann, against 1.d4 the Slav: the same squares.',
    plans: 'Then ...c5 to hit White\'s centre, ...Qc7 and the rooks to the middle.' },
  { id: 'hippo', name: 'Hippopotamus', color: 'b',
    setup: ['Pg6', 'Bg7', 'Pb6', 'Bb7', 'Pe6', 'Pd6', 'Nd7', 'Ne7', 'Ph6', 'Pa6'], plan: ['Pc5', 'Pf5', 'Pe5'],
    idea: 'Every pawn one step forward on the third rank, both bishops fianchettoed, knights behind: odd-looking, but very hard to break.',
    plans: 'Wait until White commits, then break with ...c5, ...f5 or ...e5.' },
  { id: 'stonewall-d', name: 'Stonewall Dutch', color: 'b',
    setup: ['Pf5', 'Pe6', 'Pd5', 'Pc6', 'Nf6', 'Bd6', 'O-O', 'Qe7'], plan: ['Ne4', 'Nd7'],
    idea: 'Pawns on c6, d5, e6 and f5 hold e4; the knight lands there and the pieces swing to the king\'s side. An answer to 1.d4 or 1.c4.',
    plans: 'Then ...Ne4, ...Nd7 and ...Rf6–h6 or ...g5 for an attack.' },
];
const sqIdx = name => (8 - +name[1]) * 8 + 'abcdefgh'.indexOf(name[0]);
const sqName = i => 'abcdefgh'[i & 7] + (8 - (i >> 3));
const at = (b, name) => b[sqIdx(name)];
// notes for the usual deviations; each looks at the board: White's pieces upper case, Black's lower case
const SYS_NOTES = {
  white: [
    [(b, s) => at(b, 'f5') === 'b' && s.setup.includes('Bd3') && at(b, 'd3') !== 'B', 'Black\'s light bishop came out to f5 before ...e6: put yours on d3 to trade it off, or it rules the b1–h7 diagonal.'],
    [b => at(b, 'g4') === 'b' && at(b, 'f3') === 'N', '...Bg4 pins your knight: h3 asks the bishop to decide; if it takes on f3, take back with the queen or the d2 knight.'],
  ],
  london: [
    [b => at(b, 'b6') === 'q' && at(b, 'f4') === 'B', '...Qb6 hits b2, which your bishop left: Qb3 offers a queen trade, Qc1 or Qc2 protects.'],
    [b => at(b, 'h5') === 'n' && at(b, 'f4') === 'B', '...Nh5 goes for your bishop: Bg3 or Be5 keeps it; with h3 played early it would have h2 to go back to.'],
  ],
  'colle-z': [[b => at(b, 'g7') === 'b' && at(b, 'g6') === 'p', 'Black has fianchettoed: Ne5 and f4 hit a wall. Aim for c4 or e4 in the centre instead.']],
  jobava: [[b => at(b, 'b6') === 'q' && at(b, 'f4') === 'B', '...Qb6 hits b2: Rb1 or Qc1, or the gambit Nb5 if you like it sharp.']],
  kia: [[b => at(b, 'd5') === 'p' && at(b, 'c5') === 'p', 'Black took the centre with ...d5 and ...c5: the main line. Finish the setup, then push e5 and attack on the king\'s side.']],
  kid: [
    [b => at(b, 'c4') === 'P' && at(b, 'd4') === 'P' && at(b, 'e4') === 'P', 'White has the big centre (c4, d4, e4): finish the setup, then strike with ...e5, the classical King\'s Indian.'],
    [b => at(b, 'e4') === 'P' && at(b, 'c4') !== 'P', 'Against 1.e4 the same setup is the Pirc: ...e5 or ...c5 later still hit the centre.'],
  ],
  'caro-slav': [
    [b => at(b, 'b3') === 'Q' && at(b, 'f5') === 'b', 'Qb3 hits b7, which your bishop left: ...Qb6 or ...Qc7 covers it.'],
    [b => at(b, 'e5') === 'P' && at(b, 'd5') === 'p', 'White closed the centre with e5 (the Advance): bishop to f5 first, then ...e6 and ...c5 hit the chain.'],
    [b => at(b, 'c4') === 'P' && at(b, 'd4') === 'P', 'Against 1.d4 and c4 this is the Slav: the same squares.'],
  ],
  'stonewall-d': [[b => at(b, 'e4') === 'P', 'The Stonewall Dutch answers 1.d4 or 1.c4. Against 1.e4 the ...f5 push is a gamble: start a new game with the Caro-Kann or the King\'s Indian setup.']],
};
const sysOf = id => SYSTEMS.find(s => s.id === id) || SYSTEMS[0];
const store2 = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
try { const v = localStorage.getItem('robo-exkind'); if (v === 'sys') exKind = 'sys'; } catch (e) {}
try { const v = localStorage.getItem('robo-sys'); if (v && SYSTEMS.some(s => s.id === v)) sysId = v; } catch (e) {}
// --- the setup on the board ---
function targetsOf(sys, list) {   // [{ type: 'B', sq: index, castle? }]
  const white = sys.color === 'w';
  return list.map(t => t === 'O-O' ? { castle: true } : { type: white ? t[0] : t[0].toLowerCase(), sq: sqIdx(t.slice(1)) });
}
const castled = (b, white) => b[sqIdx(white ? 'g1' : 'g8')] === (white ? 'K' : 'k');
const placed = (b, t, white) => t.castle ? castled(b, white) : b[t.sq] === t.type;
// the setup as it stands: each target placed, still to do, or gone (its piece was traded or taken, so it can not come)
function setupState(b, sys) {
  const white = sys.color === 'w', T = targetsOf(sys, sys.setup);
  T.forEach(t => { t.placed = placed(b, t, white); t.gone = false; });
  // a bishop keeps the colour of its squares: one on light squares can never reach b2
  const shade = sq => ((sq >> 3) + (sq & 7)) % 2, keyOf = (ty, sq) => ty.toUpperCase() === 'B' ? ty + shade(sq) : ty;
  const keys = [...new Set(T.filter(t => !t.castle).map(t => keyOf(t.type, t.sq)))];
  for (const key of keys) {
    const mineT = T.filter(t => !t.castle && keyOf(t.type, t.sq) === key), have = b.filter((p, sq) => p && keyOf(p, sq) === key).length;
    let spare = have - mineT.filter(t => t.placed).length;
    for (const t of mineT) if (!t.placed) { if (spare > 0) spare--; else t.gone = true; }
  }
  const kingHome = b[sqIdx(white ? 'e1' : 'e8')] === (white ? 'K' : 'k');
  T.forEach(t => { if (t.castle && !t.placed && !kingHome) t.gone = true; });   // the king moved: no castling any more
  return T;
}
// legal moves that put a piece of the right kind on a target still empty, without taking one off its own target
function setupMoves(st, sys, list) {
  const white = sys.color === 'w', T = targetsOf(sys, list);
  const fixed = new Set(T.filter(t => !t.castle && st.b[t.sq] === t.type).map(t => t.sq));
  return CH.legal(st).filter(m => {
    if (fixed.has(m.from)) return false;
    if (m.castle) return m.to === sqIdx(white ? 'g1' : 'g8') && T.some(t => t.castle) && !castled(st.b, white);
    return T.some(t => !t.castle && t.sq === m.to && st.b[m.from] === t.type && st.b[m.to] !== t.type);
  });
}
// --- the panel ---
function setKind(k) {
  exKind = k; store2('robo-exkind', k);
  $('exKind').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.kind === k));
  $('exSys').hidden = k !== 'sys'; $('exNamed').hidden = k === 'sys';
  if (k === 'sys' && sysOf(sysId).color !== opSide) { opSide = sysOf(sysId).color; store2('robo-opside', opSide); }
  $('opSide').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.side === opSide));
}
$('exKind').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.dataset.kind === exKind) return;
  const g = game;
  if (g && (g.pz.explore || g.pz.system) && g.history.length > 2 && g.phase !== 'done' && !confirm('Leave this game?')) return;
  setKind(b.dataset.kind);
  if (b.dataset.kind === 'named') showOpenings(); else request('start');
});
function systemSideChanged() { if (sysOf(sysId).color !== opSide) sysId = SYSTEMS.find(s => s.color === opSide).id; store2('robo-sys', sysId); }
function systemPuzzle() {
  const sys = sysOf(sysId), elo = opElo();
  return { name: sys.name, desc: `You play ${sys.color === 'w' ? 'White' : 'Black'} against Stockfish at Elo ${elo}, who plays as it likes. Build the setup shown by the ghosts.`,
    fen: PUZZLES[0].fen, system: sys.id, bot: { elo, human: sys.color } };
}
function systemRefresh() {
  const sys = sysOf(sysId), g = game;
  $('opSide').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.side === opSide));
  const rows = SYSTEMS.filter(s => s.color === opSide).map(s => `<button class="op-row${s.id === sys.id ? ' on' : ''}" type="button" data-sys="${s.id}">`
    + `<span class="tag ${s.color}">${s.color === 'w' ? 'W' : 'B'}</span>${esc(s.name)}${s.mine ? '<span class="known">you know it</span>' : ''}<small>${setupText(s)}</small></button>`).join('');
  if ($('sysList').dataset.sig !== opSide + sys.id) { $('sysList').innerHTML = rows; $('sysList').dataset.sig = opSide + sys.id; }
  $('sysInfoLbl').textContent = sys.color === 'w' ? 'System for White' : 'System for Black';
  $('sysName').textContent = sys.name; $('sysSetup').textContent = setupText(sys);
  $('sysIdea').textContent = sys.idea; $('sysPlan').textContent = sys.plans;
  const inGame = !!(g && g.pz.system);
  $('sysNow').hidden = !inGame;
  if (inGame) {
    const T = setupState(g.st.b, sys).filter(t => !t.gone), done = T.filter(t => t.placed).length, gone = sys.setup.length - T.length;
    $('sysProgress').textContent = (done === T.length ? `Setup complete (${done} of ${T.length}): now the plan` : `Setup: ${done} of ${T.length} in place`) + (gone ? ` · ${gone} piece${gone > 1 ? 's' : ''} traded off, left out` : '');
    $('sysNote').textContent = notesFor(sys, g.st.b).join(' ') || (done === T.length ? sys.plans : 'Ghosts show where the rest go.');
    systemAdvice(g);
  }
  $('opStart').textContent = inGame ? 'New game' : `Start: ${sys.name}`;
}
const setupText = s => s.setup.map(t => t === 'O-O' ? 'O-O' : (t[0] === 'P' ? '' : t[0]) + t.slice(1)).join(' ');
function notesFor(sys, b) {
  return [...(sys.color === 'w' ? SYS_NOTES.white : []), ...(SYS_NOTES[sys.id] || [])].filter(([test]) => test(b, sys)).map(([, text]) => text);
}
$('sysList').addEventListener('click', e => {
  const b = e.target.closest('.op-row'); if (!b) return;
  const g = game;
  if (g && g.pz.system && g.history.length > 2 && g.phase !== 'done' && !confirm('Leave this game?')) return;
  sysId = b.dataset.sys; store2('robo-sys', sysId);
  if (g && g.pz.system && g.phase !== 'done') request('sysgame'); else request('start');
  systemRefresh();
});
// --- on each of your turns: the best setup move, checked against the best move ---
function systemAdvice(g) {
  if (!g.pz.system || !g.bot || g.phase !== 'user' || g.view !== null || g.result || anim) return;
  const ply = g.history.length;
  if (g.sysPly === ply) return;
  g.sysPly = ply;
  const sys = sysOf(g.pz.system), white = sys.color === 'w', fen = fenOf(g.st);
  const complete = setupState(g.st.b, sys).every(t => t.placed || t.gone);
  let cands = setupMoves(g.st, sys, complete ? sys.plan : sys.setup);
  const uci = cands.map(m => uciOf(m));
  judge(fen, 650).then(best => {
    if (!uci.length) return [best, null];
    return judge(fen, 650, uci).then(mine => [best, mine]);
  }).then(([best, mine]) => {
    if (game !== g || g.history.length !== ply) return;
    const san = u => { const m = CH.legal(g.st).find(x => uciOf(x) === u); return m ? CH.san(g.st, m) : u; };
    const show = (u, warn, text) => {
      const m = CH.legal(g.st).find(x => uciOf(x) === u);
      if (m) g.best = { from: m.from, to: m.to, ply, warn };
      g.bestNote = { text, ply }; refreshGame();
    };
    if (!mine) {
      if (complete) g.bestNote = { text: `Setup complete. The plan: ${sys.plans} Best move asks Stockfish when you are unsure.`, ply };
      else g.bestNote = { text: 'No setup move is possible right now: play what the position needs (Best move helps), then go on with the setup.', ply };
      refreshGame(); return;
    }
    const cost = pawns(best) - pawns(mine);
    if (cost <= 0.7) show(mine.best, false, `${complete ? 'Plan' : 'Setup'}: ${san(mine.best)}${cost > 0.3 ? ' (slightly less than the best move, but it keeps your system)' : ''}.`);
    else show(best.best, true, `Wait with the ${complete ? 'plan' : 'setup'}: play ${san(best.best)} first. ${san(mine.best)} now would cost about ${cost >= 50 ? 'the game' : cost.toFixed(1) + ' pawns'}.`);
  });
}
// faint ghosts on the setup squares still empty; before the game starts too
function drawSystemGhosts(g) {
  if (g.view !== null || g.result || !(g.pz.system || g.pz.name === 'Openings')) return;
  if (g.pz.name === 'Openings' && g.history.length) return;
  const sys = sysOf(g.pz.system || sysId), white = sys.color === 'w', b = g.st.b;
  if ($('opGhosts').value === 'off') return;
  const ghost = (sq, t) => {
    pieceAlpha = white ? 0.3 : 0.42; ctx.globalAlpha = pieceAlpha;
    drawPiece({ t, white: t === t.toUpperCase() }, { x: TRAY_W + (sq & 7) + 0.5, y: (sq >> 3) + 0.5 }, 0);
    pieceAlpha = 1; ctx.globalAlpha = 1;
    ctx.strokeStyle = tok['--muted']; ctx.globalAlpha = 0.7; ctx.lineWidth = 0.025; ctx.setLineDash([0.05, 0.06]);
    ctx.beginPath(); ctx.arc(sqX(sq), sqY(sq), 0.44, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  };
  if ($('opGhosts').value === 'next') return;   // the arrow shows the next move
  for (const t of setupState(b, sys)) {
    if (t.placed || t.gone) continue;
    if (t.castle) { ghost(sqIdx(white ? 'g1' : 'g8'), white ? 'K' : 'k'); ghost(sqIdx(white ? 'f1' : 'f8'), white ? 'R' : 'r'); }
    else if (b[t.sq] !== t.type) ghost(t.sq, t.type);
  }
}
setKind(exKind);
