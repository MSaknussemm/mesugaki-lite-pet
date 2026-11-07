const path=require('path');
function zoomBounds(bounds,workArea,z){
 const size=Math.max(120,Math.round(480*z));
 // Keep the character's bottom/centre anchored, including displays with negative coordinates.
 return {width:size,height:size,
  x:Math.round(Math.max(workArea.x,Math.min(bounds.x+(bounds.width-size)/2,workArea.x+workArea.width-size))),
  y:Math.round(Math.max(workArea.y,Math.min(bounds.y+bounds.height-size,workArea.y+workArea.height-size)))};
}
function gamePresence(rows,expectedPath){
 if(!Array.isArray(rows))throw Error('Invalid process list');
 const key=p=>path.win32.normalize(p).toLowerCase();
 let unknown=false;
 for(const row of rows){
  if(!row||typeof row.Path!=='string'||!row.Path){unknown=true;continue;}
  if(key(row.Path)===key(expectedPath))return true;
 }
 return unknown?null:false;
}
module.exports={zoomBounds,gamePresence};
