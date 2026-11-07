const fs = require('fs');
class Tail {
  constructor(file) { this.file=file; this.pos=0; this.pending=''; this.initial=true; this.signature=''; }
  read() {
    try {
      const stat=fs.statSync(this.file), sig=String(stat.birthtimeMs);
      if(this.initial) { this.pos=stat.size; this.signature=sig; this.initial=false; try{const text=fs.readFileSync(this.file,'utf8');return text.split(/\r?\n/).slice(-50);}catch(e){return [];} }
      if(stat.size<this.pos || sig!==this.signature) {this.pos=0;this.pending='';this.signature=sig;}
      if(stat.size===this.pos) return [];
      const fd=fs.openSync(this.file,'r');
      const b=Buffer.alloc(Math.min(stat.size-this.pos,256*1024));
      let n; try { n=fs.readSync(fd,b,0,b.length,this.pos); } finally {fs.closeSync(fd);}
      this.pos+=n; const lines=(this.pending+b.toString('utf8')).split(/\r?\n/); this.pending=lines.pop(); return lines;
    } catch(e) { if(e.code==='ENOENT') {this.initial=false;this.pos=0;this.pending='';} return []; }
  }
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
module.exports={Tail,eventFromLine,normalize};
