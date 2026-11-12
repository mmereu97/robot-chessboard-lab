// node tools/perf-elo/calibrate.js <repo root> <out.jsonl>   (needs playwright-core and a Chromium in HS)
// bot against bot at known Elos; every game read by Stockfish at full strength; accuracy per side (Lichess formula)
const { chromium } = require('playwright-core');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.argv[2],OUT=process.argv[3];const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json'};
const srv=http.createServer((q,a)=>{const u=q.url.split('?')[0];let f=path.join(ROOT,decodeURIComponent(u));if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{if(e){a.writeHead(404);a.end();return;}a.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});a.end(d);});});
const LEVELS=[200,400,600,800,1000,1200,1400,1700,2000,2400],GAMES=6,PAGES=4;
(async()=>{await new Promise(r=>srv.listen(0,r));const b=await chromium.launch({executablePath:process.env.HS,args:['--no-sandbox']});
const jobs=[];for(let g=0;g<GAMES;g++)for(const L of LEVELS)jobs.push(L);
const worker=async(id)=>{const page=await b.newPage();page.on('pageerror',e=>console.error('pageerror',id,e.message));
 await page.goto(`http://127.0.0.1:${srv.address().port}/static/`);await new Promise(r=>setTimeout(r,1500));
 while(jobs.length){const L=jobs.shift();const t0=Date.now();
  try{const r=await page.evaluate(async(L)=>{
   const mod=await import('./bot/bot.js');const brain=mod.newGame();
   let st=CH.fromFEN(PUZZLES[0].fen,true);const sts=[st];
   for(let ply=0;ply<120;ply++){if(brain.over())break;
    const uci=await new Promise((res,rej)=>brain.think(L,false,res,()=>rej(new Error('bot'))));
    const m=CH.legal(st).find(x=>uciOf(x)===uci);if(!m)break;brain.play(uci);st=CH.make(st,m);sts.push(st);}
   const wins=[];for(const s of sts){const over=CH.status(s);let cp;
    if(over==='mate')cp=s.white?-100000:100000;else if(over==='stalemate')cp=0;
    else{const sc=await judge(fenOf(s),200);cp=(s.white?1:-1)*(sc.mate!==undefined?(sc.mate>0?100000:-100000):sc.cp);}
    wins.push(winPct(cp));}
   return {L,plies:sts.length-1,over:brain.over(),acc:gameAccuracy(wins)};},L);
   fs.appendFileSync(OUT,JSON.stringify({...r,s:Math.round((Date.now()-t0)/1000)})+'\n');
  }catch(e){fs.appendFileSync(OUT,JSON.stringify({L,error:e.message})+'\n');}}
 await page.close();};
await Promise.all(Array.from({length:PAGES},(_,i)=>worker(i)));await b.close();srv.close();console.log('done');})();
