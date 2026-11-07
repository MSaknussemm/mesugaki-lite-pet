const video=document.getElementById('video'),bubble=document.getElementById('bubble'),bubbleText=document.getElementById('bubbleText');
let config,current=null,hideTimer,endTimer,drag=null,zoom=1;
function play(name,loop){video.loop=loop;video.playbackRate=1.25;video.src=config.animations[name];video.play().catch(e=>window.pet.report({error:e.message}));}
function idle(){play('idle',true);}
function finish(){if(!current)return;clearTimeout(hideTimer);clearTimeout(endTimer);current=null;bubble.style.opacity=0;idle();window.pet.done();}
window.pet.onConfig(c=>{config=c;document.documentElement.style.setProperty('--zoom','1');['idle','talk'].forEach(k=>{if(c.animations[k]){const v=document.createElement('video');v.src=c.animations[k];v.preload='auto';v.muted=true;v.load();}});idle();});
window.pet.onMessage(msg=>{current=msg;started=performance.now();if(msg.silent){bubble.style.opacity=0;}else{bubbleText.textContent=msg.text;bubble.style.opacity=1;}play(msg.animation,false);hideTimer=setTimeout(()=>bubble.style.opacity=0,msg.duration_ms);endTimer=setTimeout(finish,msg.duration_ms+600);});
video.addEventListener('ended',()=>{if(current){const remaining=Math.max(0,current.duration_ms-(performance.now()-started));clearTimeout(endTimer);idle();endTimer=setTimeout(finish,remaining);}});
let started=0;video.addEventListener('loadeddata',()=>{video.playbackRate=1.25;window.pet.report({animation:video.getAttribute('src'),width:video.videoWidth,height:video.videoHeight,error:null});});
video.addEventListener('error',()=>{window.pet.report({error:'动画加载失败',src:video.getAttribute('src')});if(current)finish();});
document.addEventListener('contextmenu',e=>{e.preventDefault();if(hitCharacter(e.clientX,e.clientY))window.pet.menu();});
document.addEventListener('wheel',e=>{
 if(!config||!hitCharacter(e.clientX,e.clientY))return;
 e.preventDefault();
 const cur=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom'))||zoom;
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);
 zoom=Math.max(0.25,Math.min(1.5,cur-delta*0.0005));
 document.documentElement.style.setProperty('--zoom',zoom);
 window.pet.zoom(zoom);
},{passive:false});
// Check the visible video pixels as well as the smaller body ellipse.
// Transparent padding, hair-edge fringes and the surrounding desktop cannot start a drag.
const hitCanvas=document.createElement('canvas');hitCanvas.width=3;hitCanvas.height=3;
const hitContext=hitCanvas.getContext('2d',{willReadFrequently:true});
function hitCharacter(x,y){
 if(!hitContext||video.readyState<2||!video.videoWidth||!video.videoHeight)return false;
 const r=video.getBoundingClientRect();
 if(!r.width||!r.height)return false;
 const u=(x-r.left)/r.width,v=(y-r.top)/r.height;
 if(((u-0.5)/0.20)**2+((v-0.51)/0.43)**2>1)return false;
 try{
  hitContext.clearRect(0,0,3,3);
  hitContext.drawImage(video,u*video.videoWidth-1,v*video.videoHeight-1,3,3,0,0,3,3);
  const pixels=hitContext.getImageData(0,0,3,3).data;
  for(let i=3;i<pixels.length;i+=4)if(pixels[i]<160)return false;
  return true;
 }catch(e){return false;}
}
// Native pass-through follows current pixels even when the animation moves under a stationary mouse.
let pointer={x:-1,y:-1},lastInteractive=null;
function hitBubble(x,y){
 if(parseFloat(getComputedStyle(bubble).opacity)<0.1)return false;
 const r=bubble.getBoundingClientRect();
 return x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom;
}
function updateInteraction(x=pointer.x,y=pointer.y,force=false){
 pointer={x,y};
 const character=hitCharacter(x,y);
 const active=!!drag||character||hitBubble(x,y);
 if(force||active!==lastInteractive){lastInteractive=active;window.pet.interactive(active);}
 document.getElementById('drag').style.cursor=drag?'grabbing':character?'grab':'default';
}
window.pet.onCursor(({x,y})=>updateInteraction(x,y,true));
// Electron forwards mousemove while the native window is ignoring mouse input.
document.addEventListener('mousemove',e=>updateInteraction(e.clientX,e.clientY));
document.getElementById('drag').addEventListener('pointerdown',e=>{
 if(e.button!==0||!hitCharacter(e.clientX,e.clientY))return;
 drag={id:e.pointerId,x:e.screenX,y:e.screenY};
 e.target.setPointerCapture(e.pointerId);updateInteraction(e.clientX,e.clientY);
});
document.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.id)return;
 window.pet.move(e.screenX-drag.x,e.screenY-drag.y);
 drag={id:e.pointerId,x:e.screenX,y:e.screenY};
});
function endDrag(){drag=null;updateInteraction();}
document.addEventListener('pointerup',endDrag);
document.addEventListener('pointercancel',endDrag);
document.addEventListener('lostpointercapture',endDrag);
window.addEventListener('blur',endDrag);
window.pet.ready();
