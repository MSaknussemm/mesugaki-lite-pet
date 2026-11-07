const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('pet', {
 ready:()=>ipcRenderer.send('ready'),
 onConfig:fn=>ipcRenderer.on('config',(_,v)=>fn(v)),
 onMessage:fn=>ipcRenderer.on('message',(_,v)=>fn(v)),
 done:()=>ipcRenderer.send('done'),
 menu:()=>ipcRenderer.send('menu'),
 move:(dx,dy)=>ipcRenderer.send('move',{dx,dy}),
 report:v=>ipcRenderer.send('report',v),
 zoom:z=>ipcRenderer.send('zoom',z)
});
