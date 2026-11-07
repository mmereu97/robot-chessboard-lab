// Lichess puzzles come as pzstd: a 12-byte skippable frame giving the size of each zstd frame that follows
const zlib=require('zlib'),fs=require('fs');
(async()=>{const r=await fetch('https://database.lichess.org/lichess_db_puzzle.csv.zst');
const out=fs.createWriteStream('mate2.csv');let raw=Buffer.alloc(0),text='',n=0,k=0,header=null,frames=0;
const eat=s=>{text+=s;let i;while((i=text.indexOf('\n'))>=0){const line=text.slice(0,i);text=text.slice(i+1);if(!header){header=line;out.write(line+'\n');continue;}n++;if(/\bmateIn2\b/.test(line)){out.write(line+'\n');k++;}}};
const reader=r.body.getReader();
for(;;){const {value,done}=await reader.read();if(value)raw=Buffer.concat([raw,Buffer.from(value)]);
 for(;;){if(raw.length<8)break;const magic=raw.readUInt32LE(0);
  if((magic&0xFFFFFFF0)===0x184D2A50){const len=raw.readUInt32LE(4);if(raw.length<8+len)break;const size=len>=4?raw.readUInt32LE(8):0;
   if(len===4&&raw.length>=12+size){const frame=raw.subarray(12,12+size);eat(zlib.zstdDecompressSync(frame).toString('utf8'));raw=raw.subarray(12+size);frames++;continue;}
   if(len!==4){raw=raw.subarray(8+len);continue;}break;}
  if(magic===0xFD2FB528){ if(!done)break; eat(zlib.zstdDecompressSync(raw).toString('utf8'));raw=Buffer.alloc(0);break;}
  throw new Error('unknown frame '+magic.toString(16));}
 if(done)break;}
out.end();console.log('frames',frames,'header',header);console.log('puzzles',n,'mate in 2',k);})().catch(e=>console.log('ERR',e.message));
