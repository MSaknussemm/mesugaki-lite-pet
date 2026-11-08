const fs = require('fs'), path = require('path');
class Tail {
  constructor(file, fromStart=false) { this.file=file; this.pos=0; this.pending=''; this.initial=!fromStart; this.signature=''; }
  read() {
    try {
      const stat=fs.statSync(this.file), sig=String(stat.birthtimeMs);
      if(this.initial) {
        const data=fs.readFileSync(this.file);
        const lines=data.toString('utf8').split(/\r?\n/);
        this.pending=lines.pop();
        this.pos=data.length;
        this.initialMtime=stat.mtimeMs;
        this.signature=sig;
        this.initial=false;
        // Keep only the session and lifecycle marker needed to restore state.
        let session, lifecycle;
        for(let i=lines.length-1;i>=0;i--){
          const line=lines[i];
          const event=eventFromLine(line);
          if(event==='SESSION'){session=line;break;}
          if(!lifecycle && (event==='STAGE_START'||event==='GAME_END'||event==='SESSION_END'||event==='GAME_OVER'))lifecycle=line;
        }
        return [session,lifecycle].filter(Boolean);
      }
      if(stat.size<this.pos || sig!==this.signature) {this.pos=0;this.pending='';this.signature=sig;}
      if(stat.size===this.pos) return [];
      const fd=fs.openSync(this.file,'r');
      const b=Buffer.alloc(Math.min(stat.size-this.pos,256*1024));
      let n; try { n=fs.readSync(fd,b,0,b.length,this.pos); } finally {fs.closeSync(fd);}
      this.pos+=n; const lines=(this.pending+b.toString('utf8')).split(/\r?\n/); this.pending=lines.pop(); return lines;
    } catch(e) { if(e.code==='ENOENT') {this.initial=false;this.pos=0;this.pending='';} return []; }
  }
}
// The stock launcher gives each session a timestamped log when TH07_MP_LOG is unset.
function latestSessionLog(dirs) {
  let latest=null;
  for(const dir of dirs){
    let files;
    try{files=fs.readdirSync(dir,{withFileTypes:true});}catch(e){continue;}
    for(const file of files){
      if(!file.isFile())continue;
      const match=file.name.match(/^th07_coop_p\d+_(\d{8})_(\d{6})(?:_(\d{1,2}))?\.log$/i);
      if(!match)continue;
      const order=match[1]+match[2]+(match[3]||'1').padStart(2,'0');
      if(!latest || order>latest.order)latest={file:path.join(dir,file.name),order};
    }
  }
  return latest;
}
function eventFromLine(line) {
 const match=line.match(/^([A-Z][A-Z_]+)(?:\s|$)/); if(!match) return null;
 if(match[1]==='GAME_END' && !/\bfinished=1\b/.test(line)) return 'SESSION_END';
 return match[1];
}
function normalize(msg, config) {
 if(!msg || typeof msg!=='object' || Array.isArray(msg)) throw Error('消息必须是 JSON 对象');
 const rule=config.events[msg.event];
 const silent=msg.silent===true;
 const text=msg.text ?? (rule && rule.lines[Math.floor(Math.random()*rule.lines.length)]) ?? '';
 const animation=msg.animation ?? (rule && rule.animation) ?? 'talk';
 if(!silent && (typeof text!=='string'||!text.trim()||text.length>240)) throw Error('text 需为 1–240 字符，或提供已知 event');
 if(typeof animation!=='string'||!Object.hasOwn(config.animations,animation)) throw Error('未知 animation');
 const duration=msg.duration_ms ?? 7000;
 if(!Number.isFinite(duration)||duration<1000||duration>20000) throw Error('duration_ms 范围为 1000–20000');
 return {text,animation,duration_ms:duration,event:msg.event||'MESSAGE',silent};
}
module.exports={Tail,latestSessionLog,eventFromLine,normalize};
