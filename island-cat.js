(() => {
  'use strict';
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),point=([x,y])=>({x,y}),smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  // One authoritative animal across every scene; surfaces and people share swept checks.
  class IslandCat {
    constructor({image,actionImage,island,getPlayer,getPeople,onVoice,random=Math.random}){
      Object.assign(this,{image,actionImage,island,getPlayer,getPeople,onVoice,random});
      Object.assign(this,{id:'island-cat',location:'island',x:675,y:1530,z:0,surface:'floor',surfaceNode:null,route:[],phase:0,facing:0,mirror:1,pose:'watching',poseFrom:'watching',poseTime:0,wait:12+random()*10,time:0,residence:0,goal:null,transition:null,lastRoom:null,cooldown:0,nextVoice:10+random()*12,speech:'',speechUntil:0,transitions:0,history:[],speed:0,targetSpeed:0,pace:'walk',jump:null,landing:0,blocked:0,nextYield:0});
      this.frames=this.prepareFrames();
      this.actionFrames=[[30,83,519,348],[580,86,411,360],[1031,83,492,341],[37,614,501,292],[598,523,400,393],[1102,471,424,479]].map(([x,y,w,h])=>({x,y,w,h,action:true}));
    }
    prepareFrames(){return [{"x":33,"y":38,"w":271,"h":249},{"x":345,"y":46,"w":270,"h":239},{"x":658,"y":46,"w":269,"h":240},{"x":964,"y":39,"w":276,"h":245},{"x":97,"y":319,"w":142,"h":298},{"x":413,"y":324,"w":137,"h":286},{"x":720,"y":324,"w":138,"h":292},{"x":1027,"y":324,"w":138,"h":293},{"x":100,"y":644,"w":132,"h":296},{"x":415,"y":641,"w":130,"h":271},{"x":726,"y":643,"w":130,"h":274},{"x":1031,"y":643,"w":144,"h":297},{"x":64,"y":940,"w":212,"h":264},{"x":339,"y":1013,"w":288,"h":185},{"x":627,"y":943,"w":251,"h":264},{"x":949,"y":940,"w":277,"h":271}];}
    nav(){return this.location==='island'?this.island:IslandRoomWorld.navigation(this.location);}
    terrain(){return IslandCatTerrain.scenes[this.location]||{nodes:[],edges:[]};}
    people(location=this.location){if(this.getPeople)return this.getPeople(location);const player=this.getPlayer?.(),worker=window.IslandRoomWorld?.coworkers?.[location];return [...(player?.location===location?[player]:[]),...(worker?[worker]:[])];}
    clear(a,b,location=this.location){
      const za=a.z||0,zb=b.z??za,base=p=>({x:p.x,y:p.y+(p.z??za)}),people=this.people(location).filter(p=>Math.min(za,zb)<(p.height||(location==='island'?155:280))+8);
      return IslandCatTerrain.peopleClear(base(a),base(b),people,location==='island'?43:64);
    }
    setPose(pose){if(pose!==this.pose){this.poseFrom=this.pose;this.pose=pose;this.poseTime=this.time;}}
    setLocation(location,p){
      const previous=this.location;if(previous!=='island'&&location!=='island'&&previous!==location)throw Error('Cat must exit to the island before entering another room');
      Object.assign(this,{location,x:p.x,y:p.y,z:0,surface:'floor',surfaceNode:null,route:[],goal:null,jump:null,transition:null,residence:0,speed:0,wait:15+this.random()*20,speech:''});this.setPose('watching');this.transitions++;this.history.push({from:previous,to:location,time:this.time});if(this.history.length>24)this.history.shift();
    }
    floorClear(a,b){const n=Math.max(1,Math.ceil(distance(a,b)/4));for(let i=0;i<=n;i++)if(!this.nav().isWalkable({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;}
    floorRoute(start,target){
      if(this.floorClear(start,target)&&this.clear(start,target))return [{x:target.x,y:target.y,z:0,surface:'floor'}];
      const route=this.nav().findPath(start,target,this.people());if(!route)return null;const result=[];let at=start;
      for(const p of route){
        if(!this.clear(at,p)){
          const person=this.people().find(q=>!IslandCatTerrain.peopleClear(at,p,[q],this.location==='island'?43:64));let detour=null;
          if(person){const angle=Math.atan2(p.y-at.y,p.x-at.x),r=this.location==='island'?58:70;for(const sign of [-1,1]){const q={x:person.x+Math.cos(angle+sign*Math.PI/2)*r,y:person.y+Math.sin(angle+sign*Math.PI/2)*r};if(this.floorClear(at,q)&&this.floorClear(q,p)&&this.clear(at,q)&&this.clear(q,p)){detour=q;break;}}}
          if(!detour)return null;result.push({...detour,z:0,surface:'floor'});
        }
        result.push({x:p.x,y:p.y,z:0,surface:'floor'});at=p;
      }
      return result;
    }
    makeRoute(target){
      const terrain=this.terrain(),end=target.id&&terrain.nodes.find(n=>n.id===target.id),start=this.surfaceNode&&terrain.nodes.find(n=>n.id===this.surfaceNode);
      if(!start&&!end)return this.floorRoute(this,target);
      if(start&&end){const direct=IslandCatTerrain.graphRoute(terrain,start.id,end.id);if(direct)return direct.map(n=>({...n}));}
      let best=null,bestLength=Infinity;
      const starts=start?[start]:terrain.nodes.filter(n=>n.z===0&&this.nav().isWalkable(n)),ends=end?[end]:terrain.nodes.filter(n=>n.z===0&&this.nav().isWalkable(n));
      for(const a of starts)for(const b of ends){const graph=IslandCatTerrain.graphRoute(terrain,a.id,b.id);if(!graph)continue;const before=start?[]:this.floorRoute(this,a),after=end?[]:this.floorRoute(b,target);if(!before||!after)continue;const route=[...before.map((p,i)=>i===before.length-1?{...p,...a}:p),...graph.map(n=>({...n})),...after];let length=0,at=this;for(const p of route){length+=distance(at,p);at=p;}if(length<bestLength){bestLength=length;best=route;}}
      return best;
    }
    moveTo(p,goal={kind:'wander'}){
      if(this.jump||this.transition)return false;const route=this.makeRoute(p);if(!route)return false;this.route=route.filter(q=>distance(q,this)>.5||Math.abs((q.z||0)-this.z)>1);this.goal=goal;this.wait=0;this.blocked=0;
      this.pace=goal.kind==='yield'||this.random()<.26?'run':'walk';this.targetSpeed=(this.location==='island'?72:90)+this.random()*26;if(this.pace==='run')this.targetSpeed=(this.location==='island'?180:205)+this.random()*45;this.setPose(this.pace==='run'?'running':'walking');return true;
    }
    choose(){
      const terrain=this.terrain();
      if(this.random()<(this.surfaceNode?.42:.32)&&terrain.nodes.length){const options=terrain.nodes.filter(n=>n.z>0&&n.id!==this.surfaceNode&&this.clear(n,n));for(let i=0;i<6&&options.length;i++){const n=options.splice(Math.floor(this.random()*options.length),1)[0];if(this.moveTo(n,{kind:'perch'}))return true;}}
      if(this.location==='island'){
        if(this.time>=this.cooldown&&this.random()<.28){const keys=Object.keys(this.island.doors).filter(key=>key!==this.lastRoom),key=keys[Math.floor(this.random()*keys.length)];if(this.moveTo(this.island.doors[key].porch,{kind:'enter',key}))return true;}
      }else if(this.residence>90&&this.random()<.22){if(this.moveTo(point(this.nav().layout.spawn),{kind:'exit',key:this.location}))return true;}
      const player=this.getPlayer?.(),points=this.location==='island'?this.island.points:this.nav().nodes,nearby=player?.location===this.location&&this.random()<.12;
      const options=points.filter(p=>distance(p,this)>65&&(!nearby||distance(p,player)>75&&distance(p,player)<190));
      for(let i=0;i<8&&options.length;i++){const p=options.splice(Math.floor(this.random()*options.length),1)[0];if(this.moveTo(p,{kind:'wander'}))return true;}return false;
    }
    rest(){
      const options=['watching','sitting','sitting','lying','lying','grooming','scratching','sleeping','sleeping','stretching'];this.setPose(options[Math.floor(this.random()*options.length)]);this.speed=0;
      const d={watching:[18,40],sitting:[30,65],lying:[45,100],grooming:[12,28],scratching:[7,15],sleeping:[90,220],stretching:[3,5]}[this.pose];this.wait=d[0]+this.random()*(d[1]-d[0]);
    }
    speak(text,kind='meow'){this.speech=text;this.speechUntil=this.time+2.8;this.nextVoice=this.time+25+this.random()*35;if(this.getPlayer?.()?.location===this.location)this.onVoice?.({kind,location:this.location,x:this.x,y:this.y});}
    greet(){if(this.transition||this.jump)return;this.route=[];this.goal=null;this.speed=0;this.setPose('sitting');this.wait=25+this.random()*25;this.speak(this.random()<.5?'喵～':'喵嗚？');}
    collisionPoint(){if(this.transition?.kind==='enter'){const p=this.island.doors[this.transition.key].door,t=this.transition.progress;return{x:this.x+(p.x-this.x)*t,y:this.y+(p.y-this.y)*t};}return this;}
    allowsPersonStep(from,to,location){if(location!==this.location||this.z>=(location==='island'?170:295))return true;const p=this.collisionPoint(),body={x:p.x,y:p.y+this.z},ok=IslandCatTerrain.peopleClear(from,to,[body],location==='island'?43:64);if(!ok)this.yieldTo(from);return ok;}
    yieldTo(person){
      if(this.jump||this.transition||this.time<this.nextYield||this.z>0)return false;this.nextYield=this.time+.8;
      if(this.location==='island')for(const [key,door] of Object.entries(this.island.doors)){if(distance(this,door.porch)<105&&this.clear(this,door.door)){if(distance(this,door.porch)>2){if(this.moveTo(door.porch,{kind:'enter',key}))return true;}else{this.route=[];this.goal=null;this.transition={kind:'enter',key,progress:0};this.setPose('walking');return true;}}}
      const local=[];for(const radius of [65,95,135])for(let i=0;i<16;i++){const p={x:this.x+Math.cos(i*Math.PI/8)*radius,y:this.y+Math.sin(i*Math.PI/8)*radius};if(this.nav().isWalkable(p))local.push(p);}
      const points=[...(this.location==='island'?this.island.points:this.nav().nodes),...local].filter(p=>distance(p,this)>45&&distance(p,this)<230&&distance(p,person)>distance(this,person)+30).sort((a,b)=>distance(a,this)-distance(b,this));
      for(const p of points.slice(0,25))if(this.moveTo(p,{kind:'yield'}))return true;return false;
    }
    safeArrival(location,p){const nav=location==='island'?this.island:IslandRoomWorld.navigation(location),people=this.people(location),r=location==='island'?43:64;if(IslandCatTerrain.peopleClear(p,p,people,r))return p;return (location==='island'?this.island.points:nav.nodes).filter(q=>distance(q,p)<85&&nav.isWalkable(q)&&IslandCatTerrain.peopleClear(q,q,people,r)).sort((a,b)=>distance(a,p)-distance(b,p))[0]||null;}
    beginJump(next){
      if(!this.clear(this,next))return false;const rise=(next.z||0)-this.z,climb=rise>95||distance(this,next)>155&&rise>20;
      this.jump={from:{x:this.x,y:this.y,z:this.z},to:{...next},progress:0,duration:climb?1.2+distance(this,next)/170:.65+distance(this,next)/300,height:climb?12:Math.min(70,24+Math.abs(rise)*.3),climb};this.speed=0;this.facing=Math.atan2(next.y-this.y,next.x-this.x);this.setPose(climb?'climbing':'jumping');return true;
    }
    update(dt){
      if(!dt)return;this.time+=dt;this.residence+=dt;this.mirror+=((Math.cos(this.facing)<-.58?-1:1)-this.mirror)*(1-Math.exp(-dt*9));this.landing=Math.max(0,this.landing-dt);if(this.speech&&this.time>=this.speechUntil)this.speech='';
      if(this.transition){
        const t=this.transition,next=Math.min(1,t.progress+dt/.85),door=t.kind==='enter'?this.island.doors[t.key].door:this,from=this.collisionPoint(),to={x:this.x+(door.x-this.x)*next,y:this.y+(door.y-this.y)*next};if(!this.clear(from,to))return;
        if(next>=1){const location=t.kind==='enter'?t.key:'island',p=t.kind==='enter'?point(IslandRoomWorld.layouts[t.key].spawn):this.island.doors[t.key].porch,landing=this.safeArrival(location,p);if(!landing)return;if(t.kind==='exit'){this.lastRoom=t.key;this.cooldown=this.time+70;}this.setLocation(location,landing);}else t.progress=next;return;
      }
      if(this.jump){
        const j=this.jump,progress=Math.min(1,j.progress+dt/j.duration),u=smooth(Math.max(0,(progress-.16)/.84)),next={x:j.from.x+(j.to.x-j.from.x)*u,y:j.from.y+(j.to.y-j.from.y)*u,z:j.from.z+((j.to.z||0)-j.from.z)*u};
        if(!this.clear(this,next)){this.blocked+=dt;return;}j.progress=progress;this.x=next.x;this.y=next.y;this.z=next.z;this.phase+=dt*(j.climb?3:8);
        if(progress>=1){Object.assign(this,{x:j.to.x,y:j.to.y,z:j.to.z||0,surface:j.to.surface||'floor',surfaceNode:j.to.z?j.to.id:null,jump:null,landing:.3});this.route.shift();this.setPose(this.pace==='run'?'running':'walking');}else return;
      }
      if(this.route.length){
        const next=this.route[0];if(Math.abs((next.z||0)-this.z)>5){if(!this.beginJump(next)){this.route=[];this.goal=null;this.rest();}return;}
        const desired=Math.min(this.targetSpeed,Math.max(28,distance(this,this.route.at(-1))*2.6))*(1+Math.sin(this.time*1.4)*.055);this.speed+=(desired-this.speed)*(1-Math.exp(-dt*(this.pace==='run'?5:3)));let budget=dt*this.speed;
        while(budget>0&&this.route.length){const p=this.route[0];if(Math.abs((p.z||0)-this.z)>5)break;const d=distance(this,p);if(d<.1){this.x=p.x;this.y=p.y;this.z=p.z||0;this.surface=p.surface||'floor';this.surfaceNode=p.z?p.id:null;this.route.shift();continue;}const angle=Math.atan2(p.y-this.y,p.x-this.x);this.facing+=Math.atan2(Math.sin(angle-this.facing),Math.cos(angle-this.facing))*(1-Math.exp(-dt*12));
          const step=Math.min(budget,d,6),q={x:this.x+(p.x-this.x)*step/d,y:this.y+(p.y-this.y)*step/d,z:this.z+((p.z||0)-this.z)*step/d};
          if(this.z<1&&!this.nav().isWalkable(q)||!this.clear(this,q)){this.blocked+=dt;this.speed=0;if(this.blocked>1.2){this.route=[];this.goal=null;this.rest();this.wait=5+this.random()*7;}break;}
          this.blocked=0;this.x=q.x;this.y=q.y;this.z=q.z;this.phase+=step*(this.pace==='run'?(Math.abs(Math.cos(this.facing))>.45?.035:.07):.075);budget-=step;if(step>=d){this.x=p.x;this.y=p.y;this.z=p.z||0;this.surface=p.surface||'floor';this.surfaceNode=p.z?p.id:null;this.route.shift();}
        }
      }
      if(!this.route.length&&this.goal){const goal=this.goal;this.goal=null;if(goal.kind==='enter'||goal.kind==='exit'){this.transition={...goal,progress:0};this.setPose('walking');return;}this.rest();}
      if(!this.route.length&&!this.jump){this.wait-=dt;if(this.wait<=0&&!(this.random()<.38&&this.choose()))this.rest();}
      if(this.time>=this.nextVoice){if(['sleeping','grooming','lying'].includes(this.pose))this.speak('呼嚕嚕…','purr');else this.speak(['喵～','喵嗚？','喵！'][Math.floor(this.random()*3)]);}
    }
    frameFor(pose){if(this.actionImage){if(pose==='running'&&Math.abs(Math.cos(this.facing))>.45)return this.actionFrames[Math.floor(this.phase)%2];const index={jumping:2,lying:3,scratching:4,climbing:5}[pose];if(index!==undefined)return this.actionFrames[index];}if(['walking','running','jumping','climbing'].includes(pose)){const dx=Math.cos(this.facing),dy=Math.sin(this.facing),row=Math.abs(dx)>.58?0:dy<0?2:1;return this.frames[row*4+Math.floor(this.phase)%4];}return this.frames[{sitting:12,sleeping:13,lying:13,grooming:14,scratching:14,stretching:15}[pose]??4];}
    draw(g,location,scale=1){
      if(this.location!==location||!this.frames.length)return false;
      const f=this.frameFor(this.pose),unit=(location==='island'?66:84)/(f.action?this.actionImage.width/3:this.image.width/4),change=smooth((this.time-this.poseTime)/.65),breath=1+Math.sin(this.time*(this.pose==='sleeping'?1.6:2.3))*.012,visual=this.collisionPoint();let x=visual.x,y=visual.y,alpha=this.transition?1-this.transition.progress:1,lift=0,squash=1;
      if(this.jump){const p=this.jump.progress;lift=Math.sin(Math.PI*Math.max(0,(p-.16)/.84))*this.jump.height;if(p<.16)squash-=Math.sin(p/.16*Math.PI)*.16;}if(this.landing)squash-=Math.sin(this.landing/.3*Math.PI)*.12;if(this.pose==='running')lift+=Math.abs(Math.sin(this.phase*Math.PI/2))*4;
      g.save();g.globalAlpha=alpha;g.translate(x,y);g.fillStyle='#2442372e';g.beginPath();g.ellipse(0,-1,(location==='island'?22:28)*(1-lift/150),location==='island'?6:8,0,0,Math.PI*2);g.fill();g.translate(0,-lift);g.scale(Math.sign(this.mirror||1)*Math.max(.6,Math.abs(this.mirror)),breath*squash*(1-Math.sin(change*Math.PI)*.055));
      if(this.pose==='grooming'||this.pose==='scratching')g.rotate(Math.sin(this.time*(this.pose==='scratching'?17:4))*(this.pose==='scratching'?.025:.018));
      const paint=(frame,opacity)=>{g.globalAlpha=alpha*opacity;const image=frame.action?this.actionImage:this.image,u=(location==='island'?66:84)/(frame.action?image.width/3:image.width/4);g.drawImage(image,frame.x,frame.y,frame.w,frame.h,-frame.w*u/2,-frame.h*u,frame.w*u,frame.h*u);};if(change<1){paint(this.frameFor(this.poseFrom),1-change);paint(f,change);}else paint(f,1);g.restore();
      if(this.speech&&alpha>.5){const font=Math.max(13,11/Math.max(.15,scale)),height=font*1.8;g.save();g.font=font+'px "Microsoft JhengHei",sans-serif';const width=g.measureText(this.speech).width+font*1.2,bottom=y-lift-f.h*unit-9;g.fillStyle='#fffdf4f5';g.shadowColor='#29483e24';g.shadowBlur=7;g.beginPath();g.roundRect(x-width/2,bottom-height,width,height,font*.6);g.fill();g.shadowBlur=0;g.fillStyle='#6b765e';g.textAlign='center';g.textBaseline='middle';g.fillText(this.speech,x,bottom-height/2);g.restore();}return true;
    }
    snapshot(){return{id:this.id,count:1,location:this.location,x:this.x,y:this.y,z:this.z,surface:this.surface,surfaceNode:this.surfaceNode,pose:this.pose,moving:this.route.length>0,pace:this.pace,speed:this.speed,wait:this.wait,jump:this.jump?{...this.jump}:null,route:this.route.map(p=>({...p})),transition:this.transition?{...this.transition}:null,speech:this.speech,residence:this.residence,transitions:this.transitions,history:this.history.map(item=>({...item}))};}
  }
  window.IslandCat=IslandCat;
})();
