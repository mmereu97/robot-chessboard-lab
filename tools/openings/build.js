#!/usr/bin/env node
// node tools/openings/build.js <chess-analysis-board/index.html>
// Takes the named openings out of chess-analysis-board (the lichess-org/chess-openings list, CC0), where they
// are a tree of moves, and writes static/data/openings.json: for each opening its ECO code, name and moves, and,
// worked out here once so the page does not replay 3,865 lines on every load, each move as from-to squares and
// the final position (64 squares, '.' for empty, then the side to move).
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const ex = JSON.parse(/<script id="exdata" type="application\/json">(.*?)<\/script>/s.exec(html)[1]);
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../../static/js/chess.js'), 'utf8') + ';globalThis.CH=CH;');
const out = { eco: [], name: [], moves: [], ids: [], final: [] };
const moveId = m => m.from + '-' + m.to + (m.promo || '');   // as static/js/openings.js writes it
const keyOf = st => st.b.map(p => p || '.').join('') + (st.white ? 'w' : 'b');
ex.N.forEach((k, node) => {
  if (k < 0) return;
  const line = [];
  for (let i = node; i > 0; i = ex.P[i]) line.unshift(ex.M[i]);
  let st = CH.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', true);
  const ids = [];
  for (const san of line) { const m = CH.findSan(st, san); if (!m) throw new Error(`${ex.names[k]}: ${san} is not legal`); ids.push(moveId(m)); st = CH.make(st, m); }
  const [eco, name] = ex.names[k].split('|');
  out.eco.push(eco); out.name.push(name); out.moves.push(line.join(' ')); out.ids.push(ids.join(' ')); out.final.push(keyOf(st));
});
const order = out.name.map((_, i) => i).sort((a, b) => out.eco[a].localeCompare(out.eco[b]) || out.name[a].localeCompare(out.name[b]));
const sorted = {};
for (const k in out) sorted[k] = order.map(i => out[k][i]);
fs.writeFileSync(path.join(__dirname, '../../static/data/openings.json'), JSON.stringify(sorted));
console.log(sorted.name.length, 'openings, every line legal');
