// The starting position, never listed: games and the reset button start from it. The puzzles are in twins.js.
const PUZZLES = [
  { hidden: true, name: 'Starting position', desc: 'All 32 pieces on their home squares.', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR' },
];

function randomFEN() {
  const sq = [...Array(64).keys()].sort(() => Math.random() - 0.5);
  const board = new Array(64).fill(null);
  let k = 0;
  const place = (t, pawn) => {
    for (let i = k; i < sq.length; i++) {
      const s = sq[i], r = (s / 8) | 0;
      if (pawn && (r === 0 || r === 7)) continue;
      [sq[i], sq[k]] = [sq[k], sq[i]]; board[s] = t; k++; return;
    }
  };
  for (const white of [true, false]) {
    const c = t => white ? t : t.toLowerCase();
    place(c('K'));
    if (Math.random() < 0.6) place(c('Q'));
    for (const [t, max] of [['R', 2], ['B', 2], ['N', 2]]) { const m = Math.floor(Math.random() * (max + 1)); for (let i = 0; i < m; i++) place(c(t)); }
    const p = 1 + Math.floor(Math.random() * 7); for (let i = 0; i < p; i++) place(c('P'), true);
  }
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let s = '', e = 0;
    for (let f = 0; f < 8; f++) { const t = board[r * 8 + f]; if (!t) e++; else { if (e) { s += e; e = 0; } s += t; } }
    if (e) s += e; rows.push(s);
  }
  return rows.join('/');
}
if (typeof module !== 'undefined') module.exports = { PUZZLES, randomFEN };
