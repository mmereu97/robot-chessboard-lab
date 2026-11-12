// =================== reviewing a game: a PGN replayed by the robots, with Stockfish's verdict ===================
// Paste a game from Lichess or chess.com (or open its .pgn file). The robots replay it move by move; meanwhile
// Stockfish at full strength reads every position. Moves are marked as Lichess does, from the loss in winning
// chances (?! 10%, ? 20%, ?? 30%), and before each marked move the replay stops on its own with the better move
// drawn as an arrow, so you can think first. Loaded after app.js, whose state and functions it uses.
let reviewPz = null;
const store3 = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
try { const v = localStorage.getItem('robo-myname'); if (v) $('reviewName').value = v; } catch (e) {}
// the first game of a PGN: its tags and its moves, checked against the rules
function parsePgn(text) {
  text = text.replace(/\r/g, '');
  const second = text.indexOf('[Event', text.indexOf('[Event') + 1);
  if (second > 0 && /\d\./.test(text.slice(0, second))) text = text.slice(0, second);   // several games: the first
  const tags = {};
  for (const m of text.matchAll(/^\s*\[(\w+)\s+"([^"]*)"\]\s*$/gm)) tags[m[1]] = m[2];
  let body = text.replace(/^\s*\[.*\]\s*$/gm, ' ').replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  for (let k = 0; k < 20 && /\([^()]*\)/.test(body); k++) body = body.replace(/\([^()]*\)/g, ' ');   // side lines, nested
  body = body.replace(/\$\d+/g, ' ').replace(/\d+\.(\.\.)?/g, ' ').replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, ' ');
  const tokens = body.split(/\s+/).filter(Boolean);
  let st = CH.fromFEN(PUZZLES[0].fen, true); const moves = [];
  if (tags.FEN || tags.SetUp === '1') return { error: 'This game starts from a set-up position; only games from the start are supported for now.' };
  for (const t of tokens) {
    const m = CH.findSan(st, t.replace(/[!?]+$/, ''));
    if (!m) return moves.length ? { tags, moves, warning: `Stopped at move ${(moves.length >> 1) + 1}: "${t}" is not legal here.` } : { error: `"${t}" is not a legal first move: is this a PGN?` };
    moves.push(CH.san(st, m)); st = CH.make(st, m);
  }
  return moves.length ? { tags, moves } : { error: 'No moves found. Paste the whole PGN, with the move list.' };
}
function startReviewFrom(text) {
  const p = parsePgn(text || '');
  if (p.error) { $('reviewMsg').textContent = p.error; return; }
  const t = p.tags, name = $('reviewName').value.trim().toLowerCase(), pick = $('reviewMe').value;
  store3('robo-myname', $('reviewName').value.trim());
  const me = pick === 'w' || pick === 'b' ? pick : name && (t.Black || '').toLowerCase() === name ? 'b' : 'w';
  const who = c => (c === 'w' ? t.White : t.Black) || (c === 'w' ? 'White' : 'Black');
  const elo = c => { const e = c === 'w' ? t.WhiteElo : t.BlackElo; return e && e !== '?' ? ` (${e})` : ''; };
  reviewPz = { name: `${who('w')} vs ${who('b')}`, fen: PUZZLES[0].fen, player: me,
    desc: [t.Event, (t.Date || '').replace(/\./g, '-'), t.Opening, t.Result && `result ${t.Result}`].filter(Boolean).join(' · ') + `. You: ${me === 'w' ? 'White' : 'Black'}.`,
    review: { moves: p.moves, me, names: { w: who('w') + elo('w'), b: who('b') + elo('b') }, result: t.Result || '' } };
  $('reviewMsg').textContent = p.warning || `${p.moves.length} moves read. The robots set up the board…`;
  request('review');
}
$('reviewBtn').addEventListener('click', () => startReviewFrom($('pgnText').value));
$('pgnFile').addEventListener('change', () => {
  const f = $('pgnFile').files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { $('pgnText').value = r.result; startReviewFrom(r.result); };
  r.readAsText(f);
});
// --- the analysis, in the background: one look per position, then a mark per move ---
const winPct = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, cp)))) - 1);
const MARKS = [[30, '??', 'a blunder'], [20, '?', 'a mistake'], [10, '?!', 'an inaccuracy']];
function startReview(g) {
  const R = g.pz.review;
  g.review = { ...R, an: [], sts: [], marks: [], auto: false, done: false, analysed: 0 };
  let st = startSt(g.pz); g.review.sts.push(st);
  for (const san of R.moves) { st = CH.make(st, CH.findSan(st, san)); g.review.sts.push(st); }
  g.frames = [snapshot(g)]; g.phase = 'review';
  $('gMode').textContent = `Review · you: ${R.me === 'w' ? 'White' : 'Black'} · ▶ or → for the next move`;
  $('gRestart').textContent = 'Back to the start';
  analyse(g, 0);
}
function analyse(g, i) {
  const r = g.review; if (game !== g) return;
  if (i >= r.sts.length) { r.done = true; markAll(g); refreshGame(); return; }
  const st = r.sts[i], over = CH.status(st);
  const store = sc => { r.an[i] = sc; r.analysed = i + 1; if (i % 4 === 3 || i === r.sts.length - 1) { markAll(g); refreshGame(); } analyse(g, i + 1); };
  if (over === 'mate') { store({ cp: st.white ? -100000 : 100000, mate: st.white ? -0 : 0, best: null }); return; }
  if (over === 'stalemate') { store({ cp: 0, best: null }); return; }
  // scores for White: the engine gives them for the side to move
  const side = st.white ? 1 : -1;
  judge(fenOf(st), 450).then(sc => store(sc.mate !== undefined
    ? { cp: side * (sc.mate > 0 ? 100000 : -100000), mate: side * sc.mate, best: sc.best }
    : { cp: side * sc.cp, best: sc.best }));
}
// the mark of each move whose positions are both read: the winning chances it cost the side that played it
function markAll(g) {
  const r = g.review;
  for (let i = 0; i < r.moves.length; i++) {
    if (!r.an[i] || !r.an[i + 1] || r.marks[i] !== undefined) continue;
    const white = r.sts[i].white, before = winPct(r.an[i].cp), after = winPct(r.an[i + 1].cp);
    const loss = white ? before - after : after - before;
    const played = CH.findSan(r.sts[i], r.moves[i]), bestPlayed = played && r.an[i].best === uciOf(played);
    const mark = bestPlayed ? null : MARKS.find(([lim]) => loss >= lim);
    r.marks[i] = mark ? { loss, sym: mark[1], name: mark[2] } : null;
  }
}
const reviewNum = (i) => `${(i >> 1) + 1}${i % 2 ? '...' : '.'}`;
const sanOfUci = (st, u) => { const m = u && CH.legal(st).find(x => uciOf(x) === u); return m ? CH.san(st, m) : null; };
function reviewBadge(g, i) { const m = g.review && g.review.marks[i]; return m ? `<b class="rv rv${m.sym.length}${m.sym === '?!' ? 'i' : ''}">${m.sym}</b>` : ''; }
// what the status line says, and the arrow, for the position on show
function reviewStatus(g) {
  const r = g.review, p = viewedPly(g), mine = i => r.sts[i].white === (r.me === 'w');
  g.best = null;
  const progress = r.done ? '' : ` · Stockfish has read ${r.analysed} of ${r.sts.length} positions`;
  if (p >= r.moves.length) {
    if (!r.done) return `End of the game${r.result ? ' (' + r.result + ')' : ''}${progress}.`;
    const count = side => { const c = { '?!': 0, '?': 0, '??': 0 }; r.marks.forEach((m, i) => { if (m && mine(i) === side) c[m.sym]++; }); return `${c['??']} blunders, ${c['?']} mistakes, ${c['?!']} inaccuracies`; };
    return `End of the game${r.result ? ' (' + r.result + ')' : ''}. You: ${count(true)}. Your opponent: ${count(false)}. Click a marked move to see it again.`;
  }
  const next = r.moves[p], m = r.marks[p], yours = mine(p), who = yours ? 'Here you' : 'Here your opponent';
  // an arrow only on your turn: the move you should play here (the opponent's best moves stay in words)
  const bestMv = r.an[p] && CH.legal(r.sts[p]).find(x => uciOf(x) === r.an[p].best);
  if (yours && bestMv) g.best = { from: bestMv.from, to: bestMv.to, ply: p };
  if (m) {
    const better = sanOfUci(r.sts[p], r.an[p].best);
    return `${who} played ${reviewNum(p)} ${next}${m.sym}, ${m.name}: it cost ${Math.round(m.loss)}% of the winning chances. Better was ${reviewNum(p)} ${better}${yours ? ' (the arrow)' : ''}.${progress}`;
  }
  if (!r.an[p] || !r.an[p + 1]) return `Next: ${reviewNum(p)} ${next}${progress}`;
  const isBest = r.an[p].best && sanOfUci(r.sts[p], r.an[p].best) === next;
  return `Next: ${reviewNum(p)} ${next}${isBest ? ', the best move' : ', a sound move'}${yours ? (isBest ? ' (the arrow)' : `; the best was ${sanOfUci(r.sts[p], r.an[p].best)} (the arrow)`) : ''}.${progress}`;
}
// one move forward: in the past only the picture moves; at the end of what was replayed, the robots play it
function reviewStep(g) {
  if (!g || !g.review || anim || g.phase !== 'review') return;
  if (g.view !== null) { viewPly(g, g.view + 1); return; }
  const r = g.review, i = g.history.length;
  if (i >= r.moves.length) { r.auto = false; refreshGame(); return; }
  playMove(CH.findSan(g.st, r.moves[i]));
}
function reviewAfterMove(g) {
  const r = g.review;
  g.frames[g.history.length] = snapshot(g); g.phase = 'review';
  const i = g.history.length;
  if (r.auto && (i >= r.moves.length || r.marks[i])) r.auto = false;   // stop before a marked move: think first
  refreshGame();
  if (r.auto) setTimeout(() => { if (game === g && r.auto) reviewStep(g); }, 550);
}
$('gReviewPlay').addEventListener('click', () => {
  const g = game; if (!g || !g.review) return;
  g.review.auto = !g.review.auto;
  if (g.review.auto) { if (g.view !== null) viewPly(g, g.history.length); reviewStep(g); }
  refreshGame();
});
// --- accuracy as Lichess computes it (lila, AccuracyPercent): each move scores by the winning chances it lost,
// and the game's accuracy is the mean of a volatility-weighted mean and a harmonic mean of those scores.
// wins: White's winning chances (0–100) of every position, from the start to the end.
function gameAccuracy(wins) {
  const n = wins.length - 1; if (n < 2) return null;
  const win = Math.min(8, Math.max(2, Math.floor(n / 10)));
  // as lila: the first window repeats for the opening moves, then it slides one position at a time
  const windows = [];
  for (let i = 0; i < n; i++) { const st = Math.max(0, i - (win - 2)); windows.push(wins.slice(st, st + win)); }
  const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length); };
  const weights = windows.map(w => Math.min(12, Math.max(0.5, sd(w))));
  const out = {};
  for (const side of ['w', 'b']) {
    const acc = [], wt = [];
    for (let i = 0; i < n; i++) {
      if ((i % 2 === 0) !== (side === 'w')) continue;
      const before = side === 'w' ? wins[i] : 100 - wins[i], after = side === 'w' ? wins[i + 1] : 100 - wins[i + 1];
      const loss = Math.max(0, before - after);
      acc.push(Math.min(100, Math.max(0, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669 + 1)));
      wt.push(weights[i]);
    }
    if (!acc.length) { out[side] = null; continue; }
    const weighted = acc.reduce((s, a, k) => s + a * wt[k], 0) / wt.reduce((s, w) => s + w, 0);
    const harmonic = acc.length / acc.reduce((s, a) => s + 1 / Math.max(a, 1), 0);
    out[side] = (weighted + harmonic) / 2;
  }
  return out;
}
// =================== how well each side played, on the bot's own Elo scale ===================
// The bot played itself at known Elos and Stockfish read every game (tools/perf-elo); this table turns a game's
// accuracy into the Elo at which the bot plays that accurately, so "you played like 1100" means: set the bot to 1100.
// 60 games, 12 accuracies per level (tools/perf-elo, 12.11.2026): the medians, with 1000 and 1200 pooled at 1100
// because their order came out reversed. One game spreads about ±6 points around these, so a single game is a range.
const PERF_CAL = [[54.6, 200], [72.6, 400], [73.3, 600], [80.3, 800], [83.3, 1100], [85.1, 1400], [87.9, 1700], [91.2, 2000], [91.8, 2400]];
const PERF_SPREAD = 6;
const PERF_KEEP = 10;   // your last games, kept in the browser for an average
let perfHist = [];
try { perfHist = JSON.parse(localStorage.getItem('robo-perf') || '[]'); } catch (e) {}
function eloFromAccuracy(acc) {
  if (!PERF_CAL || acc == null) return null;
  if (acc <= PERF_CAL[0][0]) return PERF_CAL[0][1];
  for (let i = 1; i < PERF_CAL.length; i++) {
    const [a0, e0] = PERF_CAL[i - 1], [a1, e1] = PERF_CAL[i];
    if (acc <= a1) return Math.round((e0 + (e1 - e0) * (acc - a0) / (a1 - a0)) / 50) * 50;
  }
  return PERF_CAL[PERF_CAL.length - 1][1];
}
// a finished game against the bot is read the same way as a reviewed one: Stockfish at full strength, position by position
function readGame(g, sts) {
  const token = g.perf = { sts, cps: [], done: false };
  const step = i => {
    if (game !== g || g.perf !== token) return;
    if (i >= sts.length) { token.done = true; refreshGame(); return; }
    const st = sts[i], over = CH.status(st);
    const keep = cp => { token.cps[i] = cp; if (i % 4 === 3) refreshGame(); step(i + 1); };
    if (over === 'mate') { keep(st.white ? -100000 : 100000); return; }
    if (over === 'stalemate') { keep(0); return; }
    judge(fenOf(st), 350).then(sc => keep((st.white ? 1 : -1) * (sc.mate !== undefined ? (sc.mate > 0 ? 100000 : -100000) : sc.cp)));
  };
  step(0);
}
function perfLine(acc, who) {
  if (acc == null) return '';
  const elo = eloFromAccuracy(acc), lo = eloFromAccuracy(acc - PERF_SPREAD), hi = eloFromAccuracy(acc + PERF_SPREAD);
  const top = PERF_CAL[PERF_CAL.length - 1][1], show = e => e >= top ? top + '+' : e;   // the scale ends at the strongest level measured
  return `<div class="perf-row"><span>${esc(who)}</span><b>${Math.round(acc)}%</b><span>played like about <b>${show(elo)}</b>${lo < hi ? ` <small>(likely ${lo}–${show(hi)})</small>` : ''}</span></div>`;
}
// your accuracy, kept once per game; the average of the last ones is what the button offers
function keepMine(g, acc) {
  if (g.perfKept || acc == null) return; g.perfKept = true;
  perfHist.push(Math.round(acc * 10) / 10); perfHist = perfHist.slice(-PERF_KEEP);
  try { localStorage.setItem('robo-perf', JSON.stringify(perfHist)); } catch (e) {}
}
function averageLine() {
  if (perfHist.length < 2) return '';
  const avg = perfHist.reduce((a, b) => a + b, 0) / perfHist.length;
  return `<div class="perf-row avg"><span>Your last ${perfHist.length} games</span><b>${Math.round(avg)}%</b><span>about <b>${eloFromAccuracy(avg)}</b> on average</span></div>`;
}
let perfElo = null;
// the level to play next: your average once there are 3 games, otherwise this game
const levelToOffer = acc => eloFromAccuracy(perfHist.length >= 3 ? perfHist.reduce((a, b) => a + b, 0) / perfHist.length : acc);
function perfRefresh(g) {
  const box = $('gPerf'); let html = '';
  if (g.review) {
    const r = g.review;
    if (r.done && viewedPly(g) >= r.moves.length) {
      const acc = gameAccuracy(r.an.map(a => winPct(a.cp))), me = r.me, op = me === 'w' ? 'b' : 'w';
      keepMine(g, acc[me]);
      html = perfLine(acc[me], 'You') + perfLine(acc[op], r.names[op].replace(/ \(\d+\)$/, '')) + averageLine();
      perfElo = levelToOffer(acc[me]);
    }
  } else if (g.bot && g.phase === 'done' && g.history.length >= 6) {
    if (!g.perf) { let st = startSt(g.pz); const sts = [st]; for (const m of g.moves) { st = CH.make(st, m); sts.push(st); } readGame(g, sts); }
    const P = g.perf;
    if (!P.done) html = `<div class="perf-wait">Stockfish is reading the game: ${P.cps.length} of ${P.sts.length} positions…</div>`;
    else {
      const acc = gameAccuracy(P.cps.map(winPct)), me = g.bot.human, op = me === 'w' ? 'b' : 'w';
      keepMine(g, acc[me]);
      html = perfLine(acc[me], 'You') + perfLine(acc[op], `Stockfish at ${g.bot.elo}`) + averageLine();
      perfElo = levelToOffer(acc[me]);
    }
  } else if (g.bot && g.phase !== 'done') g.perf = null;   // taken back: read again at the next end
  box.hidden = !html;
  if (html) {
    const btn = perfElo ? `<button class="btn" id="gPlayLevel" type="button">Play the bot at ${perfElo}</button>` : '';
    const sig = html + btn;
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      box.innerHTML = `<div class="perf-head"><span class="lbl">Your play</span><span class="perf-note">accuracy as Lichess computes it · Elo on this bot's scale, measured on 60 of its own games · one game is only a rough guide; the average of several says more</span></div>${html}${btn}`;
    }
  }
}
document.addEventListener('click', e => {
  if (!e.target.closest('#gPlayLevel') || !perfElo) return;
  $('botElo').value = perfElo; saveElo(perfElo);
  if (mode !== 'play') goMode('play'); else request('bot');
});
