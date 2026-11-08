const {app,BrowserWindow,ipcMain,Menu,Tray,nativeImage,screen,globalShortcut,dialog,shell}=require('electron');
const fs=require('fs'),path=require('path'),http=require('http');
const {execFile}=require('child_process');
const {zoomBounds,gamePresence}=require('./interaction');
const {Tail,latestSessionLog,eventFromLine,normalize}=require('./core');
const root=__dirname,config=JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8'));
try{const t=fs.readFileSync(path.join(root,'idle-lines.txt'),'utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(t.length){config.idle=config.idle||{};config.idle.lines=t;}}catch(e){}
if(config.hardware_acceleration!==true){app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');}
let win,tray,server,timer,busy=false,ready=false,watchdog,pass=false,queue=[],last=new Map(),report={},sessionSeq=0,seen=new Set(),lastGameEventAt=0,serverError=null,gameRunning=false,processTimer,checkingProcess=false,cursorTimer;
let menuOpen=false,currentMenu=null,recoveryTimer,quitting=false,windowZoom=1;
function raiseTop(){if(!win||win.isDestroyed())return;try{win.setAlwaysOnTop(true,'screen-saver');win.moveTop();}catch(e){}}
function logPet(msg){try{const f=path.join(root,'pet.log');if(fs.existsSync(f)&&fs.statSync(f).size>102400)fs.writeFileSync(f,'');fs.appendFileSync(f,new Date().toISOString()+' '+msg+'\n');}catch(e){}}
const cooldowns={PLAYER_DIE:3000,BOT_DIE:4000,GHOST:3000,GHOST_REVIVE:3000,AUTO_REVIVE:3000,GAME_END:3000,GAME_OVER:3000,SESSION_END:3000,BOT_MISS:4000,BOT_HIT:5000,BOT_DEATHBOMB:5000,BOT_BOMB:5000,PLAYER_BOMB:5000,BOT_DANGER:10000,BOT_SLOW:10000};
const priorities={PLAYER_DIE:100,GHOST:95,GHOST_REVIVE:95,AUTO_REVIVE:95,GAME_END:100,GAME_OVER:100,SESSION_END:100,BOT_MISS:85,BOT_HIT:80,BOT_DEATHBOMB:80,BOT_BOMB:70,PLAYER_BOMB:60,BOT_DANGER:40,BOT_SLOW:30};
function createPetWindow(bounds){
 const petWindow=new BrowserWindow({...bounds,transparent:true,frame:false,resizable:false,hasShadow:false,alwaysOnTop:true,skipTaskbar:true,focusable:false,show:false,webPreferences:{preload:path.join(root,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win=petWindow;
 pass=false;
 setMousePass(true);
 petWindow.webContents.on('render-process-gone',(_,details)=>recoverPetWindow(petWindow,details.reason));
 petWindow.on('show',raiseTop);
 petWindow.once('ready-to-show',()=>{if(petWindow===win&&!recoveryTimer){raiseTop();petWindow.showInactive();}});
 petWindow.loadFile(path.join(root,'index.html')).catch(error=>recoverPetWindow(petWindow,error.message));
}
function recoverPetWindow(petWindow,reason){
 if(quitting||petWindow!==win||recoveryTimer)return;
 logPet('restarting pet window: '+reason);
 ready=false;
 busy=false;
 clearTimeout(watchdog);
 menuOpen=false;
 currentMenu=null;
 setMousePass(true);
 const bounds=petWindow.getBounds();
 petWindow.hide();
 recoveryTimer=setTimeout(()=>{
  recoveryTimer=null;
  createPetWindow(bounds);
  if(!petWindow.isDestroyed())petWindow.destroy();
 },1000);
}
if(!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(()=>{
 const area=screen.getPrimaryDisplay().workArea;
 // game_dir 可以是绝对路径，也可以是相对本程序目录的路径（便于整包搬移）
 const gameDir=path.isAbsolute(config.game_dir)?config.game_dir:path.join(root,config.game_dir);
 createPetWindow({width:480,height:480,x:area.x+Math.max(0,area.width-650),y:area.y+Math.max(0,area.height-540)});
 cursorTimer=setInterval(probeCursor,50);
 setInterval(()=>{if(!menuOpen)raiseTop();},2000);
 const icon=nativeImage.createFromPath(path.join(root,'assets/tray.png'));
 tray=new Tray(icon.isEmpty()?nativeImage.createEmpty():icon);tray.setToolTip('鲸鱼娘精简版'); updateMenu();
 
 server=http.createServer((req,res)=>{
  const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  if(req.method==='GET'&&req.url==='/health') return send(200,{ok:true,queued:queue.length,busy,report,animations:Object.keys(config.animations),game_dir:gameDir,serverError,window:win?{bounds:win.getBounds(),content:win.getContentSize(),scaleFactor:screen.getPrimaryDisplay().scaleFactor,workArea:screen.getPrimaryDisplay().workArea}:null});
  if(req.method!=='POST'||req.url!=='/message') return send(404,{error:'POST /message'});
  if(req.headers.origin) return send(403,{error:'仅允许本机程序调用'});
  const chunks=[];let size=0;req.on('data',chunk=>{size+=chunk.length;if(size>8192)req.destroy();else chunks.push(chunk);});
  req.on('end',()=>{if(size>8192)return;try {const msg=normalize(JSON.parse(Buffer.concat(chunks,size).toString('utf8')),config);if(busy||queue.length)return send(429,{error:'正在说，说完再发'});enqueue(msg);send(202,{ok:true});}catch(e){send(400,{error:e.message});}});
 });
 server.on('error',e=>{serverError=e.message;logPet('server error: '+e.message);try{if(tray&&tray.displayBalloon)tray.displayBalloon({iconType:'warning',title:'鲸鱼娘桌宠',content:'端口 '+config.port+' 被占用，台词接口不可用'});}catch(x){}});server.listen(config.port,'127.0.0.1');scheduleIdle();
 const mpTail=new Tail(path.join(gameDir,'mp_log.txt'));
 const botTail=new Tail(path.join(gameDir,'bot_log.txt'));
 const sessionDirs=[path.join(gameDir,'th07_coop_logs')];
 if(process.env.APPDATA)sessionDirs.push(path.join(process.env.APPDATA,'ShanghaiAlice','th07','th07_coop_logs'));
 let sessionLog=latestSessionLog(sessionDirs);
 let sessionTail=sessionLog?new Tail(sessionLog.file):null;
 let nextSessionScan=0;
 let humanSeat=null;
 function processLine(line,backfill){
  const sm=line.match(/^SESSION .*session=([0-9A-Fa-f]+)/);if(sm){
   sessionSeq++;
   seen.clear();
   const seat=line.match(/(?:^|\s)seat=(\d+)(?=\s|$)/);
   humanSeat=seat && /\bmode=local\b/.test(line) && /\bbot=1\b/.test(line) ? Number(seat[1]) : null;
   return;
  }
  let event=eventFromLine(line);
  if(event==='STAGE_START'){
   gameRunning=true;
   seen.clear(); // Log frames restart at zero on each stage or retry.
  }
  if(event==='GAME_END'||event==='SESSION_END'||event==='GAME_OVER')gameRunning=false;
  if(backfill)return;
  if(humanSeat!==null){
   // Local AI deaths are reported by both logs. Use the actual life loss from mp_log.
   if(event==='BOT_MISS' && config.events.BOT_DIE)return;
   if(event==='PLAYER_BOMB' || event==='PLAYER_DIE'){
    const seat=line.match(/(?:^|\s)seat=(\d+)(?=\s|$)/);
    if(seat && Number(seat[1])!==humanSeat){
     if(event==='PLAYER_BOMB')return;
     event='BOT_DIE';
    }
   }
  }
  if(!config.events[event])return;
  lastGameEventAt=Date.now();
  const fm=line.match(/(?:^|\s)frame=(\d+)/);
  if(fm){const key=event+'|'+fm[1];if(seen.has(key))return;seen.add(key);if(seen.size>2000)seen.clear();}
  if(event==='PLAYER_DIE')queue=queue.filter(m=>m.event!=='PLAYER_HIT');
  const now=Date.now();const cd=cooldowns[event]||12000;if(now-(last.get(event)||0)<cd)return;
  if(enqueue(normalize({event},config)))last.set(event,now);
 }
 const fixedState=mpTail.read();
 const sessionState=sessionTail?.read()||[];
 const initialState=sessionState.length&&(!fixedState.length||sessionTail.initialMtime>mpTail.initialMtime)?sessionState:fixedState;
 for(const line of initialState)processLine(line,true);
 botTail.read();
 // Match the configured game executable, not any same-named game on the machine.
 let expectedGame=path.join(gameDir,'th07_multi.exe');
 try{expectedGame=fs.realpathSync.native(expectedGame);}catch(e){}
 const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 processTimer=setInterval(()=>{
  if(!gameRunning||checkingProcess)return;
  checkingProcess=true;
  const observedSession=sessionSeq;
  execFile(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'game-processes.ps1')],{windowsHide:true,timeout:8000,encoding:'utf8'},(error,stdout)=>{
   checkingProcess=false;
   if(error||observedSession!==sessionSeq)return;
   try{
    if(gamePresence(JSON.parse(stdout.replace(/^\uFEFF/,'')),expectedGame)===false){gameRunning=false;logPet('configured game process ended; idle restored');}
   }catch(e){logPet('process check: '+e.message);}
  });
 },10000);
 timer=setInterval(()=>{
  const now=Date.now();
  if(now>=nextSessionScan){
   nextSessionScan=now+1000;
   const found=latestSessionLog(sessionDirs);
   if(found&&(!sessionLog||found.order>sessionLog.order)){
    sessionLog=found;
    sessionTail=new Tail(found.file,true);
   }
  }
  for(const tail of [mpTail,sessionTail,botTail]){
   if(tail)for(const line of tail.read())processLine(line);
  }
 },200);
});
function scheduleIdle(){
 if(!config.idle || config.idle.enabled===false)return;
 const min=Math.max(10,config.idle.min_seconds||45), max=Math.max(min+5,config.idle.max_seconds||120);
 const delay=(min+Math.random()*(max-min))*1000;
 setTimeout(()=>{
  if(ready && !busy && !gameRunning && queue.length===0 && Date.now()-lastGameEventAt>120000){
   const lines=config.idle.lines||[];
   const text=lines.length?lines[Math.floor(Math.random()*lines.length)]:'……';
   const anims=Object.keys(config.animations).filter(k=>k!=='idle'&&k!=='failure');if(!anims.length)anims.push('talk');
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
 if(!Number.isFinite(z))return;
 z=Math.max(0.25,Math.min(1.5,z));
 windowZoom=z;
 const b=win.getBounds();
 const wa=screen.getDisplayMatching(b).workArea;
 const next=zoomBounds(b,wa,z);
 win.setBounds(next);
 probeCursor();
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
function setMousePass(ignore){
 if(!win||win.isDestroyed())return;
 const next=menuOpen?false:!!ignore;
 if(pass===next)return;
 win.setIgnoreMouseEvents(next,{forward:true});pass=next;
}
function probeCursor(){
 if(!ready||!win||win.isDestroyed()||menuOpen)return;
 const cursor=screen.getCursorScreenPoint(),b=win.getContentBounds();
 win.webContents.send('cursor',{x:cursor.x-b.x,y:cursor.y-b.y});
}
function menuClosed(menu){
 if(currentMenu!==menu)return;
 currentMenu=null;menuOpen=false;
 if(win&&!win.isDestroyed()){
  win.setFocusable(false);setMousePass(true);probeCursor();raiseTop();
 }
}
function updateMenu(){const m=Menu.buildFromTemplate([
 {label:'动画演示',submenu:Object.keys(config.animations).map(name=>({label:name,click:()=>enqueue(normalize({silent:true,animation:name},config))}))},
 {label:'打开空闲台词文件',click:()=>{const f=path.join(root,'idle-lines.txt');if(!fs.existsSync(f))fs.writeFileSync(f,'', 'utf8');shell.openPath(f);}},
 {label:'选择游戏目录',click:async()=>{const r=await dialog.showOpenDialog({properties:['openDirectory']});if(!r.canceled){config.game_dir=r.filePaths[0];fs.writeFileSync(path.join(root,'config.json'),JSON.stringify(config,null,2),'utf8');dialog.showMessageBox({message:'已保存游戏目录，重启桌宠后生效'});}}},
 {label:'缩放',submenu:[0.25,0.5,0.75,1,1.25,1.5].map(z=>({label:Math.round(z*100)+'%',click:()=>applyZoom(z)}))},
 {type:'separator'},{label:'退出',click:()=>app.quit()}]);
 m.on('menu-will-show',()=>{currentMenu=m;menuOpen=true;setMousePass(false);});
 m.on('menu-will-close',()=>menuClosed(m));
 tray?.setContextMenu(m);return m;
}
function isPetSender(event){return !recoveryTimer&&event.sender===win?.webContents;}
ipcMain.on('ready',event=>{
 if(!isPetSender(event))return;
 win.webContents.send('config',config);
 ready=true;
 if(windowZoom!==1)applyZoom(windowZoom);
 pump();
});
ipcMain.on('done',event=>{if(isPetSender(event))finish();});
ipcMain.on('report',(event,v)=>{if(isPetSender(event))report=v;});
ipcMain.on('zoom',(event,z)=>{if(isPetSender(event))applyThrottledZoom(z);});
ipcMain.on('interactive',(event,active)=>{
 if(!isPetSender(event)||typeof active!=='boolean')return;
 setMousePass(!active);
});
ipcMain.on('menu',event=>{
 if(!isPetSender(event)||menuOpen)return;
 let menu;
 try{
  setMousePass(false);
  win.setFocusable(true);win.show();win.focus();
  menu=updateMenu();currentMenu=menu;menuOpen=true;
  menu.popup({window:win,callback:()=>menuClosed(menu)});
 }catch(e){
  if(menu&&currentMenu===menu)menuClosed(menu);
  else{menuOpen=false;currentMenu=null;win.setFocusable(false);setMousePass(true);}
  logPet('menu error: '+(e&&e.stack||e));
 }
});
ipcMain.on('move',(event,v)=>{if(!isPetSender(event)||pass||!Number.isFinite(v.dx)||!Number.isFinite(v.dy))return;const [x,y]=win.getPosition();win.setPosition(x+Math.round(v.dx),y+Math.round(v.dy));});
app.on('before-quit',()=>{quitting=true;clearTimeout(recoveryTimer);});
app.on('will-quit',()=>{clearInterval(timer);clearInterval(processTimer);clearInterval(cursorTimer);clearTimeout(watchdog);server?.close();globalShortcut.unregisterAll();});
process.on('uncaughtException',e=>logPet('uncaught: '+(e&&e.stack||e)));
process.on('unhandledRejection',e=>logPet('unhandledRejection: '+(e&&e.stack||e)));
