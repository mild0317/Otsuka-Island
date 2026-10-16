(() => {
  'use strict';
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),point=([x,y])=>({x,y});
  class IslandCat {
    // Construct once for the session. Scenes render this same instance only
    // when location matches; closing a room never resets the cat's position.
    constructor({image,island,getPlayer,onVoice,random=Math.random}){
      this.image=image;this.island=island;this.getPlayer=getPlayer;this.onVoice=onVoice;this.random=random;
      this.id='island-cat';this.location='island';this.x=675;this.y=1530;this.route=[];this.phase=0;this.facing=0;this.pose='watching';this.wait=2;this.time=0;this.residence=0;this.goal=null;this.transition=null;this.lastRoom=null;this.cooldown=0;this.nextVoice=6+random()*8;this.speech='';this.speechUntil=0;this.transitions=0;this.history=[];
      this.frames=this.prepareFrames(image);
    }
    prepareFrames(){return [{"x":33,"y":38,"w":271,"h":249},{"x":345,"y":46,"w":270,"h":239},{"x":658,"y":46,"w":269,"h":240},{"x":964,"y":39,"w":276,"h":245},{"x":97,"y":319,"w":142,"h":298},{"x":413,"y":324,"w":137,"h":286},{"x":720,"y":324,"w":138,"h":292},{"x":1027,"y":324,"w":138,"h":293},{"x":100,"y":644,"w":132,"h":296},{"x":415,"y":641,"w":130,"h":271},{"x":726,"y":643,"w":130,"h":274},{"x":1031,"y":643,"w":144,"h":297},{"x":64,"y":940,"w":212,"h":264},{"x":339,"y":1013,"w":288,"h":185},{"x":627,"y":943,"w":251,"h":264},{"x":949,"y":940,"w":277,"h":271}];}
    nav(){return this.location==='island'?this.island:IslandRoomWorld.navigation(this.location);}
    setLocation(location,p){const previous=this.location;if(previous!=='island'&&location!=='island'&&previous!==location)throw Error('Cat must exit to the island before entering another room');this.location=location;this.x=p.x;this.y=p.y;this.route=[];this.goal=null;this.transition=null;this.residence=0;this.pose='watching';this.wait=2+this.random()*4;this.speech='';this.transitions++;this.history.push({from:previous,to:location,time:this.time});if(this.history.length>24)this.history.shift();}
    choose(){
      const nearbyPlayer=this.getPlayer?.();
      if(nearbyPlayer?.location===this.location&&this.random()<.16){const options=(this.location==='island'?this.island.points:this.nav().nodes).filter(p=>distance(p,nearbyPlayer)>45&&distance(p,nearbyPlayer)<130&&distance(p,this)>35);if(options.length&&this.moveTo(options[Math.floor(this.random()*options.length)],{kind:'wander'}))return true;}
      if(this.location==='island'){
        if(this.time>=this.cooldown&&this.random()<.48){const keys=Object.keys(this.island.doors).filter(key=>key!==this.lastRoom),key=keys[Math.floor(this.random()*keys.length)],door=this.island.doors[key];return this.moveTo(door.porch,{kind:'enter',key});}
        const points=this.island.points;return this.moveTo(points[Math.floor(this.random()*points.length)],{kind:'wander'});
      }
      const nav=this.nav();
      if(this.residence>12&&this.random()<.32)return this.moveTo(point(nav.layout.spawn),{kind:'exit',key:this.location});
      const player=this.getPlayer?.(),candidates=nav.nodes.filter(p=>distance(p,this)>45&&(!player||player.location!==this.location||distance(p,player)>70));
      if(!candidates.length)return false;return this.moveTo(candidates[Math.floor(this.random()*candidates.length)],{kind:'wander'});
    }
    moveTo(p,goal){const route=this.nav().findPath(this,p);if(!route)return false;this.route=route.filter(q=>distance(q,this)>.5).map(q=>({x:q.x,y:q.y}));this.goal=goal;this.pose='walking';this.wait=0;return true;}
    rest(){const choices=['watching','sitting','grooming','stretching','sleeping'];this.pose=choices[Math.floor(this.random()*choices.length)];this.wait=this.pose==='sleeping'?9+this.random()*12:this.pose==='stretching'?2.5:3+this.random()*5;}
    speak(text,kind='meow'){this.speech=text;this.speechUntil=this.time+2.8;this.nextVoice=this.time+15+this.random()*20;const player=this.getPlayer?.();if(player?.location===this.location)this.onVoice?.({kind,location:this.location,x:this.x,y:this.y});}
    greet(){if(this.transition)return;this.route=[];this.goal=null;this.pose='sitting';this.wait=3+this.random()*2;this.speak(this.random()<.5?'喵～':'喵嗚？');}
    update(dt){
      if(!dt)return;this.time+=dt;this.residence+=dt;
      if(this.speech&&this.time>=this.speechUntil)this.speech='';
      if(this.transition){this.transition.progress+=dt/.85;if(this.transition.progress>=1){const {kind,key}=this.transition;if(kind==='enter')this.setLocation(key,point(IslandRoomWorld.layouts[key].spawn));else{this.lastRoom=key;this.cooldown=this.time+9;this.setLocation('island',this.island.doors[key].porch);}}return;}
      if(this.route.length){let budget=dt*(this.location==='island'?115:150);while(budget>0&&this.route.length){const p=this.route[0],d=distance(this,p);if(d<.1){this.route.shift();continue;}this.facing=Math.atan2(p.y-this.y,p.x-this.x);const step=Math.min(budget,d),next={x:this.x+(p.x-this.x)*step/d,y:this.y+(p.y-this.y)*step/d};if(!this.nav().isWalkable(next)){this.route=[];this.goal=null;this.rest();break;}this.x=next.x;this.y=next.y;this.phase+=step*.08;budget-=step;if(step>=d)this.route.shift();}}
      if(!this.route.length&&this.goal){const goal=this.goal;this.goal=null;if(goal.kind==='enter'||goal.kind==='exit'){this.transition={...goal,progress:0};this.pose='walking';return;}this.rest();}
      if(!this.route.length){this.wait-=dt;if(this.wait<=0){if(!this.choose())this.rest();}}
      if(this.time>=this.nextVoice){if(this.pose==='sleeping'||this.pose==='grooming')this.speak('呼嚕嚕…','purr');else this.speak(['喵～','喵嗚？','喵！'][Math.floor(this.random()*3)]);}
    }
    draw(g,location,scale=1){
      if(this.location!==location||!this.frames.length)return false;
      let row=0,col=Math.floor(this.phase)%4,mirror=1;const moving=this.route.length>0||!!this.transition;
      if(moving){const dx=Math.cos(this.facing),dy=Math.sin(this.facing);if(Math.abs(dx)>.58){row=0;mirror=dx<0?-1:1;}else row=dy<0?2:1;}else{const idle={sitting:0,sleeping:1,grooming:2,stretching:3};if(this.pose in idle){row=3;col=idle[this.pose];}else{row=1;col=0;}}
      const f=this.frames[row*4+col],unit=(location==='island'?66:84)/(this.image.width/4),breath=1+Math.sin(this.time*(this.pose==='sleeping'?1.8:3))*.014;let x=this.x,y=this.y,alpha=1;
      if(this.transition){alpha=1-this.transition.progress;if(this.transition.kind==='enter'){const door=this.island.doors[this.transition.key].door;x+=(door.x-x)*this.transition.progress;y+=(door.y-y)*this.transition.progress;}}
      g.save();g.globalAlpha=alpha;g.translate(x,y);g.fillStyle='#2442372e';g.beginPath();g.ellipse(0,-1,location==='island'?22:28,location==='island'?6:8,0,0,Math.PI*2);g.fill();g.scale(mirror,breath);if(this.pose==='grooming')g.rotate(Math.sin(this.time*5)*.025);g.drawImage(this.image,f.x,f.y,f.w,f.h,-f.w*unit/2,-f.h*unit,f.w*unit,f.h*unit);g.restore();
      if(this.speech&&alpha>.5){const font=Math.max(13,11/Math.max(.15,scale)),height=font*1.8;g.save();g.font=font+'px "Microsoft JhengHei",sans-serif';const width=g.measureText(this.speech).width+font*1.2,bottom=y-f.h*unit-9;g.fillStyle='#fffdf4f5';g.shadowColor='#29483e24';g.shadowBlur=7;g.beginPath();g.roundRect(x-width/2,bottom-height,width,height,font*.6);g.fill();g.shadowBlur=0;g.fillStyle='#6b765e';g.textAlign='center';g.textBaseline='middle';g.fillText(this.speech,x,bottom-height/2);g.restore();}
      return true;
    }
    snapshot(){return{id:this.id,count:1,location:this.location,x:this.x,y:this.y,pose:this.pose,moving:this.route.length>0,route:this.route.map(p=>({...p})),transition:this.transition?{...this.transition}:null,speech:this.speech,residence:this.residence,transitions:this.transitions,history:this.history.map(item=>({...item}))};}
  }
  window.IslandCat=IslandCat;
})();
