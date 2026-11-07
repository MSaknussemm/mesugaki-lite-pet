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
document.addEventListener('contextmenu',e=>{e.preventDefault();window.pet.menu();});
document.addEventListener('wheel',e=>{if(!config)return;const w=innerWidth,h=innerHeight,cx=w*0.51,cy=h*0.84,rx=Math.max(30,w*0.04),ry=Math.max(36,h*0.055);const dx=(e.clientX-cx)/rx,dy=(e.clientY-cy)/ry;if(dx*dx+dy*dy>1)return;e.preventDefault();const cur=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom'))||zoom;zoom=Math.max(0.25,Math.min(1.5,cur-e.deltaY*0.0005));document.documentElement.style.setProperty('--zoom',zoom);document.documentElement.style.setProperty('--bubble-display','block');document.documentElement.style.setProperty('--bubble-arrow','block');window.pet.zoom(zoom);},{passive:false});
document.getElementById('drag').addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.screenX,y:e.screenY};e.target.setPointerCapture(e.pointerId);});
document.addEventListener('pointermove',e=>{if(!drag)return;window.pet.move(e.screenX-drag.x,e.screenY-drag.y);drag={x:e.screenX,y:e.screenY};});
document.addEventListener('pointerup',()=>drag=null);document.addEventListener('lostpointercapture',()=>drag=null);
window.pet.ready();
