(() => {
  'use strict';
  const point=([x,y])=>({x,y}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  // Coordinates match the 1536 x 1024 artwork. Floor polygons constrain feet;
  // obstacle polygons include chairs, tables and cabinets rather than just walls.
  const layouts={
    clock:{spawn:[760,865],floor:[[380,830],[525,790],[745,720],[825,665],[990,690],[1055,715],[1110,785],[1245,810],[1300,826],[1080,914],[700,942],[450,880],[335,825]],obstacles:[[[600,675],[705,670],[727,750],[600,760]],[[1100,675],[1210,665],[1250,770],[1155,800],[1090,760]]],equipment:{outline:1,target:[1065,750],lookAt:[1220,535]},occluders:[]},
    workshop:{spawn:[750,900],floor:[[275,695],[405,648],[660,555],[835,565],[1030,620],[1245,732],[1380,790],[1195,870],[805,966],[480,934],[255,851],[230,785]],obstacles:[[[410,614],[620,557],[811,617],[801,716],[696,787],[420,727]],[[780,683],[985,616],[1190,686],[1175,827],[1098,877],[782,786]],[[300,642],[375,642],[390,730],[300,735]]],equipment:{outline:0,target:[610,815],lookAt:[610,625]},occluders:[{poly:[[414,592],[620,557],[811,617],[800,720],[696,787],[414,731]],front:[[414,731],[696,787],[805,720]]},{poly:[[780,664],[985,616],[1190,686],[1175,827],[1098,877],[782,786]],front:[[782,786],[1098,877],[1175,827]]}]},
    library:{spawn:[760,850],floor:[[345,735],[535,659],[680,596],[858,582],[1000,630],[1205,735],[1150,834],[890,914],[575,919],[425,825],[320,790]],obstacles:[[[633,523],[758,501],[780,639],[632,666]],[[965,593],[1085,579],[1118,721],[1016,748],[952,708]],[[395,566],[540,568],[547,681],[463,702],[400,667]]],equipment:{outline:1,target:[890,735],lookAt:[1160,470]},occluders:[]},
    lab:{spawn:[770,870],floor:[[375,623],[500,562],[633,535],[910,535],[1048,577],[1182,665],[1183,737],[1080,820],[950,871],[770,920],[600,876],[456,801],[362,710]],obstacles:[[[585,540],[748,489],[937,553],[982,655],[924,733],[741,764],[566,690],[554,610]],[[427,548],[488,548],[507,605],[424,610]],[[1025,552],[1090,553],[1106,608],[1024,612]],[[250,600],[380,600],[399,712],[306,750]]],equipment:{outline:1,target:[420,660],lookAt:[420,440]},occluders:[{poly:[[600,480],[740,461],[930,495],[978,640],[924,733],[741,764],[566,690],[554,610]],front:[[554,690],[741,764],[924,733],[978,655]]}]},
  };
  function inside(p,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [x,y]=poly[i],[xx,yy]=poly[j];if((y>p.y)!==(yy>p.y)&&p.x<(xx-x)*(p.y-y)/(yy-y)+x)hit=!hit;}return hit;}
  function edgeDistance(p,poly){let d=Infinity;for(let i=0;i<poly.length;i++){const a=point(poly[i]),b=point(poly[(i+1)%poly.length]),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));d=Math.min(d,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy));}return d;}
  function segmentDistance(a,b,c,d){
    const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x),toSegment=(p,q,r)=>{const dx=r.x-q.x,dy=r.y-q.y,t=Math.max(0,Math.min(1,((p.x-q.x)*dx+(p.y-q.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-q.x-t*dx,p.y-q.y-t*dy);};
    if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y)))return 0;
    return Math.min(toSegment(a,c,d),toSegment(b,c,d),toSegment(c,a,b),toSegment(d,a,b));
  }
  const coworkers={
    clock:{name:'小公主',asset:'princess',x:560,y:800,height:330,frames:[[78,47,418,907]]},
    library:{name:'Hank',asset:'hank',x:625,y:745,height:310,frames:[[1042,29,392,942]],direction:'upper-left'},
    lab:{name:'安東尼',asset:'anthony',x:1125,y:715,height:300,frames:[[1121,52,370,901]]},
  };
  // Furniture is static; coworker footprints follow their live positions.
  function drawCoworker(g,p,image,time){
    if(!image?.complete||!image.naturalWidth||!p.frames.length)return;
    // One intact pose, animated continuously about planted feet. No frame swaps
    // or overlapping body images: every working/looking/breathing cycle eases.
    const work=Math.sin(time*.72),breath=Math.sin(time*1.7),look=Math.sin(time*.37);
    g.save();g.fillStyle='#47322226';g.beginPath();g.ellipse(p.x,p.y+2,27,8,0,0,Math.PI*2);g.fill();
    g.translate(p.x,p.y);g.transform(1,0,work*.009+look*.002,1+breath*.004,0,0);
    const [x,y,w,h]=p.frames[0],scale=p.height/h;g.drawImage(image,x,y,w,h,-w*scale/2,-p.height,w*scale,p.height);g.restore();
  }
  const cache=new Map();
  function navigation(key){
    if(cache.has(key))return cache.get(key);
    const layout=layouts[key],isWalkable=p=>inside(p,layout.floor)&&edgeDistance(p,layout.floor)>=10&&!layout.obstacles.some(poly=>inside(p,poly)||edgeDistance(p,poly)<12);
    // Check the entire segment, including clearance around furniture corners.
    const clear=(a,b)=>isWalkable(a)&&isWalkable(b)&&[layout.floor,...layout.obstacles].every((poly,index)=>poly.every((v,i)=>segmentDistance(a,b,point(v),point(poly[(i+1)%poly.length]))>=(index?12:10)));
    const nodes=[],indices=new Map(),step=20;
    for(let y=520;y<=960;y+=step)for(let x=220;x<=1400;x+=step){const p={x,y};if(isWalkable(p)){indices.set(x+','+y,nodes.length);nodes.push({...p,links:[]});}}
    nodes.forEach(p=>{for(const [dx,dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){const i=indices.get((p.x+dx*step)+','+(p.y+dy*step));if(i!==undefined&&clear(p,nodes[i]))p.links.push(i);}});
    function findPath(start,target,people=[]){
      const safe=(a,b)=>clear(a,b)&&(!people.length||IslandCatTerrain.peopleClear(a,b,people,64));
      if(!isWalkable(start)||!isWalkable(target))return null;
      if(safe(start,target))return [{...target}];
      const near=p=>nodes.map((n,i)=>({i,d:distance(p,n)})).filter(n=>n.d<90).sort((a,b)=>a.d-b.d).filter(n=>safe(p,nodes[n.i])).slice(0,8);
      const beginnings=near(start),ends=near(target),goals=new Set(ends.map(n=>n.i)),costs=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),open=new Set();
      beginnings.forEach(n=>{costs[n.i]=n.d;open.add(n.i);});let end=-1;
      while(open.size){let current=-1,best=Infinity;for(const i of open){const cost=costs[i]+distance(nodes[i],target);if(cost<best){best=cost;current=i;}}open.delete(current);if(goals.has(current)){end=current;break;}for(const next of nodes[current].links){if(people.length&&!IslandCatTerrain.peopleClear(nodes[current],nodes[next],people,64))continue;const candidate=costs[current]+distance(nodes[current],nodes[next]);if(candidate<costs[next]){costs[next]=candidate;previous[next]=current;open.add(next);}}}
      if(end<0)return null;
      const route=[{...target}];for(let i=end;i>=0;i=previous[i])route.unshift({x:nodes[i].x,y:nodes[i].y});
      const smooth=[];let at=start;while(route.length){let far=route.length-1;while(far>0&&!safe(at,route[far]))far--;at=route[far];smooth.push(at);route.splice(0,far+1);}return smooth;
    }
    const result={layout,isWalkable,findPath,nodes};cache.set(key,result);return result;
  }
  class RoomWorld {
    constructor({key,canvas,art,renderCharacter,onArrive,cat,coworkerImages,npcLife}){
      this.npcLife=npcLife;this.coworker=npcLife?.workers[key]||coworkers[key]||null;this.coworkerImages=coworkerImages;
      this.key=key;this.canvas=canvas;this.art=art;this.renderCharacter=renderCharacter;this.onArrive=onArrive;this.cat=cat;this.nav=navigation(key);this.layout=this.nav.layout;this.pendingStation=null;this.hold=0;this.marker=null;this.time=0;this.topicOpen=false;
      this.actor={...point(this.layout.spawn),route:[],phase:0,gait:0,facing:0,heading:0,turn:0,wave:0,idle:0,nextWave:8+Math.random()*8,lookAt:false};
      const occupied=[...(npcLife?.people(key)||[])];if(cat?.location===key&&cat.z<295)occupied.push({x:cat.x,y:cat.y+cat.z,radius:70});if(occupied.some(p=>distance(this.actor,p)<(p.radius||70))){const free=this.nav.nodes.filter(p=>occupied.every(body=>distance(p,body)>=(body.radius||70)+6)&&distance(p,this.actor)<170&&this.nav.findPath(this.actor,p)).sort((a,b)=>distance(a,this.actor)-distance(b,this.actor))[0];if(free){this.actor.x=free.x;this.actor.y=free.y;}}
    }
    cancel(){this.actor.route=[];this.pendingStation=null;this.marker=null;this.hold=0;this.actor.lookAt=false;}
    walkTo(target,station=null){
      if(this.topicOpen)return false;let route=this.nav.findPath(this.actor,target,this.npcLife?.people(this.key)||[]);if(!route){this.npcLife?.requestYield(this.key,this.actor,target);route=this.nav.findPath(this.actor,target);}if(!route)return false;
      this.actor.route=route.filter(p=>distance(p,this.actor)>.5);this.actor.wave=0;this.actor.idle=0;this.actor.lookAt=false;this.pendingStation=station;this.hold=0;this.marker={...target};return true;
    }
    visit(index){return index===0&&this.walkTo(point(this.layout.equipment.target),index);}
    update(dt,motion=true){
      this.time+=motion?dt:0;const a=this.actor,moving=a.route.length>0;
      a.gait+=((moving?1:0)-a.gait)*Math.min(1,dt*12);a.turn=Math.max(0,a.turn-dt*4);
      if(!this.topicOpen&&moving){let budget=dt*230;while(budget>0&&a.route.length){const goal=a.route[0],d=distance(a,goal);if(d<.1){a.route.shift();continue;}const angle=Math.atan2(goal.y-a.y,goal.x-a.x);if(Math.abs(Math.atan2(Math.sin(angle-a.heading),Math.cos(angle-a.heading)))>.65)a.turn=1;a.heading=angle;a.facing+=Math.atan2(Math.sin(angle-a.facing),Math.cos(angle-a.facing))*Math.min(1,dt*12);const step=Math.min(budget,d),next={x:a.x+(goal.x-a.x)*step/d,y:a.y+(goal.y-a.y)*step/d};if(!this.nav.isWalkable(next)){this.cancel();break;}if(this.npcLife&&!this.npcLife.allowsDoctorStep(this.key,a,next)){this.blocked=(this.blocked||0)+dt;if(this.blocked>.4){const route=this.nav.findPath(a,a.route.at(-1),this.npcLife.people(this.key));if(route)a.route=route;this.blocked=0;}break;}this.blocked=0;if(this.cat&&!this.cat.allowsPersonStep(a,next,this.key))break;a.x=next.x;a.y=next.y;a.phase+=step*.065;budget-=step;if(step>=d){a.route.shift();a.x=goal.x;a.y=goal.y;}}}
      if(!this.topicOpen&&!a.route.length){this.marker=null;if(this.pendingStation!==null){const look=point(this.layout.equipment.lookAt),heading=Math.atan2(look.y-a.y,look.x-a.x);a.lookAt=true;a.facing+=Math.atan2(Math.sin(heading-a.facing),Math.cos(heading-a.facing))*Math.min(1,dt*12);this.hold+=dt;if(this.hold>=.38){const index=this.pendingStation;this.pendingStation=null;this.topicOpen=true;this.onArrive(index);}}else if(motion){a.idle+=dt;if(a.wave>0)a.wave=Math.max(0,a.wave-dt);else if(a.idle>a.nextWave){a.wave=3.2;a.idle=0;a.nextWave=10+Math.random()*9;}}}
      this.draw();
    }
    draw(){
      const c=this.canvas,g=c.getContext('2d'),rect=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
      if(c.width!==w||c.height!==h){c.width=w;c.height=h;}g.setTransform(w/1536,0,0,h/1024,0,0);g.clearRect(0,0,1536,1024);
      if(this.marker){g.save();g.strokeStyle='#bd704dbb';g.lineWidth=3;g.beginPath();g.ellipse(this.marker.x,this.marker.y,20+Math.sin(this.time*5)*2,7,0,0,Math.PI*2);g.stroke();g.restore();}
      const entities=[{actor:this.actor,draw:()=>this.renderCharacter?.(g,this.actor)}];
      if(this.coworker)entities.push({actor:this.coworker,draw:()=>this.npcLife?this.npcLife.draw(this.key,g,this.art):drawCoworker(g,this.coworker,this.coworkerImages?.[this.coworker.asset],this.time)});
      if(this.cat?.location===this.key)entities.push({actor:this.cat,draw:()=>this.cat.draw(g,this.key,rect.width/1536)});
      entities.sort((a,b)=>a.actor.y-b.actor.y);
      for(const entity of entities){entity.draw();if(entity.actor===this.cat&&this.cat.z>35)continue;for(const mask of this.layout.occluders){const x=entity.actor.x,front=mask.front;let depth=-Infinity;for(let i=1;i<front.length;i++){const [ax,ay]=front[i-1],[bx,by]=front[i];if(x>=Math.min(ax,bx)-50&&x<=Math.max(ax,bx)+50){const t=Math.max(0,Math.min(1,(x-ax)/(bx-ax)));depth=Math.max(depth,ay+(by-ay)*t);}}if(entity.actor.y>=depth||!this.art.naturalWidth)continue;g.save();g.beginPath();mask.poly.forEach(([px,py],i)=>i?g.lineTo(px,py):g.moveTo(px,py));g.closePath();g.clip();g.drawImage(this.art,0,0,1536,1024);g.restore();}}
    }
    snapshot(){return{actor:{...this.actor,route:this.actor.route.map(p=>({...p}))},pendingStation:this.pendingStation,arrivalHold:this.hold,equipment:{outline:this.layout.equipment.outline,target:point(this.layout.equipment.target)},spawn:point(this.layout.spawn),speed:230,coworkers:this.npcLife?(this.npcLife.snapshot(this.key)?[this.npcLife.snapshot(this.key)]:[]):this.coworker?[{name:this.coworker.name,x:this.coworker.x,y:this.coworker.y,working:true,animationTime:this.time}]:[]};}
  }
  window.IslandRoomWorld=Object.freeze({layouts,navigation,RoomWorld,coworkers});
})();
