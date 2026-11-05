const PUZZLES = [
  { name: 'Starting position', desc: 'All 32 pieces on their home squares.', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR' },
  { name: 'Smothered mate', desc: 'The knight mates a king boxed in by its own pieces.', fen: '6rk/5Npp/8/8/8/8/5PPP/6K1' },
  { name: 'Back-rank mate', desc: 'The rook lands on the 8th rank; Black’s own pawns trap the king.', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1' },
  { name: 'Anastasia’s mate', desc: 'Knight on e7, rook ready to strike down the h-file.', fen: '5r2/4Nppk/8/8/8/8/6PP/5RK1' },
  { name: 'Lucena position', desc: 'The classic rook ending: White builds the bridge.', fen: '1K6/1P1k4/8/8/8/8/r7/2R5' },
  { name: 'Philidor position', desc: 'The textbook defence in rook vs. rook and pawn.', fen: '4k3/R7/7r/4PK2/8/8/8/8' },
  { name: 'Réti study', desc: 'The white king catches a pawn that looks uncatchable.', fen: '7K/8/k1P5/7p/8/8/8/8' },
  { name: 'Saavedra study', desc: 'The c6 pawn against the black rook.', fen: '8/8/1KP5/3r4/8/8/8/k7' },
  { name: 'The opposition', desc: 'King and pawn vs. king: who has the opposition?', fen: '8/8/8/4k3/8/4K3/4P3/8' },
  { name: 'The Opera Game', desc: 'Morphy, Paris 1858: final position after Rd8#.', fen: '1n1Rkb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2K5' },
  { name: 'The Immortal Game', desc: 'Anderssen–Kieseritzky, London 1851: final position.', fen: 'r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1' },
  { name: 'Italian Game', desc: 'The c4 bishop eyes f7 from the first moves.', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R' },
  { name: 'Sicilian Dragon', desc: 'Yugoslav Attack: opposite castling, a crowded board.', fen: 'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R' },
  { name: 'Mate in two #67', desc: 'White to move. Prying open a file.', fen: '4kb2/rppn1ppp/2N5/4pP1q/P7/1P4QP/2B3P1/3R2K1', set: 'm2' },
  { name: 'Mate in two #68', desc: 'White to move. Lure the king onto a fatal square.', fen: '5k2/q2r4/4RP1p/5P1P/p7/1B6/P7/K5R1', set: 'm2' },
  { name: 'Mate in two #69', desc: 'White to move. The doubled rooks on the 7th: where to strike?', fen: 'r1r1n1k1/4RRp1/1Bp3Q1/3p4/2P4p/1P4PP/Pq4B1/7K', set: 'm2' },
  { name: 'Mate in two #70', desc: 'White to move. A weak back rank.', fen: '5r1k/4qp1p/3p3Q/4n3/4N3/7P/1B4P1/7K', set: 'm2' },
  { name: 'Mate in two #71', desc: 'White to move. Another back-rank theme.', fen: '1b4k1/r5np/1p5B/p1p5/2q3P1/2P4P/8/4QRK1', set: 'm2' },
  { name: 'Mate in two #72', desc: 'White to move. Two rooks working along the ranks.', fen: '1r1k4/2R4R/8/8/6P1/6pP/PPP2p1q/K4B2', set: 'm2' },
  { name: 'Mate in two #73', desc: 'White to move. Opens with a discovered attack.', fen: '5k2/1b2Rp1p/6p1/5q1P/BB4N1/8/PPP2PP1/1K6', set: 'm2' },
  { name: 'Mate in two #74', desc: 'White to move. Deflect a defender or cut a line.', fen: 'r2q3k/pppb1Q1p/3p1b1p/8/2B5/8/PP3PPP/4R1K1', set: 'm2' },
  { name: 'Mate in two #75', desc: 'White to move. A deflection that breaks a pin.', fen: '6R1/p4p2/1p2q2p/8/6Pk/8/PP2r1PK/3Q4', set: 'm2' },
  { name: 'Mate in two #76', desc: 'White to move. The bishops’ diagonals decide it.', fen: 'qn5k/p5pp/5p2/8/7n/1BB5/5QPP/2K5', set: 'm2' },
  { name: 'Mate in two #77', desc: 'White to move. Control of a diagonal and a file.', fen: '2rr4/1b1n1p1k/3Pq1p1/8/p2Bp1P1/1N2R3/1PP2R1P/6K1', set: 'm2' },
  { name: 'Mate in two #78', desc: 'White to move. Same idea again on a full board.', fen: '2r1nr1k/pp1q1p1p/3bpp2/5P2/1P1Q4/P3P3/1B3P1P/R3K1R1', set: 'm2' },
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
