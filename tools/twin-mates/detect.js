// node detect.js <mate2.csv> <out.jsonl> [workers]: positions where one key move leaves defences that need different mates
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs'), vm = require('vm'), path = require('path');
if (isMainThread) {
  const [csv, outFile, nw = 4] = process.argv.slice(2);
  const lines = fs.readFileSync(csv, 'utf8').split('\n').filter(Boolean);
  const head = lines.shift().split(','), rows = lines;
  console.log('rows', rows.length, 'columns', head.join(','));
  const out = fs.createWriteStream(outFile); let done = 0, kept = 0; const t0 = Date.now();
  const W = +nw, per = Math.ceil(rows.length / W);
  let alive = W;
  for (let w = 0; w < W; w++) {
    const wk = new Worker(__filename, { workerData: { rows: rows.slice(w * per, (w + 1) * per), head } });
    wk.on('message', m => {
      if (m.kept) { out.write(JSON.stringify(m.kept) + '\n'); kept++; }
      if (m.done) { done += m.done; if (done % 20000 < m.done) console.log(`${done} checked, ${kept} kept, ${Math.round((Date.now() - t0) / 1000)} s`); }
    });
    wk.on('exit', () => { if (--alive === 0) { out.end(); console.log(`finished: ${done} checked, ${kept} kept, ${Math.round((Date.now() - t0) / 1000)} s`); } });
  }
} else {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', '..', 'static', 'js', 'chess.js'), 'utf8') + ';globalThis.CH=CH;');
  const { rows, head } = workerData, col = n => head.indexOf(n);
  const NAME = i => 'abcdefgh'[i & 7] + (8 - (i >> 3)), SQ = s => 'abcdefgh'.indexOf(s[0]) + (8 - +s[1]) * 8;
  function fromFull(fen) {
    const [place, side, cas, ep] = fen.split(' ');
    const st = CH.fromFEN(place, side === 'w');
    st.castle = { K: cas.includes('K'), Q: cas.includes('Q'), k: cas.includes('k'), q: cas.includes('q') };
    st.ep = ep && ep !== '-' ? SQ(ep) : -1;
    return st;
  }
  const byUci = (st, u) => CH.legal(st).find(m => NAME(m.from) + NAME(m.to) + (m.promo ? m.promo.toLowerCase() : '') === u);
  const mates = st => CH.legal(st).filter(m => { const s = CH.make(st, m); return CH.inCheck(s) && CH.isMate(s); });
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let batch = 0;
  for (const line of rows) {
    batch++; if (batch % 500 === 0) parentPort.postMessage({ done: 500 });
    const c = line.split(',');
    try {
      let st = fromFull(c[col('FEN')]);
      const moves = c[col('Moves')].split(' ');
      st = CH.make(st, byUci(st, moves[0]));            // the opponent's move that sets the puzzle
      if (mates(st).length) continue;                     // a mate in one is there: not a mate in two
      const key = byUci(st, moves[1]); if (!key) continue;
      const s1 = CH.make(st, key), replies = CH.legal(s1);
      if (replies.length < 2) continue;
      const vars = replies.map(r => { const s2 = CH.make(s1, r); return { r, ms: mates(s2).map(m => CH.san(s2, m)), san: CH.san(s1, r) }; });
      if (vars.some(v => !v.ms.length)) continue;          // the key does not force mate
      const common = vars[0].ms.filter(m => vars.every(v => v.ms.includes(m)));
      if (common.length) continue;                         // one move mates after every defence: nothing to see
      // the fewest mating moves that answer every defence
      const all = [...new Set(vars.flatMap(v => v.ms))]; let cover = 99;
      for (let mask = 1; mask < (1 << Math.min(all.length, 12)); mask++) { const pick = all.filter((_, i) => mask >> i & 1); if (pick.length >= cover) continue; if (vars.every(v => v.ms.some(m => pick.includes(m)))) cover = pick.length; }
      // and only now the expensive test: no other first move works
      const keys = CH.mateIn2Keys(st); if (keys.length !== 1) continue;
      const piece = st.b[key.from].toLowerCase(), onKey = vars.filter(v => v.r.to === key.to);
      const takers = new Set(onKey.map(v => s1.b[v.r.from].toLowerCase()));
      const sacrifice = onKey.length > 0 && VAL[piece] >= 3;
      const dualFree = vars.filter(v => v.ms.length === 1).length / vars.length;
      const check = CH.inCheck(s1);
      let score = 3 * (cover - 1) + (takers.size >= 2 ? 4 : 0) + (sacrifice ? 2 + VAL[piece] / 9 : 0) + 3 * dualFree + (check ? 0 : 2) - (vars.length > 6 ? 1 : 0);
      const pop = +c[col('Popularity')], plays = +c[col('NbPlays')];
      score += Math.max(0, Math.min(1, pop / 100)) + (plays > 1000 ? 0.5 : 0);
      parentPort.postMessage({ kept: { id: c[col('PuzzleId')], fen: c[col('FEN')], moves: c[col('Moves')], rating: +c[col('Rating')], pop, plays, url: c[col('GameUrl')], themes: c[col('Themes')], key: CH.san(st, key), side: st.white ? 'w' : 'b', placement: c[col('FEN')] && null, cover, takers: [...takers].join(''), sacrifice, check, dualFree: +dualFree.toFixed(2), score: +score.toFixed(2), vars: vars.map(v => ({ r: v.san, m: v.ms })) } });
    } catch (e) { }
  }
  parentPort.postMessage({ done: batch % 500 });
}
