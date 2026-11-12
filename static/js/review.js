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
