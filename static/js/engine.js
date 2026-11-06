// ===== Motor de planificare: grilă 12x8 (2 coloane tavă + 8 tablă + 2 coloane tavă) =====
// each tray is 4 columns of 8 places, so all the pieces fit on one of them
const TRAY_W = 4, W = 8 + 2 * TRAY_W, H = 8, N = W * H, SQ2 = Math.SQRT2;
const DIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const cx = c => c % W, cy = c => (c / W) | 0;
const cellXY = c => ({ x: cx(c) + 0.5, y: cy(c) + 0.5 });
const idx = (x, y) => y * W + x;

// vecini precalculați
const NB = [];
for (let c = 0; c < N; c++) {
  const x = cx(c), y = cy(c), list = [];
  DIRS.forEach(([dx, dy], k) => {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
    const diag = dx !== 0 && dy !== 0;
    list.push({ n: idx(nx, ny), k, diag, o1: diag ? idx(nx, y) : -1, o2: diag ? idx(x, ny) : -1 });
  });
  NB.push(list);
}

// distanțe BFS pe grila goală (4 și 8 vecini, în pași)
function allPairs(diag) {
  const D = new Int16Array(N * N).fill(9999);
  for (let s = 0; s < N; s++) {
    const q = [s]; D[s * N + s] = 0;
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      for (const nb of NB[c]) {
        if (!diag && nb.diag) continue;
        if (D[s * N + nb.n] > D[s * N + c] + 1) { D[s * N + nb.n] = D[s * N + c] + 1; q.push(nb.n); }
      }
    }
  }
  return D;
}
const DIST4 = allPairs(false), DIST8 = allPairs(true);
const octile = (a, b) => { const dx = Math.abs(cx(a) - cx(b)), dy = Math.abs(cy(a) - cy(b)); return Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy); };
const manh = (a, b) => Math.abs(cx(a) - cx(b)) + Math.abs(cy(a) - cy(b));

// heap minimal
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f < n.f || (a[p].f === n.f && a[p].h <= n.h)) break; a[i] = a[p]; i = p; } a[i] = n; }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { let i = 0; const n = last; for (;;) { let l = 2 * i + 1, r = l + 1, m = i, mv = n; if (l < a.length && (a[l].f < mv.f || (a[l].f === mv.f && a[l].h < mv.h))) { m = l; mv = a[l]; } if (r < a.length && (a[r].f < mv.f || (a[r].f === mv.f && a[r].h < mv.h))) { m = r; mv = a[r]; } if (m === i) break; a[i] = a[m]; i = m; } a[i] = n; } return top; }
}

// Hungarian (minimizare), matrice n x n -> rând i primește coloana ans[i]
function hungarian(a) {
  const n = a.length, INF = 1e18;
  const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0), p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0;
    const minv = new Array(n + 1).fill(INF), used = new Array(n + 1).fill(false);
    do {
      used[j0] = true; const i0 = p[j0]; let delta = INF, j1 = 0;
      for (let j = 1; j <= n; j++) if (!used[j]) {
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const ans = new Array(n);
  for (let j = 1; j <= n; j++) ans[p[j] - 1] = j - 1;
  return ans;
}

// ---------- configurații ----------
// No piece has a place of its own. A piece not in play goes to the tray on its side of the board: files a-d
// to the left, e-h to the right; one already on a tray stays on it. Each tray fills its two columns next to
// the board first, the farther one before the nearer, and the outer two only when those are full.
const column = col => [...Array(8).keys()].map(r => idx(col, r));
const TRAY_CELLS = {
  left: [TRAY_W - 2, TRAY_W - 1, TRAY_W - 3, TRAY_W - 4].flatMap(column),
  right: [W - TRAY_W + 1, W - TRAY_W, W - TRAY_W + 2, W - TRAY_W + 3].flatMap(column),
};
const onLeft = c => cx(c) < W / 2;
const WRONG_TRAY = 1000;   // far above any distance: a leftover piece never crosses to the other tray
// the 32 pieces of a game and a spare queen of each colour, waiting on the trays for a promotion
const FULL_SET = 'KQRRBBNNPPPPPPPPkqrrbbnnppppppppQq'.split('');

function parseFEN(fen) {
  const map = new Map();
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += +ch;
      else { map.set(idx(TRAY_W + f, r), ch); f++; }
    }
  });
  return map;
}

// which tray cell gets which leftover piece: the back column first; among those, the choice that
// moves the pieces least, so a piece already sitting in the back column stays where it is
function fillTray(cfg, types, cells, agents, starts) {
  if (!starts) { types.forEach((t, i) => cfg.set(cells[i], t)); return; }
  const FRONT = 1000;                       // far above any distance: the front column is the last resort
  const BEHIND = 4;                         // squeezing in behind a piece costs more than that piece stepping back
  const at = new Map(); starts.forEach((c, a) => at.set(c, a));
  const cost = t => cells.map((c, i) => {
    let d = Infinity;
    agents.forEach((ag, a) => {
      if (ag.t !== t) return;
      const blocker = i < 8 ? at.get(cells[i + 8]) : undefined;     // who stands in front of this back place
      const behind = blocker !== undefined && blocker !== a && starts[a] !== c;
      d = Math.min(d, octile(starts[a], c) + (behind ? BEHIND : 0));
    });
    return d + (d > 0 ? 0.35 : 0) + (i >= 16 ? 2 * FRONT : i >= 8 ? FRONT : 0);
  });
  const m = types.map(cost);
  while (m.length < cells.length) m.push(new Array(cells.length).fill(0));   // empty places
  const res = hungarian(m);
  types.forEach((t, i) => cfg.set(cells[res[i]], t));
}

// Which pieces of each type are left over, once the position has taken the closest ones:
// a piece on a tray can stay as it is, one on the board has at least the way to the nearer tray to go.
function leftovers(board, agents, starts) {
  const out = new Set(), wanted = {};
  for (const [c, t] of board) (wanted[t] = wanted[t] || []).push(c);
  const parking = c => { const f = cx(c) - TRAY_W; return f < 0 || f > 7 ? 0 : Math.min(f + 1, 8 - f) + 0.35; };
  [...new Set(agents.map(ag => ag.t))].forEach(t => {
    const ag = agents.map((_, a) => a).filter(a => agents[a].t === t), tg = wanted[t] || [];
    const res = hungarian(ag.map(a => ag.map((_, j) => {
      if (j >= tg.length) return parking(starts[a]);
      const d = octile(starts[a], tg[j]);
      return d + (d > 0 ? 0.35 : 0);
    })));
    ag.forEach((a, i) => { if (res[i] >= tg.length) out.add(a); });
  });
  return out;
}
// ținta completă: celulă -> tip pentru toate cele 32 de piese
function targetConfig(fen, agents, starts) {
  const board = parseFEN(fen);
  const need = {};
  FULL_SET.forEach(t => need[t] = (need[t] || 0) + 1);
  const cfg = new Map();
  for (const [c, t] of board) { cfg.set(c, t); need[t]--; }
  const sides = { left: [], right: [] };
  for (const t in need) if (need[t] < 0) throw new Error('Prea multe piese de tip ' + t);
  if (starts) {
    cfg.leftovers = leftovers(board, agents, starts);
    cfg.leftovers.forEach(a => sides[onLeft(starts[a]) ? 'left' : 'right'].push(agents[a].t));
  } else for (const t in need) for (let i = 0; i < need[t]; i++) sides[t === t.toUpperCase() ? 'left' : 'right'].push(t);   // the very first layout
  fillTray(cfg, sides.left, TRAY_CELLS.left, agents, starts);
  fillTray(cfg, sides.right, TRAY_CELLS.right, agents, starts);
  return cfg;
}

const isTrayCol = c => cx(c) < TRAY_W || cx(c) >= W - TRAY_W;
const crossing = (from, to) => isTrayCol(to) && onLeft(from) !== onLeft(to) ? WRONG_TRAY : 0;
// asignare piese -> ținte, pe tip
function assign(agents, starts, cfg, mode, diag) {
  const goals = new Array(agents.length);
  const byType = {};
  agents.forEach((a, i) => (byType[a.t] = byType[a.t] || { ag: [], tg: [] }).ag.push(i));
  for (const [c, t] of cfg) byType[t].tg.push(c);
  for (const t in byType) {
    const { ag, tg } = byType[t];
    if (mode === 'bottleneck') continue;
    if (mode === 'naive') {
      const byCell = (x, y) => x - y, byStart = (a, b) => starts[a] - starts[b], stays = a => !cfg.leftovers.has(a);
      const onBoard = c => !isTrayCol(c);
      ag.filter(stays).sort(byStart).forEach((a, i, l) => goals[a] = tg.filter(onBoard).sort(byCell)[i]);
      for (const side of [true, false]) {
        const ts = tg.filter(c => !onBoard(c) && onLeft(c) === side).sort(byCell);
        ag.filter(a => !stays(a) && onLeft(starts[a]) === side).sort(byStart).forEach((a, i) => goals[a] = ts[i]);
      }
    } else {
      const m = ag.map(a => tg.map(c => {
        const d = diag ? octile(starts[a], c) : manh(starts[a], c);
        return d + (d > 0 ? 0.35 : 0) + crossing(starts[a], c); // la egalitate, preferă să mute mai puține piese
      }));
      const res = hungarian(m);
      ag.forEach((a, i) => goals[a] = tg[res[i]]);
    }
  }
  if (mode === 'bottleneck') bottleneckAssign(byType, starts, goals, diag);
  return goals;
}

// bottleneck assignment: minimize the longest trip (that's what bounds a parallel reset), then the sum
function kuhnPerfect(n, ok) {
  const match = new Array(n).fill(-1);
  const tryK = (i, seen) => { for (let j = 0; j < n; j++) if (ok(i, j) && !seen[j]) { seen[j] = 1; if (match[j] < 0 || tryK(match[j], seen)) { match[j] = i; return true; } } return false; };
  for (let i = 0; i < n; i++) if (!tryK(i, new Array(n).fill(0))) return false;
  return true;
}
function typeBottleneck(d) {
  const vals = [...new Set(d.flat())].sort((x, y) => x - y);
  for (const v of vals) if (kuhnPerfect(d.length, (i, j) => d[i][j] <= v)) return v;
  return vals[vals.length - 1];
}
function groupTypes(agents, cfg) {
  const byType = {};
  agents.forEach((a, i) => (byType[a.t] = byType[a.t] || { ag: [], tg: [] }).ag.push(i));
  for (const [c, t] of cfg) byType[t].tg.push(c);
  return byType;
}
function bottleneckValue(agents, starts, cfg, diag) {
  const D = diag ? DIST8 : DIST4, byType = groupTypes(agents, cfg);
  let L = 0;
  for (const t in byType) { const { ag, tg } = byType[t]; L = Math.max(L, typeBottleneck(ag.map(a => tg.map(c => D[c * N + starts[a]])))); }
  return L;
}
function bottleneckAssign(byType, starts, goals, diag) {
  const D = diag ? DIST8 : DIST4, mats = {};
  let L = 0;
  for (const t in byType) {
    const { ag, tg } = byType[t];
    mats[t] = ag.map(a => tg.map(c => D[c * N + starts[a]] + crossing(starts[a], c)));
    L = Math.max(L, typeBottleneck(mats[t]));
  }
  for (const t in byType) {
    const { ag, tg } = byType[t];
    const m = mats[t].map(row => row.map(v => v <= L ? v + (v > 0 ? 0.35 : 0) : 1e6 + v));
    const res = hungarian(m);
    ag.forEach((a, i) => goals[a] = tg[res[i]]);
  }
}

// ---------- A* static (o singură piesă se mișcă, restul stau) ----------
const EMPTY = new Int16Array(N).fill(-1);
function staticAstar(s, g, occ, self, diag, turnPen, occPenalty = null) {
  if (s === g) return [s];
  const S = N * 9, gS = new Float64Array(S).fill(Infinity), prev = new Int32Array(S).fill(-1), closed = new Uint8Array(S);
  const h = c => diag ? octile(c, g) : manh(c, g);
  const blocked = c => occ[c] >= 0 && occ[c] !== self;
  const heap = new Heap();
  const s0 = s * 9 + 8; gS[s0] = 0; heap.push({ f: h(s), h: h(s), st: s0 });
  while (heap.size) {
    const { st } = heap.pop();
    if (closed[st]) continue; closed[st] = 1;
    const c = (st / 9) | 0, d = st % 9;
    if (c === g) { const path = []; let x = st; while (x >= 0) { path.push((x / 9) | 0); x = prev[x]; } return path.reverse(); }
    for (const nb of NB[c]) {
      if (nb.diag && !diag) continue;
      let cost = nb.diag ? SQ2 : 1;
      if (blocked(nb.n)) { if (!occPenalty) continue; cost += occPenalty(nb.n); }
      if (nb.diag && (blocked(nb.o1) || blocked(nb.o2))) { if (!occPenalty) continue; cost += (blocked(nb.o1) ? occPenalty(nb.o1) : 0) + (blocked(nb.o2) ? occPenalty(nb.o2) : 0); }
      if (d !== 8 && d !== nb.k) { const df = Math.abs(d - nb.k), steps = Math.min(df, 8 - df); cost += turnPen * steps * 0.5; }
      const ns = nb.n * 9 + nb.k, ng = gS[st] + cost;
      if (ng < gS[ns]) { gS[ns] = ng; prev[ns] = st; const hh = h(nb.n); heap.push({ f: ng + hh, h: hh, st: ns }); }
    }
  }
  return null;
}

// ---------- utilitare de traseu ----------
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; }
function pathLen(cells) { let L = 0; for (let i = 1; i < cells.length; i++) L += (cx(cells[i]) !== cx(cells[i - 1]) && cy(cells[i]) !== cy(cells[i - 1])) ? SQ2 : (cells[i] === cells[i - 1] ? 0 : 1); return L; }

// rotunjește colțurile cu Bezier pătratic (sigur când o singură piesă se mișcă)
function smoothPoly(cells) {
  const p = cells.map(cellXY);
  // elimină punctele coliniare
  const k = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = k[k.length - 1], b = p[i], c = p[i + 1];
    const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cr) > 1e-9) k.push(b);
  }
  if (p.length > 1) k.push(p[p.length - 1]);
  if (k.length < 3) return k;
  const out = [k[0]];
  for (let i = 1; i < k.length - 1; i++) {
    const a = k[i - 1], b = k[i], c = k[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(0.48, l1 / 2, l2 / 2);
    const p0 = { x: b.x + (a.x - b.x) * r / l1, y: b.y + (a.y - b.y) * r / l1 };
    const p2 = { x: b.x + (c.x - b.x) * r / l2, y: b.y + (c.y - b.y) * r / l2 };
    for (let j = 0; j <= 8; j++) {
      const t = j / 8, u = 1 - t;
      out.push({ x: u * u * p0.x + 2 * u * t * b.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * b.y + t * t * p2.y });
    }
  }
  out.push(k[k.length - 1]);
  return out;
}

// profil trapezoidal de viteză (accelerare - croazieră - frânare), ca un motor real
function trapezoid(L) {
  const A = 2.4, V = 1.3;
  let ta = V / A, da = 0.5 * A * ta * ta, tc, v = V;
  if (2 * da >= L) { ta = Math.sqrt(L / A); v = A * ta; da = L / 2; tc = 0; } else tc = (L - 2 * da) / V;
  const T = 2 * ta + tc;
  const s = t => {
    if (t <= 0) return 0; if (t >= T) return L;
    if (t < ta) return 0.5 * A * t * t;
    if (t < ta + tc) return da + v * (t - ta);
    const r = T - t; return L - 0.5 * A * r * r;
  };
  return { T, s };
}

function makeMotionSeg(a, t0, cells, smooth) {
  const pts = smooth ? smoothPoly(cells) : cells.map(cellXY);
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const L = cum[cum.length - 1], prof = trapezoid(L);
  return { a, type: 'motion', t0, t1: t0 + prof.T, pts, cum, L, prof };
}
function makeHopSeg(a, t0, cells, stepDur) {
  return { a, type: 'hop', t0, t1: t0 + stepDur * (cells.length - 1), pts: cells.map(cellXY), stepDur };
}

const easeIO = u => 0.5 - 0.5 * Math.cos(Math.PI * u);
function segPos(seg, t) {
  const pts = seg.pts;
  if (t <= seg.t0) return pts[0];
  if (t >= seg.t1) return pts[pts.length - 1];
  if (seg.type === 'track') {   // a position every dt
    const u = (t - seg.t0) / seg.dt, k = Math.min(pts.length - 2, Math.floor(u)), f = u - k;
    return { x: pts[k].x + (pts[k + 1].x - pts[k].x) * f, y: pts[k].y + (pts[k + 1].y - pts[k].y) * f };
  }
  if (seg.type === 'steps') {
    const u = t - seg.t0, k = Math.min(pts.length - 2, Math.floor(u)), f = u - k;
    return { x: pts[k].x + (pts[k + 1].x - pts[k].x) * f, y: pts[k].y + (pts[k + 1].y - pts[k].y) * f };
  }
  if (seg.type === 'hop') {
    const u = (t - seg.t0) / seg.stepDur, k = Math.min(pts.length - 2, Math.floor(u)), f = easeIO(u - k);
    return { x: pts[k].x + (pts[k + 1].x - pts[k].x) * f, y: pts[k].y + (pts[k + 1].y - pts[k].y) * f };
  }
  const s = seg.prof.s(t - seg.t0), cum = seg.cum;
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const span = cum[hi] - cum[lo] || 1, f = (s - cum[lo]) / span;
  return { x: pts[lo].x + (pts[hi].x - pts[lo].x) * f, y: pts[lo].y + (pts[hi].y - pts[lo].y) * f };
}

// ---------- 1 & 2: planificare secvențială (un singur cărucior magnetic) ----------
let CA_ATTEMPTS = 45; let HOLDS = [0];
const CAR_SPEED = 3.2, GRAB = 0.25;
function planSequential(starts, goals, opt, carStart, naive) {
  const n = starts.length, pos = starts.slice(), occ = new Int16Array(N).fill(-1);
  pos.forEach((c, a) => occ[c] = a);
  const isGoal = new Uint8Array(N); goals.forEach(g => isGoal[g] = 1);
  const diag = naive ? false : opt.diag, tp = naive ? 0 : (opt.turn ? 1.2 : 0), smooth = !naive && opt.smooth;
  const segs = [], car = [];
  let t = 0, carPos = { ...carStart }, dist = 0, carEmpty = 0, moves = 0, temps = 0;
  const scan = [...Array(n).keys()].sort((a, b) => starts[a] - starts[b]);

  const exec = (a, cells) => {
    const p = cellXY(pos[a]);
    const d = Math.hypot(p.x - carPos.x, p.y - carPos.y);
    if (d > 1e-6) { car.push({ type: 'line', t0: t, t1: t + d / CAR_SPEED, from: { ...carPos }, to: p }); t += d / CAR_SPEED; carEmpty += d; }
    t += GRAB;
    const seg = naive ? makeHopSeg(a, t, cells, 0.9) : makeMotionSeg(a, t, cells, smooth);
    segs.push(seg); car.push({ type: 'follow', t0: seg.t0, t1: seg.t1, seg });
    t = seg.t1 + GRAB;
    carPos = { ...seg.pts[seg.pts.length - 1] };
    dist += pathLen(cells); moves++;
    occ[pos[a]] = -1; pos[a] = cells[cells.length - 1]; occ[pos[a]] = a;
  };

  const penalty = c => pos[occ[c]] === goals[occ[c]] ? 30 : 5;
  const blockersOf = (ghost, self) => {
    const bl = [];
    const add = c => { if (occ[c] >= 0 && occ[c] !== self && !bl.includes(occ[c])) bl.push(occ[c]); };
    for (let i = 1; i < ghost.length; i++) {
      add(ghost[i]);
      const pc = ghost[i - 1], c = ghost[i];
      if (cx(pc) !== cx(c) && cy(pc) !== cy(c)) { add(idx(cx(c), cy(pc))); add(idx(cx(pc), cy(c))); }
    }
    return bl;
  };
  let focus = -1, focusTries = 0, rot = 0;
  const tabu = new Set();
  // mută piesa o într-o celulă tampon (liberă, care nu e țintă și nu e pe drumul protejat)
  const relocate = (o, avoid, depth) => {
    const free = c => occ[c] < 0;
    const seen = new Uint8Array(N), dep = new Int16Array(N), q = [pos[o]]; seen[pos[o]] = 1; let buf = -1;
    const cands = [];
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      for (const nb of NB[c]) {
        if (nb.diag && !diag) continue;
        if (seen[nb.n] || !free(nb.n)) continue;
        if (nb.diag && (!free(nb.o1) || !free(nb.o2))) continue;
        seen[nb.n] = 1; dep[nb.n] = dep[c] + 1;
        if (!isGoal[nb.n] && !avoid.has(nb.n)) cands.push(nb.n);
        q.push(nb.n);
      }
      if (cands.length >= 10) break;
    }
    // preferă celule aerisite (puțini vecini ocupați), aproape, și nu foarte departe de ținta piesei
    let bs = Infinity;
    for (const c of cands) {
      let crowd = 0; for (const nb of NB[c]) if (occ[nb.n] >= 0 && nb.n !== pos[o]) crowd++;
      const sc = dep[c] + 0.8 * crowd + 0.25 * (diag ? octile(c, goals[o]) : manh(c, goals[o]));
      if (sc < bs) { bs = sc; buf = c; }
    }
    if (buf >= 0) {
      const path = staticAstar(pos[o], buf, occ, o, diag, tp);
      if (path) { exec(o, path); tabu.add(o); temps++; return true; }
    }
    if (depth >= 3) return false;
    // piesa e închisă: alegem cea mai apropiată celulă tampon ignorând piesele și facem loc
    const seen2 = new Uint8Array(N), q2 = [pos[o]]; seen2[pos[o]] = 1; let tgt = -1;
    for (let i = 0; i < q2.length && tgt < 0; i++) {
      for (const nb of NB[q2[i]]) {
        if (nb.diag && !diag) continue;
        if (seen2[nb.n]) continue; seen2[nb.n] = 1;
        if (free(nb.n) && !isGoal[nb.n] && !avoid.has(nb.n)) { tgt = nb.n; break; }
        q2.push(nb.n);
      }
    }
    if (tgt < 0) return false;
    const ghost = staticAstar(pos[o], tgt, occ, o, diag, tp, penalty);
    if (!ghost) return false;
    const av2 = new Set([...avoid, ...ghost]);
    for (const b of blockersOf(ghost, o)) if (!relocate(b, av2, depth + 1)) return false;
    const path = staticAstar(pos[o], tgt, occ, o, diag, tp);
    if (!path) return false;
    exec(o, path); tabu.add(o); temps++; return true;
  };

  const seenStates = new Map();
  let fallback = false;
  for (let guard = 0; guard < 700; guard++) {
    const rem = scan.filter(a => pos[a] !== goals[a]);
    if (!rem.length) break;
    const key = pos.join(',');
    const cnt = (seenStates.get(key) || 0) + 1; seenStates.set(key, cnt);
    if (cnt > 2 || guard === 699) { fallback = true; break; }
    if (focus >= 0 && pos[focus] === goals[focus]) { focus = -1; tabu.clear(); }
    if (focus >= 0 && occ[goals[focus]] < 0) {
      const path = staticAstar(pos[focus], goals[focus], occ, focus, diag, tp);
      if (path) { exec(focus, path); continue; }
    }
    let best = null, bestScore = Infinity;
    for (const a of rem) {
      if (tabu.has(a) || a === focus || occ[goals[a]] >= 0) continue;
      const path = staticAstar(pos[a], goals[a], occ, a, diag, tp);
      if (!path) continue;
      if (naive) { best = { a, path }; break; }
      const p = cellXY(pos[a]);
      const score = Math.hypot(p.x - carPos.x, p.y - carPos.y) / CAR_SPEED + 0.15 * pathLen(path);
      if (score < bestScore) { bestScore = score; best = { a, path }; }
    }
    if (best) { exec(best.a, best.path); continue; }
    // blocaj: alegem o piesă-țintă și îi facem loc
    if (focus < 0 || focusTries > 4) {
      const order = naive ? rem : rem.slice().sort((x, y) => {
        const px = cellXY(pos[x]), py = cellXY(pos[y]);
        return Math.hypot(px.x - carPos.x, px.y - carPos.y) - Math.hypot(py.x - carPos.x, py.y - carPos.y);
      });
      focus = order[rot++ % order.length]; focusTries = 0; tabu.clear();
    }
    focusTries++;
    const ghost = staticAstar(pos[focus], goals[focus], occ, focus, diag, tp, penalty);
    if (!ghost) continue;
    const avoid = new Set(ghost);
    for (const o of blockersOf(ghost, focus)) relocate(o, avoid, 0);
  }
  if (fallback) {
    // plasă de siguranță: plan PIBT serializat (în fiecare pas, celulele-țintă sunt libere, deci orice ordine e validă)
    const raw = planPIBT(pos, goals, { diag: false }).rawPaths;
    const T = Math.max(...raw.map(r => r.length));
    let run = null, lastA = -1;
    const flush = () => { if (run && run.cells.length > 1) exec(run.a, run.cells); run = null; };
    for (let k = 0; k < T - 1; k++) {
      const movers = [];
      for (let a = 0; a < n; a++) { const r = raw[a]; if (k + 1 < r.length && r[k] !== r[k + 1]) movers.push(a); }
      movers.sort((x, y) => (y === lastA) - (x === lastA));
      // ordinea în pas: întâi cine eliberează o celulă, apoi cine intră în ea (trenurile PIBT)
      const sim = new Int16Array(N).fill(-1);
      for (let a = 0; a < n; a++) sim[raw[a][Math.min(k, raw[a].length - 1)]] = a;
      const ordered = [], left = movers.slice();
      while (left.length) {
        const i = left.findIndex(a => sim[raw[a][k + 1]] < 0);
        const a = left.splice(i < 0 ? 0 : i, 1)[0];
        sim[raw[a][k]] = -1; sim[raw[a][k + 1]] = a; ordered.push(a);
      }
      for (const a of ordered) {
        if (run && run.a === a) run.cells.push(raw[a][k + 1]);
        else { flush(); run = { a, cells: [raw[a][k], raw[a][k + 1]] }; }
        lastA = a;
      }
    }
    flush();
  }
  const ok = pos.every((c, a) => c === goals[a]);
  return { ok, segs, car, makespan: t, dist, carEmpty, moves, temps, waits: 0, carEnd: carPos, parallel: false, note: fallback ? 'Heuristic loop detected; the rest was done with serialized PIBT' : '' };
}

// closest approach of two pieces moving linearly during one step
function segMinDist(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) {
  const rx = ax0 - bx0, ry = ay0 - by0, vx = (ax1 - ax0) - (bx1 - bx0), vy = (ay1 - ay0) - (by1 - by0);
  const vv = vx * vx + vy * vy;
  let u = vv > 1e-12 ? -(rx * vx + ry * vy) / vv : 0;
  if (u < 0) u = 0; else if (u > 1) u = 1;
  return Math.hypot(rx + vx * u, ry + vy * u);
}
// ---------- 3: Cooperative A* (planificare prioritizată în spațiu-timp) ----------
function planCA(starts, goals, opt, budget = 0) {
  const n = starts.length, diag = opt.diag, D = diag ? DIST8 : DIST4, T = 90;
  // ordinea de bază: piese puțin „îngropate” întâi, ținte adânci întâi, drumuri lungi întâi
  const depthMap = (occSet) => {
    const dep = new Int16Array(N).fill(99), q = [];
    for (let c = 0; c < N; c++) if (!occSet[c]) { dep[c] = 0; q.push(c); }
    for (let i = 0; i < q.length; i++) for (const nb of NB[q[i]]) if (!nb.diag && dep[nb.n] > dep[q[i]] + 1) { dep[nb.n] = dep[q[i]] + 1; q.push(nb.n); }
    return dep;
  };
  const occS = new Uint8Array(N), occG = new Uint8Array(N);
  starts.forEach(c => occS[c] = 1); goals.forEach(c => occG[c] = 1);
  const depS = depthMap(occS), depG = depthMap(occG);
  const key = a => -depG[goals[a]] * 10 + depS[starts[a]] * 0.5 - D[goals[a] * N + starts[a]] * 0.1;
  const base = [...Array(n).keys()].sort((a, b) => key(a) - key(b));

  const run = (order, mode, relK = 0) => {
    const commitOrder = [];
    const occ = []; for (let t = 0; t <= T + 1; t++) occ.push(new Int16Array(N).fill(-1));
    const corner = []; for (let t = 0; t <= T + 1; t++) corner.push(new Uint8Array(N));
    const finalAt = new Int32Array(N).fill(1 << 30), lastRes = new Int32Array(N).fill(-1);
    const startMark = new Uint8Array(N); starts.forEach(c => startMark[c] = 1);
    const paths = new Array(n);
    let forcedMode = 0;
    const release = new Int32Array(N).fill(1 << 30);
    const isStationary = new Uint8Array(N); starts.forEach((c, a) => { if (c === goals[a]) isStationary[c] = 1; });
    const heldStart = (c, t) => startMark[c] === 1 && (mode === 'classic' ? t <= relK * depS[c] : (!forcedMode || (forcedMode === 1 && isStationary[c]) || t <= release[c]));
    const isOcc = (c, t) => (t <= T + 1 && occ[t][c] >= 0) || t >= finalAt[c] || heldStart(c, t);
    const DIAM = opt.diam || 0.76, geo = !!opt.geometric;
    const lastNear = new Int32Array(N).fill(-1);
    // exact check: during the step t -> t+1, does my move come closer than one piece diameter to anybody?
    const geomOK = (c, nn, t) => {
      const x0 = cx(c), y0 = cy(c), x1 = cx(nn), y1 = cy(nn);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const qx = x0 + dx, qy = y0 + dy;
        if (qx < 0 || qy < 0 || qx >= W || qy >= H || (dx === 0 && dy === 0)) continue;
        const q = qy * W + qx;
        let ex = qx, ey = qy;
        const b = t <= T + 1 ? occ[t][q] : -1;
        if (b >= 0) { const pb = paths[b], nq = t + 1 < pb.length ? pb[t + 1] : pb[pb.length - 1]; ex = cx(nq); ey = cy(nq); }
        else if (!(finalAt[q] <= t || heldStart(q, t))) continue;
        if (segMinDist(x0, y0, x1, y1, qx, qy, ex, ey) < DIAM - 1e-9) return false;
      }
      return true;
    };
    const cornerHit = (c, t) => corner[t][c] === 1 || (t > 0 && corner[t - 1][c] === 1);
    // verificare rapidă: ținta e accesibilă printre piesele neplanificate (care stau pe loc)?
    const staticOK = (a) => {
      const s = starts[a], g = goals[a];
      if (s === g) return true;
      if (startMark[g] && g !== s) return false;
      const seen = new Uint8Array(N), q = [s]; seen[s] = 1;
      for (let i = 0; i < q.length; i++) {
        if (q[i] === g) return true;
        for (const nb of NB[q[i]]) {
          if (nb.diag && !diag) continue;
          if (seen[nb.n] || (startMark[nb.n] && nb.n !== s)) continue;
          if (nb.diag && (startMark[nb.o1] || startMark[nb.o2])) continue;
          seen[nb.n] = 1; q.push(nb.n);
        }
      }
      return false;
    };
    const search = (a) => {
      const s = starts[a], g = goals[a];
      const SZ = (T + 1) * N, closed = new Uint8Array(SZ), prev = new Int32Array(SZ).fill(-1), gb = new Float32Array(SZ).fill(Infinity);
      const heap = new Heap(); const h0 = D[g * N + s];
      gb[s] = 0; heap.push({ f: h0, h: h0, st: s, g: 0 });
      while (heap.size) {
        const nd = heap.pop(), st = nd.st;
        if (closed[st]) continue; closed[st] = 1;
        const t = (st / N) | 0, c = st % N;
        if (c === g && t > lastRes[g] && t >= lastNear[g]) { const path = []; let x = st; while (x >= 0) { path.push(x % N); x = prev[x]; } return path.reverse(); }
        if (t >= T) continue;
        const tryMove = (nn, isDiag, o1, o2) => {
          if (isOcc(nn, t + 1)) return;
          if (geo) {
            if (!geomOK(c, nn, t)) return;
            const ns = (t + 1) * N + nn, ng = nd.g + 1 + (nn !== c ? (isDiag ? 0.0014 : 0.001) : 0);
            if (ng < gb[ns]) { gb[ns] = ng; prev[ns] = st; const hh = D[g * N + nn]; heap.push({ f: ng + hh, h: hh, st: ns, g: ng }); }
            return;
          }
          if (nn !== c) {
            const dx = cx(nn) - cx(c), dy = cy(nn) - cy(c);
            // intrare într-o celulă ocupată: permisă doar dacă ocupantul pleacă în aceeași direcție (tren)
            if (isOcc(nn, t)) {
              const b = occ[t][nn];
              if (b < 0 || startMark[nn] && t === 0) return;
              const pb = paths[b]; if (!pb || t + 1 >= pb.length) return;
              const q = pb[t + 1]; if (cx(q) - cx(nn) !== dx || cy(q) - cy(nn) !== dy) return;
            }
            // cineva intră în celula pe care o eliberez: doar dacă mă urmează în aceeași direcție
            if (isOcc(c, t + 1)) {
              const e = occ[t + 1][c];
              if (e < 0) return;
              const pe = paths[e]; const bx = cx(c) - dx, by = cy(c) - dy;
              if (bx < 0 || by < 0 || bx >= W || by >= H || pe[t] !== idx(bx, by)) return;
            }
          }
          if (cornerHit(nn, t + 1)) return;
          if (isDiag && (isOcc(o1, t) || isOcc(o1, t + 1) || isOcc(o2, t) || isOcc(o2, t + 1))) return;
          const ns = (t + 1) * N + nn, ng = nd.g + 1 + (nn !== c ? (isDiag ? 0.0014 : 0.001) : 0);
          if (ng < gb[ns]) { gb[ns] = ng; prev[ns] = st; const hh = D[g * N + nn]; heap.push({ f: ng + hh, h: hh, st: ns, g: ng }); }
        };
        tryMove(c, false);
        for (const nb of NB[c]) { if (nb.diag && !diag) continue; tryMove(nb.n, nb.diag, nb.o1, nb.o2); }
      }
      return null;
    };
    const commit = (a, path) => {
      paths[a] = path; startMark[starts[a]] = 0; commitOrder.push(a);
      const arr = path.length - 1;
      for (let t = 0; t <= arr; t++) { occ[t][path[t]] = a; if (t > lastRes[path[t]]) lastRes[path[t]] = t; }
      for (let t = 0; t < arr; t++) {
        const p0 = path[t], p1 = path[t + 1];
        if (cx(p0) !== cx(p1) && cy(p0) !== cy(p1))
          for (const o of [idx(cx(p1), cy(p0)), idx(cx(p0), cy(p1))]) { corner[t][o] = 1; if (t + 1 > lastRes[o]) lastRes[o] = t + 1; }
      }
      finalAt[goals[a]] = arr;
      if (geo) for (let t = 0; t < arr; t++) {
        const p0 = path[t], p1 = path[t + 1], x0 = cx(p0), y0 = cy(p0), x1 = cx(p1), y1 = cy(p1);
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const qx = x0 + dx, qy = y0 + dy;
          if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
          if (segMinDist(x0, y0, x1, y1, qx, qy, qx, qy) < DIAM - 1e-9) { const q = qy * W + qx; if (t + 1 > lastNear[q]) lastNear[q] = t + 1; }
        }
      }
    };
    if (mode === 'classic') {
      // classic prioritized planning: fixed order, unplanned pieces dodge later
      for (const a of order) {
        startMark[starts[a]] = 0;
        const path = search(a);
        if (!path) return { fail: a };
        commit(a, path);
      }
      return { paths, order: commitOrder, mode };
    }
    let left = order.slice();
    let forced = 0;
    while (left.length) {
      let done = false;
      // 1) alegere lacomă: prima piesă care își găsește drum cu celelalte neplanificate ținute pe loc
      const movers = left.filter(a => starts[a] !== goals[a]);
      // nu parca o piesă acolo unde ar închide pentru totdeauna drumul altei piese spre ținta ei
      const seals = (a) => {
        const F = new Uint8Array(N);
        for (let c = 0; c < N; c++) if (finalAt[c] < (1 << 30)) F[c] = 1;
        for (const b of left) if (starts[b] === goals[b]) F[starts[b]] = 1;
        F[goals[a]] = 1;
        for (const b of movers) {
          if (b === a) continue;
          const seen = new Uint8Array(N), q = [goals[b]]; seen[goals[b]] = 1; let ok = false;
          for (let i = 0; i < q.length && !ok; i++) for (const nb of NB[q[i]]) {
            if (nb.diag && !diag) continue;
            if (seen[nb.n] || F[nb.n]) continue;
            if (nb.diag && (F[nb.o1] || F[nb.o2])) continue;
            if (nb.n === starts[b]) { ok = true; break; }
            seen[nb.n] = 1; q.push(nb.n);
          }
          if (!ok) return true;
        }
        return false;
      };
      const pool = movers.length ? movers : left;
      const safe = pool.filter(a => !seals(a));
      for (const a of safe.concat(pool.filter(a => !safe.includes(a)))) {
        if (!staticOK(a)) continue;
        startMark[starts[a]] = 0;
        const path = search(a);
        if (path) { commit(a, path); left = left.filter(x => x !== a); done = true; break; }
        startMark[starts[a]] = 1;
      }
      if (done) continue;
      // 2) blocaj: o piesă pleacă având voie să treacă prin locurile celorlalte după 2 pași (ele trebuie să se ferească)
      forced++;
      { // timp de eliberare: piesele mai îngropate primesc mai mult timp să plece
        const cur = new Uint8Array(N); for (let c = 0; c < N; c++) cur[c] = startMark[c];
        const dep = depthMap(cur);
        for (let c = 0; c < N; c++) release[c] = 2 + 4 * dep[c];
      }
      for (const lvl of [1, 2]) {
        forcedMode = lvl;
        for (const a of (movers.length ? movers : left)) {
          startMark[starts[a]] = 0;
          const path = search(a);
          if (path) { commit(a, path); left = left.filter(x => x !== a); done = true; break; }
          startMark[starts[a]] = 1;
        }
        if (done) break;
      }
      forcedMode = 0;
      if (!done) return null;
    }
    return { paths, forced, order: commitOrder, mode };
  };
  const jit = j => j ? base.slice().sort((x, y) => key(x) - key(y) + (Math.random() - 0.5) * j) : base.slice();
  if (!budget) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const r = run(jit(attempt === 0 ? 0 : 40 * attempt), 'greedy');
      if (r) { const pl = pathsToPlan(r.paths, attempt); pl.forced = r.forced; return pl; }
    }
    return { ok: false, note: 'Cooperative A* found no working priority order' };
  }
  // ---- makespan optimizer: try many priority orders, keep the shortest plan ----
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const tStart = now();
  // A piece with nowhere to go should not step aside for the others: each one that does counts
  // as ASIDE_COST extra steps of duration, so a plan pays for it only if it saves real time.
  const ASIDE_COST = 3;
  const score = r => {
    let mk = 0, sum = 0, aside = 0;
    r.paths.forEach((p, a) => {
      mk = Math.max(mk, p.length - 1); sum += p.length - 1;
      if (starts[a] === goals[a] && p.some(c => c !== starts[a])) aside++;
    });
    return { mk, v: (mk + ASIDE_COST * aside) * 1000 + sum };
  };
  let best = null, bestV = Infinity, iters = 0;
  const improvements = [];
  const consider = (r) => {
    if (!r || !r.paths) return;
    iters++;
    const sc = score(r);
    if (sc.v < bestV) { bestV = sc.v; best = r; best.mk = sc.mk; improvements.push(sc.mk); }
  };
  const classic = (order, tries, k = 0) => {
    let o = order.slice();
    for (let i = 0; i < tries; i++) {
      const r = run(o, 'classic', k);
      if (r.paths) r.k = k;
      if (r.paths) return r;
      o = [r.fail, ...o.filter(a => a !== r.fail)];
      if (now() - tStart > budget) break;
    }
    return null;
  };
  const longest = [...Array(n).keys()].sort((a, b) => D[goals[b] * N + starts[b]] - D[goals[a] * N + starts[a]]);
  // pieces that stay put reserve their squares first; the others route around them
  const staysFirst = [...longest].sort((a, b) => (starts[b] === goals[b]) - (starts[a] === goals[a]));
  for (const k of [0, 2, 1, 3]) if (!best || now() - tStart < budget * 0.6) consider(classic(staysFirst, 12, k));
  for (const k of [0, 2, 1, 3]) if (!best || now() - tStart < budget * 0.6) consider(classic(longest, 12, k));
  if (!best || now() - tStart < budget * 0.7) consider(run(base, 'greedy'));
  if (!best) consider(run(longest, 'greedy'));
  // iterative repair: the piece that arrives last gets top priority
  let stall = 0;
  while (best && now() - tStart < budget && stall < 40) {
    const arr = best.paths.map(p => p.length - 1);
    const late = [...Array(n).keys()].sort((a, b) => arr[b] - arr[a]);
    const z = late[Math.floor(Math.random() * Math.min(3, late.length))];
    const o = [z, ...best.order.filter(a => a !== z)];
    if (Math.random() < 0.3) { const i = 1 + Math.floor(Math.random() * (n - 1)), j = 1 + Math.floor(Math.random() * (n - 1)); [o[i], o[j]] = [o[j], o[i]]; }
    const before = bestV;
    const k = best.mode === 'classic' ? (Math.random() < 0.7 ? best.k : Math.floor(Math.random() * 4)) : 0;
    consider(best.mode === 'classic' ? classic(o, 6, k) : run(o, 'greedy'));
    stall = bestV < before ? 0 : stall + 1;
  }
  if (!best) return { ok: false, note: 'The optimizer found no working priority order' };
  const pl = pathsToPlan(best.paths, iters);
  pl.iters = iters; pl.improvements = improvements; pl.mode = best.mode;
  return pl;
}

// ---------- 4: PIBT (Priority Inheritance with Backtracking), reactiv, pas cu pas ----------
function planPIBT(starts, goals, opt) {
  const n = starts.length, D = DIST4, cur = starts.slice();
  const paths = cur.map(c => [c]);
  const prio = cur.map((c, a) => (a * 0.6180339) % 1 * 0.5);
  let rnd = 12345; const rand = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let step = 0; step < 500; step++) {
    if (cur.every((c, a) => c === goals[a])) break;
    const occAt = new Int16Array(N).fill(-1); cur.forEach((c, a) => occAt[c] = a);
    const next = new Int16Array(n).fill(-1), resNext = new Int16Array(N).fill(-1), onStack = new Uint8Array(n);
    const dirOf = (a) => [cx(next[a]) - cx(cur[a]), cy(next[a]) - cy(cur[a])];
    const pibt = (a, parentCell) => {
      onStack[a] = 1;
      const r = pibtInner(a, parentCell);
      onStack[a] = 0; return r;
    };
    const pibtInner = (a, parentCell) => {
      const g = goals[a];
      const cands = [cur[a], ...NB[cur[a]].filter(nb => !nb.diag).map(nb => nb.n)]
        .map(v => ({ v, d: D[g * N + v] + rand() * 0.01 })).sort((x, y) => x.d - y.d).map(o => o.v);
      for (const v of cands) {
        if (resNext[v] >= 0) continue;
        if (v === parentCell) continue;
        const b = occAt[v];
        if (b >= 0 && b !== a && onStack[b]) continue;
        resNext[v] = a; next[a] = v;
        if (b >= 0 && b !== a) {
          if (next[b] < 0) pibt(b, cur[a]);
          const da = [cx(v) - cx(cur[a]), cy(v) - cy(cur[a])], db = dirOf(b);
          if (next[b] === v || da[0] !== db[0] || da[1] !== db[1]) {
            if (resNext[v] === a) resNext[v] = -1;
            next[a] = -1; continue;
          }
        }
        return true;
      }
      next[a] = cur[a]; resNext[cur[a]] = a; return false;
    };
    const order = [...Array(n).keys()].sort((x, y) => prio[y] - prio[x]);
    for (const a of order) if (next[a] < 0) pibt(a, -1);
    for (let a = 0; a < n; a++) { cur[a] = next[a]; paths[a].push(cur[a]); }
    for (let a = 0; a < n; a++) prio[a] = cur[a] === goals[a] ? (a * 0.6180339) % 1 * 0.5 : prio[a] + 1;
  }
  const plan = pathsToPlan(paths, 0);
  plan.rawPaths = paths;
  plan.ok = cur.every((c, a) => c === goals[a]);
  if (!plan.ok) plan.note = 'PIBT did not finish in 500 steps';
  return plan;
}

function pathsToPlan(paths, retries) {
  const segs = []; let dist = 0, waits = 0, moves = 0, mk = 0;
  paths.forEach((p, a) => {
    let last = p.length - 1; while (last > 0 && p[last] === p[last - 1]) last--;
    mk = Math.max(mk, last);
    let t = 0, nmoves = 0;
    while (t < last) {
      if (p[t] === p[t + 1]) { t++; continue; }
      const t0 = t; while (t < last && p[t] !== p[t + 1]) t++;
      const cells = p.slice(t0, t + 1);
      segs.push({ a, type: 'steps', t0, t1: t, pts: cells.map(cellXY) });
      dist += pathLen(cells); nmoves += cells.length - 1;
    }
    if (last > 0) { waits += last - nmoves; moves++; }
  });
  return { ok: true, segs, car: null, makespan: mk, dist, carEmpty: 0, moves, temps: 0, waits, parallel: true, retries };
}

// ---------- verificare: distanța minimă între centrele pieselor ----------
function buildIndex(plan, n) {
  const by = Array.from({ length: n }, () => []);
  plan.segs.forEach(s => by[s.a].push(s));
  by.forEach(l => l.sort((x, y) => x.t0 - y.t0));
  return by;
}
function agentPos(by, a, startCell, t) {
  const l = by[a];
  if (!l.length || t <= l[0].t0) return l.length ? l[0].pts[0] : cellXY(startCell);
  let s = l[0];
  for (let i = 0; i < l.length; i++) { if (l[i].t0 <= t) s = l[i]; else break; }
  return segPos(s, t);
}
function minClearance(plan, starts) {
  const n = starts.length, by = buildIndex(plan, n);
  let best = Infinity;
  for (let t = 0; t <= plan.makespan + 1e-9; t += 0.05) {
    const P = []; for (let a = 0; a < n; a++) P.push(agentPos(by, a, starts[a], t));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y);
      if (d < best) best = d;
    }
  }
  return best;
}

// one piece along a line, with the same motor profile as the others
function lineSeg(a, t0, p, q) {
  const L = Math.hypot(q.x - p.x, q.y - p.y), prof = trapezoid(L);
  return { a, type: 'motion', t0, t1: t0 + prof.T, pts: [p, q], cum: [0, L], L, prof };
}
// ---------- 6: pieces step aside, by the least that lets a moving piece through ----------
// No grid here: positions are continuous and pieces are circles of the chosen diameter. Each trip gets
// a route that disturbs as little as possible. Pieces too close to the route slide off it just far
// enough for the circle to pass, moving their neighbours only if they touch them, and go home once it
// has passed. A trip starts as soon as it collides with nothing already under way.
// With `extra` it plans a single trip along given points, from free positions: a captured piece going to a
// tray. extra = { pos: every piece's position, a, pts, rect: j => the tray a piece must stay in, or null }.
// A piece in a tray stays where it was pushed instead of going back. Instead of pts, extra.to asks for a route to that point.
function planNudge(starts, goals, opt, extra) {
  const n = starts.length, DIAM = opt.diam || 0.76, diag = opt.diag;
  const R = DIAM + 0.01, HARD = DIAM + 0.004, TICK = 0.05, TRY = 0.25;
  const minX = DIAM / 2, maxX = W - DIAM / 2, minY = DIAM / 2, maxY = H - DIAM / 2;
  const LX = 2 * W + 1, LY = 2 * H + 1, node = (i, j) => j * LX + i;
  const place = starts.slice();                 // where each piece is once everything planned so far is done
  const pos = a => extra ? extra.pos[a] : cellXY(place[a]);

  // A* on a half-square lattice; coming close to a piece costs what that piece would have to move
  function route(a, goal) {
    const bodies = []; for (let b = 0; b < n; b++) if (b !== a) bodies.push(pos(b));
    const cost = (p, q) => {
      const L = Math.hypot(q.x - p.x, q.y - p.y), steps = Math.max(1, Math.ceil(L / 0.2));
      let push = 0;
      for (let k = 0; k < steps; k++) {
        const u = (k + 0.5) / steps, x = p.x + (q.x - p.x) * u, y = p.y + (q.y - p.y) * u;
        for (const o of bodies) { const d = Math.hypot(o.x - x, o.y - y); if (d < R) push += R - d; }
      }
      return L * (1 + 4 * push / steps);
    };
    const s = pos(a), g = extra && extra.to ? extra.to : cellXY(goal), S0 = node(2 * s.x, 2 * s.y), G0 = node(2 * g.x, 2 * g.y);
    const best = new Float64Array(LX * LY).fill(Infinity), prev = new Int32Array(LX * LY).fill(-1), heap = new Heap();
    const est = (x, y) => Math.hypot(g.x - x, g.y - y);
    best[S0] = 0; heap.push({ f: est(s.x, s.y), st: S0 });
    while (heap.size) {
      const { f, st } = heap.pop();
      if (st === G0) break;
      const j = (st / LX) | 0, i = st % LX, p = { x: i / 2, y: j / 2 };
      if (f > best[st] + est(p.x, p.y) + 1e-9) continue;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if ((!di && !dj) || (!diag && di && dj)) continue;
        const q = { x: (i + di) / 2, y: (j + dj) / 2 };
        if (q.x < minX || q.x > maxX || q.y < minY || q.y > maxY) continue;
        const nx = node(i + di, j + dj), c = best[st] + cost(p, q);
        if (c < best[nx] - 1e-9) { best[nx] = c; prev[nx] = st; heap.push({ f: c + est(q.x, q.y), st: nx }); }
      }
    }
    const way = [];
    for (let x = G0; x >= 0; x = prev[x]) way.push({ x: (x % LX) / 2, y: ((x / LX) | 0) / 2 });
    way.reverse();
    // straighten where that disturbs no more, then sample and round the corners
    if (diag) for (let i = 0; i + 2 < way.length; i++) {
      while (i + 2 < way.length && cost(way[i], way[i + 2]) <= cost(way[i], way[i + 1]) + cost(way[i + 1], way[i + 2]) + 1e-9) way.splice(i + 1, 1);
    }
    const pts = [way[0]];
    for (let i = 1; i < way.length; i++) {
      const p = way[i - 1], q = way[i], L = Math.hypot(q.x - p.x, q.y - p.y), m = Math.max(1, Math.round(L / 0.05));
      for (let k = 1; k <= m; k++) pts.push({ x: p.x + (q.x - p.x) * k / m, y: p.y + (q.y - p.y) * k / m });
    }
    return pts.map((p, i) => {
      const w = Math.min(4, i, pts.length - 1 - i); let x = 0, y = 0;
      for (let k = i - w; k <= i + w; k++) { x += pts[k].x; y += pts[k].y; }
      return { x: x / (2 * w + 1), y: y / (2 * w + 1) };
    });
  }

  // where every other piece has to stand so that the circle fits along the route: the least move from
  // home that keeps it clear of the route, of the walls and of its neighbours
  function makeRoom(a, pts) {
    const X = []; for (let b = 0; b < n; b++) X.push(pos(b));
    const closest = c => {
      let bd = Infinity, bi = 0;
      for (let i = 0; i < pts.length; i += 2) { const d = Math.hypot(pts[i].x - c.x, pts[i].y - c.y); if (d < bd) { bd = d; bi = i; } }
      return { d: bd, i: bi };
    };
    for (let it = 0; it < 400; it++) {
      let worst = 0;
      for (let j = 0; j < n; j++) {
        if (j === a) continue;
        const { d, i } = closest(X[j]);
        if (d >= R) continue;
        worst = Math.max(worst, R - d - 0.008);
        let ux, uy;
        if (d > 0.02) { ux = (X[j].x - pts[i].x) / d; uy = (X[j].y - pts[i].y) / d; }
        else {
          const k = Math.min(pts.length - 1, i + 2), l = Math.max(0, i - 2), tx = pts[k].x - pts[l].x, ty = pts[k].y - pts[l].y, tl = Math.hypot(tx, ty) || 1;
          ux = -ty / tl; uy = tx / tl;
          if (!ux && !uy) uy = 1;      // a piece put down exactly on top of another: no direction of travel to go by
          // at the end of a trip into a tray, the piece in the way goes further in
          if (extra && extra.rect(j) && i >= pts.length - 3 && Math.hypot(tx, ty) > 1e-6) { ux = tx / tl; uy = ty / tl; X[j] = { x: X[j].x + ux * (R - d), y: X[j].y + uy * (R - d) }; continue; }
          const room = o => { let q = 0; for (let b = 0; b < n; b++) if (b !== j && b !== a) { const e = Math.hypot(X[b].x - X[j].x - o * ux, X[b].y - X[j].y - o * uy); if (e < 1.2) q += 1.2 - e; } return q; };
          if (room(1) > room(-1)) { ux = -ux; uy = -uy; }
        }
        X[j] = { x: X[j].x + ux * (R - d), y: X[j].y + uy * (R - d) };
        // still there after a while: it is held by a wall or a full row, so the route bends away from it
        if (it >= 40) {
          const reach = 16, bend = (R - d) * 0.25;
          for (let k = Math.max(1, i - reach); k <= Math.min(pts.length - 2, i + reach); k++) {
            const w = (1 - Math.abs(k - i) / (reach + 1)) * Math.min(1, k / 10, (pts.length - 1 - k) / 10);
            pts[k] = { x: Math.max(minX, Math.min(maxX, pts[k].x - ux * bend * w)), y: Math.max(minY, Math.min(maxY, pts[k].y - uy * bend * w)) };
          }
        }
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        if (i === a || j === a) continue;
        const dx = X[j].x - X[i].x, dy = X[j].y - X[i].y;
        if (Math.abs(dx) >= HARD || Math.abs(dy) >= HARD) continue;
        const d = Math.hypot(dx, dy);
        if (d >= HARD) continue;
        worst = Math.max(worst, HARD - d - 0.003);
        const ux = d > 1e-6 ? dx / d : 1, uy = d > 1e-6 ? dy / d : 0, gap = (HARD - d) / 2;
        X[i] = { x: X[i].x - ux * gap, y: X[i].y - uy * gap }; X[j] = { x: X[j].x + ux * gap, y: X[j].y + uy * gap };
      }
      for (let j = 0; j < n; j++) if (j !== a) {
        const b = (extra && extra.rect(j)) || { x0: minX, x1: maxX, y0: minY, y1: maxY };
        X[j] = { x: Math.max(b.x0, Math.min(b.x1, X[j].x)), y: Math.max(b.y0, Math.min(b.y1, X[j].y)) };
      }
      if (worst <= 0) return { X, closest };
    }
    return null;
  }

  const by = Array.from({ length: n }, () => []);   // committed motion of each piece, in time order
  const busyUntil = new Float64Array(n);
  const at = (a, t) => {
    const l = by[a];
    if (!l.length || t <= l[0].t0) return l.length ? l[0].pts[0] : pos0[a];
    let s = l[0]; for (const x of l) { if (x.t0 <= t) s = x; else break; }
    return segPos(s, t);
  };
  const pos0 = extra ? extra.pos : starts.map(cellXY);
  let temps = 0, moved = new Set(), most = 0, nudgeSum = 0, nudgeN = 0;

  // one trip: the piece, the pieces that make way, and when each of them moves
  function trip(a, goal, wide = false) {
    const pts = extra && extra.pts ? extra.pts.slice() : route(a, goal), room = makeRoom(a, pts);
    if (!room) return null;
    const main = motionSeg(a, 0, pts), times = [];
    const when = arc => { let lo = 0, hi = main.prof.T; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (main.prof.s(m) < arc) lo = m; else hi = m; } return hi; };
    const moves = [];
    for (let j = 0; j < n; j++) {
      if (j === a) continue;
      const h = pos(j), y = room.X[j], off = Math.hypot(y.x - h.x, y.y - h.y);
      if (off < 0.004) continue;
      // the stretch of the route during which it must not be at home or on its way
      let first = -1, last = -1;
      for (let i = 0; i < pts.length; i += 2) {
        let close = false;
        for (let u = 0; u <= 1 && !close; u += 0.25) if (Math.hypot(pts[i].x - (h.x + (y.x - h.x) * u), pts[i].y - (h.y + (y.y - h.y) * u)) < R + 0.02) close = true;
        if (close) { if (first < 0) first = i; last = i; }
      }
      moves.push({ j, h, y, off, first, last, dur: trapezoid(off).T, t0: Infinity, t1: -Infinity });
    }
    for (const m of moves) if (m.first >= 0) {
      m.t0 = when(main.cum[m.first]) - m.dur; m.t1 = when(main.cum[m.last]);
    }
    // a piece standing where a neighbour has to go leaves before it and comes back after it;
    // two that each stand where the other goes move together
    for (let it = 0; it < moves.length + 1; it++) for (const p of moves) for (const q of moves) {
      if (p === q || !isFinite(p.t0) || Math.hypot(p.y.x - q.h.x, p.y.y - q.h.y) >= HARD) continue;
      const both = Math.hypot(q.y.x - p.h.x, q.y.y - p.h.y) < HARD;
      q.t0 = Math.min(q.t0, both ? p.t0 : p.t0 - q.dur);
      q.t1 = Math.max(q.t1, both ? p.t1 : p.t1 + p.dur);
    }
    for (const m of moves) if (!isFinite(m.t0)) { m.t0 = 0; m.t1 = main.prof.T; }
    // the safe way, if the close timing does not work out: everyone is aside before the piece sets off
    if (wide) for (const m of moves) { m.t0 = -m.dur; m.t1 = main.prof.T; }
    const lead = Math.max(0, ...moves.map(m => -m.t0));
    const span = Math.max(main.prof.T, ...moves.map(m => m.t1 + m.dur)) + lead;
    return { a, goal, pts, main, moves, lead, span };
  }
  function motionSeg(a, t0, pts) {
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const L = cum[cum.length - 1], prof = trapezoid(L);
    return { a, type: 'motion', t0, t1: t0 + prof.T, pts, cum, L, prof };
  }
  // the trip's segments if it starts at time t
  function build(tr, t) {
    const segs = [{ ...tr.main, t0: t + tr.lead, t1: t + tr.lead + tr.main.prof.T }];
    for (const m of tr.moves) {
      const out = t + tr.lead + m.t0, back = t + tr.lead + m.t1;
      segs.push(motionSeg(m.j, out, [m.h, m.y]));
      if (!(extra && extra.rect(m.j))) segs.push(motionSeg(m.j, Math.max(back, out + m.dur), [m.y, m.h]));
    }
    return segs;
  }
  function fits(tr, t) {
    if (t < busyUntil[tr.a]) return false;
    for (const m of tr.moves) if (t + tr.lead + m.t0 < busyUntil[m.j] - 1e-9) return false;
    const segs = build(tr, t), mine = new Map();
    for (const s of segs) { if (!mine.has(s.a)) mine.set(s.a, []); mine.get(s.a).push(s); }
    const end = Math.max(...segs.map(x => x.t1), ...busyUntil) + 0.05;   // what is already under way must not run into it later
    // before its part in this trip a piece is still doing whatever was planned for it earlier
    const myAt = (a, tt) => { const l = mine.get(a); let s = null; for (const x of l) if (x.t0 <= tt) s = x; return s ? segPos(s, tt) : at(a, tt); };
    // a piece being put down by hand is in the air until the others have made room
    const inAir = b => extra && extra.inAir && b === extra.a;
    const ids = [...mine.keys()].filter(b => !inAir(b)), others = []; for (let b = 0; b < n; b++) if (!mine.has(b) && !inAir(b)) others.push(b);
    for (let tt = t; tt <= end; tt += TICK) {
      const P = ids.map(a => myAt(a, tt));
      for (let i = 0; i < ids.length; i++) {
        for (let k = i + 1; k < ids.length; k++) if (Math.hypot(P[i].x - P[k].x, P[i].y - P[k].y) < DIAM) return false;
        for (const b of others) { const q = at(b, tt); if (Math.abs(q.x - P[i].x) < DIAM && Math.abs(q.y - P[i].y) < DIAM && Math.hypot(q.x - P[i].x, q.y - P[i].y) < DIAM) return false; }
      }
    }
    return true;
  }
  function commit(tr, t) {
    for (const s of build(tr, t)) { by[s.a].push(s); busyUntil[s.a] = Math.max(busyUntil[s.a], s.t1); }
    by.forEach(l => l.sort((x, y) => x.t0 - y.t0));
    place[tr.a] = tr.goal;
    for (const m of tr.moves) { moved.add(m.j); if (starts[m.j] === goals[m.j]) { most = Math.max(most, m.off); nudgeSum += m.off; nudgeN++; } }
  }
  // the earliest start that collides with nothing
  function earliest(tr) {
    const last = Math.max(0, ...busyUntil) + 0.1;
    for (let t = 0; t <= last + TRY; t += TRY) if (fits(tr, t)) return t;
    return -1;
  }
  function bestTrip(a, goal) {
    let tr = trip(a, goal), t = tr ? earliest(tr) : -1;
    if (tr && t < 0) { tr = trip(a, goal, true); t = tr ? earliest(tr) : -1; }
    return t < 0 ? null : { tr, t, end: t + tr.span };
  }
  if (extra) {
    const c = bestTrip(extra.a, -1);
    if (!c) return { ok: false };
    commit(c.tr, c.t);
    const segs = by.flat();
    return { ok: true, segs, car: null, makespan: Math.max(...busyUntil), dist: segs.reduce((v, s) => v + s.L, 0), carEmpty: 0,
      moves: new Set(segs.map(s => s.a)).size, temps: 0, waits: 0, parallel: true, clearance: DIAM, algo: 'nudge', diam: DIAM, lb: 0,
      stayed: c.tr.moves.filter(m => extra.rect(m.j)).map(m => ({ j: m.j, at: m.y })) };
  }
  const taken = c => place.includes(c);
  let pending = []; starts.forEach((c, a) => { if (c !== goals[a]) pending.push(a); });
  const dist = a => octile(place[a], goals[a]);
  const TRIES = 8;
  while (pending.length) {
    const ready = pending.filter(a => !taken(goals[a])).sort((x, y) => dist(y) - dist(x)).slice(0, TRIES);
    if (ready.length) {
      // of the trips that could go next, the one that is done first
      let best = null, who = -1;
      for (const a of ready) { const c = bestTrip(a, goals[a]); if (c && (!best || c.end < best.end)) { best = c; who = a; } }
      if (!best) return { ok: false, note: 'A piece could not get through' };
      commit(best.tr, best.t);
      pending = pending.filter(x => x !== who);
      continue;
    }
    // everyone waits for someone else's square: one of them makes way on a free place nearby
    const a = pending[0]; let spot = -1, bd = Infinity;
    for (let c = 0; c < N; c++) if (!taken(c) && !goals.includes(c)) { const d = octile(place[a], c); if (d < bd) { bd = d; spot = c; } }
    if (spot < 0) return { ok: false, note: 'No free place to make way' };
    const c = bestTrip(a, spot);
    if (!c) return { ok: false, note: 'A piece could not get through' };
    commit(c.tr, c.t);
    temps++;
  }
  const segs = by.flat();
  if (minClearance({ segs, makespan: Math.max(...busyUntil) }, starts) < DIAM - 1e-3) return { ok: false, note: 'Two pieces would have touched' };
  let total = 0, mk = 0;
  for (const s of segs) { total += s.L; mk = Math.max(mk, s.t1); }
  return { ok: true, segs, car: null, makespan: mk, dist: total, carEmpty: 0, moves: new Set(segs.map(s => s.a)).size, temps, waits: 0, parallel: true, nudged: [...moved].filter(a => starts[a] === goals[a]).length, most, nudgeAvg: nudgeN ? nudgeSum / nudgeN : 0 };
}

const ALGOS = {
  naive: { name: 'Naive, one piece at a time', short: 'Naive', run: (s, g, o, car) => planSequential(s, g, o, car, true), assign: 'naive' },
  seq: { name: 'Optimized sequential', short: 'Sequential', run: (s, g, o, car) => planSequential(s, g, o, car, false), assign: 'hungarian' },
  ca: { name: 'Cooperative A* (parallel)', short: 'Coop. A*', run: (s, g, o) => planCA(s, g, o), assign: 'hungarian' },
  pibt: { name: 'PIBT (parallel, reactive)', short: 'PIBT', run: (s, g, o) => planPIBT(s, g, o), assign: 'hungarian' },
  fast: { name: 'Fastest reset (optimizer)', short: 'Fastest', run: (s, g, o) => {
    const a = planCA(s, g, { ...o, geometric: true }, o.budget || 1200), b = planPIBT(s, g, o);
    if (!a.ok) { b.note = 'Optimizer found no CA* plan; using PIBT'; return b; }
    if (b.ok && b.makespan < a.makespan) { b.iters = a.iters; b.note = 'PIBT beat the optimized CA* plan this time'; return b; }
    return a;
  }, assign: 'bottleneck' },
  nudge: { name: 'Pieces step aside', short: 'Step aside', run: (s, g, o) => {
    const a = planNudge(s, g, o);
    if (a.ok) return a;
    const b = ALGOS.fast.run(s, g, o);
    b.note = (a.note || 'Pieces could not step aside') + '; used Fastest reset';
    return b;
  }, assign: 'bottleneck' },
};

function planTransition(algoKey, agents, starts, fen, opt, carStart) {
  const cfg = targetConfig(fen, agents, starts), A = ALGOS[algoKey];
  const diag = algoKey === 'naive' ? false : (algoKey === 'pibt' ? false : opt.diag);
  const lb = bottleneckValue(agents, starts, cfg, opt.diag);
  const goals = assign(agents, starts, cfg, A.assign, diag);
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let plan = A.run(starts, goals, opt, carStart);
  if (!plan.ok && algoKey === 'ca') { plan = planPIBT(starts, goals, opt); plan.note = 'Coop. A* failed, fell back to PIBT'; }
  plan.compute = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  plan.goals = goals; plan.starts = starts.slice();
  plan.clearance = minClearance(plan, starts);
  plan.algo = algoKey; plan.lb = lb; plan.diam = opt.diam || 0.76;
  return plan;
}

if (typeof module !== 'undefined') module.exports = { bottleneckValue, planTransition, targetConfig, ALGOS, FULL_SET, parseFEN, idx, N, minClearance, planNudge };

// plan a transition where every piece already has its exact target (used for game moves)
function planFixed(algoKey, starts, goals, opt, carStart) {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let plan = ALGOS[algoKey].run(starts, goals, { ...opt, budget: Math.min(opt.budget || 400, 400) }, carStart);
  if (!plan.ok && algoKey !== 'pibt') { plan = planPIBT(starts, goals, opt); plan.note = 'Fell back to PIBT'; }
  plan.compute = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  plan.goals = goals.slice(); plan.starts = starts.slice();
  plan.clearance = minClearance(plan, starts);
  const D = opt.diag ? DIST8 : DIST4;
  plan.lb = Math.max(0, ...starts.map((s, a) => D[goals[a] * N + s]));
  plan.algo = algoKey; plan.diam = opt.diam || 0.76;
  return plan;
}
