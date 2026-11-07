const {app,BrowserWindow,ipcMain,Menu,Tray,nativeImage,screen,globalShortcut,dialog,shell}=require('electron');
const fs=require('fs'),path=require('path'),http=require('http');
const {Tail,eventFromLine,normalize}=require('./core');
const root=__dirname,config=JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8'));
try{const t=fs.readFileSync(path.join(root,'idle-lines.txt'),'utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(t.length){config.idle=config.idle||{};config.idle.lines=t;}}catch(e){}
if(config.hardware_acceleration!==true){app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');}
let win,tray,server,timer,busy=false,ready=false,watchdog,pass=false,queue=[],last=new Map(),report={},lastSession='',sessionSeq=0,seen=new Set(),lastGameEventAt=0,serverError=null,gameRunning=false;
let menuOpen=false, currentMenu=null, menuOpenedAt=0;
function raiseTop(){if(!win||win.isDestroyed())return;try{win.setAlwaysOnTop(true,'screen-saver');win.moveTop();}catch(e){}}
function logPet(msg){try{const f=path.join(root,'pet.log');if(fs.existsSync(f)&&fs.statSync(f).size>102400)fs.writeFileSync(f,'');fs.appendFileSync(f,new Date().toISOString()+' '+msg+'\n');}catch(e){}}
const cooldowns={PLAYER_DIE:3000,GHOST:3000,GHOST_REVIVE:3000,AUTO_REVIVE:3000,GAME_END:3000,GAME_OVER:3000,SESSION_END:3000,BOT_MISS:4000,BOT_HIT:5000,BOT_DEATHBOMB:5000,BOT_BOMB:5000,PLAYER_BOMB:5000,BOT_DANGER:10000,BOT_SLOW:10000};
const priorities={PLAYER_DIE:100,GHOST:95,GHOST_REVIVE:95,AUTO_REVIVE:95,GAME_END:100,GAME_OVER:100,SESSION_END:100,BOT_MISS:85,BOT_HIT:80,BOT_DEATHBOMB:80,BOT_BOMB:70,PLAYER_BOMB:60,BOT_DANGER:40,BOT_SLOW:30};
if(!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(()=>{
 const area=screen.getPrimaryDisplay().workArea;
 win=new BrowserWindow({width:480,height:480,x:area.x+Math.max(0,area.width-650),y:area.y+Math.max(0,area.height-540),transparent:true,frame:false,resizable:false,hasShadow:false,alwaysOnTop:true,skipTaskbar:true,focusable:false,show:false,webPreferences:{preload:path.join(root,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 raiseTop();
 setInterval(()=>{if(!menuOpen)raiseTop();},2000);
 win.on('show',raiseTop);
 win.loadFile(path.join(root,'index.html')); win.once('ready-to-show',()=>{raiseTop();win.showInactive();});
 const icon=nativeImage.createFromPath(path.join(root,'assets/tray.png'));
 tray=new Tray(icon.isEmpty()?nativeImage.createEmpty():icon);tray.setToolTip('鲸鱼娘精简版'); updateMenu();
 
 server=http.createServer((req,res)=>{
  const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  if(req.method==='GET'&&req.url==='/health') return send(200,{ok:true,queued:queue.length,busy,report,animations:Object.keys(config.animations),game_dir:config.game_dir,serverError,window:win?{bounds:win.getBounds(),content:win.getContentSize(),scaleFactor:screen.getPrimaryDisplay().scaleFactor,workArea:screen.getPrimaryDisplay().workArea}:null});
  if(req.method!=='POST'||req.url!=='/message') return send(404,{error:'POST /message'});
  if(req.headers.origin) return send(403,{error:'仅允许本机程序调用'});
  let raw='',size=0;req.on('data',chunk=>{size+=chunk.length;if(size>8192) req.destroy();else raw+=chunk;});
  req.on('end',()=>{try {const msg=normalize(JSON.parse(raw),config);if(busy||queue.length)return send(429,{error:'正在说，说完再发'});enqueue(msg);send(202,{ok:true});}catch(e){send(400,{error:e.message});}});
 });
 server.on('error',e=>{serverError=e.message;try{fs.appendFileSync(path.join(root,'pet.log'),new Date().toISOString()+' server error: '+e.message+'\n');}catch(x){}});server.listen(config.port,'127.0.0.1');scheduleIdle();
 const tails=['mp_log.txt','bot_log.txt'].map(f=>new Tail(path.join(config.game_dir,f)));
 function processLine(line,backfill){
  const sm=line.match(/^SESSION .*session=([0-9A-Fa-f]+)/);if(sm){lastSession=sm[1]+'#'+(++sessionSeq);return;}
  const event=eventFromLine(line);
  if(event==='STAGE_START')gameRunning=true;
  if(event==='GAME_END'||event==='SESSION_END'||event==='GAME_OVER')gameRunning=false;
  if(!config.events[event])return;
  if(!backfill)lastGameEventAt=Date.now();
  if(backfill&&(event==='PAUSE'||event==='STAGE_START'||event==='SESSION_END'||event==='GAME_END'))return;
  const fm=line.match(/(?:^|\s)frame=(\d+)/);
  if(fm){const key=lastSession+'|'+event+'|'+fm[1];if(seen.has(key))return;seen.add(key);if(seen.size>2000)seen.clear();}
  if(event==='PLAYER_DIE')queue=queue.filter(m=>m.event!=='PLAYER_HIT');
  const now=Date.now();const cd=cooldowns[event]||12000;if(now-(last.get(event)||0)<cd)return;
  last.set(event,now);enqueue(normalize({event},config));
 }
 tails.forEach(t=>{let recent=false;try{recent=Date.now()-fs.statSync(t.file).mtimeMs<300000;}catch(e){}const lines=t.read().filter(Boolean);if(recent)lines.slice(-10).forEach(line=>processLine(line,true));});
 timer=setInterval(()=>{for(const t of tails)for(const line of t.read())processLine(line);},200);
});
function scheduleIdle(){
 if(!config.idle || config.idle.enabled===false)return;
 const min=Math.max(10,config.idle.min_seconds||45), max=Math.max(min+5,config.idle.max_seconds||120);
 const delay=(min+Math.random()*(max-min))*1000;
 setTimeout(()=>{
  if(ready && !busy && !gameRunning && queue.length===0 && Date.now()-lastGameEventAt>120000){
   const lines=config.idle.lines||[];
   const text=lines.length?lines[Math.floor(Math.random()*lines.length)]:'……';
   const anims=Object.keys(config.animations).filter(k=>k!=='idle');if(!anims.length)anims.push('talk');
   const animation=anims[Math.floor(Math.random()*anims.length)];
   enqueue(normalize({text,animation},config));
   try{const lf=path.join(root,'idle.log');if(fs.existsSync(lf)&&fs.statSync(lf).size>102400)fs.writeFileSync(lf,'');fs.appendFileSync(lf,new Date().toISOString()+' say '+animation+' '+text+'\n');}catch(e){}
  }
  scheduleIdle();
 },delay);
}
function enqueue(msg){if(busy||queue.length)return false;msg.priority=priorities[msg.event]||50;queue.push(msg);pump();return true;}
function pump(){if(!ready||busy||!queue.length)return;busy=true;win.webContents.send('message',queue.shift());watchdog=setTimeout(finish,25000);}
function finish(){clearTimeout(watchdog);busy=false;pump();}
function applyZoom(z){
 const b=win.getBounds();
 const w=Math.max(120,Math.round(480*z)), h=Math.max(120,Math.round(480*z));
 const wa=screen.getPrimaryDisplay().workArea;
 const x=Math.min(Math.max(wa.x,b.x),wa.x+wa.width-w);
 const y=Math.min(Math.max(wa.y,b.y),wa.y+wa.height-h);
 win.setContentSize(w,h);
 win.setPosition(x,y);
 win.webContents.executeJavaScript('document.documentElement.style.setProperty("--zoom","'+z+'");document.documentElement.style.setProperty("--bubble-display","block");document.documentElement.style.setProperty("--bubble-arrow","block");').catch(()=>{});
 try{if(fs.existsSync(path.join(root,'zoom.log'))&&fs.statSync(path.join(root,'zoom.log')).size>102400)fs.writeFileSync(path.join(root,'zoom.log'),'');fs.appendFileSync(path.join(root,'zoom.log'),new Date().toISOString()+' z='+z+' content='+JSON.stringify(win.getContentSize())+' bounds='+JSON.stringify(win.getBounds())+'\n');}catch(e){}
}
let zoomTimer=null,pendingZoom=1;
function applyThrottledZoom(z){
 if(!Number.isFinite(z))return;
 pendingZoom=Math.max(0.25,Math.min(1.5,z));
 if(zoomTimer)return;
 zoomTimer=setTimeout(()=>{zoomTimer=null;applyZoom(pendingZoom);},80);
}
function togglePass(){pass=!pass;win.setIgnoreMouseEvents(pass,{forward:true});updateMenu();}
function updateMenu(){const m=Menu.buildFromTemplate([
 {label:'动画演示',submenu:Object.keys(config.animations).map(name=>({label:name,click:()=>enqueue(normalize({silent:true,animation:name},config))}))},
 {label:'打开空闲台词文件',click:()=>{const f=path.join(root,'idle-lines.txt');if(!fs.existsSync(f))fs.writeFileSync(f,'', 'utf8');shell.openPath(f);}},
 {label:'选择游戏目录',click:async()=>{const r=await dialog.showOpenDialog({properties:['openDirectory']});if(!r.canceled){config.game_dir=r.filePaths[0];fs.writeFileSync(path.join(root,'config.json'),JSON.stringify(config,null,2),'utf8');dialog.showMessageBox({message:'已保存游戏目录，重启桌宠后生效'});}}},
 {label:'缩放',submenu:[0.25,0.5,0.75,1,1.25].map(z=>({label:Math.round(z*100)+'%',click:()=>applyZoom(z)}))},
 {type:'separator'},{label:'退出',click:()=>app.quit()}]);tray?.setContextMenu(m);return m;}
ipcMain.on('ready',()=>{win.webContents.send('config',config);ready=true;pump();});
ipcMain.on('done',finish);ipcMain.on('report',(_,v)=>report=v);ipcMain.on('zoom',(_,z)=>applyThrottledZoom(z));
ipcMain.on('menu',()=>{
  try{
    if(currentMenu){try{currentMenu.closePopup(win);}catch(e){}currentMenu=null;}
    menuOpen=true; menuOpenedAt=Date.now();
    // 原生菜单需要窗口真正被激活，否则点外面/按 ESC 都关不掉，会一直盖在角色上
    try{win.setFocusable(true);win.show();win.focus();}catch(e){}
    currentMenu=updateMenu();
    currentMenu.popup({window:win,callback:()=>{
      menuOpen=false; currentMenu=null;
      try{win.setFocusable(false);}catch(e){}
      try{raiseTop();}catch(e){}
    }});
  }catch(e){menuOpen=false;currentMenu=null;logPet('menu error: '+(e&&e.stack||e));}
});
// 菜单卡死的兜底：10 秒还没关就强关
setInterval(()=>{
  if(menuOpen&&Date.now()-menuOpenedAt>10000){
    try{currentMenu&&currentMenu.closePopup(win);}catch(e){}
    menuOpen=false;currentMenu=null;
    try{win.setFocusable(false);}catch(e){}
    logPet('menu stuck: force closed');
  }
},2000);
ipcMain.on('move',(_,v)=>{if(pass||!Number.isFinite(v.dx)||!Number.isFinite(v.dy))return;const [x,y]=win.getPosition();win.setPosition(x+Math.round(v.dx),y+Math.round(v.dy));});
app.on('will-quit',()=>{clearInterval(timer);clearTimeout(watchdog);server?.close();globalShortcut.unregisterAll();});
process.on('uncaughtException',e=>logPet('uncaught: '+(e&&e.stack||e)));
process.on('unhandledRejection',e=>logPet('unhandledRejection: '+(e&&e.stack||e)));
