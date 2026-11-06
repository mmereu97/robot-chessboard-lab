/* The human-like Stockfish bot from chess-analysis-board (https://github.com/mmereu97/chess-analysis-board).
   The helpers and the bot brain below are copied from it, so it keeps its calibration. One change: the rule that it
   stops making mistakes when a rook or more down applies only with cfg.fightBack. The driver at the end is new. Licensed GPL-3.0, like that project: see LICENSE-GPL-3.0.txt in this folder. */
import { Chess } from "./chess.js";

const turnOf = fen => fen.split(" ")[1];
const moveNo = fen => +fen.split(" ")[5];
const FILES = "abcdefgh";
const VAL = {p:1, n:3, b:3, r:5, q:9, k:100};
const sqFR = sq => [FILES.indexOf(sq[0]), +sq[1] - 1];
const frSq = (f, r) => FILES[f] + (r + 1);
function grid(fen){ const g = {}; new Chess(fen).board().forEach(row => row.forEach(p => { if (p) g[p.square] = p; })); return g; }
function attacksFrom(g, sq, p = g[sq]){
  const [f, r] = sqFR(sq), out = [];
  const add = (a, b) => { if (a >= 0 && a < 8 && b >= 0 && b < 8) out.push(frSq(a, b)); };
  if (p.type === "p"){ const d = p.color === "w" ? 1 : -1; add(f-1, r+d); add(f+1, r+d); }
  else if (p.type === "n") [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].forEach(([a,b]) => add(f+a, r+b));
  else if (p.type === "k"){ for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (a || b) add(f+a, r+b); }
  else {
    const dirs = [];
    if (p.type !== "b") dirs.push([1,0],[-1,0],[0,1],[0,-1]);
    if (p.type !== "r") dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
    for (const [a, b] of dirs){ let x = f+a, y = r+b; while (x >= 0 && x < 8 && y >= 0 && y < 8){ const s = frSq(x, y); out.push(s); if (g[s]) break; x += a; y += b; } }
  }
  return out;
}
const attackers = (g, sq, color) => Object.keys(g).filter(s => g[s].color === color && attacksFrom(g, s).includes(sq));
function enPrise(g, sq){
  const p = g[sq], opp = p.color === "w" ? "b" : "w";
  const att = attackers(g, sq, opp); if (!att.length) return false;
  if (!attackers(g, sq, p.color).length) return "undef";
  return Math.min(...att.map(s => VAL[g[s].type])) < VAL[p.type] ? "cheaper" : false;
}
function material(fen){ let s = 0; for (const ch of fen.split(" ")[0]){ const t = ch.toLowerCase(); if (VAL[t] && t !== "k") s += (ch === t ? -1 : 1) * VAL[t]; } return s; }
function walkPv(fen, pv, max = 14){
  const c = new Chess(fen), seq = [];
  for (const u of (pv || []).slice(0, max)){ try { seq.push(c.move({from:u.slice(0,2), to:u.slice(2,4), promotion:u[4]})); } catch { break; } }
  return seq;
}
function netMaterial(fen, seq){            // white-POV material change when the line's exchanges settle
  if (!seq.length) return 0;
  let end = seq.length;
  for (let k = 6; k < seq.length; k++) if (!seq[k].captured && !seq[k-1].captured){ end = k; break; }
  return material(seq[end-1].after) - material(fen);
}
function parseInfo(line){
  const t = line.split(" "); const o = {};
  for (let i = 1; i < t.length; i++){
    const k = t[i];
    if (k === "depth") o.depth = +t[++i];
    else if (k === "multipv") o.mpv = +t[++i];
    else if (k === "score"){ const ty = t[++i], v = +t[++i]; if (ty === "cp") o.cp = v; else o.mate = v; }
    else if (k === "pv"){ o.pv = t.slice(i+1); break; }
  }
  return o.pv && (o.cp != null || o.mate != null) ? o : null;
}
let OPEN = {};
try { OPEN = await (await fetch(new URL("openings.json", import.meta.url))).json(); } catch {}
const epdOf = fen => fen.split(" ").slice(0, 4).join(" ");
function openingOf(fen){ const v = OPEN[epdOf(fen)]; if (!v) return null; const k = v.indexOf("|"); return {eco:v.slice(0, k), name:v.slice(k + 1)}; }

/* ---------- bot brain (no page state: the calibration harness runs this same code) ---------- */
/* cfg = {style:"human", elo} | {style:"window", tol} | {style:"rank", rank}
   lines = engine lines [{mpv, cp|mate, pv}] for the side to move; last = the opponent's last move */
const LIMIT_MIN = 1320;   // lowest strength Stockfish can limit itself to; below it the "human" bot is simulated
// internal strength scale: 1 = sees well and rarely errs; below 0 it sees only one move ahead and errs often
const eloT = elo => Math.max(-0.6, Math.min(1, (elo - 200) / (LIMIT_MIN - 200)));
/* measured: 250 automatic games against Stockfish limited to UCI_Elo 1320 (0.2 s per move) gave these
   [measured Elo, internal setting] pairs; the Elo you type is turned into the internal setting that played at that level */
const ELO_CAL = [[541, -472], [627, 0], [751, 200], [918, 400], [1244, 800], [1779, 1100]];
function eloToInternal(elo){
  if (elo <= ELO_CAL[0][0]) return ELO_CAL[0][1];
  for (let i = 1; i < ELO_CAL.length; i++){
    const [e0, v0] = ELO_CAL[i - 1], [e1, v1] = ELO_CAL[i];
    if (elo <= e1) return v0 + (v1 - v0) * (elo - e0) / (e1 - e0);
  }
  return ELO_CAL[ELO_CAL.length - 1][1];
}
const lineScore = o => o.mate != null ? (o.mate > 0 ? 100000 - o.mate * 100 : -100000 - o.mate * 100) : o.cp;
function weightedPick(items, weight, rnd){
  const w = items.map(weight); let x = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++){ x -= w[i]; if (x <= 0) return items[i]; }
  return items[items.length - 1];
}
const OPENING_MOVES = 8;   // in the first moves the human bot plays sound, mostly book moves
function botPlan(cfg, fen){
  if (cfg.style === "window" || cfg.style === "rank") return {multipv:10, depth:10};
  const depth = Math.max(1, 2 + Math.round(6 * eloT(cfg.elo)));
  if (cfg.fightBack && fen && behindBy(fen) >= 5) return {multipv:8, depth:12};
  if (fen && pawnAlarm(fen)) return {multipv:8, depth:Math.max(depth, 9)};
  return {multipv:8, depth: fen && moveNo(fen) <= OPENING_MOVES ? Math.max(depth, 10) : depth};
}
/* an enemy passed pawn on its 5th rank or further: a person stops thinking about anything else */
function pawnAlarm(fen){
  const g = grid(fen), me = turnOf(fen), op = me === "w" ? "b" : "w";
  return Object.keys(g).some(s => {
    const p = g[s]; if (p.type !== "p" || p.color !== op) return false;
    const [f, r] = sqFR(s), rel = op === "w" ? r : 7 - r;      // 0-based rank from the pawn's own side
    if (rel < 4) return false;
    return !Object.keys(g).some(q => { const x = g[q]; if (x.type !== "p" || x.color !== me) return false;
      const [a, b] = sqFR(q); return Math.abs(a - f) <= 1 && (op === "w" ? b > r : b < r); });
  });
}
/* material the side to move is behind by (pawn 1, minor 3, rook 5, queen 9) */
const behindBy = fen => { const w = material(fen); return turnOf(fen) === "w" ? -w : w; };
/* material the side to move loses along an engine line, once the exchanges settle */
const lineMatLoss = (fen, o) => { const seq = walkPv(fen, o.pv); return turnOf(fen) === "w" ? -netMaterial(fen, seq) : netMaterial(fen, seq); };
/* every legal move with what a human would notice about it */
/* in the app the openings database tells which moves are "book"; the calibration harness has none */
/* odd sidelines the database names but real club players almost never choose: the bot does not count them as book */
const ODD_OPEN = /^(Ware|Barnes|Borg|Amar|Grob|Kádas|Clemenz|Sodium|St\. George|Lemming|Fried Fox|Bongcloud|Gunderam|Irish|Carr|Goldsmith|Duras|Basque|Canard|Paleface|Global|Lasker Simul|Saragossa|Valencia|Australian|Montevideo|Zaire|Wade|Döry|Vulture|Creepy Crawly|Amsterdam|Amazon|Mexican|Polish|Kangaroo|Hippopotamus|Anderssen|Van't Kruijs|Mieses|Pterodactyl|Englund|Latvian|Elephant|Nimzowitsch Defense|Rat Defense|Durkin|Formation|Lion Defense|Mikenas|Horwitz|Czech|Ware)/;
const isBookPos = fen => { if (typeof openingOf !== "function") return false; const o = openingOf(fen); return !!o && !ODD_OPEN.test(o.name); };
function humanMoves(fen, last){
  const c = new Chess(fen), g0 = grid(fen), me = c.turn(), op = me === "w" ? "b" : "w";
  const homeRank = me === "w" ? "1" : "8";
  const opening = moveNo(fen) <= 12;
  const hangingBefore = Object.keys(g0).filter(s => g0[s].color === me && g0[s].type !== "k" && VAL[g0[s].type] >= 3 && enPrise(g0, s));
  const oppK = Object.keys(g0).find(s => g0[s].type === "k" && g0[s].color === op);
  const lastAtt = last && g0[last.to] && g0[last.to].color === op ? attacksFrom(g0, last.to) : [];
  const threatened = hangingBefore.filter(s => lastAtt.includes(s) && VAL[g0[s].type] <= 5);
  // the enemy's passed pawns, most advanced first, each with the squares it still has to cross
  const runners = Object.keys(g0).filter(s => g0[s].type === "p" && g0[s].color === op).map(s => {
    const [f, r] = sqFR(s), up = op === "w" ? 1 : -1;
    const passed = !Object.keys(g0).some(q => { const x = g0[q]; if (x.type !== "p" || x.color !== me) return false; const [a, b] = sqFR(q); return Math.abs(a - f) <= 1 && (b - r) * up > 0; });
    const path = []; for (let y = r + up; y >= 0 && y <= 7; y += up) path.push(frSq(f, y));
    return {sq:s, passed, rel: op === "w" ? r : 7 - r, path};
  }).filter(x => x.passed && x.rel >= 2).sort((a, b) => b.rel - a.rel).slice(0, 2);
  const dist = (a, b) => { const [x1, y1] = sqFR(a), [x2, y2] = sqFR(b); return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)); };
  return c.moves({verbose:true}).map(m => {
    const gA = grid(m.after), lan = m.from + m.to + (m.promotion || "");
    const exposed = gA[m.to] && enPrise(gA, m.to);
    const gift = !!exposed && !(m.captured && VAL[m.captured] >= VAL[m.piece]) && m.piece !== "k";   // walks onto a square where it is simply taken
    const hangingAfter = Object.keys(gA).filter(s => gA[s].color === me && gA[s].type !== "k" && s !== m.to && VAL[gA[s].type] >= 3 && enPrise(gA, s));
    const ignores = !hangingBefore.includes(m.from) && hangingBefore.some(s => hangingAfter.includes(s));   // misses the threat already there
    // the threat your last move just made: a minor piece or rook it now attacks, left where it is
    const missesThreat = threatened.length > 0 && !threatened.includes(m.from) && threatened.some(s => hangingAfter.includes(s));
    const newHang = hangingAfter.some(s => !hangingBefore.includes(s));                                     // uncovers another piece
    const greedy = !!m.captured && !!exposed && VAL[m.captured] < VAL[m.piece];                              // grabs a defended piece
    // a grab a person could really miss: never with the queen, the square defended once and not by a pawn
    const defenders = greedy ? attackers(gA, m.to, op) : [];
    const greedyOk = greedy && m.piece !== "q" && defenders.length === 1 && gA[defenders[0]].type !== "p";
    // the most valuable piece left hanging by ignoring the threat
    const ignoredVal = ignores ? Math.max(...hangingBefore.filter(s => hangingAfter.includes(s)).map(s => VAL[gA[s].type])) : 0;
    // what makes the move look natural
    let nat = 0;
    if (m.captured) nat += 1 + VAL[m.captured] / 3;
    if (m.captured && last && last.to === m.to) nat += 2;
    if (m.san.includes("+")) nat += 1;
    if (m.flags.includes("k") || m.flags.includes("q")) nat += opening ? 2 : 0.5;
    if (opening && (m.piece === "n" || m.piece === "b") && (m.from[1] === "1" || m.from[1] === "8")) nat += 1.5;
    if (opening && m.piece === "p" && (m.from[0] === "d" || m.from[0] === "e")) nat += 1;
    if (opening && m.piece === "k" && !m.flags.includes("k") && !m.flags.includes("q")) nat -= 1.5;
    if (m.piece === "n" && (m.to[0] === "a" || m.to[0] === "h")) nat -= 0.5;
    // taking a knight or bishop back home: people do it only to save the piece
    const undevelop = (m.piece === "n" || m.piece === "b") && m.to[1] === homeRank && m.from[1] !== homeRank;
    const escaping = hangingBefore.includes(m.from);
    if (undevelop && !escaping) nat -= 3;
    if (moveNo(fen) <= 8 && isBookPos(m.after)) nat += 1.5;      // a known opening move
    // what the move seems to want: an "idea" a human would play it for
    let intent = 0, why = "";
    if (m.san.includes("+")){ intent += 2; why = "șah"; }
    for (const s of attacksFrom(gA, m.to)){
      const p = gA[s]; if (!p || p.color !== op || p.type === "k") continue;
      if (enPrise(gA, s) || VAL[p.type] > VAL[m.piece]){ intent += 1 + VAL[p.type] / 3; why = why || "atac"; }
    }
    if (oppK && "nbrq".includes(m.piece) && dist(m.to, oppK) <= dist(m.from, oppK) - 2){ intent += 1; why = why || "spre rege"; }
    if (m.piece === "r"){
      const f = m.to[0], open = !Object.keys(gA).some(s => s[0] === f && gA[s].type === "p" && gA[s].color === me);
      if (open && m.from[0] !== f){ intent += 1; why = why || "coloană"; }
      if (m.to[1] === (me === "w" ? "7" : "2")){ intent += 1; why = why || "rândul 7"; }
    }
    if (m.piece === "p" && oppK && Math.abs(FILES.indexOf(m.from[0]) - FILES.indexOf(oppK[0])) <= 2 && !opening){ intent += 0.8; why = why || "pioni spre rege"; }
    // a capture any player sees: taking back what was just taken, or a piece that cannot be recaptured
    const recapture = !!(m.captured && last && last.captured && last.to === m.to);
    const obvious = !!m.captured && (recapture || (VAL[m.captured] >= 3 && (!exposed || VAL[m.captured] >= VAL[m.piece])));
    // how much the move fights the running pawns: take it, block its path, watch its path, bring the king closer
    let focus = 0;
    for (const rp of runners){
      if (m.to === rp.sq && m.captured === "p") focus += 6;
      if (rp.path.includes(m.to)) focus += m.to === rp.path[0] ? 4 : 3;
      if (m.piece !== "k" && attacksFrom(gA, m.to).some(q => rp.path.includes(q) || q === rp.sq)) focus += 2;
      if (m.piece === "k"){ const d = q => Math.min(...rp.path.map(x => dist(x, q))); if (d(m.to) < d(m.from)) focus += 2; else if (d(m.to) > d(m.from)) focus -= 2; }
    }
    return {lan, m, gift, ignores, ignoredVal, missesThreat, newHang, greedy, greedyOk, obvious, undevelop: undevelop && !escaping, focus, nat, intent, why};
  });
}
/* first decision after the main search: a move, or a second search over "moves with an idea" */
function botDecide(cfg, fen, lines, last, rnd = Math.random){
  const cands = humanMoves(fen, last); if (!cands.length) return {move:null};
  const by = Object.fromEntries(cands.map(x => [x.lan, x]));
  lines = lines.filter(o => o.pv && o.pv[0] && by[o.pv[0]]).sort((a, b) => a.mpv - b.mpv);
  if (!lines.length) return {move:cands[0].lan};
  const best = lineScore(lines[0]);
  if (cfg.style === "rank") return {move:lines[Math.min(cfg.rank, lines.length) - 1].pv[0], reason:"rank"};
  if (cfg.style === "window"){
    const ok = lines.filter(o => best - lineScore(o) <= cfg.tol * 100 && (!by[o.pv[0]].gift || o === lines[0]));
    return {move:ok[Math.floor(rnd() * ok.length)].pv[0], reason:"window"};
  }
  const t = eloT(cfg.elo);
  // a rook or more down: no more mistakes, it fights with the best move
  const byFocus = pool => { const top = Math.max(...pool.map(o => by[o.pv[0]].focus)); const f = pool.filter(o => by[o.pv[0]].focus === top); return f[Math.floor(rnd() * f.length)]; };
  if (cfg.fightBack && behindBy(fen) >= 5){
    const pool = lines.filter(o => !by[o.pv[0]].gift && best - lineScore(o) <= 150);
    if (pool.length && pool.some(o => by[o.pv[0]].focus > 0)) return {move:byFocus(pool).pv[0], reason:"behind-pawn"};
    return {move:lines[0].pv[0], reason:"behind"};
  }
  const m1 = lines.find(o => o.mate === 1);
  if (m1 && rnd() < 0.35 + 0.6 * t) return {move:m1.pv[0], reason:"mate1"};
  // the opening: sound moves only, book moves first, no mistakes yet
  if (moveNo(fen) <= OPENING_MOVES){
    const obvO = lines.filter(o => by[o.pv[0]].obvious && best - lineScore(o) <= 150);
    if (obvO.length) return {move:obvO[0].pv[0], reason:"obvious"};
    const sound = lines.filter(o => best - lineScore(o) <= 40 && !by[o.pv[0]].gift && !by[o.pv[0]].undevelop);
    const book = sound.filter(o => isBookPos(by[o.pv[0]].m.after));
    const pool = book.length ? book : sound.length ? sound.slice(0, 2) : [lines[0]];
    return {move:pool[Math.floor(rnd() * pool.length)].pv[0], reason: book.length ? "book" : "opening"};
  }
  // the natural choice: one of the moves it sees, favouring natural ones, never a free gift
  // ordinary choices: no free gifts, never leaving the queen or a rook en prise, and nothing far worse than the best
  const cap = 120 + 130 * (1 - Math.max(0, t));
  let ok = lines.filter(o => o === lines[0] || (!by[o.pv[0]].gift && !by[o.pv[0]].ignores && best - lineScore(o) <= cap && lineMatLoss(fen, o) < 2));
  // no retreat home unless every other move is clearly worse
  const fwd = ok.filter(o => !by[o.pv[0]].undevelop);
  if (fwd.length && best - lineScore(fwd[0]) <= 120) ok = fwd;
  if (!ok.length) ok = [lines[0]];
  const T = 30 + 220 * (1 - t);
  const normal = weightedPick(ok, o => Math.exp(-Math.min(3000, best - lineScore(o) - 12 * by[o.pv[0]].nat) / T), rnd).pv[0];
  // a rare, plausible blunder, the way people at this level lose games: they miss the threat your last move made,
  // or play a natural capture or move that loses material two moves later (a defender removed, a fork, a pin).
  // The engine checks each candidate more deeply; only ones that lose a minor piece or a rook (never the queen) qualify.
  const pB = cfg.disp != null ? Math.max(0, Math.min(0.06, 0.05 * (LIMIT_MIN - cfg.disp) / 720)) : 0.05 * (1 - Math.max(0, t));
  if (moveNo(fen) > OPENING_MOVES && !pawnAlarm(fen) && rnd() < pB){
    const top = (arr, n) => arr.slice().sort((a, b) => b.nat - a.nat).slice(0, n);
    const A = top(cands.filter(x => x.missesThreat && !x.gift), 4);
    const B = top(cands.filter(x => x.m.captured && !x.gift && !(x.greedy && !x.greedyOk)), 4);
    const C = top(cands.filter(x => !x.m.captured && !x.gift && !x.undevelop && !x.missesThreat && x.nat > 0), 4);
    const set = [...new Map([...A, ...B, ...C].map(x => [x.lan, x])).values()];
    if (set.length) return {search:{moves:set.map(x => x.lan), depth:Math.max(8, botPlan(cfg, fen).depth + 4)},
                            ctx:{kind:"blunder", fen, best, normal, cands:Object.fromEntries(set.map(x => [x.lan, x]))}, reason:"blunder-search"};
  }
  // obvious captures (a recapture, a free piece) are almost never missed, as long as the engine does not see them losing
  const obv = lines.filter(o => by[o.pv[0]].obvious && best - lineScore(o) <= 150);
  if (obv.length && rnd() < 0.9 + 0.1 * Math.max(0, t)) return {move:obv[0].pv[0], reason:"obvious"};
  // an enemy pawn running to promote: full attention, a sound move that deals with it
  if (pawnAlarm(fen)){
    const sound = lines.filter(o => best - lineScore(o) <= 50 && !by[o.pv[0]].gift);
    return {move:(sound.length ? byFocus(sound) : lines[0]).pv[0], reason:"alarm"};
  }
  // checks played on instinct: with the queen out, a person gives check without calculating where it leads
  const hasQueen = cands.some(x => x.m.piece === "q");
  if (hasQueen && moveNo(fen) > OPENING_MOVES && rnd() < 0.15 + 0.5 * (1 - Math.max(0, t))){
    const checks = cands.filter(x => x.m.san.includes("+") && !x.gift && !x.newHang && !x.ignores);
    // only checks the engine looked at, that cost at most 3 pawns and lose no material once the exchanges settle
    const seen = checks.filter(x => { const o = lines.find(l => l.pv[0] === x.lan); return o && best - lineScore(o) <= 300 && lineMatLoss(fen, o) < 2; });
    if (seen.length) return {move:weightedPick(seen, x => Math.exp(x.nat) * (x.m.piece === "q" ? 2 : 1), rnd).lan, reason:"check"};
  }
  // the usual mistake: a safe move played for an idea, which weakens the position
  if (rnd() < 0.04 + 0.26 * (1 - t)){
    const top3 = new Set(lines.slice(0, 3).map(o => o.pv[0]));
    const ideas = cands.filter(x => x.intent > 0 && !x.gift && !x.greedy && !x.newHang && !x.ignores && !x.undevelop && !top3.has(x.lan))
      .sort((a, b) => (b.intent + rnd()) - (a.intent + rnd())).slice(0, 10);
    if (ideas.length) return {search:{moves:ideas.map(x => x.lan), depth:Math.max(6, botPlan(cfg, fen).depth)},
                              ctx:{fen, best, normal, ideas:Object.fromEntries(ideas.map(x => [x.lan, x]))}, reason:"idea-search"};
  }
  return {move:normal, reason:"normal"};
}
/* after the second search: pick an idea move that costs "a bit": enough to be a mistake, not a gift */
function botFinish(cfg, ctx, lines2, rnd = Math.random){
  if (ctx.kind === "blunder"){
    const scored = lines2.filter(o => o.pv && o.pv[0] && ctx.cands[o.pv[0]]);
    ctx.reason = "blunder-none";
    if (!scored.length) return ctx.normal;
    const ref = Math.max(ctx.best, ...scored.map(lineScore));
    // an obvious capture that is in fact fine: a person just plays it
    const fine = scored.filter(o => ctx.cands[o.pv[0]].obvious && lineMatLoss(ctx.fen, o) < 2 && ref - lineScore(o) <= 100);
    if (fine.length){ ctx.reason = "blunder-fine"; return fine[0].pv[0]; }
    const traps = scored.filter(o => { const ml = lineMatLoss(ctx.fen, o), cl = ref - lineScore(o); return ml >= 2 && ml <= 5.5 && cl >= 150 && cl <= 800; });
    if (traps.length){ const o = weightedPick(traps, o => Math.exp(ctx.cands[o.pv[0]].nat) * (ctx.cands[o.pv[0]].missesThreat ? 1.5 : 1), rnd);
      ctx.reason = ctx.cands[o.pv[0]].missesThreat ? "blunder-threat" : "blunder-tactic"; return o.pv[0]; }
    return ctx.normal;
  }
  const t = eloT(cfg.elo), lo = 0.3, hi = Math.min(1.5, 0.8 + 2.2 * (1 - t));
  const scored = lines2.filter(o => o.pv && o.pv[0] && ctx.ideas[o.pv[0]] && lineMatLoss(ctx.fen, o) < 2);
  ctx.reason = "idea-none";
  if (!scored.length) return ctx.normal;
  const ref = Math.max(ctx.best, ...scored.map(lineScore));
  const loss = o => (ref - lineScore(o)) / 100;
  const inWin = scored.filter(o => loss(o) >= lo && loss(o) <= hi);
  if (inWin.length){ ctx.reason = "idea"; return weightedPick(inWin, o => ctx.ideas[o.pv[0]].intent * Math.exp(-loss(o) / hi), rnd).pv[0]; }
  const mild = scored.filter(o => loss(o) < lo);
  if (mild.length){ ctx.reason = "idea-mild"; return weightedPick(mild, o => ctx.ideas[o.pv[0]].intent, rnd).pv[0]; }
  return ctx.normal;
}
/* ---------- end of bot brain ---------- */

/* ---------- driver: talks to the engine, plays the brain's choice ---------- */
let w = null, job = null;
function engine(){
  if (w) return w;
  const wasm = new URL("stockfish.wasm", import.meta.url).href;
  w = new Worker(new URL("stockfish.js", import.meta.url).href + "#" + encodeURIComponent(wasm));
  w.onmessage = e => { if (typeof e.data === "string") e.data.split("\n").forEach(l => l && onLine(l)); };
  w.onerror = () => { const j = job; cancel(); if (j) j.onError(); };
  w.postMessage("uci"); w.postMessage("setoption name Hash value 16");
  return w;
}
/* a search nobody wants any more: a new worker is simpler than telling its bestmove from the next one's */
function cancel(){ job = null; if (w){ w.terminate(); w = null; } }
function onLine(l){
  const P = job; if (!P) return;
  if (l.startsWith("info ")){ const o = parseInfo(l); if (o && o.depth >= (P.depth || 1)) P.lines[o.mpv || 1] = {...o, mpv:o.mpv || 1}; return; }
  if (!l.startsWith("bestmove")) return;
  const u = l.split(" ")[1];
  let choice = u;
  if (P.stage === "main" && !P.official){
    const r = botDecide(P.cfg, P.fen, Object.values(P.lines), P.last);
    if (r.search){
      // second look, only at the moves "with an idea"
      P.stage = "second"; P.ctx = r.ctx; P.lines = {}; P.depth = r.search.depth;
      w.postMessage("setoption name MultiPV value " + r.search.moves.length);
      w.postMessage(P.pos);
      w.postMessage("go depth " + r.search.depth + " searchmoves " + r.search.moves.join(" "));
      return;
    }
    choice = r.move || u;
  } else if (P.stage === "second") choice = botFinish(P.cfg, P.ctx, Object.values(P.lines));
  job = null;
  const wait = Math.max(0, (500 + Math.random() * 1100) - (performance.now() - P.t0));   // a human takes a variable time
  setTimeout(() => { if (!P.dead) P.onMove(choice); }, wait);
}
export { botPlan, botDecide };
/* one game: the moves so far, the end of the game, and the bot's next move */
export function newGame(startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"){
  const c = new Chess(startFen), fens = [startFen], moves = [];
  let current = null;
  return {
    play(uci){ moves.push(c.move({from:uci.slice(0,2), to:uci.slice(2,4), promotion:uci[4]})); fens.push(c.fen()); },
    /* "mate", or the reason for a draw, or null while the game goes on */
    over(){
      if (c.isCheckmate()) return "mate";
      if (c.isStalemate()) return "stalemate";
      if (c.isInsufficientMaterial()) return "insufficient material";
      const k = epdOf(c.fen());
      if (fens.filter(f => epdOf(f) === k).length >= 3) return "threefold repetition";
      if (+c.fen().split(" ")[4] >= 100) return "the fifty-move rule";
      return null;
    },
    think(elo, fightBack, onMove, onError){
      const fen = c.fen(), cfg = {style:"human", elo:eloToInternal(elo), disp:elo, fightBack};
      const pos = moves.length ? `position fen ${startFen} moves ${moves.map(m => m.lan).join(" ")}` : "position fen " + fen;
      const P = current = job = {fen, cfg, pos, lines:{}, t0:performance.now(), last:moves[moves.length - 1] || null, stage:"main", ctx:null, official:elo >= LIMIT_MIN, depth:1, onMove, onError};
      const e = engine();
      if (P.official){
        e.postMessage("setoption name MultiPV value 1");
        e.postMessage("setoption name UCI_LimitStrength value true");
        e.postMessage("setoption name UCI_Elo value " + elo);
        e.postMessage(pos);
        e.postMessage("go movetime " + (elo >= 2400 ? 1500 : 900));
      } else {
        const plan = botPlan(cfg, fen); P.depth = plan.depth;
        e.postMessage("setoption name UCI_LimitStrength value false");
        e.postMessage("setoption name MultiPV value " + plan.multipv);
        e.postMessage(pos);
        e.postMessage("go depth " + plan.depth);
      }
    },
    stop(){ if (current) current.dead = true; cancel(); },
  };
}
