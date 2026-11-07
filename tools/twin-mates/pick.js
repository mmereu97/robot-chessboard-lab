// node pick.js <in.jsonl> <n>: rescore and choose varied, beautiful positions
const fs=require('fs');const [inp,N=100]=process.argv.slice(2);
const L=fs.readFileSync(inp,'utf8').split('\n').filter(Boolean).map(JSON.parse);
const piece=s=>/^[KQRBN]/.test(s)?s[0]:'P';
const sqOf=san=>(san.match(/[a-h][1-8]/g)||[]).pop();
for(const x of L){
 // a defence that just puts a piece in the way, mated by taking it there, says nothing new
 const real=x.vars.filter(v=>!(!v.r.includes("x")&&!/^K/.test(v.r)&&v.m.length&&v.m.every(m=>m.includes("x")&&sqOf(m)===sqOf(v.r))));
 const realMates=new Set(real.map(v=>v.m.slice().sort().join("/")));x.realVariety=realMates.size;
 const nonKing=[...new Set(x.takers.replace('k','').replace('K',''))];
 // the mating moves that answer the defences: the first mate of each, distinct
 const firsts=[...new Set(x.vars.map(v=>v.m[0]))], matePieces=new Set(firsts.map(piece));
 const kingTakes=/k/i.test(x.takers);
 let s=4*(x.cover-1)+(nonKing.length>=2?5:0)+(matePieces.size>=2?2:0)+(x.check?0:3)+3*x.dualFree+(x.sacrifice?2:0)-(kingTakes&&nonKing.length<2?2:0)-(x.vars.length>6?2:0);
 s+=(x.pop>=90?1:0)+(x.plays>=1000?0.5:0);
 s+=2*(x.realVariety-2)-2*(x.vars.length-real.length);x.s2=+s.toFixed(2);x.sig=piece(x.key)+'|'+[...x.takers].sort().join('')+'|'+x.cover+'|'+[...matePieces].sort().join('')+'|'+x.check;
}
const ok=L.filter(x=>x.realVariety>=2&&x.pop>=70&&x.plays>=200&&x.dualFree>=0.5&&x.vars.length<=6).sort((a,b)=>b.s2-a.s2||b.pop-a.pop);
const per={},games=new Set(),out=[];
for(const x of ok){if(out.length>=N)break;const g=x.url.split('#')[0].split('/').slice(0,5).join('/');if(games.has(g))continue;if((per[x.sig]||0)>=2)continue;per[x.sig]=(per[x.sig]||0)+1;games.add(g);out.push(x);}
console.log('candidates',L.length,'quality',ok.length,'chosen',out.length);
const hist=a=>{const h={};a.forEach(k=>h[k]=(h[k]||0)+1);return JSON.stringify(h);};
console.log('cover',hist(out.map(x=>x.cover)),'quiet keys',out.filter(x=>!x.check).length,'side',hist(out.map(x=>x.side)),'non-king takers ≥2',out.filter(x=>[...new Set(x.takers.replace(/k/ig,''))].length>=2).length);
console.log('rating min/median/max',Math.min(...out.map(x=>x.rating)),out.map(x=>x.rating).sort((a,b)=>a-b)[out.length>>1],Math.max(...out.map(x=>x.rating)));
for(const x of out.slice(0,14))console.log(x.s2,x.id,x.rating,x.side,x.key,'|',x.vars.map(v=>v.r+'>'+v.m.join('/')).join(' ; ').slice(0,120));
fs.writeFileSync('chosen.json',JSON.stringify(out));
