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
function applyThemeDiameter() { if (insideBase(theme())) { $('diam').value = KING_BASE_RULE; $('diamVal').textContent = KING_BASE_RULE.toFixed(2) + ' of a square'; } }
let lastTheme = theme();
$('pieceTheme').addEventListener('change', () => {
  try { localStorage.setItem('robo-theme', theme()); } catch (e) {}
  if (!insideBase(lastTheme)) applyThemeDiameter();   // between the two "inside" themes the slider stays where it is
  lastTheme = theme();
});
// inside the base: size of each image as a multiple of the circle's diameter, and the centre of the smallest
// circle around the symbol, in fractions of the image. King and queen fill the circle; the others follow the
// height order of a real set (king, queen, bishop, knight, rook, pawn).
const INSIDE = {
  K: { s: 1.21, cx: 0.489, cy: 0.516 }, Q: { s: 1.01, cx: 0.499, cy: 0.469 }, B: { s: 0.97, cx: 0.499, cy: 0.575 },
  N: { s: 0.91, cx: 0.568, cy: 0.518 }, R: { s: 0.91, cx: 0.499, cy: 0.551 }, P: { s: 0.84, cx: 0.497, cy: 0.589 },
};

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
const diam = () => +$('diam').value;
const opt = () => ({ diag: $('optDiag').checked, turn: $('optTurn').checked, smooth: $('optSmooth').checked, diam: diam(), budget: 1000 });
$('diam').addEventListener('input', () => { $('diamVal').textContent = diam().toFixed(2) + ' of a square'; });
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
function launch(key, pz, fromStarts) {
  releaseHeld();
  agents.forEach((ag, a) => { ag.t = FULL_SET[a]; }); // a pawn promoted without a spare goes back to being a pawn
  flip = !!(pz.bot && pz.bot.human === 'b');
  currentKey = key; sel.value = key;
  $('pzName').textContent = pz.name; $('pzDesc').textContent = pz.desc;
  $('clock').textContent = algo === 'fast' ? 'optimizing paths…' : 'planning paths…'; $('note').textContent = '';
  if (fromStarts) cells = fromStarts.slice();
  setTimeout(() => {
    const starts = cells.slice();
    const plan = planTransition(algo, agents, starts, pz.fen, opt(), carPos);
    last = { starts, pz, key, carStart: { ...carPos } };
    anim = { plan, by: buildIndex(plan, agents.length), t: 0, prev: performance.now(), kind: 'setup', pz };
    endGame();
    if (plan.carEnd) carPos = { ...plan.carEnd };
    $('note').textContent = plan.note || '';
    $('replayBtn').disabled = false; $('cmpBtn').disabled = false;
    renderStats();
    lastCmp = null; $('cmpTable').hidden = true; $('cmpEmpty').hidden = false;
    $('cmpEmpty').textContent = 'Press “Compare planners” to run all six on this transition.';
  }, 20);
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
  for (const x0 of [0, W - TRAY_W]) {
    ctx.fillStyle = tok['--tray']; rrect(vx(x0) - 0.12, -0.12, TRAY_W + 0.24, 8.24, 0.22); ctx.fill();
    for (let x = x0; x < x0 + TRAY_W; x++) for (let y = 0; y < 8; y++) {
      ctx.fillStyle = tok['--tray-slot']; ctx.beginPath(); ctx.arc(vx(x + 0.5), y + 0.5, 0.34, 0, 7); ctx.fill();
    }
  }
  // tabla
  const bx = vx(TRAY_W + 0.5) - 0.5;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    ctx.fillStyle = (r + f) % 2 ? tok['--sq-dark'] : tok['--sq-light'];
    ctx.fillRect(bx + f, r, 1.002, 1.002);
  }
  ctx.font = '500 0.17px "IBM Plex Mono", monospace'; ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? tok['--sq-light'] : tok['--sq-dark'];
    ctx.textAlign = 'right'; ctx.fillText((flip ? 'hgfedcba' : 'abcdefgh')[i], bx + i + 0.94, 7.94);
    ctx.fillStyle = i % 2 ? tok['--sq-dark'] : tok['--sq-light'];
    ctx.textAlign = 'left'; ctx.fillText(String(flip ? i + 1 : 8 - i), bx + 0.05, i + 0.2);
  }
  // playing Black: everything from here on is turned around the board's centre, and each piece back upright
  if (flip) { ctx.save(); ctx.translate(wU, 8); ctx.scale(-1, -1); }

  const P = [], moving = new Uint8Array(agents.length);
  const t = anim ? anim.t : 0;
  for (let a = 0; a < agents.length; a++) {
    if (anim) {
      const p = agentPos(anim.by, a, anim.plan.starts[a], t);
      P.push(p);
      const l = anim.by[a]; for (const s of l) if (t > s.t0 && t < s.t1) moving[a] = 1;
    } else P.push(cellXY(cells[a]));
  }
  if (anim) {
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
  } else if ($('optCar').checked && (algo === 'naive' || algo === 'seq')) drawMagnet(carPos);

  // piese: întâi cele în repaus, apoi cele care se mișcă
  const order = [...agents.keys()].sort((x, y) => moving[x] - moving[y]);
  const held = game && game.held;
  if (held && held.queued !== null) P[held.a] = cellXY(held.queued);
  if (game && game.placing) P[game.placing.a] = cellXY(game.placing.cell);
  const dragged = drag && drag.moved ? drag.a : -1;
  drawGameMarks();
  for (const a of order) if (a !== dragged && (!held || held.queued !== null || a !== held.a)) drawPiece(agents[a], P[a], moving[a]);
  drawGameDots();
  if (dragged >= 0) drawPiece(agents[dragged], { x: mouse.x, y: mouse.y, screen: true }, 1);
  if (held && held.queued === null) {
    // where it would land, then the piece itself on the cursor
    const side = traySide(mouse.x), c = side < 0 ? null : dropCell(mouse.x, mouse.y, side);
    if (c !== null) { ctx.strokeStyle = tok['--accent']; ctx.lineWidth = 0.05; ctx.setLineDash([0.1, 0.07]); ctx.beginPath(); ctx.arc(vx(cx(c) + 0.5), cy(c) + 0.5, R, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    drawPiece(agents[held.a], { x: mouse.x, y: mouse.y, screen: true }, 1);
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
    const D = diam(), f = INSIDE[ag.t.toUpperCase()], size = D * f.s;
    ctx.save();
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
const sqToCell = sq => (sq >> 3) * W + TRAY_W + (sq & 7);
const sqX = sq => vx(TRAY_W + (sq & 7) + 0.5), sqY = sq => (sq >> 3) + 0.5;
function endGame() { if (game && game.bot && game.bot.brain) game.bot.brain.stop(); game = null; $('game').hidden = true; cv.classList.remove('clickable', 'holding'); }
function startGame(pz) {
  const m2 = pz.set === 'm2';
  game = { pz, st: CH.fromFEN(pz.fen, true), m2, history: [], sel: -1, last: null, phase: 'user', userMoves: 0, hint: -1, result: '' };
  if (m2) game.keys = CH.mateIn2Keys(game.st);
  $('game').hidden = false; cv.classList.add('clickable');
  $('gMode').textContent = m2 ? 'White to move · mate in two · the robot defends' : 'Free play · you move both sides';
  $('gHint').hidden = $('gSolution').hidden = !m2;
  $('gRestart').textContent = pz.bot ? 'New game' : 'Restart position';
  if (pz.bot) startBotGame(pz.bot);
  refreshGame();
}
// =================== playing Stockfish ===================
// The bot and its 7 MB engine live in static/bot/ and load only when someone wants to play.
function botPuzzle() {
  const elo = Math.max(500, Math.min(3000, Math.round(+$('botElo').value) || 800)), c = $('botColor').value;
  const human = c === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : c;
  $('botElo').value = elo;
  try { localStorage.setItem('robo-bot', JSON.stringify({ elo, c })); } catch (e) {}
  return { name: 'Playing Stockfish', desc: `Elo ${elo}. You play ${human === 'w' ? 'White' : 'Black'}.`, fen: PUZZLES[0].fen, bot: { elo, human } };
}
try { const v = JSON.parse(localStorage.getItem('robo-bot')); if (v) { $('botElo').value = v.elo; $('botColor').value = v.c; } } catch (e) {}
$('botBtn').addEventListener('click', () => request('bot'));
function startBotGame(bot) {
  const g = game;
  g.bot = { ...bot, brain: null };
  g.phase = 'loading';
  $('gMode').textContent = `You play ${bot.human === 'w' ? 'White' : 'Black'} · Stockfish at Elo ${bot.elo}`;
  import('../bot/bot.js').then(mod => {
    if (game !== g) return;
    g.bot.brain = mod.newGame();
    botNext(g);
  }).catch(e => { console.error(e); botFailed(g); });
}
function botFailed(g) { if (game !== g) return; g.phase = 'done'; g.result = 'lose'; g.loseMsg = 'Stockfish could not start in this browser.'; refreshGame(); }
function botNext(g) {
  const b = g.bot, over = b.brain.over();
  if (over) {
    const humanMated = g.st.white === (b.human === 'w');
    g.phase = 'done'; g.result = over !== 'mate' ? 'draw' : humanMated ? 'lose' : 'win';
    g.loseMsg = 'Checkmate. Stockfish wins.'; g.winMsg = 'Checkmate. You win!'; g.drawMsg = `Draw: ${over}.`;
    refreshGame(); return;
  }
  if (g.st.white === (b.human === 'w')) { g.phase = 'user'; refreshGame(); return; }
  g.phase = 'robot'; refreshGame();
  b.brain.think(b.elo, uci => {
    if (game !== g) return;
    const m = CH.legal(g.st).find(x => uciOf(x) === uci);
    if (m) playMove(m); else botFailed(g);
  }, () => botFailed(g));
}
const uciOf = m => CH.NAME(m.from) + CH.NAME(m.to) + (m.promo ? m.promo.toLowerCase() : '');
function refreshGame() {
  if (!game) return;
  const g = game, st = CH.status(g.st), side = g.st.white ? 'White' : 'Black';
  let text = '', cls = '';
  if (g.result === 'win') { text = g.winMsg || 'Checkmate. Solved!'; cls = 'win'; }
  else if (g.result === 'draw') text = g.drawMsg;
  else if (g.result === 'lose') { text = g.loseMsg || 'Not mate in two.'; cls = 'lose'; }
  else if (st === 'mate') { text = 'Checkmate. ' + (g.st.white ? 'Black' : 'White') + ' wins.'; cls = 'win'; }
  else if (st === 'stalemate') { text = 'Stalemate.'; }
  else if (g.held && g.held.queued === null) text = `Take the ${PIECE_NAME[agents[g.held.a].t.toLowerCase()]} off the board: click a free place on a tray.`;
  else if (g.phase === 'loading') text = 'Starting Stockfish…';
  else if (g.phase === 'robot') text = g.bot ? 'Stockfish is thinking…' : 'Black is thinking…';
  else if (g.phase === 'moving') text = 'Moving…';
  else text = (g.m2 || g.bot ? 'Your move' : side + ' to move') + (st === 'check' ? ' · check' : '');
  $('gStatus').textContent = text; $('gStatus').className = 'game-status ' + cls;
  cv.classList.toggle('holding', !!(g.held && g.held.queued === null));
  $('gMoves').innerHTML = g.history.map((h, i) => (i % 2 === 0 ? `<b>${(i >> 1) + 1}.</b> ` : '') + h).join(' ') || '&nbsp;';
}
function boardAgents() { const map = new Map(); cells.forEach((c, a) => map.set(c, a)); return map; }
const isTrayCell = c => cx(c) < TRAY_W || cx(c) >= W - TRAY_W;
const ALL_TRAY = Array.from({ length: N }, (_, c) => c).filter(isTrayCell);
function freeTraySlot(type, nearCell) {
  const occ = new Set(cells), dist = c => Math.hypot(cx(c) - cx(nearCell), cy(c) - cy(nearCell));
  // the tray on the side of the board where it was taken, or the tray of its colour
  const left = $('optSide').checked ? cx(nearCell) < W / 2 : type === type.toUpperCase();
  const cols = [...Array(TRAY_W).keys()], own = left ? cols : cols.map(i => W - 1 - i), other = left ? cols.map(i => W - 1 - i) : cols;
  // the far column of that tray first, then towards the board; the other tray only if this one is full
  for (const col of [...own, ...other]) {
    const free = ALL_TRAY.filter(c => cx(c) === col && !occ.has(c));
    if (free.length) return free.reduce((b, c) => dist(c) < dist(b) ? c : b);
  }
  return nearCell;
}
const inTray = (a, type) => agents[a].t === type && isTrayCell(cells[a]) && !(game && game.held && game.held.a === a);
function trayHas(type) { return agents.some((ag, a) => inTray(a, type)); }
// physical move: which robot goes where (capture to tray, rook in castling, promotion swap with a tray piece)
function playMove(m, byUser = false, dropped = false) {
  const g = game, map = boardAgents(), goals = cells.slice();
  const mover = map.get(sqToCell(m.from));
  if (m.capSq >= 0) {
    const victim = map.get(sqToCell(m.capSq)), slot = freeTraySlot(agents[victim].t, sqToCell(m.capSq));
    goals[victim] = slot;
    if (byUser && $('optHand').checked) {
      // Lifted at once, so the capturing piece finds its square empty. For the planner it already
      // waits on a free tray cell; it is drawn on the cursor until it is dropped.
      cells = cells.slice(); cells[victim] = slot;
      g.held = { a: victim, queued: null };
    }
  }
  const spare = m.promo ? agents.findIndex((ag, a) => inTray(a, m.promo)) : -1;
  if (spare >= 0) {
    goals[mover] = freeTraySlot(m.piece, sqToCell(m.from));
    goals[spare] = sqToCell(m.to);
  } else {
    if (m.promo) agents[mover].t = m.promo; // no spare on the trays: the pawn's robot takes on the new piece
    goals[mover] = sqToCell(m.to);
    if (dropped) {
      // Put there by hand, so no robot carries it. If the piece it took is still on that square, or the
      // rook has to pass it when castling, the planner sees it waiting at home until that is done;
      // it is drawn where it was dropped.
      if (m.castle || (m.capSq === m.to && !g.held)) { g.placing = { a: mover, cell: goals[mover] }; goals[mover] = cells[mover]; }
      else { cells = cells.slice(); cells[mover] = goals[mover]; }
    }
  }
  if (m.castle) goals[map.get(sqToCell(m.rookFrom))] = sqToCell(m.rookTo);
  g.history.push(CH.san(g.st, m));
  if (g.bot) g.bot.brain.play(uciOf(m));
  g.st = CH.make(g.st, m); g.last = m; g.sel = -1; g.hint = -1; g.phase = 'moving';
  refreshGame();
  setTimeout(() => {
    const plan = planFixed(algo, cells.slice(), goals, opt(), carPos);
    if (plan.carEnd) carPos = { ...plan.carEnd };
    anim = { plan, by: buildIndex(plan, agents.length), t: 0, prev: performance.now(), kind: 'move' };
    $('note').textContent = plan.note || ''; renderStats();
  }, 10);
}
function afterMove() {
  const g = game; if (!g) return;
  if (g.placing) { cells[g.placing.a] = g.placing.cell; g.placing = null; }
  if (g.held) { // play goes on only once the captured piece is off the board
    if (g.held.queued === null) { g.phase = 'hold'; refreshGame(); return; }
    cells[g.held.a] = g.held.queued; g.held = null;
  }
  const st = CH.status(g.st);
  if (g.bot) { botNext(g); return; }
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
  return CH.legal(game.st).filter(m => m.from === sq && (!m.promo || game.bot || trayHas(m.promo)));
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
// the free tray cell nearest to a point; side: 0 = left tray, 1 = right tray, -1 = both
function dropCell(x, y, side) {
  const g = game, a = g.held.a, occ = new Set(anim ? anim.plan.goals : cells);
  occ.delete(anim ? anim.plan.goals[a] : cells[a]); // its own parking cell is free for it
  const dist = c => Math.hypot(vx(cx(c) + 0.5) - x, cy(c) + 0.5 - y);
  const free = ALL_TRAY.filter(c => !occ.has(c) && (side < 0 || (side === 0) === (cx(c) < 2)));
  return free.length ? free.reduce((b, c) => dist(c) < dist(b) ? c : b) : null;
}
const traySide = x => x < vx(TRAY_W + 0.5) - 0.5 ? 0 : x > vx(TRAY_W + 0.5) + 7.5 ? 1 : -1;
function dropHeld() {
  const g = game, side = traySide(mouse.x);
  if (side < 0) { flashHold('Drop it on a tray, left or right of the board.'); return; }
  const c = dropCell(mouse.x, mouse.y, side);
  if (c === null) { flashHold('That tray is full. Use the other one.'); return; }
  if (anim) { g.held.queued = c; refreshGame(); return; } // settled when the capturing piece arrives
  cells[g.held.a] = c; g.held = null;
  if (g.phase === 'hold') afterMove();
  refreshGame();
}
function flashHold(text) { $('gStatus').textContent = text; }
// leaving the position while still holding a piece: it goes to the nearest free tray cell
function releaseHeld() {
  const g = game; if (!g || !g.held) return;
  const c = g.held.queued !== null ? g.held.queued : dropCell(mouse.x, mouse.y, -1);
  if (c !== null) cells[g.held.a] = c;
  g.held = null; cv.classList.remove('holding');
}
// the square under the pointer, or -1 outside the board
function squareAtMouse() {
  const f = Math.floor(mouse.x - TRAY_W - GAP), r = Math.floor(mouse.y);
  return f < 0 || f > 7 || r < 0 || r > 7 ? -1 : r * 8 + f;
}
const canMove = g => g && !anim && g.phase === 'user' && !g.held && CH.status(g.st) !== 'mate' && CH.status(g.st) !== 'stalemate';
// =================== dragging a piece, as on chess.com or lichess (clicking two squares still works) ===================
const DRAG_START = 0.12;   // squares the pointer has to travel before a press counts as a drag
let drag = null, skipClick = false;
cv.addEventListener('pointerdown', e => {
  skipClick = false;
  if (e.button !== 0) return;
  trackMouse(e);
  const g = game, sq = squareAtMouse();
  if (!canMove(g) || sq < 0 || !legalFrom(sq).length) return;
  drag = { sq, a: boardAgents().get(sqToCell(sq)), x: mouse.x, y: mouse.y, moved: false };
});
window.addEventListener('pointermove', () => {
  if (!drag || drag.moved || Math.hypot(mouse.x - drag.x, mouse.y - drag.y) < DRAG_START) return;
  drag.moved = true; game.sel = drag.sq; game.hint = -1; cv.classList.add('dragging');
});
window.addEventListener('pointerup', e => {
  const d = drag; drag = null; cv.classList.remove('dragging');
  if (!d || !d.moved) return;
  trackMouse(e);
  skipClick = true;
  const g = game, to = squareAtMouse();
  const ms = canMove(g) && to !== d.sq ? legalFrom(d.sq).filter(m => m.to === to) : [];
  if (ms.length) playMove(ms.length > 1 ? pickPromo(ms) : ms[0], true, true);
});
window.addEventListener('pointercancel', () => { drag = null; cv.classList.remove('dragging'); });
cv.addEventListener('click', e => {
  const g = game;
  if (skipClick) { skipClick = false; return; }
  trackMouse(e);
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
  if (g.last) { box(g.last.from, tok['--accent'], 0.22); box(g.last.to, tok['--accent'], 0.32); }
  if (g.hint >= 0) box(g.hint, tok['--good'] || '#2f8a57', 0.45);
  if (g.sel >= 0) box(g.sel, tok['--accent'], 0.5);
  if (CH.inCheck(g.st)) {
    const k = g.st.b.indexOf(g.st.white ? 'K' : 'k');
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
      if (!pending) { if (finished.kind === 'setup') startGame(finished.pz); else if (finished.kind === 'move') afterMove(finished); }
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
// demonstrație: prima tranziție pornește singură
setTimeout(() => { if (!anim && !last) request('p1'); }, 900);
