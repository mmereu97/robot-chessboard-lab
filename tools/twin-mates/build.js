// node build.js <chosen.json> <out twins.js>: checks each position in the app's own rules and writes the public file
const fs=require('fs'),vm=require('vm'),path=require('path');
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'..','..','static','js','chess.js'),'utf8')+';globalThis.CH=CH;');
const NAME=i=>'abcdefgh'[i&7]+(8-(i>>3)),SQ=s=>'abcdefgh'.indexOf(s[0])+(8-+s[1])*8;
const [inp,outFile]=process.argv.slice(2);const L=JSON.parse(fs.readFileSync(inp,'utf8'));
function placement(st){const rows=[];for(let r=0;r<8;r++){let s='',e=0;for(let f=0;f<8;f++){const p=st.b[r*8+f];if(!p)e++;else{if(e){s+=e;e=0;}s+=p;}}rows.push(s+(e||''));}return rows.join('/');}
const out=[],skipped=[];
for(const x of L){
 const [pl,side,cas,ep]=x.fen.split(' ');let st=CH.fromFEN(pl,side==='w');st.castle={K:cas.includes('K'),Q:cas.includes('Q'),k:cas.includes('k'),q:cas.includes('q')};st.ep=ep!=='-'?SQ(ep):-1;
 const u=x.moves.split(' ')[0];st=CH.make(st,CH.legal(st).find(m=>NAME(m.from)+NAME(m.to)+(m.promo?m.promo.toLowerCase():'')===u));
 // the app rebuilds castling rights from the pieces and knows no en passant: the moves must come out the same
 const app=CH.fromFEN(placement(st),st.white),san=s=>CH.legal(s).map(m=>CH.san(s,m)).sort().join(' ');
 if(san(app)!==san(st)){skipped.push(x.id+' castling/en passant');continue;}
 const keys=CH.mateIn2Keys(app).map(m=>CH.san(app,m));if(keys.length!==1||keys[0]!==x.key){skipped.push(x.id+' keys '+keys);continue;}
 const k=CH.findSan(app,x.key),s1=CH.make(app,k);
 const vars=CH.legal(s1).map(r=>{const s2=CH.make(s1,r);return{r:CH.san(s1,r),m:CH.legal(s2).filter(w=>CH.isMate(CH.make(s2,w))).map(w=>CH.san(s2,w))};});
 // one defence for each different set of mates, those with a single mate first
 const groups=new Map();for(const v of vars){const g=v.m.slice().sort().join('/');if(!groups.has(g))groups.set(g,v);}
 const reps=[...groups.values()].sort((a,b)=>a.m.length-b.m.length);
 const W=x.side==='w';
 const sol=reps.map((v,i)=>W?(i?`1...${v.r} 2.${v.m.join(' or ')}`:`1.${x.key}! ${v.r} 2.${v.m.join(' or ')}`):(i?`2.${v.r} ${v.m.join(' or ')}`:`1...${x.key}! 2.${v.r} ${v.m.join(' or ')}`)).join('; ');
 out.push({rating:x.rating,id:x.id,url:x.url,pz:{fen:placement(app),side:x.side,goal:'mate',n:2,line:[x.key,reps[0].r,reps[0].m[0]],defences:reps.map(v=>v.r),sol}});
}
out.sort((a,b)=>a.rating-b.rating);
const items=out.map((o,i)=>{const p={name:`Twin mates #${i+1}`,desc:`From a Lichess game (puzzle ${o.id}, rated ${o.rating}). ${o.pz.side==='w'?'White':'Black'} to move, mate in two.`,...o.pz,set:'twin'};if(p.side==='w')delete p.side;return '  '+JSON.stringify(p);});
fs.writeFileSync(outFile,`// Twin mates: mate in two where every defence needs its own mate. Chosen by a program
// (twin-mates in the repo's tools) among the mate-in-two puzzles of the Lichess puzzle database,
// https://database.lichess.org/#puzzles, released under CC0. Each comes from a real game on lichess.org.
PUZZLES.push(\n${items.join(',\n')}\n);\n`);
console.log('written',out.length,'skipped',skipped.length,skipped.slice(0,5).join(' | '));
