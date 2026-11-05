// ===== Minimal chess rules: legal moves, check, mate-in-two helpers =====
// board: 64 squares, index r*8+f, r=0 is rank 8 (FEN order), values like 'K','p' or null
const CH = (() => {
  const isW = p => p && p === p.toUpperCase();
  const RF = i => [i >> 3, i & 7];
  const SQ = (r, f) => (r < 0 || r > 7 || f < 0 || f > 7) ? -1 : r * 8 + f;
  const NAME = i => 'abcdefgh'[i & 7] + (8 - (i >> 3));
  const KN = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
  const KG = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  const DIAG = [[1,1],[1,-1],[-1,1],[-1,-1]], ORTH = [[1,0],[-1,0],[0,1],[0,-1]];

  function fromFEN(fen, whiteToMove = true) {
    const b = new Array(64).fill(null);
    fen.split(' ')[0].split('/').forEach((row, r) => { let f = 0; for (const ch of row) { if (/\d/.test(ch)) f += +ch; else b[r * 8 + f++] = ch; } });
    // castling rights inferred from pieces standing on their home squares
    const castle = { K: b[60] === 'K' && b[63] === 'R', Q: b[60] === 'K' && b[56] === 'R', k: b[4] === 'k' && b[7] === 'r', q: b[4] === 'k' && b[0] === 'r' };
    return { b, white: whiteToMove, castle, ep: -1 };
  }

  function attacked(b, sq, byWhite) {
    const [r, f] = RF(sq);
    const own = p => p && isW(p) === byWhite;
    const pr = byWhite ? r + 1 : r - 1; // attacking pawn stands one rank behind (from its side)
    for (const df of [-1, 1]) { const s = SQ(pr, f + df); if (s >= 0 && b[s] === (byWhite ? 'P' : 'p')) return true; }
    for (const [dr, df] of KN) { const s = SQ(r + dr, f + df); if (s >= 0 && own(b[s]) && b[s].toUpperCase() === 'N') return true; }
    for (const [dr, df] of KG) { const s = SQ(r + dr, f + df); if (s >= 0 && own(b[s]) && b[s].toUpperCase() === 'K') return true; }
    for (const [dirs, kinds] of [[DIAG, 'BQ'], [ORTH, 'RQ']]) for (const [dr, df] of dirs) {
      let rr = r + dr, ff = f + df;
      while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
        const p = b[rr * 8 + ff];
        if (p) { if (own(p) && kinds.includes(p.toUpperCase())) return true; break; }
        rr += dr; ff += df;
      }
    }
    return false;
  }
  const kingSq = (b, white) => b.indexOf(white ? 'K' : 'k');
  const inCheck = st => { const k = kingSq(st.b, st.white); return k >= 0 && attacked(st.b, k, !st.white); };

  function pseudo(st) {
    const { b, white } = st, out = [];
    const mine = p => p && isW(p) === white, theirs = p => p && isW(p) !== white;
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (!mine(p)) continue;
      const [r, f] = RF(i), k = p.toUpperCase();
      const add = (to, extra = {}) => out.push({ from: i, to, piece: p, cap: b[to], capSq: b[to] ? to : -1, ...extra });
      if (k === 'P') {
        const dir = white ? -1 : 1, start = white ? 6 : 1, last = white ? 0 : 7;
        const push = (to, extra) => { if ((to >> 3) === last) for (const pr of 'QRBN') add(to, { ...extra, promo: white ? pr : pr.toLowerCase() }); else add(to, extra); };
        const one = SQ(r + dir, f);
        if (one >= 0 && !b[one]) { push(one); const two = SQ(r + 2 * dir, f); if (r === start && !b[two]) add(two, { double: true }); }
        for (const df of [-1, 1]) {
          const s = SQ(r + dir, f + df); if (s < 0) continue;
          if (theirs(b[s])) push(s);
          else if (s === st.ep) out.push({ from: i, to: s, piece: p, cap: b[s + (white ? 8 : -8)], capSq: s + (white ? 8 : -8), ep: true });
        }
      } else if (k === 'N' || k === 'K') {
        for (const [dr, df] of (k === 'N' ? KN : KG)) { const s = SQ(r + dr, f + df); if (s >= 0 && !mine(b[s])) add(s); }
        if (k === 'K') {
          const home = white ? 60 : 4, c = st.castle, opp = !white;
          if (i === home && !attacked(b, home, opp)) {
            if ((white ? c.K : c.k) && !b[home + 1] && !b[home + 2] && b[home + 3] === (white ? 'R' : 'r') && !attacked(b, home + 1, opp) && !attacked(b, home + 2, opp))
              add(home + 2, { castle: 'K', rookFrom: home + 3, rookTo: home + 1 });
            if ((white ? c.Q : c.q) && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === (white ? 'R' : 'r') && !attacked(b, home - 1, opp) && !attacked(b, home - 2, opp))
              add(home - 2, { castle: 'Q', rookFrom: home - 4, rookTo: home - 1 });
          }
        }
      } else {
        const dirs = k === 'B' ? DIAG : k === 'R' ? ORTH : DIAG.concat(ORTH);
        for (const [dr, df] of dirs) {
          let rr = r + dr, ff = f + df;
          while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
            const s = rr * 8 + ff;
            if (mine(b[s])) break;
            add(s); if (b[s]) break;
            rr += dr; ff += df;
          }
        }
      }
    }
    return out;
  }

  function make(st, m) {
    const b = st.b.slice();
    if (m.capSq >= 0) b[m.capSq] = null;
    b[m.from] = null;
    b[m.to] = m.promo || m.piece;
    if (m.castle) { b[m.rookTo] = b[m.rookFrom]; b[m.rookFrom] = null; }
    const c = { ...st.castle };
    const touch = s => { if (s === 60) c.K = c.Q = false; if (s === 4) c.k = c.q = false; if (s === 63) c.K = false; if (s === 56) c.Q = false; if (s === 7) c.k = false; if (s === 0) c.q = false; };
    touch(m.from); touch(m.to);
    return { b, white: !st.white, castle: c, ep: m.double ? (m.from + m.to) / 2 : -1 };
  }

  function legal(st) {
    return pseudo(st).filter(m => { const n = make(st, m); const k = kingSq(n.b, st.white); return k >= 0 && !attacked(n.b, k, !st.white); });
  }
  const hasLegal = st => pseudo(st).some(m => { const n = make(st, m); const k = kingSq(n.b, st.white); return k >= 0 && !attacked(n.b, k, !st.white); });
  const isMate = st => inCheck(st) && !hasLegal(st);
  const status = st => { const any = hasLegal(st), chk = inCheck(st); return !any ? (chk ? 'mate' : 'stalemate') : (chk ? 'check' : 'play'); };

  // does the side to move have a mate in one? returns the mating move or null
  function mateIn1(st) { for (const m of legal(st)) if (isMate(make(st, m))) return m; return null; }

  // best defence for the side to move: a reply after which the opponent has no mate in one
  function defend(st) {
    const replies = legal(st);
    if (!replies.length) return null;
    const safe = replies.filter(r => !mateIn1(make(st, r)));
    const pool = safe.length ? safe : replies;
    // among equal options prefer captures and checks, so the defence looks purposeful
    pool.sort((a, b) => (!!b.cap - !!a.cap) || (inCheck(make(st, b)) - inCheck(make(st, a))));
    const top = pool.filter(m => !!m.cap === !!pool[0].cap);
    return { move: top[Math.floor(Math.random() * top.length)], refutes: safe.length > 0 };
  }

  // keys of a mate-in-two: first moves after which every reply allows mate in one
  function mateIn2Keys(st) {
    const keys = [];
    for (const m of legal(st)) {
      const n = make(st, m);
      if (isMate(n)) { keys.push(m); continue; }
      const replies = legal(n);
      if (!replies.length) continue; // stalemate
      if (replies.every(r => mateIn1(make(n, r)))) keys.push(m);
    }
    return keys;
  }

  function san(st, m) {
    if (m.castle) return m.castle === 'K' ? 'O-O' : 'O-O-O';
    const k = m.piece.toUpperCase();
    let s = '';
    if (k === 'P') { if (m.cap) s = 'abcdefgh'[m.from & 7] + 'x'; s += NAME(m.to); if (m.promo) s += '=' + m.promo.toUpperCase(); }
    else {
      s = k;
      const others = legal(st).filter(o => o.to === m.to && o.piece === m.piece && o.from !== m.from);
      if (others.length) { if (others.every(o => (o.from & 7) !== (m.from & 7))) s += 'abcdefgh'[m.from & 7]; else if (others.every(o => (o.from >> 3) !== (m.from >> 3))) s += 8 - (m.from >> 3); else s += NAME(m.from); }
      if (m.cap) s += 'x'; s += NAME(m.to);
    }
    const n = make(st, m);
    return s + (isMate(n) ? '#' : inCheck(n) ? '+' : '');
  }
  return { fromFEN, legal, make, inCheck, isMate, status, mateIn1, defend, mateIn2Keys, san, NAME };
})();
if (typeof module !== 'undefined') module.exports = CH;
