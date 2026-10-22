(() => {
  'use strict';
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  class IslandNPCLife {
    constructor({getDoctor=()=>null,getCat=()=>null,random=Math.random,fallbackImages={}}={}){
      this.random=random;this.getDoctor=getDoctor;this.getCat=getCat;this.fallbackImages=fallbackImages;this.workers={};this.loads={};this.images={};
      for(const [key,profile] of Object.entries(IslandNPCRoutines.profiles)){
        const p=profile.stations[profile.start];
        this.workers[key]={key,profile,name:profile.name,x:p.x,y:p.y,height:profile.height,station:profile.start,heading:Math.atan2(p.look.y-p.y,p.look.x-p.x),phase:random()*6,time:0,elapsed:0,duration:8+random()*7,kind:'work',pose:'work',previousPose:'work',blend:1,route:[],steps:[],job:'initial',previousJob:'',speed:0,walkSpeed:100,blocked:0,prop:null,yielding:false,history:[],completed:0};
        this.workers[key].items=Object.entries(profile.stations).filter(([,s])=>s.item).map(([station,s])=>({id:key+'-'+station,kind:s.prop,hiddenAtRest:!!s.storage,home:{...s.item},station,location:'table',progress:0}));
      }
    }
    load(key){
      const w=this.workers[key];if(!w)return Promise.resolve();if(this.loads[key])return this.loads[key];
      this.images[key]={};
      this.loads[key]=Promise.all(['seats','gestures','views',...(w.profile.asset==='hank'?['skin','identity']:[])].map(part=>new Promise(resolve=>{const im=new Image();im.onload=()=>{this.images[key][part]=im;resolve();};im.onerror=()=>resolve();im.src=part==='skin'?'assets/hank-skin-v27.png':part==='identity'?'assets/hank-identity-v27.png':'assets/npc-'+w.profile.asset+'-'+part+'-v'+(part==='seats'?24:23)+'.png';}))).then(()=>this.ready(key));
      return this.loads[key];
    }
    ready(key){return ['seats','gestures','views',...(this.workers[key]?.profile.asset==='hank'?['skin','identity']:[])].every(part=>this.images[key]?.[part]?.naturalWidth>0);}
    body(key){const w=this.workers[key];return w?{x:w.x,y:w.y,radius:66,name:w.name}:null;}
    people(key){const body=this.body(key);return body?[body]:[];}
    otherBodies(key){const d=this.getDoctor();return d?.location===key?[{...d,radius:67}]:[];}
    poseFor(w){
      if(w.prop&&w.kind==='walk')return 'hold';
      if(['type','seatedWork','sit','seatedLook'].includes(w.kind))return 'sit';
      if(w.kind==='half')return 'half';
      if(['scratch','glasses'].includes(w.kind))return 'scratch';
      if(w.kind==='fold')return 'fold';
      if(['pick','inspect','place'].includes(w.kind)||w.prop)return 'hold';
      if(['work','sort','reach'].includes(w.kind))return 'work';
      if(w.kind==='walk')return Math.abs(Math.sin(w.heading))>.45?(Math.sin(w.heading)<0?'back':'front'):'side';
      return 'front';
    }
    setPose(w){const pose=this.poseFor(w),sign=Math.cos(w.heading)<0?-1:1;if(w.kind==='walk'&&w.blend<1&&w.previousPose!==w.pose)return;if(pose!==w.pose||sign!==w.poseSign){w.previousPose=w.pose;w.previousSign=w.poseSign||sign;w.pose=pose;w.poseSign=sign;w.transitionDuration=(pose==='half'||w.previousPose==='half')?.65:.8;w.blend=0;}}
    start(w,step){
      w.kind=step.kind;w.elapsed=0;w.duration=step.time||0;w.station=step.station||w.station;w.targetStation=w.profile.stations[w.station];w.blocked=0;
      if(step.kind==='walk'){
        w.goal=step.point||w.targetStation;
        w.route=IslandRoomWorld.navigation(w.key).findPath(w,w.goal,this.otherBodies(w.key))||[];
        w.walkSpeed=w.profile.speed[0]+this.random()*(w.profile.speed[1]-w.profile.speed[0]);
        if(distance(w,w.goal)<2)w.route=[];
      }else{
        const look=w.targetStation.look;w.targetHeading=Math.atan2(look.y-w.y,look.x-w.x);
      }
      if(step.kind==='pick'&&!w.prop)w.prop=w.items.find(p=>p.id===w.lastPlacedId&&p.location==='table'&&p.station===w.station)||w.items.find(p=>p.location==='table'&&p.station===w.station)||null;
      if(step.kind==='place'&&w.prop){const occupied=w.items.some(p=>p!==w.prop&&p.station===w.station),home=w.targetStation.item||w.prop.home;w.prop.home={x:home.x+(occupied?35:0),y:home.y+(occupied?5:0)};}
      this.setPose(w);w.history.push({kind:w.kind,station:w.station,time:Math.round(w.time*10)/10});if(w.history.length>50)w.history.shift();
    }
    choose(w){
      const choices=w.profile.jobs.filter(([name])=>name!==w.previousJob),total=choices.reduce((n,[,weight])=>n+weight,0);let roll=this.random()*total,job=choices.at(-1)[0];
      for(const [name,weight] of choices){roll-=weight;if(roll<=0){job=name;break;}}
      w.previousJob=job;w.job=job;w.completed++;w.steps=IslandNPCRoutines.makeJob(w.profile,job,this.random);
    }
    next(w){if(w.kind==='yield')w.yielding=false;if(!w.steps.length)this.choose(w);this.start(w,w.steps.shift());}
    canStep(w,next){
      if(!IslandCatTerrain.peopleClear(w,next,this.otherBodies(w.key),67))return false;
      const cat=this.getCat();return !cat||cat.allowsPersonStep(w,next,w.key);
    }
    yieldPoint(w,from,to){
      const nav=IslandRoomWorld.navigation(w.key),people=this.otherBodies(w.key);
      return nav.nodes.filter(p=>distance(p,w)>35&&distance(p,w)<240&&distance(p,from)>80&&IslandCatTerrain.segmentDistance(p,from,to)>78).sort((a,b)=>distance(a,w)-distance(b,w)).find(p=>nav.findPath(w,p,people));
    }
    update(dt){
      if(!(dt>0))return;
      for(const w of Object.values(this.workers)){
        w.time+=dt;w.blend=Math.min(1,w.blend+dt/(w.transitionDuration||.8));
        w.gait=(w.gait||0)+((w.kind==='walk'?Math.min(1,w.speed/70):0)-(w.gait||0))*Math.min(1,dt*7);
        if(w.kind==='walk'){
          if(!w.route.length&&distance(w,w.goal||w)<2){w.speed*=Math.exp(-dt*9);this.next(w);continue;}
          w.blocked-=dt;
          if(!w.route.length&&w.blocked<=0){
            const nav=IslandRoomWorld.navigation(w.key);w.route=nav.findPath(w,w.goal,this.otherBodies(w.key))||[];
            if(!w.route.length&&w.yielding){const doctor=this.getDoctor(),end=doctor?.route?.at(-1)||w.yieldEnd;if(doctor?.location===w.key&&end){const alternative=this.yieldPoint(w,doctor,end);if(alternative){w.goal=alternative;w.route=nav.findPath(w,w.goal,this.otherBodies(w.key))||[];}}}
            w.blocked=.8+this.random()*.7;
          }
          const next=w.route[0],aim=next?Math.atan2(next.y-w.y,next.x-w.x):w.heading,error=Math.atan2(Math.sin(aim-w.heading),Math.cos(aim-w.heading));
          w.heading+=error*Math.min(1,dt*7);this.setPose(w);
          const projection=w.profile.asset==='hank'?(window.IslandHankRig?.travelScale(w.heading)||1):1;
          const desired=Math.min(w.walkSpeed,Math.max(28,distance(w,w.goal)*2.8))*projection*(Math.abs(error)>.5?0:1);
          let budget=dt*(w.speed+=(desired-w.speed)*Math.min(1,dt*5));
          while(budget>0&&w.route.length){
            const p=w.route[0],d=distance(w,p);if(d<.1){w.route.shift();continue;}
            const n=Math.min(d,budget),next={x:w.x+(p.x-w.x)*n/d,y:w.y+(p.y-w.y)*n/d};
            if(!this.canStep(w,next)){w.speed=0;if(w.blocked<=0){w.route=[];w.blocked=.25;}break;}
            w.x=next.x;w.y=next.y;w.phase+=n*.055;budget-=n;if(n>=d)w.route.shift();
          }
          this.setPose(w);
        }else{
          w.speed*=Math.exp(-dt*10);w.elapsed+=dt;
          if(w.targetHeading!==undefined)w.heading+=Math.atan2(Math.sin(w.targetHeading-w.heading),Math.cos(w.targetHeading-w.heading))*Math.min(1,dt*5);
          this.setPose(w);
          if(w.prop){
            if(w.kind==='pick'){w.prop.location='lifting';w.prop.progress=ease((w.elapsed/w.duration-.25)/.75);if(w.elapsed>=w.duration)w.prop.location='hands';}
            else if(w.kind==='place'){w.prop.location='lowering';w.prop.progress=1-ease(w.elapsed/w.duration);if(w.elapsed>=w.duration){w.prop.location='table';w.prop.station=w.station;w.prop.hiddenAtRest=!!w.targetStation.storage;w.prop.progress=0;w.lastPlacedId=w.prop.id;w.prop=null;}}
          }
          if(w.elapsed>=w.duration)this.next(w);
        }
      }
    }
    requestYield(key,from,to){
      const w=this.workers[key];if(!w||w.yielding||IslandCatTerrain.peopleClear(from,to,[{...w,radius:70}],70))return;
      if(['pick','place','half'].includes(w.kind))return;
      const end=this.getDoctor()?.route?.at(-1)||to,free=this.yieldPoint(w,from,end);w.yieldEnd={x:end.x,y:end.y};
      if(!free)return;
      const resume={kind:w.kind,time:Math.max(2,w.duration-w.elapsed),station:w.station,...(w.kind==='walk'?{point:w.goal}:{})},returnStep={kind:'walk',point:{x:w.x,y:w.y},station:w.station};
      const seated=w.pose==='sit',half={kind:'half',time:.8,station:w.station};
      w.steps=[...(seated?[half,{kind:'stand',time:.8,station:w.station}]:[]),{kind:'walk',point:{x:free.x,y:free.y},station:w.station},{kind:'yield',time:3,station:w.station},returnStep,...(seated?[half,{kind:'sit',time:.8,station:w.station}]:[]),resume,...w.steps];
      w.yielding=true;this.start(w,w.steps.shift());
    }
    allowsDoctorStep(key,from,to){const bodies=this.people(key);const clear=IslandCatTerrain.peopleClear(from,to,bodies,66);if(!clear)this.requestYield(key,from,to);return clear;}
    draw(key,g,art){const w=this.workers[key];if(!w)return;IslandNPCRenderer.draw(g,w,this.images[key],this.fallbackImages[w.profile.asset]);const back=w.targetStation?.back;if(back&&w.pose==='sit'&&w.blend>.6&&art?.naturalWidth){g.save();g.beginPath();back.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();g.drawImage(art,0,0,1536,1024);g.restore();}}
    snapshot(key){const w=this.workers[key];return w?{name:w.name,x:w.x,y:w.y,height:w.height,working:true,animationTime:w.time,action:w.kind,station:w.station,job:w.job,pose:w.pose,previousPose:w.previousPose,transition:ease(w.blend),heading:w.heading,speed:w.speed,route:w.route.map(p=>({...p})),goal:w.goal?{x:w.goal.x,y:w.goal.y}:null,yielding:w.yielding,prop:w.prop?{...w.prop,home:{...w.prop.home}}:null,habit:w.profile.habit,completed:w.completed,history:w.history.map(x=>({...x})),assetsReady:this.ready(key)}:null;}
  }
  window.IslandNPCLife=IslandNPCLife;
})();
