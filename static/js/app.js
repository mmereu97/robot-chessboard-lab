// =================== interfață ===================
const GAP = 0.38, PAD = 0.28, R = 0.38;
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const ALGO_META = {
  fast: { tag: 'parallel', em: 'Shortest total time: bottleneck matching, many priority orders, exact geometry.' },
  nudge: { tag: 'parallel', em: 'Same matching; pieces near a route slide aside just enough for the circle to pass, then return.' },
  ca: { tag: 'parallel', em: 'Space-time planning with reservations; strict square rules.' },
  pibt: { tag: 'parallel', em: 'Step-by-step decisions with pushing and priority inheritance.' },
  seq: { tag: '1 magnet', em: 'Optimal matching, magnet-friendly order, smooth A* paths.' },
  naive: { tag: '1 magnet', em: 'Fixed order, orthogonal only, stops on every square.' },
};

const agents = FULL_SET.map((t, i) => ({ t, id: i, white: t === t.toUpperCase() }));
let cells = (() => { const cfg = targetConfig(PUZZLES[0].fen), used = new Set();
  return agents.map(a => { for (const [c, t] of cfg) if (t === a.t && !used.has(c)) { used.add(c); return c; } }); })();
let carPos = { x: 6, y: 4 };
let anim = null, pending = null, last = null, currentKey = 'p0';
let algo = 'fast';
try { const s = localStorage.getItem('robo-algo2'); if (s && ALGOS[s]) algo = s; } catch (e) {}
// Piece themes. Every piece is the same robot, with the same round base; only the drawing changes.
// "Inside the base": each symbol fits inside an invisible circle as wide as the base the planner
// checks, so pieces that do not collide also do not overlap on screen.
const KING_BASE_RULE = 0.78;   // the usual guideline: king's base = 78% of the square (not in the FIDE rules)
const theme = () => $('pieceTheme').value;
try { const t = localStorage.getItem('robo-theme'); if (t) $('pieceTheme').value = t; else if (localStorage.getItem('robo-discs') === '1') $('pieceTheme').value = 'discs'; } catch (e) {}
const insideBase = t => t === 'true' || t === 'ring';
const showSymbol = () => { $('sizesNote').hidden = insideBase(theme()); };
function applyThemeDiameter() { if (insideBase(theme())) { $('diam').value = KING_BASE_RULE; $('diamVal').textContent = KING_BASE_RULE.toFixed(2) + ' of a square'; } }
let lastTheme = theme();
$('pieceTheme').addEventListener('change', () => {
  try { localStorage.setItem('robo-theme', theme()); } catch (e) {}
  if (!insideBase(lastTheme)) applyThemeDiameter();   // between the two "inside" themes the slider stays where it is
  lastTheme = theme();
  showSymbol();
});
showSymbol();
// inside the base: of each symbol, the diameter of the smallest circle around it and that circle's centre,
// in fractions of the image. A percentage says how much of the base that circle fills, so 100% touches it.
const INSIDE = {
  K: { enc: 0.801, cx: 0.489, cy: 0.516 }, Q: { enc: 0.961, cx: 0.499, cy: 0.469 }, B: { enc: 0.941, cx: 0.499, cy: 0.575 },
  N: { enc: 0.919, cx: 0.568, cy: 0.518 }, R: { enc: 0.901, cx: 0.499, cy: 0.551 }, P: { enc: 0.814, cx: 0.497, cy: 0.589 },
};
const SIZE_DEFAULT = { K: 88, Q: 92, B: 90, N: 86, R: 82, P: 73 };
const SIZE_NAME = { K: 'King', Q: 'Queen', B: 'Bishop', N: 'Knight', R: 'Rook', P: 'Pawn' };
const sizes = { ...SIZE_DEFAULT };
try { const v = JSON.parse(localStorage.getItem('robo-sizes')); if (v) for (const k in sizes) if (+v[k]) sizes[k] = +v[k]; } catch (e) {}
function buildSizes() {
  const box = $('sizesRows');
  box.innerHTML = '';
  for (const k of Object.keys(sizes)) {
    const row = document.createElement('div'); row.className = 'size-row';
    row.innerHTML = `<img alt="" src="${PIECE_SVG[k]}"><span>${SIZE_NAME[k]}</span><input type="range" min="30" max="130" step="0.1" aria-label="${SIZE_NAME[k]} size"><input type="number" min="30" max="130" step="0.1" aria-label="${SIZE_NAME[k]} size, percent"><i>%</i>`;
    const range = row.querySelector('[type=range]'), num = row.querySelector('[type=number]');
    const show = () => { range.value = sizes[k]; num.value = sizes[k].toFixed(1); };
    const set = v => {
      sizes[k] = Math.round(Math.max(30, Math.min(130, +v || SIZE_DEFAULT[k])) * 10) / 10;
      show();
      try { localStorage.setItem('robo-sizes', JSON.stringify(sizes)); } catch (e) {}
    };
    range.addEventListener('input', () => set(range.value));
    num.addEventListener('input', () => { const v = +num.value; if (v >= 30 && v <= 130) sizes[k] = Math.round(v * 10) / 10; });   // live, while typing
    num.addEventListener('change', () => set(num.value));
    show(); box.appendChild(row);
  }
}
buildSizes();
$('sizesReset').addEventListener('click', () => { Object.assign(sizes, SIZE_DEFAULT); try { localStorage.removeItem('robo-sizes'); } catch (e) {} buildSizes(); });
// the space between circle and symbol: transparent, or an opaque colour for each side
const FILL_DEFAULT = { w: { on: true, color: '#d4af37' }, b: { on: true, color: '#8a8a8a' } };
const fill = { w: { ...FILL_DEFAULT.w }, b: { ...FILL_DEFAULT.b } };
try { const v = JSON.parse(localStorage.getItem('robo-fill')); if (v) for (const k of ['w', 'b']) Object.assign(fill[k], v[k]); } catch (e) {}
for (const k of ['w', 'b']) {
  const on = $('fillOn' + k), color = $('fillColor' + k);
  on.checked = fill[k].on; color.value = fill[k].color;
  const save = () => { fill[k].on = on.checked; fill[k].color = color.value; try { localStorage.setItem('robo-fill', JSON.stringify(fill)); } catch (e) {} };
  on.addEventListener('change', save);
  color.addEventListener('input', () => { on.checked = true; save(); });
}
function showTab(name) {
  $('panelMain').hidden = name !== 'main'; $('panelSizes').hidden = name !== 'sizes';
  $('tabMain').classList.toggle('on', name === 'main'); $('tabSizes').classList.toggle('on', name === 'sizes');
  try { localStorage.setItem('robo-tab', name); } catch (e) {}
}
$('tabMain').addEventListener('click', () => showTab('main'));
$('tabSizes').addEventListener('click', () => showTab('sizes'));
try { if (localStorage.getItem('robo-tab') === 'sizes') showTab('sizes'); } catch (e) {}

// --- control UI ---
const sel = $('pzSel');
{
  const groups = { classic: 'Classic positions', m2: 'Mate in two' }, og = {};
  for (const g in groups) { og[g] = document.createElement('optgroup'); og[g].label = groups[g]; sel.appendChild(og[g]); }
  PUZZLES.forEach((p, i) => { const o = document.createElement('option'); o.value = 'p' + i; o.textContent = p.name; og[p.set || 'classic'].appendChild(o); });
  const o = document.createElement('option'); o.value = 'rand'; o.textContent = 'Random generated position'; og.classic.appendChild(o);
}
try { const v = localStorage.getItem('robo-pool'); if (v) $('poolSel').value = v; } catch (e) {}
$('poolSel').addEventListener('change', () => { try { localStorage.setItem('robo-pool', $('poolSel').value); } catch (e) {} });
const algosEl = $('algos');
['fast', 'nudge', 'ca', 'pibt', 'seq', 'naive'].map(k => [k, ALGOS[k]]).forEach(([k, A]) => {
  const l = document.createElement('label'); l.className = 'algo';
  l.innerHTML = `<input type="radio" name="algo" id="algo-${k}" value="${k}"${k === algo ? ' checked' : ''}><strong>${A.name}<span class="tag">${ALGO_META[k].tag}</span></strong><em>${ALGO_META[k].em}</em>`;
  algosEl.appendChild(l);
});
algosEl.addEventListener('change', e => { algo = e.target.value; try { localStorage.setItem('robo-algo2', algo); } catch (er) {} });
// The slider is the piece as drawn. Like magnets that repel, pieces keep 3 mm apart (on a 58 mm square):
// to everything that plans or places them, a piece is that much wider than it looks.
const PIECE_GAP = 3 / 58;
const pieceBase = () => +$('diam').value;
const diam = () => pieceBase() + PIECE_GAP;
const opt = () => ({ diag: $('optDiag').checked, turn: $('optTurn').checked, smooth: $('optSmooth').checked, diam: diam(), budget: 1000 });
$('diam').addEventListener('input', () => { $('diamVal').textContent = pieceBase().toFixed(2) + ' of a square'; });
const speed = () => +$('speed').value;
$('speed').addEventListener('input', () => { $('speedVal').textContent = speed() + ' squares/s'; if (lastCmp) renderCmp(lastCmp); renderStats(); });

function puzzleFor(key) {
  if (key === 'bot') return botPuzzle();
  if (key === 'rand') return { name: 'Random position', desc: 'Pieces scattered at random, as a stress test.', fen: randomFEN() };
  return PUZZLES[+key.slice(1)];
}
function randomKey() {
  const pool = $('poolSel').value;
  if (pool !== 'm2' && Math.random() < (pool === 'all' ? 0.08 : 0.15)) return 'rand';
  const ids = PUZZLES.map((p, i) => i).filter(i => pool === 'all' || (PUZZLES[i].set || 'classic') === pool);
  let k; do { k = 'p' + ids[Math.floor(Math.random() * ids.length)]; } while (k === currentKey && ids.length > 1);
  return k;
}
function request(key) {
  const pz = puzzleFor(key);
  if (anim) { pending = { key, pz }; $('queueTag').textContent = 'queued: ' + pz.name; return; }
  launch(key, pz);
}
// says on the page what opened a position, to find out why one appears unasked
let lastInput = 'the page';
window.addEventListener('click', e => { const t = e.target; lastInput = 'click on ' + (t.id || (t.closest('button,select,label,a') || t).id || t.tagName.toLowerCase()); }, true);
window.addEventListener('change', e => { lastInput = 'change of ' + (e.target.id || e.target.tagName.toLowerCase()); }, true);
window.addEventListener('keydown', e => { lastInput = 'key ' + e.code; }, true);
function launch(key, pz, fromStarts) {
  releaseHeld();
  agents.forEach((ag, a) => { ag.t = FULL_SET[a]; }); // a promoted pawn goes back to being a pawn
  flip = !!(pz.bot && pz.bot.human === 'b');
  currentKey = key; sel.value = key;
  $('pzName').textContent = pz.name; $('pzDesc').textContent = pz.desc + (pz.bot ? '' : ` Opened by: ${lastInput}.`);
  $('clock').textContent = algo === 'fast' ? 'optimizing paths…' : 'planning paths…'; $('note').textContent = '';
  if (fromStarts) { cells = fromStarts.slice(); loose.fill(null); }
  const go = () => {
    const starts = cells.slice();
    const plan = planTransition(algo, agents, starts, pz.fen, opt(), carPos);
    last = { starts, pz, key, carStart: { ...carPos } };
    pileUp(plan);
    anim = { plan, by: buildIndex(plan, agents.length), t: 0, prev: performance.now(), kind: 'setup', pz };
    endGame();
    if (plan.carEnd) carPos = { ...plan.carEnd };
    $('note').textContent = plan.note || '';
    $('replayBtn').disabled = false; $('cmpBtn').disabled = false;
    renderStats();
    lastCmp = null; $('cmpTable').hidden = true; $('cmpEmpty').hidden = false;
    $('cmpEmpty').textContent = 'Press “Compare planners” to run all six on this transition.';
  };
  setTimeout(go, 20);
}
// The planners work on a grid, the trays do not. A piece that stays on a tray stays where it lies, a piece
// that leaves one starts its trip from where it lies, and a piece that arrives on one ends up in the heap.
function pileUp(plan) {
  const D = diam(), by = buildIndex(plan, agents.length), final = agents.map((_, a) => isTrayCell(plan.goals[a]));
  const left = a => cx(plan.goals[a]) < TRAY_W;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const pos = agents.map((_, a) => {
    const stays = plan.goals[a] === plan.starts[a] && !by[a].length;
    if (stays && loose[a]) return { ...loose[a], fixed: true };
    if (!final[a]) return null;
    const c = cellXY(plan.goals[a]);
    return { x: c.x + 0.8 * gauss(), y: 4 + (c.y - 4) * 0.8 + 0.5 * gauss() };
  });
  // nobody overlaps: those lying there keep their place if they have room, and each arrival takes
  // the free spot nearest to where it would fall
  const NEED = D + 0.012, placed = { true: [], false: [] };
  const roomAt = (q, list) => list.every(o => Math.hypot(o.x - q.x, o.y - q.y) >= NEED);
  agents.forEach((_, a) => {
    if (!pos[a] || !pos[a].fixed || !final[a]) return;
    if (roomAt(pos[a], placed[left(a)])) placed[left(a)].push(pos[a]); else pos[a].fixed = false;
  });
  agents.forEach((_, a) => {
    if (!pos[a] || pos[a].fixed || !final[a]) return;
    const r = trayRect(left(a)), list = placed[left(a)], want = { x: Math.max(r.x0, Math.min(r.x1, pos[a].x)), y: Math.max(r.y0, Math.min(r.y1, pos[a].y)) };
    let best = null, bd = Infinity;
    if (roomAt(want, list)) best = want;
    else for (let x = r.x0; x <= r.x1 + 1e-9; x += D / 8) for (let y = r.y0; y <= r.y1 + 1e-9; y += D / 8) {
      const d = Math.hypot(x - want.x, y - want.y);
      if (d < bd && roomAt({ x, y }, list)) { bd = d; best = { x, y }; }
    }
    if (!best) { best = want; console.warn('no room on the tray for piece', a); }
    pos[a].x = best.x; pos[a].y = best.y;
    list.push(pos[a]);
  });
  // Pieces leaving a tray: one at a time on the magnet, the first stretch starts from where they lie. All at
  // once, each first goes from where it lies to its grid place, and from there the planner's paths hold.
  const leaving = agents.map((_, a) => a).filter(a => loose[a] && by[a].length);
  if (plan.parallel === false) leaving.forEach(a => {
    const first = by[a][0];
    first.pts = [loose[a], ...first.pts.slice(1)];
    refit(first);
    loose[a] = null;
  });
  else if (leaving.length) {
    const out = leaving.map(a => lineSeg(a, 0, loose[a], cellXY(plan.starts[a])));
    const lead = Math.max(...out.map(s => s.t1));
    plan.segs.forEach(s => { s.t0 += lead; s.t1 += lead; });
    plan.segs.push(...out);
    plan.makespan += lead;
    leaving.forEach(a => { loose[a] = null; });
  }
  settleTrays(plan, pos, final, left);
  const mk = plan.makespan;
  // the clearance on show is the real one, heap included
  const by2 = buildIndex(plan, agents.length), lying = loose.slice();
  let least = Infinity;
  for (let t = 0; t <= mk + 1e-9; t += 0.05) {
    const P = agents.map((_, a) => by2[a].length ? agentPos(by2, a, plan.starts[a], t) : (lying[a] || cellXY(plan.starts[a])));
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) least = Math.min(least, Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y));
  }
  plan.clearance = least;
}
// The trays, like magnets that repel. The planners bring each arriving piece to its grid place, and what lies on
// a tray is pushed out of the way of whatever moves, by the least that keeps the distance. A piece that has
// arrived then drifts to its place in the heap, and stops there or as soon as something is in its way.
function settleTrays(plan, pos, final, left) {
  const DT = 0.04, n = agents.length, NEED = diam() + 0.012, by = buildIndex(plan, n);
  const endOf = a => by[a].length ? by[a][by[a].length - 1].t1 : 0;
  const P = agents.map((_, a) => { const q = by[a].length ? agentPos(by, a, plan.starts[a], 0) : (loose[a] || cellXY(plan.starts[a])); return { x: q.x, y: q.y }; });
  const soft = new Uint8Array(n), first = new Int32Array(n).fill(-1), track = agents.map(() => []);
  const want = agents.map((_, a) => final[a] && pos[a] && !pos[a].fixed ? { x: pos[a].x, y: pos[a].y, stuck: 0 } : null);
  const inTray = (a, q) => { const r = trayRect(left(a)); q.x = Math.max(r.x0, Math.min(r.x1, q.x)); q.y = Math.max(r.y0, Math.min(r.y1, q.y)); };
  const free = (a, q) => P.every((o, j) => j === a || Math.hypot(o.x - q.x, o.y - q.y) >= NEED);
  let tick = 0;
  for (;; tick++) {
    const t = tick * DT;
    for (let a = 0; a < n; a++) {
      if (final[a] && !soft[a] && t >= endOf(a)) { soft[a] = 1; first[a] = tick; if (by[a].length) { const e = by[a][by[a].length - 1].pts; const q = e[e.length - 1]; P[a] = { x: q.x, y: q.y }; } }
      if (!soft[a] && by[a].length) { const q = agentPos(by, a, plan.starts[a], t); P[a] = { x: q.x, y: q.y }; }
    }
    let busy = false;
    for (let a = 0; a < n; a++) {   // drifting to its place, never pushing anything
      const w = want[a]; if (!soft[a] || !w) continue;
      const d = Math.hypot(w.x - P[a].x, w.y - P[a].y);
      if (d < 1e-3) { want[a] = null; continue; }
      busy = true;
      const f = Math.min(1, DT / d), q = { x: P[a].x + (w.x - P[a].x) * f, y: P[a].y + (w.y - P[a].y) * f };
      if (free(a, q)) { P[a] = q; w.stuck = 0; } else if (++w.stuck > 25) want[a] = null;
    }
    for (let it = 0; it < 8; it++) {   // pushed by whatever comes too close
      let pushed = false;
      for (let i = 0; i < n; i++) {
        if (!soft[i]) continue;
        for (let j = 0; j < n; j++) {
          if (j === i || (soft[j] && j < i)) continue;
          const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d = Math.hypot(dx, dy) || 1e-3, gap = NEED + 1e-4 - d;
          if (gap <= 0) continue;
          pushed = true;
          const ux = dx / d || 0.6, uy = dy / d || 0.8, wi = soft[j] ? 0.5 : 1;
          P[i] = { x: P[i].x + ux * gap * wi, y: P[i].y + uy * gap * wi }; inTray(i, P[i]);
          if (soft[j]) { P[j] = { x: P[j].x - ux * gap * wi, y: P[j].y - uy * gap * wi }; inTray(j, P[j]); }
        }
      }
      if (!pushed) break;
      busy = true;
    }
    for (let a = 0; a < n; a++) if (soft[a]) track[a].push({ x: P[a].x, y: P[a].y });
    if ((t >= plan.makespan && !busy) || t > plan.makespan + 4) break;
  }
  let mk = plan.makespan;
  for (let a = 0; a < n; a++) {
    if (!final[a]) { loose[a] = null; continue; }
    const tr = track[a], moved = i => Math.hypot(tr[i].x - tr[0].x, tr[i].y - tr[0].y) > 1e-4;
    let i0 = 0, i1 = tr.length - 1;
    while (i0 < tr.length && !moved(i0)) i0++;
    if (i0 < tr.length) {
      while (i1 > i0 && Math.hypot(tr[i1].x - tr[i1 - 1].x, tr[i1].y - tr[i1 - 1].y) < 1e-6) i1--;
      const t0 = (first[a] + i0 - 1) * DT, pts = tr.slice(Math.max(0, i0 - 1), i1 + 1);
      plan.segs.push({ a, type: 'track', t0, t1: t0 + (pts.length - 1) * DT, dt: DT, pts });
      mk = Math.max(mk, t0 + (pts.length - 1) * DT);
    }
    loose[a] = { x: P[a].x, y: P[a].y };
  }
  plan.makespan = mk;
}
// a segment whose end points changed: same start time, and its timing follows the new length
function refit(seg) {
  if (seg.type !== 'motion') return;
  seg.cum = [0];
  for (let i = 1; i < seg.pts.length; i++) seg.cum.push(seg.cum[i - 1] + Math.hypot(seg.pts[i].x - seg.pts[i - 1].x, seg.pts[i].y - seg.pts[i - 1].y));
  seg.L = seg.cum[seg.cum.length - 1]; seg.prof = trapezoid(seg.L); seg.t1 = seg.t0 + seg.prof.T;
}
$('goBtn').addEventListener('click', () => request(randomKey()));
// step through the puzzles of the chosen pool in list order (wraps around)
function stepKey(dir) {
  const pool = $('poolSel').value;
  const ids = PUZZLES.map((p, i) => i).filter(i => pool === 'all' || (PUZZLES[i].set || 'classic') === pool);
  const base = pending ? pending.key : currentKey;
  const cur = base && base[0] === 'p' ? ids.indexOf(+base.slice(1)) : -1;
  const next = cur < 0 ? (dir > 0 ? 0 : ids.length - 1) : (cur + dir + ids.length) % ids.length;
  return 'p' + ids[next];
}
$('nextBtn').addEventListener('click', () => request(stepKey(1)));
$('prevBtn').addEventListener('click', () => request(stepKey(-1)));
function setTrails(on) { $('optTrails').checked = on; $('trailBtn').setAttribute('aria-pressed', on ? 'true' : 'false'); try { localStorage.setItem('robo-trails', on ? '1' : '0'); } catch (e) {} }
$('trailBtn').addEventListener('click', () => setTrails(!$('optTrails').checked));
try { const v = localStorage.getItem('robo-side'); if (v !== null) $('optSide').checked = v === '1'; } catch (e) {}
$('optSide').addEventListener('change', () => { try { localStorage.setItem('robo-side', $('optSide').checked ? '1' : '0'); } catch (e) {} });
$('optTrails').addEventListener('change', () => setTrails($('optTrails').checked));
try { const v = localStorage.getItem('robo-trails'); if (v !== null) setTrails(v === '1'); } catch (e) {}
$('resetBtn').addEventListener('click', () => request('p0'));
sel.addEventListener('change', () => request(sel.value));
$('replayBtn').addEventListener('click', () => { if (!last || anim) return; carPos = { ...last.carStart }; launch(last.key, last.pz, last.starts); });
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
  if (game && game.bot) {   // a stray key must not end a game against Stockfish; the arrows look through its moves
    const to = { ArrowLeft: viewedPly(game) - 1, ArrowRight: viewedPly(game) + 1, ArrowUp: 0, Home: 0, ArrowDown: game.history.length, End: game.history.length }[e.code];
    if (to !== undefined) { e.preventDefault(); viewPly(game, to); }
    return;
  }
  if (e.code === 'Space') { if (tag === 'BUTTON') return; e.preventDefault(); request(randomKey()); }
  if (e.code === 'KeyR') { e.preventDefault(); request('p0'); }
  if (e.code === 'ArrowRight') { e.preventDefault(); request(stepKey(1)); }
  if (e.code === 'ArrowLeft') { e.preventDefault(); request(stepKey(-1)); }
  if (e.code === 'KeyP') { e.preventDefault(); setTrails(!$('optTrails').checked); }
});

// --- statistici ---
const fmtS = u => (u / speed()).toFixed(1) + ' s';
function renderStats() {
  const p = anim ? anim.plan : (lastPlan || null);
  const el = $('stats');
  if (!p) { el.innerHTML = ''; return; }
  const items = [
    ['Duration', fmtS(p.makespan)], ['Lower bound', fmtS(p.lb)], ['Piece travel', p.dist.toFixed(0) + ' sq'],
    ['Pieces moved', p.moves], [p.parallel ? 'Waits' : 'Detours', p.parallel ? p.waits : p.temps],
    ['Min. clearance', p.clearance.toFixed(2), p.clearance >= p.diam - 1e-6 ? 'ok' : 'bad'],
  ];
  el.innerHTML = items.map(([k, v, c]) => `<div class="stat ${c || ''}"><b>${v}</b><span>${k}</span></div>`).join('');
}
let lastPlan = null;

// --- comparație ---
let lastCmp = null;
$('cmpBtn').addEventListener('click', () => {
  if (!last) return;
  $('cmpEmpty').hidden = false; $('cmpTable').hidden = true; $('cmpEmpty').textContent = 'Running all five planners…';
  setTimeout(() => {
    const rows = ['fast', 'nudge', 'ca', 'pibt', 'seq', 'naive'].map(k => ({ k, p: planTransition(k, agents, last.starts, last.pz.fen, opt(), last.carStart) }));
    lastCmp = rows; renderCmp(rows);
  }, 30);
});
function renderCmp(rows) {
  $('cmpEmpty').hidden = true; $('cmpTable').hidden = false;
  $('cmpSub').textContent = `${last.pz.name}: the same change of position, run by every planner. Times are at the current speed. The lower bound (${fmtS(rows[0].p.lb)}) is the longest single trip under the best possible assignment; no planner can beat it.`;
  const min = f => Math.min(...rows.map(r => f(r.p)));
  const maxMk = Math.max(...rows.map(r => r.p.makespan));
  const bm = min(p => p.makespan), bd = min(p => p.dist);
  $('cmpBody').innerHTML = rows.map(({ k, p }) => `<tr>
    <td>${ALGOS[k].name}${p.note ? ' <span class="tag" title="' + p.note + '">fallback</span>' : ''}</td>
    <td class="num ${p.makespan === bm ? 'best' : ''}"><span class="meter" style="width:${Math.max(4, 70 * p.makespan / maxMk)}px"></span>${fmtS(p.makespan)}</td>
    <td class="num">${p.lb > 0 ? '+' + Math.round(100 * (p.makespan / p.lb - 1)) + '%' : '—'}</td>
    <td class="num ${p.dist === bd ? 'best' : ''}">${p.dist.toFixed(1)}</td>
    <td class="num">${p.parallel ? '—' : p.carEmpty.toFixed(1)}</td>
    <td class="num">${p.moves}</td>
    <td class="num">${p.parallel ? p.waits + ' waits' : p.temps + ' detours'}</td>
    <td class="num ${p.clearance >= p.diam - 1e-6 ? 'best' : ''}">${p.clearance.toFixed(2)}</td>
    <td class="num">${p.compute.toFixed(0)} ms</td>
    <td><button class="btn" type="button" data-run="${k}">Run</button></td></tr>`).join('');
}
$('cmpBody').addEventListener('click', e => {
  const k = e.target.dataset && e.target.dataset.run; if (!k || anim) return;
  algo = k; $('algo-' + k).checked = true;
  carPos = { ...last.carStart };
  const keep = lastCmp; launch(last.key, last.pz, last.starts);
  setTimeout(() => { lastCmp = keep; if (keep) renderCmp(keep); }, 60);
});

// =================== desen ===================
const vx = gx => gx + GAP * Math.min(1, Math.max(0, gx - TRAY_W + 0.5)) + GAP * Math.min(1, Math.max(0, gx - W + TRAY_W + 0.5));
let S = 100, tok = {};
function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  ['--good','--panel','--ink','--muted','--line','--sq-light','--sq-dark','--tray','--tray-slot','--accent','--pw','--pw-ink','--pb','--pb-ink','--shadow'].forEach(k => tok[k] = cs.getPropertyValue(k).trim());
}
function resize() {
  const wUnits = W + 2 * GAP + 2 * PAD, hUnits = 8 + 2 * PAD;
  const cssW = cv.clientWidth || 800, dpr = Math.min(2, window.devicePixelRatio || 1);
  S = cssW / wUnits;
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(hUnits * S * dpr);
  cv.style.height = (hUnits * S) + 'px';
  ctx.setTransform(dpr * S, 0, 0, dpr * S, PAD * dpr * S, PAD * dpr * S);
}
window.addEventListener('resize', resize);
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const hue = a => (a * 137.508) % 360;

function draw() {
  readTokens();
  const wU = W + 2 * GAP;
  ctx.clearRect(-PAD, -PAD, wU + 2 * PAD, 8 + 2 * PAD);
  // tăvi
  ctx.fillStyle = tok['--tray'];
  const tw = trayWidth();
  rrect(vx(TRAY_W - tw) - 0.12, -0.12, tw + 0.24, 8.24, 0.22); ctx.fill();
  rrect(vx(W - TRAY_W) - 0.12, -0.12, tw + 0.24, 8.24, 0.22); ctx.fill();
  // tabla
  const bx = vx(TRAY_W + 0.5) - 0.5;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    ctx.fillStyle = (r + f) % 2 ? tok['--sq-dark'] : tok['--sq-light'];
    ctx.fillRect(bx + f, r, 1.002, 1.002);
  }
  // coordinates in the corners of the edge squares, in the colour of the other squares
  ctx.font = '600 0.2px "IBM Plex Mono", monospace'; ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = (7 + i) % 2 ? tok['--sq-light'] : tok['--sq-dark'];
    ctx.textAlign = 'left'; ctx.fillText((flip ? 'hgfedcba' : 'abcdefgh')[i], bx + i + 0.82, 7.95);   // right alignment misplaces a font this small
    ctx.fillStyle = i % 2 ? tok['--sq-light'] : tok['--sq-dark'];
    ctx.textAlign = 'left'; ctx.fillText(String(flip ? i + 1 : 8 - i), bx + 0.05, i + 0.21);
  }
  // playing Black: everything from here on is turned around the board's centre, and each piece back upright
  if (flip) { ctx.save(); ctx.translate(wU, 8); ctx.scale(-1, -1); }

  const P = [], moving = new Uint8Array(agents.length);
  const t = anim ? anim.t : 0;
  const review = game && game.view !== null ? game.frames[game.view] : null;
  for (let a = 0; a < agents.length; a++) {
    if (anim) {
      const p = anim.by[a].length ? agentPos(anim.by, a, anim.plan.starts[a], t) : (loose[a] || cellXY(anim.plan.starts[a]));
      P.push(p);
      const l = anim.by[a]; for (const s of l) if (t > s.t0 && t < s.t1) moving[a] = 1;
    } else P.push(loose[a] || cellXY(cells[a]));
  }
  if (anim && !review) {
    // trasee
    if ($('optTrails').checked) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const s of anim.plan.segs) {
        const active = t >= s.t0 && t <= s.t1, done = t > s.t1;
        if (!active && !done && anim.plan.parallel === false) continue;
        ctx.strokeStyle = `hsla(${hue(s.a)}, 70%, 50%, ${active ? 0.75 : done ? 0.22 : 0.18})`;
        ctx.lineWidth = active ? 0.06 : 0.04;
        ctx.beginPath(); s.pts.forEach((q, i) => i ? ctx.lineTo(vx(q.x), q.y) : ctx.moveTo(vx(q.x), q.y)); ctx.stroke();
      }
      // ținte
      for (let a = 0; a < agents.length; a++) {
        const g = anim.plan.goals[a], s0 = anim.plan.starts[a]; if (g === s0) continue;
        const gp = cellXY(g); if (Math.hypot(P[a].x - gp.x, P[a].y - gp.y) < 0.02) continue;
        ctx.strokeStyle = `hsla(${hue(a)}, 70%, 50%, .6)`; ctx.lineWidth = 0.035; ctx.setLineDash([0.08, 0.07]);
        ctx.beginPath(); ctx.arc(vx(gp.x), gp.y, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // magnet
    if ($('optCar').checked && anim.plan.car) {
      let cp = null;
      for (const c of anim.plan.car) {
        if (t >= c.t0 && t <= c.t1) { if (c.type === 'line') { const u = (t - c.t0) / (c.t1 - c.t0 || 1), e = easeIO(u); cp = { x: c.from.x + (c.to.x - c.from.x) * e, y: c.from.y + (c.to.y - c.from.y) * e }; } else cp = segPos(c.seg, t); break; }
        if (c.t1 < t) cp = c.type === 'line' ? c.to : c.seg.pts[c.seg.pts.length - 1];
      }
      if (!cp) cp = anim.plan.car.length ? anim.plan.car[0].from || anim.plan.car[0].seg.pts[0] : carPos;
      drawMagnet(cp);
    }
  } else if (!anim && !review && $('optCar').checked && (algo === 'naive' || algo === 'seq')) drawMagnet(carPos);

  // piese: întâi cele în repaus, apoi cele care se mișcă
  const order = [...agents.keys()].sort((x, y) => moving[x] - moving[y]);
  const held = game && game.held;
  if (held && held.queued !== null) P[held.a] = held.queued;
  if (game && game.placing) P[game.placing.a] = cellXY(game.placing.cell);
  if (game && game.trayQueue) P[game.trayQueue.a] = game.trayQueue.pt;
  const dragged = drag && drag.moved ? drag.a : -1, inHand = review ? -1 : handPiece();
  glideOver(P, review);
  drawGameMarks();
  for (const a of order) {
    if (review) drawPiece({ ...agents[a], t: review.types[a] }, P[a], 0);
    else if (a !== dragged && a !== inHand) drawPiece(agents[a], P[a], moving[a]);
  }
  drawGameDots();
  if (dragged >= 0) drawPiece(agents[dragged], { x: mouse.x, y: mouse.y, screen: true }, 1);
  if (inHand >= 0) {
    // where it would land, then the piece itself on the cursor
    const side = traySide(mouse.x), c = side < 0 ? null : dropPoint(mouse.x, mouse.y, side);
    if (c !== null) { ctx.strokeStyle = tok['--accent']; ctx.lineWidth = 0.05; ctx.setLineDash([0.1, 0.07]); ctx.beginPath(); ctx.arc(vx(c.x), c.y, pieceBase() / 2, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    drawPiece(agents[inHand], { x: mouse.x, y: mouse.y, screen: true }, 1);
  }
  if (flip) ctx.restore();
}
function drawMagnet(p) {
  const x = vx(p.x), y = p.y;
  ctx.strokeStyle = tok['--accent']; ctx.lineWidth = 0.05; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(x, y, 0.47, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 0.6, y); ctx.lineTo(x - 0.5, y); ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.6, y); ctx.moveTo(x, y - 0.6); ctx.lineTo(x, y - 0.5); ctx.moveTo(x, y + 0.5); ctx.lineTo(x, y + 0.6); ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawPiece(ag, p, lifted) {
  if (!flip) { drawPieceUp(ag, p, lifted); return; }
  const x = p.screen ? p.x : vx(p.x), y = p.y;
  ctx.save(); ctx.translate(2 * x, 2 * y); ctx.scale(-1, -1); drawPieceUp(ag, p, lifted); ctx.restore();
}
function drawPieceUp(ag, p, lifted) {
  const x = p.screen ? p.x : vx(p.x), y = p.y;
  const img = PIECE_IMG[ag.t];
  if (insideBase(theme()) && img && img.complete && img.naturalWidth) {
    const D = pieceBase(), T = ag.t.toUpperCase(), f = INSIDE[T], size = D * sizes[T] / 100 / f.enc;
    ctx.save();
    const inside = fill[ag.white ? 'w' : 'b'];
    if (inside.on) { ctx.fillStyle = inside.color; ctx.beginPath(); ctx.arc(x, y, D / 2, 0, 7); ctx.fill(); }
    if (theme() === 'ring') { ctx.strokeStyle = tok['--muted']; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.arc(x, y, D / 2, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    if (lifted) { ctx.shadowColor = tok['--shadow']; ctx.shadowBlur = 0.12 * S; ctx.shadowOffsetY = 0.04 * S; }
    ctx.drawImage(img, x - size * f.cx, y - size * f.cy, size, size);
    ctx.restore();
    return;
  }
  if (theme() !== 'discs' && img && img.complete && img.naturalWidth) {
    const size = 1.0 + (lifted ? 0.05 : 0);   // a square wide; slightly bigger while it moves
    ctx.save();
    ctx.shadowColor = tok['--shadow']; ctx.shadowBlur = (lifted ? 0.2 : 0.05) * S; ctx.shadowOffsetY = (lifted ? 0.07 : 0.015) * S;
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.shadowColor = tok['--shadow']; ctx.shadowBlur = (lifted ? 0.22 : 0.08) * S; ctx.shadowOffsetY = (lifted ? 0.08 : 0.03) * S;
  ctx.fillStyle = ag.white ? tok['--pw'] : tok['--pb'];
  ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = ag.white ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.14)'; ctx.lineWidth = 0.02;
  ctx.beginPath(); ctx.arc(x, y, R - 0.06, 0, 7); ctx.stroke();
  ctx.fillStyle = ag.white ? tok['--pw-ink'] : tok['--pb-ink'];
  ctx.font = '0.5px "Segoe UI Symbol","DejaVu Sans","Noto Sans Symbols 2","Apple Symbols",serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(GLYPH[ag.t.toLowerCase()] + '︎', x, y + 0.03);
}

// =================== playing the position ===================
let game = null, flip = false;
// pieces lying anywhere on a tray: their position, or null; their cell is only a place for the planners
const loose = new Array(agents.length).fill(null);
const sqToCell = sq => (sq >> 3) * W + TRAY_W + (sq & 7);
const sqX = sq => vx(TRAY_W + (sq & 7) + 0.5), sqY = sq => (sq >> 3) + 0.5;
function endGame() { if (game && game.bot && game.bot.brain) game.bot.brain.stop(); game = null; glide = null; trayHand = null; $('game').hidden = true; cv.classList.remove('clickable', 'holding'); }
function startGame(pz) {
  const m2 = pz.set === 'm2';
  game = { pz, st: CH.fromFEN(pz.fen, true), m2, history: [], sel: -1, last: null, phase: 'user', userMoves: 0, hint: -1, result: '', view: null };
  if (m2) game.keys = CH.mateIn2Keys(game.st);
  $('game').hidden = false; cv.classList.add('clickable');
  $('gMode').textContent = m2 ? 'White to move · mate in two · the robot defends' : 'Free play · you move both sides';
  $('gHint').hidden = $('gSolution').hidden = !m2;
  $('gRestart').textContent = pz.bot ? 'New game' : 'Restart position';
  $('gNav').hidden = !pz.bot;
  if (pz.bot) startBotGame(pz.bot);
  refreshGame();
}
// =================== playing Stockfish ===================
// The bot and its 7 MB engine live in static/bot/ and load only when someone wants to play.
function botPuzzle() {
  const elo = Math.max(100, Math.min(3000, Math.round(+$('botElo').value) || 800)), c = $('botColor').value;
  const human = c === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : c;
  $('botElo').value = elo;
  return { name: 'Playing Stockfish', desc: `Elo ${elo}. You play ${human === 'w' ? 'White' : 'Black'}.`, fen: PUZZLES[0].fen, bot: { elo, human } };
}
$('botBtn').addEventListener('click', () => request('bot'));
function startBotGame(bot) {
  const g = game;
  g.bot = { ...bot, brain: null };
  g.phase = 'loading';
  g.frames = [snapshot(g)];
  $('gMode').textContent = `You play ${bot.human === 'w' ? 'White' : 'Black'} · Stockfish at Elo ${bot.elo}`;
  import('../bot/bot.js').then(mod => {
    if (game !== g || g.phase === 'done') return;
    g.bot.brain = mod.newGame();
    botNext(g);
  }).catch(e => { console.error(e); botFailed(g); });
}
function botFailed(g) { if (game !== g || g.phase === 'done') return; g.phase = 'done'; g.result = 'lose'; g.loseMsg = 'Stockfish could not start in this browser.'; refreshGame(); }
function botNext(g) {
  if (g.phase === 'done') { refreshGame(); return; }   // resigned while the robots were still moving
  const b = g.bot, over = b.brain.over();
  if (over) {
    const humanMated = g.st.white === (b.human === 'w');
    g.phase = 'done'; g.result = over !== 'mate' ? 'draw' : humanMated ? 'lose' : 'win';
    g.loseMsg = 'Checkmate. Stockfish wins.'; g.winMsg = 'Checkmate. You win!'; g.drawMsg = `Draw: ${over}.`;
    viewPly(g, g.history.length); refreshGame(); return;
  }
  if (g.st.white === (b.human === 'w')) { g.phase = 'user'; refreshGame(); return; }
  g.phase = 'robot'; refreshGame();
  b.brain.think(b.elo, $('botFight').checked, uci => {
    if (game !== g || g.phase === 'done') return;
    const m = CH.legal(g.st).find(x => uciOf(x) === uci);
    if (m) playMove(m); else botFailed(g);
  }, () => botFailed(g));
}
const uciOf = m => CH.NAME(m.from) + CH.NAME(m.to) + (m.promo ? m.promo.toLowerCase() : '');
function resign(g) {
  if (g.bot.brain) g.bot.brain.stop();
  viewPly(g, g.history.length);
  const hold = g.phase === 'hold';
  g.phase = 'done'; g.result = 'lose'; g.loseMsg = 'You resigned. Stockfish wins.';
  // a captured piece still in the hand goes to the place kept for it on the tray
  if (g.held && g.held.queued === null) {
    const pt = cellXY(cells[g.held.a]);
    if (hold) finishDrop(g, pt, () => afterMove()); else g.held.queued = pt;
  }
  refreshGame();
}
$('gResign').addEventListener('click', () => {
  const g = game; if (!g || !g.bot || g.phase === 'done') return;
  if (g.confirmResign) { g.confirmResign = false; resign(g); return; }
  g.confirmResign = true; refreshGame();
  setTimeout(() => { if (game === g && g.confirmResign) { g.confirmResign = false; refreshGame(); } }, 3000);
});
// =================== looking back through the moves ===================
// Only the picture changes: the game, the engine and the robots carry on underneath.
// frames[i] is how the board stood after i moves, recorded once all the pieces had come to rest.
const GLIDE_MS = 160;
let glide = null, shownPos = null;
function snapshot(g) {
  return { pos: agents.map((_, a) => { const p = loose[a] || cellXY(cells[a]); return { x: p.x, y: p.y }; }), types: agents.map(ag => ag.t), last: g.last, st: g.st };
}
const viewedPly = g => g.view === null ? g.history.length : g.view;
function viewPly(g, ply) {
  ply = Math.max(0, Math.min(g.history.length, ply));
  if (ply === viewedPly(g)) return;
  if (shownPos) glide = { from: shownPos, t0: performance.now() };
  if (drag) { drag = null; skipClick = true; cv.classList.remove('dragging'); }
  if (trayHand) { trayHand = null; skipClick = true; cv.classList.remove('dragging'); }
  g.view = ply === g.history.length ? null : ply;
  g.sel = -1;
  refreshGame();
}
// the pieces of a past position, sliding there from where they were last drawn
function glideOver(P, review) {
  if (review) review.pos.forEach((p, a) => { P[a] = p; });
  if (glide) {
    const u = Math.min(1, (performance.now() - glide.t0) / GLIDE_MS), e = easeIO(u);
    P.forEach((p, a) => { const q = glide.from[a]; P[a] = { x: q.x + (p.x - q.x) * e, y: q.y + (p.y - q.y) * e }; });
    if (u >= 1) glide = null;
  }
  shownPos = P.slice();
}
$('gFirst').addEventListener('click', () => { if (game) viewPly(game, 0); });
$('gBack').addEventListener('click', () => { if (game) viewPly(game, viewedPly(game) - 1); });
$('gForward').addEventListener('click', () => { if (game) viewPly(game, viewedPly(game) + 1); });
$('gLive').addEventListener('click', () => { if (game) viewPly(game, game.history.length); });
$('gMoves').addEventListener('click', e => { const t = e.target.closest('.mv'); if (t && game) viewPly(game, +t.dataset.ply); });
const moveLabel = (g, ply) => `${(ply + 1) >> 1}${ply % 2 ? '.' : '…'} ${g.history[ply - 1]}`;
function refreshGame() {
  if (!game) return;
  const g = game, st = CH.status(g.st), side = g.st.white ? 'White' : 'Black';
  let text = '', cls = '';
  if (g.view !== null) text = g.view ? `Looking back: after ${moveLabel(g, g.view)}` : 'Looking back: the starting position';
  else if (g.result === 'win') { text = g.winMsg || 'Checkmate. Solved!'; cls = 'win'; }
  else if (g.result === 'draw') text = g.drawMsg;
  else if (g.result === 'lose') { text = g.loseMsg || 'Not mate in two.'; cls = 'lose'; }
  else if (st === 'mate') { text = 'Checkmate. ' + (g.st.white ? 'Black' : 'White') + ' wins.'; cls = 'win'; }
  else if (st === 'stalemate') { text = 'Stalemate.'; }
  else if (trayHand && trayHand.moved) text = `Put the ${PIECE_NAME[agents[trayHand.a].t.toLowerCase()]} down on either tray.`;
  else if (g.held && g.held.queued === null) text = `Take the ${PIECE_NAME[agents[g.held.a].t.toLowerCase()]} off the board: click a free place on a tray.`;
  else if (g.phase === 'loading') text = 'Starting Stockfish…';
  else if (g.phase === 'robot') text = g.bot ? 'Stockfish is thinking…' : 'Black is thinking…';
  else if (g.phase === 'moving') text = 'Moving…';
  else text = (g.m2 || g.bot ? 'Your move' : side + ' to move') + (st === 'check' ? ' · check' : '');
  $('gStatus').textContent = text; $('gStatus').className = 'game-status ' + cls;
  cv.classList.toggle('holding', !!(g.held && g.held.queued === null));
  const move = (h, i) => g.bot ? `<span class="mv${i + 1 === viewedPly(g) ? ' on' : ''}" data-ply="${i + 1}">${h}</span>` : h;
  $('gMoves').innerHTML = g.history.map((h, i) => (i % 2 === 0 ? `<b>${(i >> 1) + 1}.</b> ` : '') + move(h, i)).join(' ') || '&nbsp;';
  if (g.bot) {
    $('gFirst').disabled = $('gBack').disabled = viewedPly(g) === 0;
    $('gForward').disabled = $('gLive').disabled = g.view === null;
    $('gResign').hidden = g.phase === 'done';
    $('gResign').textContent = g.confirmResign ? 'Really resign?' : 'Resign';
    $('gResign').classList.toggle('confirm', !!g.confirmResign);
  } else $('gResign').hidden = true;
}
function boardAgents() { const map = new Map(); cells.forEach((c, a) => map.set(c, a)); return map; }
const isTrayCell = c => cx(c) < TRAY_W || cx(c) >= W - TRAY_W;
const ALL_TRAY = Array.from({ length: N }, (_, c) => c).filter(isTrayCell);
function freeTraySlotOn(left, near) {
  const occ = new Set(cells), free = ALL_TRAY.filter(c => (cx(c) < TRAY_W) === left && !occ.has(c));
  const d = c => Math.hypot(cx(c) + 0.5 - near.x, cy(c) + 0.5 - near.y);
  return free.length ? free.reduce((b, c) => d(c) < d(b) ? c : b) : -1;
}
// the tray on the side of the board where it was taken, or the tray of its colour; for the planners, a grid place on it
function freeTraySlot(type, nearCell) {
  const left = $('optSide').checked ? cx(nearCell) < W / 2 : type === type.toUpperCase();
  const c = freeTraySlotOn(left, cellXY(nearCell));
  return c >= 0 ? c : freeTraySlotOn(!left, cellXY(nearCell));
}
// physical move: which robot goes where (capture to tray, rook in castling, promotion swap with a tray piece)
function playMove(m, byUser = false, dropped = false) {
  if (anim) { game.deferred = [m, byUser, dropped]; return; }   // the pieces on a tray are still making room
  const g = game, map = boardAgents(), goals = cells.slice();
  const mover = map.get(sqToCell(m.from));
  let removal = null;
  if (m.capSq >= 0) {
    const victim = map.get(sqToCell(m.capSq)), from = sqToCell(m.capSq), slot = freeTraySlot(agents[victim].t, from);
    goals[victim] = slot;
    if (byUser && $('optHand').checked) {
      // Lifted at once, so the capturing piece finds its square empty. For the planner it already
      // waits on a free tray cell; it is drawn on the cursor until it is dropped.
      cells = cells.slice(); cells[victim] = slot;
      g.held = { a: victim, queued: null };
    } else removal = { victim, from, slot };
  }
  // a promotion: the piece waiting on a tray comes by itself and the pawn goes off the board;
  // with no such piece on the trays, the pawn's robot takes on the new piece
  const spare = m.promo ? spareFor(m.promo, sqToCell(m.to)) : -1;
  if (m.promo && spare < 0) agents[mover].t = m.promo;
  goals[mover] = sqToCell(m.to);
  if (spare >= 0) {
    if (dropped) g.placing = { a: mover, cell: goals[mover] };
    goals[mover] = cells[mover];
  } else if (dropped) {
    // Put there by hand, so no robot carries it. If the piece it took is still on that square, or the
    // rook has to pass it when castling, the planner sees it waiting at home until that is done;
    // it is drawn where it was dropped.
    if (m.castle || (m.capSq === m.to && !g.held)) { g.placing = { a: mover, cell: goals[mover] }; goals[mover] = cells[mover]; }
    else { cells = cells.slice(); cells[mover] = goals[mover]; }
  }
  if (m.castle) goals[map.get(sqToCell(m.rookFrom))] = sqToCell(m.rookTo);
  g.history.push(CH.san(g.st, m));
  if (g.bot) g.bot.brain.play(uciOf(m));
  g.st = CH.make(g.st, m); g.last = m; g.sel = -1; g.hint = -1; g.phase = 'moving';
  refreshGame();
  const go = () => setTimeout(() => {
    const plan = planFixed(algo, cells.slice(), goals, opt(), carPos);
    if (plan.carEnd) carPos = { ...plan.carEnd };
    anim = { plan, by: buildIndex(plan, agents.length), t: 0, prev: performance.now(), kind: 'move' };
    $('note').textContent = plan.note || ''; renderStats();
  }, 10);
  // the captured piece first goes straight to the nearest tray, then the move is played
  const steps = [];
  if (removal) steps.push(() => removeToTray(removal.victim, removal.from, removal.slot));
  if (spare >= 0) {
    const to = sqToCell(m.to), from = dropped ? to : sqToCell(m.from);
    steps.push(() => {
      g.placing = null;
      if (dropped) { cells = cells.slice(); cells[mover] = to; }
      goals[mover] = freeTraySlot(m.piece, from);
      return removeToTray(mover, from, goals[mover]);
    });
    steps.push(() => {
      goals[spare] = to;
      const plan = bringFromTray(spare, to);
      if (!plan) { loose[spare] = null; }
      return plan;
    });
  }
  const next = i => {
    if (i === steps.length) { go(); return; }
    const plan = steps[i]();
    if (plan) runSettle(plan, () => next(i + 1)); else next(i + 1);
  };
  next(0);
}
// of the pieces of this type lying on a tray, the one closest to the square
function spareFor(type, toCell) {
  const to = cellXY(toCell), held = game && game.held ? game.held.a : -1;
  const inHand = trayHand ? trayHand.a : game && game.trayQueue ? game.trayQueue.a : -1;
  let best = -1, bd = Infinity;
  agents.forEach((ag, a) => {
    if (ag.t !== type || a === held || a === inHand || !isTrayCell(cells[a])) return;
    const p = loose[a] || cellXY(cells[a]), d = Math.hypot(p.x - to.x, p.y - to.y);
    if (d < bd) { bd = d; best = a; }
  });
  return best;
}
// a piece leaves the tray in a straight line for its square; whatever is in the way steps aside
function bringFromTray(a, toCell) {
  const from = loose[a] || cellXY(cells[a]), end = cellXY(toCell);
  const L = Math.hypot(end.x - from.x, end.y - from.y), m = Math.max(2, Math.round(L / 0.05)), pts = [];
  for (let i = 0; i <= m; i++) pts.push({ x: from.x + (end.x - from.x) * i / m, y: from.y + (end.y - from.y) * i / m });
  const plan = roomPlan(a, pts);
  if (!plan) return null;
  loose[a] = null;
  plan.goals[a] = toCell;
  return plan;
}
// =================== the trays: no fixed places, pieces lie where they fit ===================
// Wide enough for all the pieces in rows and columns at the chosen diameter, plus 10% of free room.
function trayWidth() {
  const D = diam(), rows = Math.floor(8 / D), cols = Math.ceil(agents.length / rows);
  return Math.min(TRAY_W, cols * D * 1.1);
}
function trayRect(left) {
  const D = diam(), w = trayWidth();
  return left ? { x0: TRAY_W - w + D / 2, x1: TRAY_W - D / 2, y0: D / 2, y1: 8 - D / 2 }
    : { x0: W - TRAY_W + D / 2, x1: W - TRAY_W + w - D / 2, y0: D / 2, y1: 8 - D / 2 };
}
const trayOf = j => isTrayCell(cells[j]) ? trayRect(cx(cells[j]) < TRAY_W) : null;
function roomPlan(a, pts, inAir = false) {
  const pos = agents.map((_, j) => j === a ? pts[0] : (loose[j] || cellXY(cells[j])));
  const plan = planNudge(cells, cells, opt(), { pos, a, pts, inAir, rect: j => j === a ? null : trayOf(j) });
  return plan.ok ? keepRoom(plan) : null;
}
function keepRoom(plan) {
  plan.starts = cells.slice(); plan.goals = cells.slice();
  for (const s of plan.stayed) loose[s.j] = s.at;
  return plan;
}
// What a route costs: its own length plus how far each piece has to step aside, so that a short way
// past a few pieces moving a little beats both a long way round and a piece running along the route.
const disturbance = (plan, a) => {
  const off = new Map();
  plan.segs.forEach(s => { if (s.a !== a) off.set(s.a, Math.max(off.get(s.a) || 0, s.L)); });
  let sum = 0; off.forEach(L => { sum += L; });
  return sum;
};
const routeCost = (plan, a) => plan.segs.find(s => s.a === a).L + disturbance(plan, a);
// points on a tray to try when a piece does not fit where it should: the closest and least crowded first
function spotsNear(a, q0, left) {
  const r = trayRect(left), D = diam(), spots = [];
  for (let x = r.x0; x <= r.x1 + 1e-9; x += D / 3) for (let y = r.y0; y <= r.y1 + 1e-9; y += D / 3) spots.push({ x, y });
  const crowd = q => { let c = 0; agents.forEach((_, j) => { if (j !== a && trayOf(j)) { const p = loose[j] || cellXY(cells[j]), d = Math.hypot(p.x - q.x, p.y - q.y); if (d < D) c += D - d; } }); return c; };
  const score = q => Math.hypot(q.x - q0.x, q.y - q0.y) + 3 * crowd(q);
  return spots.sort((p, q) => score(p) - score(q)).slice(0, 24);
}
// The shortest way off the board: along its rank to the edge of the tray, stopping as soon as it is
// inside. If the pieces there cannot make room at that point, the nearest point where they can.
function removeToTray(a, fromCell, slot) {
  const from = cellXY(fromCell), left = cx(slot) < TRAY_W, r = trayRect(left), edge = left ? r.x1 : r.x0;
  const tries = [{ x: edge, y: from.y }, ...spotsNear(a, from, left)];
  const before = cells;
  const straight = end => {
    const L = Math.hypot(end.x - from.x, end.y - from.y), m = Math.max(2, Math.round(L / 0.05)), pts = [];
    for (let i = 0; i <= m; i++) pts.push({ x: from.x + (end.x - from.x) * i / m, y: from.y + (end.y - from.y) * i / m });
    return pts;
  };
  const pos = agents.map((_, j) => j === a ? from : (loose[j] || cellXY(cells[j])));
  const attempt = extra => { const plan = planNudge(cells, cells, opt(), { pos, a, inAir: false, rect: j => j === a ? null : trayOf(j), ...extra }); return plan.ok ? plan : null; };
  cells = before.slice(); cells[a] = slot;
  // straight along its rank, if that disturbs nothing; if it does, routes to other points on the edge of the tray, between pieces too
  const direct = attempt({ pts: straight(tries[0]) });
  if (direct && disturbance(direct, a) < 1e-6) { loose[a] = tries[0]; return keepRoom(direct); }
  let best = direct, bestEnd = tries[0], bestCost = direct ? routeCost(direct, a) : Infinity;
  const inlet = left ? TRAY_W - 0.5 : W - TRAY_W + 0.5;
  for (let y = Math.max(r.y0, from.y - 2); y <= Math.min(r.y1, from.y + 2) + 1e-9; y += 0.25) {
    const to = { x: inlet, y: Math.round(y * 2) / 2 };
    if (to.y < r.y0 || to.y > r.y1) continue;
    const plan = attempt({ to });
    if (!plan) continue;
    const pts = plan.segs.find(s => s.a === a).pts, end = pts[pts.length - 1], cost = routeCost(plan, a);
    if (cost < bestCost - 1e-6) { best = plan; bestEnd = end; bestCost = cost; }
  }
  if (best) { loose[a] = bestEnd; return keepRoom(best); }
  for (const end of tries.slice(1)) {
    const plan = attempt({ pts: straight(end) });
    if (plan) { loose[a] = end; return keepRoom(plan); }
  }
  cells = before;
  return null;
}
function runSettle(plan, then) {
  plan.starts = plan.starts || cells.slice(); plan.goals = plan.goals || cells.slice();
  anim = { plan, by: buildIndex(plan, agents.length), t: 0, prev: performance.now(), kind: 'settle', then };
}
function afterMove() {
  const g = game; if (!g) return;
  if (g.placing) { cells[g.placing.a] = g.placing.cell; g.placing = null; }
  if (g.held) { // play goes on only once the captured piece is off the board
    if (g.held.queued === null) { g.phase = 'hold'; refreshGame(); return; }
    finishDrop(g, g.held.queued, afterMove);
    return;
  }
  if (g.trayQueue) { const q = g.trayQueue; g.trayQueue = null; layOnTray(q.a, q.pt, afterMove); return; }
  const st = CH.status(g.st);
  if (g.bot) { g.frames[g.history.length] = snapshot(g); botNext(g); return; }
  if (!g.m2) { g.phase = 'user'; refreshGame(); return; }
  if (!g.st.white) { // the user just moved
    g.userMoves++;
    if (st === 'mate') { g.result = 'win'; g.phase = 'done'; refreshGame(); return; }
    if (st === 'stalemate') { g.result = 'lose'; g.loseMsg = 'Stalemate: Black has no moves, but it is not mate.'; g.phase = 'done'; refreshGame(); return; }
    if (g.userMoves >= 2) { g.result = 'lose'; g.loseMsg = 'Not mate. Restart the position to try again.'; g.phase = 'done'; refreshGame(); return; }
    g.phase = 'robot'; refreshGame();
    setTimeout(() => { const d = CH.defend(g.st); if (game !== g) return; g.refuted = d.refutes; playMove(d.move); }, 450);
  } else { g.phase = 'user'; refreshGame(); }
}
function legalFrom(sq) {
  if (!game) return [];
  return CH.legal(game.st).filter(m => m.from === sq);
}
function pickPromo(list) { // auto-promote to the best piece available in the tray
  for (const t of 'QRBN') { const m = list.find(x => x.promo && x.promo.toUpperCase() === t); if (m) return m; }
  return list[0];
}
// =================== a captured piece in the hand ===================
const PIECE_NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const mouse = { x: 0, y: 0 };
function trackMouse(e) {
  const rect = cv.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) / S - PAD; mouse.y = (e.clientY - rect.top) / S - PAD;
  if (flip) { mouse.x = W + 2 * GAP - mouse.x; mouse.y = 8 - mouse.y; }
}
window.addEventListener('pointermove', trackMouse);
// where a piece held over a tray would lie, in board coordinates
function dropPoint(x, y, side) {
  const r = trayRect(side === 0), gx = side === 0 ? x : x - 2 * GAP;
  return { x: Math.max(r.x0, Math.min(r.x1, gx)), y: Math.max(r.y0, Math.min(r.y1, y)) };
}
const traySide = x => x < vx(TRAY_W + 0.5) - 0.5 ? 0 : x > vx(TRAY_W + 0.5) + 7.5 ? 1 : -1;
function dropHeld() {
  const g = game, side = traySide(mouse.x);
  if (side < 0) { flashHold('Drop it on a tray, left or right of the board.'); return; }
  const pt = dropPoint(mouse.x, mouse.y, side);
  if (anim) { g.held.queued = pt; refreshGame(); return; } // settled when the capturing piece arrives
  finishDrop(g, pt, () => { if (g.phase === 'hold') afterMove(); refreshGame(); });
}
// it lies where it was dropped; the pieces there move by the least that makes it fit
function finishDrop(g, pt, then) {
  const a = g.held.a;
  g.held = null;
  cv.classList.remove('holding');
  layOnTray(a, pt, then);
}
function layOnTray(a, pt, then) {
  const left = pt.x < W / 2;
  if ((cx(cells[a]) < TRAY_W) !== left) { const c = freeTraySlotOn(left, cellXY(cells[a])); if (c >= 0) { cells = cells.slice(); cells[a] = c; } }
  let plan = null, at = pt;
  for (const q of [pt, ...spotsNear(a, pt, left)]) { plan = roomPlan(a, [q, { ...q }], true); if (plan) { at = q; break; } }
  loose[a] = at;
  if (plan && plan.stayed.length) { plan.segs = plan.segs.filter(x => x.a !== a); runSettle(plan, then); } else then();
}
// =================== free hands on the trays, at any moment of a game ===================
// Press and drag, or click a piece and click where it goes. It counts as lying where it was until it is
// put down; while the robots are moving it waits on its new spot for them to finish.
let trayHand = null;
const handPiece = () => {
  const g = game; if (!g) return -1;
  if (trayHand && trayHand.moved) return trayHand.a;
  return g.held && g.held.queued === null ? g.held.a : -1;
};
function trayPieceAt(x, y) {
  let best = -1, bd = pieceBase() / 2;
  agents.forEach((_, a) => {
    if (!isTrayCell(cells[a]) || (game.held && game.held.a === a) || (anim && anim.by[a].length)) return;
    const p = loose[a] || cellXY(cells[a]), d = Math.hypot(vx(p.x) - x, p.y - y);
    if (d < bd) { bd = d; best = a; }
  });
  return best;
}
function dropTrayHand(g) {
  const a = trayHand.a, side = traySide(mouse.x);
  trayHand = null; cv.classList.remove('dragging');
  if (side >= 0) putOnTray(g, a, dropPoint(mouse.x, mouse.y, side));   // anywhere else: it goes back where it lay
  refreshGame();
}
function putOnTray(g, a, pt) {
  if (anim || g.phase === 'moving' || g.phase === 'hold') { g.trayQueue = { a, pt }; return; }
  layOnTray(a, pt, () => traySettled(g));
}
function traySettled(g) {
  if (game !== g) return;
  if (g.trayQueue) { const q = g.trayQueue; g.trayQueue = null; layOnTray(q.a, q.pt, () => traySettled(g)); return; }
  if (g.deferred) { const d = g.deferred; g.deferred = null; playMove(...d); }
}
function flashHold(text) { $('gStatus').textContent = text; }
// leaving the position while still holding a piece: it goes to the nearest free tray cell
function releaseHeld() {
  const g = game; if (!g || !g.held) return;
  g.held = null; cv.classList.remove('holding');
}
// the square under the pointer, or -1 outside the board
function squareAtMouse() {
  const f = Math.floor(mouse.x - TRAY_W - GAP), r = Math.floor(mouse.y);
  return f < 0 || f > 7 || r < 0 || r > 7 ? -1 : r * 8 + f;
}
const canMove = g => g && !anim && g.phase === 'user' && !g.held && g.view === null && CH.status(g.st) !== 'mate' && CH.status(g.st) !== 'stalemate';
// =================== dragging a piece, as on chess.com or lichess (clicking two squares still works) ===================
const DRAG_START = 0.12;   // squares the pointer has to travel before a press counts as a drag
let drag = null, skipClick = false;
cv.addEventListener('pointerdown', e => {
  skipClick = false;
  if (e.button !== 0) return;
  trackMouse(e);
  const g = game, sq = squareAtMouse();
  if (g && trayHand) { trayHand.dropping = true; skipClick = true; return; }   // a piece picked up with a click
  if (g && g.view === null && !g.trayQueue && !(g.held && g.held.queued === null)) {
    const a = trayPieceAt(mouse.x, mouse.y);
    if (a >= 0) { trayHand = { a, x: mouse.x, y: mouse.y, moved: false }; skipClick = true; return; }
  }
  if (!canMove(g) || sq < 0 || !legalFrom(sq).length) return;
  drag = { sq, a: boardAgents().get(sqToCell(sq)), x: mouse.x, y: mouse.y, moved: false };
});
window.addEventListener('pointermove', () => {
  if (trayHand && !trayHand.moved && Math.hypot(mouse.x - trayHand.x, mouse.y - trayHand.y) >= DRAG_START) { trayHand.moved = trayHand.dragged = true; cv.classList.add('dragging'); refreshGame(); }
  if (!drag || drag.moved || Math.hypot(mouse.x - drag.x, mouse.y - drag.y) < DRAG_START) return;
  drag.moved = true; game.sel = drag.sq; game.hint = -1; cv.classList.add('dragging');
});
window.addEventListener('pointerup', e => {
  if (trayHand) {
    trackMouse(e);
    if (trayHand.dragged || trayHand.dropping) dropTrayHand(game);
    else { trayHand.moved = true; cv.classList.add('dragging'); refreshGame(); }   // only clicked: it stays on the cursor
    return;
  }
  const d = drag; drag = null; cv.classList.remove('dragging');
  if (!d || !d.moved) return;
  trackMouse(e);
  skipClick = true;
  const g = game, to = squareAtMouse();
  const ms = canMove(g) && to !== d.sq ? legalFrom(d.sq).filter(m => m.to === to) : [];
  if (ms.length) playMove(ms.length > 1 ? pickPromo(ms) : ms[0], true, true);
});
window.addEventListener('pointercancel', () => { drag = null; trayHand = null; cv.classList.remove('dragging'); });
window.addEventListener('keydown', e => { if (e.code === 'Escape' && trayHand) { trayHand = null; cv.classList.remove('dragging'); refreshGame(); } });
cv.addEventListener('click', e => {
  const g = game;
  if (skipClick) { skipClick = false; return; }
  trackMouse(e);
  if (g && g.view !== null) { viewPly(g, g.history.length); return; }   // looking back: a click on the board returns to the game
  if (g && g.held && g.held.queued === null) { dropHeld(); return; }
  if (!g || anim || g.phase !== 'user' || CH.status(g.st) === 'mate' || CH.status(g.st) === 'stalemate') return;
  const sq = squareAtMouse();
  if (sq < 0) { g.sel = -1; return; }
  const p = g.st.b[sq];
  if (g.sel >= 0) {
    const ms = legalFrom(g.sel).filter(m => m.to === sq);
    if (ms.length) { playMove(ms.length > 1 ? pickPromo(ms) : ms[0], true); return; }
  }
  g.sel = (p && (p === p.toUpperCase()) === g.st.white && legalFrom(sq).length) ? sq : -1;
});
$('gRestart').addEventListener('click', () => { if (game && !anim) request(currentKey); });
$('gHint').addEventListener('click', () => { if (game && game.keys && game.keys.length && game.history.length === 0) { game.hint = game.keys[0].from; game.sel = -1; $('gStatus').textContent = 'Hint: the highlighted piece starts the combination.'; } });
$('gSolution').addEventListener('click', () => { if (game && game.keys && game.keys.length) { const st0 = CH.fromFEN(game.pz.fen, true); $('gStatus').textContent = 'Key move: ' + game.keys.map(k => CH.san(st0, k)).join(' or '); $('gStatus').className = 'game-status'; } });
function drawGameMarks() {
  const g = game; if (!g || anim && anim.kind === 'setup') return;
  const box = (sq, col, a) => { ctx.fillStyle = col; ctx.globalAlpha = a; ctx.fillRect(sqX(sq) - 0.5, sqY(sq) - 0.5, 1, 1); ctx.globalAlpha = 1; };
  const { last, st } = g.view !== null ? g.frames[g.view] : { last: g.last, st: g.st };
  if (last) { box(last.from, tok['--accent'], 0.22); box(last.to, tok['--accent'], 0.32); }
  if (g.hint >= 0) box(g.hint, tok['--good'] || '#2f8a57', 0.45);
  if (g.sel >= 0) box(g.sel, tok['--accent'], 0.5);
  if (CH.inCheck(st)) {
    const k = st.b.indexOf(st.white ? 'K' : 'k');
    if (k >= 0) { ctx.strokeStyle = '#d23c2c'; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.arc(sqX(k), sqY(k), 0.45, 0, 7); ctx.stroke(); }
  }
}
function drawGameDots() {
  const g = game; if (!g || anim || g.sel < 0) return;
  if (drag && drag.moved && legalFrom(g.sel).some(m => m.to === squareAtMouse())) {
    const q = squareAtMouse();
    ctx.strokeStyle = tok['--accent']; ctx.lineWidth = 0.05; ctx.strokeRect(sqX(q) - 0.475, sqY(q) - 0.475, 0.95, 0.95);
  }
  for (const m of legalFrom(g.sel)) {
    ctx.fillStyle = tok['--accent']; ctx.globalAlpha = 0.85;
    ctx.beginPath();
    if (g.st.b[m.to] || m.ep) { ctx.lineWidth = 0.07; ctx.strokeStyle = tok['--accent']; ctx.arc(sqX(m.to), sqY(m.to), 0.44, 0, 7); ctx.stroke(); }
    else { ctx.arc(sqX(m.to), sqY(m.to), 0.13, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}

// =================== buclă ===================
function frame(now) {
  if (anim) {
    const dt = Math.min(0.1, (now - anim.prev) / 1000); anim.prev = now;
    anim.t += dt * speed();
    const mk = anim.plan.makespan;
    $('prog').style.width = Math.min(100, 100 * anim.t / (mk || 1)) + '%';
    $('clock').textContent = `${(Math.min(anim.t, mk) / speed()).toFixed(1)} / ${(mk / speed()).toFixed(1)} s · ${ALGOS[anim.plan.algo].short}`;
    if (anim.t >= mk) {
      const finished = anim; cells = anim.plan.goals.slice(); lastPlan = anim.plan; anim = null;
      $('clock').textContent = 'done · ' + ALGOS[lastPlan.algo].short;
      if (!pending) { if (finished.kind === 'setup') startGame(finished.pz); else if (finished.kind === 'move') afterMove(finished); else if (finished.then) finished.then(); }
      if (pending) { const p = pending; pending = null; $('queueTag').textContent = '→'; setTimeout(() => launch(p.key, p.pz), 350); }
    }
  }
  draw();
  requestAnimationFrame(frame);
}
applyThemeDiameter();
resize();
document.fonts && document.fonts.ready.then(() => draw());
requestAnimationFrame(frame);
// on opening, always the same: the board ready for a game against Stockfish at Elo 800, with you as White
$('botElo').value = 800; $('botColor').value = 'w';
setTimeout(() => request('bot'), 300);
