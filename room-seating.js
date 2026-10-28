(() => {
  'use strict';
  // Three independent layers: chair-free room, empty chair, occupied chair.
  // A seated person and their chair are one intact RGBA image. Never overlay
  // another backrest or wheel mask on that image, or stretch its legs to dock.
  const sources={office:'chair-office-empty-v42.png',round:'chair-round-empty-v42.png',mint:'chair-mint-empty-v42.png',hank:'npc-hank-seated-chair-v42.png',princessOffice:'npc-princess-office-v42.png',princessRound:'npc-princess-stool-v42.png',anthony:'npc-anthony-keyboard-v46.png'};
  // Each rectangle maps the entire source canvas, including transparent space.
  // Empty/occupied images use exactly the same rectangle and reflection.
  // Simulation seats sit outside the central platform's occluder; their whole
  // empty and occupied layers move together, including the wheel bases.
  const seats={
    library:{computer:{empty:'office',occupied:'hank',x:510,y:355,width:319,height:308,flip:false,body:[700,663]},second:{empty:'office',occupied:'hank',x:910,y:415,width:319,height:308,flip:true,body:[1045,723]}},
    clock:{computer:{empty:'office',occupied:'princessOffice',x:1043,y:481,width:319,height:308,flip:true,body:[1175,789]},stool:{empty:'round',occupied:'princessRound',x:458,y:425,width:332,height:321,flip:false,body:[660,746]}},
    lab:{computer:{empty:'mint',occupied:'anthony',x:912,y:343,width:295,height:285,flip:true,body:[1028,628]},second:{empty:'mint',occupied:'anthony',x:318,y:343,width:295,height:285,flip:false,body:[505,628]}},
    workshop:{left:{empty:'office',occupied:'princessOffice',x:250,y:400,width:319,height:308,flip:false,body:[440,708]},right:{empty:'mint',occupied:'anthony',x:1110,y:500,width:319,height:308,flip:true,body:[1236,808]}}
  };
  const images={},loads={};
  const keys=key=>[...new Set(Object.values(seats[key]||{}).flatMap(s=>[s.empty,s.occupied]))];
  function load(key){return Promise.all(keys(key).map(name=>loads[name]||(loads[name]=new Promise(resolve=>{const im=new Image();images[name]=im;im.onload=()=>resolve(true);im.onerror=()=>{delete loads[name];resolve(false);};im.src='assets/'+sources[name];}))));}
  function ready(key){return keys(key).every(name=>images[name]?.naturalWidth>0);}
  function occupied(w){return w?.pose==='sit'?seats[w.key]?.[w.station]:null;}
  function paint(g,seat,name,worker=null){
    const im=images[name];if(!im?.naturalWidth)return;
    g.save();g.translate(seat.x+(seat.flip?seat.width:0),seat.y);if(seat.flip)g.scale(-1,1);
    if(worker===null)g.drawImage(im,0,0,seat.width,seat.height);
    else if(window.IslandNPCRenderer?.drawSeated)IslandNPCRenderer.drawSeated(g,seat,im,worker,name);
    else{
      // Subpixel breathing above the chair: the lower body, cushion and every
      // wheel stay fixed. Both pieces share the same boundary without overlap.
      const cut=Math.floor(im.naturalHeight*.40),edge=cut/im.naturalHeight*seat.height,breath=Math.sin(worker.time*1.8)*.35;
      g.drawImage(im,0,0,im.naturalWidth,cut,0,-breath,seat.width,edge+breath);
      g.drawImage(im,0,cut,im.naturalWidth,im.naturalHeight-cut,0,edge,seat.width,seat.height-edge);
    }
    g.restore();
  }
  function drawOccupied(g,w){const seat=occupied(w);if(seat)paint(g,seat,seat.occupied,w);}
  function drawDeskProps(g,key){
    if(key!=='workshop')return;
    // A compact keyboard on the right computer bench, beneath the operator's
    // hands. Its perspective follows the existing desktop plane.
    g.save();g.translate(1290,627);g.transform(.92,.25,-.2,.8,0,0);
    g.fillStyle='#343d3d';g.strokeStyle='#b0ada0';g.lineWidth=.8;g.beginPath();g.roundRect(0,0,66,27,2);g.fill();g.stroke();
    g.fillStyle='#747b75';for(let row=0;row<4;row++)for(let col=0;col<12;col++)g.fillRect(3+col*5,3+row*5,3.5,3.4);
    g.fillStyle='#858b83';g.fillRect(18,23,26,2);g.restore();
  }
  function emptyEntities(key,w){const active=new Set((Array.isArray(w)?w:[w]).map(occupied));return Object.values(seats[key]||{}).filter(s=>!active.has(s)).map(s=>({actor:{x:s.body[0],y:s.body[1]},draw:g=>paint(g,s,s.empty)}));}
  function body(w){const seat=occupied(w);return seat?{x:seat.body[0],y:seat.body[1],radius:66,name:w.name}:null;}
  function snapshot(key,w){const active=occupied(w);return {ready:ready(key),roomLayer:'chair-free',occupiedStation:active?w.station:null,chairs:Object.entries(seats[key]||{}).map(([station,s])=>({station,layer:s===active?'person-with-chair':'empty-chair',asset:sources[s===active?s.occupied:s.empty],x:s.x,y:s.y,width:s.width,height:s.height,flip:s.flip}))};}
  window.IslandRoomSeating=Object.freeze({load,ready,occupied,drawOccupied,drawDeskProps,emptyEntities,body,snapshot,handles:key=>!!seats[key]});
})();
