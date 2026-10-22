(() => {
  'use strict';
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  // Each coworker has two seated poses and a camera-facing standing smile.
  // Seats are resolved against
  // each profile; right/left are the screen chairs by their room x position.
  const POSES={
    clock:[{station:'computer',kind:'type'},{station:'stool',kind:'seatedWork'},{stand:true}],
    library:[{station:'second',kind:'type'},{station:'computer',kind:'seatedWork'},{stand:true}],
    lab:[{station:'computer',kind:'type'},{station:'second',kind:'type'},{stand:true}]
  };
  class IslandNPCLife {
    constructor({getDoctor=()=>null,getCat=()=>null,random=Math.random,fallbackImages={}}={}){
      this.random=random;this.getDoctor=getDoctor;this.getCat=getCat;this.fallbackImages=fallbackImages;this.workers={};this.loads={};this.images={};
      for(const [key,profile] of Object.entries(IslandNPCRoutines.profiles)){
        const p=profile.stations[profile.start];
        this.workers[key]={key,profile,name:profile.name,x:p.x,y:p.y,height:profile.height,station:profile.start,heading:Math.atan2(p.look.y-p.y,p.look.x-p.x),phase:random()*6,time:0,elapsed:0,duration:8+random()*7,kind:'work',pose:'work',previousPose:'work',blend:1,route:[],steps:[],job:'initial',previousJob:'',speed:0,walkSpeed:100,blocked:0,prop:null,yielding:false,history:[],completed:0};
        this.workers[key].items=Object.entries(profile.stations).filter(([,s])=>s.item).map(([station,s])=>({id:key+'-'+station,kind:s.prop,hiddenAtRest:!!s.storage,home:{...s.item},station,location:'table',progress:0}));
        this.settle(this.workers[key]);
      }
    }
    // On each doctor visit a coworker holds one of three fixed poses, chosen
    // at random: seated operating the right chair, seated working at the left
    // chair/stool, or standing facing the camera. No walking, no thinking, no
    // props; only the idle breathing motion remains. The seats and the
    // standing spot are different places, so a pose is picked once and held
    // (never toggled) to avoid teleporting between them.
    settle(w){
      const presets=IslandNPCLife.POSES[w.key]||[{stand:true}];
      const options=w.profile.asset==='anthony'&&presets.length>1?presets.filter(p=>(p.station||'stand')!==w.lastFixedPose):presets;
      const pick=options[Math.floor(this.random()*options.length)];w.lastFixedPose=pick.station||'stand';
      const st=w.profile.stations[pick.station]||w.profile.stations[w.profile.start];
      w.static=true;w.station=pick.station||w.profile.start;w.targetStation=st;
      w.speed=0;w.gait=0;w.route=[];w.steps=[];w.goal=null;w.blocked=0;w.yielding=false;w.elapsed=0;w.duration=Infinity;w.prop=null;
      if(pick.stand){w.kind='stand';w.x=st.x;w.y=st.y;w.heading=w.targetHeading=Math.PI/2;}
      else{w.kind=pick.kind;w.x=st.x;w.y=st.y;w.heading=w.targetHeading=Math.atan2(st.look.y-st.y,st.look.x-st.x);}
      w.pose=this.poseFor(w);w.previousPose=w.pose;w.poseSign=Math.cos(w.heading)<0?-1:1;w.blend=1;
    }
    load(key){
      const w=this.workers[key];if(!w)return Promise.resolve();if(this.loads[key])return this.loads[key];
      this.images[key]={};
      this.loads[key]=Promise.all(['seats','gestures','views',...(w.profile.asset==='anthony'?['portrait']:[])].map(part=>new Promise(resolve=>{const im=new Image();im.onload=()=>{this.images[key][part]=im;resolve();};im.onerror=()=>resolve();im.src=part==='portrait'?'assets/npc-anthony-front-v35.png':'assets/npc-'+w.profile.asset+'-'+part+'-v'+(part==='seats'?24:23)+'.png';}))).then(()=>this.ready(key));
      return this.loads[key];
    }
    ready(key){return ['seats','gestures','views',...(this.workers[key]?.profile.asset==='anthony'?['portrait']:[])].every(part=>this.images[key]?.[part]?.naturalWidth>0);}
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
      // When the doctor steps into a room, re-settle that room's coworker into
      // a new random fixed pose. Nobody walks or cycles actions otherwise.
      const location=this.getDoctor()?.location||null;
      if(location!==this.doctorLocation){this.doctorLocation=location;if(location&&this.workers[location])this.settle(this.workers[location]);}
      for(const w of Object.values(this.workers)){
        w.time+=dt;w.blend=Math.min(1,w.blend+dt/(w.transitionDuration||.8));
        if(w.static){
          w.speed=0;w.gait=(w.gait||0)*Math.exp(-dt*6);w.elapsed+=dt;
          if(w.targetHeading!==undefined)w.heading+=Math.atan2(Math.sin(w.targetHeading-w.heading),Math.cos(w.targetHeading-w.heading))*Math.min(1,dt*5);
          this.setPose(w);
          continue;
        }
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
          const desired=Math.min(w.walkSpeed,Math.max(28,distance(w,w.goal)*2.8))*(Math.abs(error)>.5?0:1);
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
    // Coworkers hold a fixed pose and never step aside; the doctor simply
    // routes around whatever furniture spot they are settled at.
    requestYield(){}
    allowsDoctorStep(key,from,to){return IslandCatTerrain.peopleClear(from,to,this.people(key),66);}
    draw(key,g,art){
      const w=this.workers[key];if(!w)return;
      IslandNPCRenderer.draw(g,w,this.images[key],this.fallbackImages[w.profile.asset]);
      if(w.pose!=='sit'||w.blend<=.6||!art?.naturalWidth)return;
      // The backrest and foreground pedestal/casters belong in front of the
      // seated body. Restore only their silhouettes, never a rectangular patch.
      const fronts={
        library:{
          computer:[[[716,534],[731,529],[736,535],[732,599],[727,607],[727,616],[751,624],[758,630],[758,641],[748,647],[741,643],[743,633],[704,621],[704,644],[707,651],[704,660],[694,663],[690,656],[691,646],[694,620],[650,638],[650,647],[642,650],[639,643],[641,633],[693,611],[708,609]],[[652,610],[663,608],[672,612],[714,607],[718,615],[660,623],[650,621]]],
          second:[[[997,586],[1007,583],[1015,589],[1017,650],[1022,657],[1045,658],[1047,678],[1094,693],[1103,699],[1104,710],[1096,716],[1088,710],[1089,702],[1046,690],[1048,718],[1047,731],[1040,736],[1032,730],[1033,719],[1034,691],[987,708],[988,714],[980,719],[972,713],[973,703],[980,697],[1029,680],[1030,660],[1011,654],[999,642]]]
        },
        clock:{stool:[[[652,675],[665,675],[669,710],[675,716],[704,722],[710,731],[707,738],[698,738],[695,730],[670,724],[667,745],[670,751],[665,758],[656,756],[654,748],[655,725],[630,737],[629,746],[620,749],[616,744],[618,735],[651,716]]],computer:[[[1138,655],[1147,654],[1152,663],[1155,711],[1161,724],[1170,731],[1194,736],[1202,742],[1200,752],[1191,754],[1187,746],[1167,742],[1166,769],[1170,778],[1166,785],[1156,783],[1154,774],[1155,745],[1123,758],[1123,767],[1115,771],[1109,766],[1111,757],[1153,733],[1146,716]] ]}
      };
      for(const polygon of [w.targetStation?.back,...(fronts[key]?.[w.station]||[])].filter(Boolean)){
        g.save();g.beginPath();polygon.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();g.drawImage(art,0,0,1536,1024);g.restore();
      }
    }
    snapshot(key){const w=this.workers[key];return w?{name:w.name,x:w.x,y:w.y,height:w.height,working:true,animationTime:w.time,action:w.kind,station:w.station,job:w.job,pose:w.pose,previousPose:w.previousPose,transition:ease(w.blend),heading:w.heading,speed:w.speed,route:w.route.map(p=>({...p})),goal:w.goal?{x:w.goal.x,y:w.goal.y}:null,yielding:w.yielding,prop:w.prop?{...w.prop,home:{...w.prop.home}}:null,habit:w.profile.habit,completed:w.completed,history:w.history.map(x=>({...x})),assetsReady:this.ready(key)}:null;}
  }
  IslandNPCLife.POSES=POSES;
  window.IslandNPCLife=IslandNPCLife;
})();
