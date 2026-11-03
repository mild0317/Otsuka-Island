(() => {
  'use strict';
  // A single articulated 2.5D skeleton, in body-local units. Work/sit/walk
  // animate joint targets, never dissolve between pictures of whole bodies.
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(v,k)=>v.map(x=>x*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const length=v=>Math.hypot(...v),unit=v=>mul(v,1/(length(v)||1));
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  // Map a floor-space walking speed to the isometric screen projection.
  // Previously vertical travel kept horizontal speed and tripled cadence.
  const travelScale=heading=>1/Math.hypot(Math.cos(heading),Math.sin(heading)/.32);
  function ik(origin,target,a,b,pole){
    const delta=sub(target,origin),distance=clamp(length(delta),Math.abs(a-b)+.001,a+b-.001),axis=unit(delta);
    let bend=sub(pole,mul(axis,dot(pole,axis)));
    if(length(bend)<.001)bend=cross(axis,[1,0,0]);
    bend=unit(bend);
    const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
    return [add(origin,add(mul(axis,along),mul(bend,height))),add(origin,mul(axis,distance))];
  }
  const states=new WeakMap();
  function solve(w){
    let s=states.get(w);
    if(!s){s={time:w.time,seat:['sit','type','seatedWork','seatedLook'].includes(w.kind)?1:w.kind==='half'?.5:0,work:['work','type','seatedWork','sort','reach'].includes(w.kind)?1:0,think:0,fold:0,hold:0,look:0,yaw:Math.atan2(Math.cos(w.heading),Math.sin(w.heading)/.32),root:[w.x,w.y],gait:0};states.set(w,s);}
    const dt=clamp(w.time-s.time,0,.08);s.time=w.time;
    const seated=['sit','type','seatedWork','seatedLook'].includes(w.kind),rising=w.kind==='half';
    // Half is an actual intermediate joint configuration, not a third sprite.
    const goals={seat:seated?1:rising?.5:0,work:['work','type','seatedWork','sort','reach'].includes(w.kind)?1:0,think:['scratch','glasses'].includes(w.kind)?1:0,fold:w.kind==='fold'?1:0,hold:['pick','inspect','place'].includes(w.kind)||w.prop?1:0,gait:w.kind==='walk'?clamp(w.speed/(70*travelScale(w.heading)),0,1):0,look:['look','seatedLook','nod'].includes(w.kind)?1:0};
    for(const [key,v] of Object.entries(goals))s[key]=mix(s[key],v,1-Math.exp(-dt*(key==='seat'?5:7)));
    const desired=Math.atan2(Math.cos(w.heading),Math.sin(w.heading)/.32),turn=Math.atan2(Math.sin(desired-s.yaw),Math.cos(desired-s.yaw));s.yaw+=turn*(1-Math.exp(-dt*7));
    const h=w.height,cy=Math.cos(s.yaw),sy=Math.sin(s.yaw),seat=w.targetStation?.seatHip;
    const projectedForward=Math.hypot(sy,cy*.32),stride=h*.19;
    s.cycle ??= w.phase/(Math.PI*2);
    if(s.lastPosition&&w.kind==='walk'){
      const moved=(w.x-s.lastPosition[0])*Math.sin(s.yaw)/projectedForward+(w.y-s.lastPosition[1])*Math.cos(s.yaw)*.32/projectedForward;
      s.cycle+=moved*.6/(stride*projectedForward);
    }
    s.lastPosition=[w.x,w.y];
    const footData=i=>{const cycle=((s.cycle+i*.5)%1+1)%1,support=cycle<.6,travel=support?mix(.5,-.5,cycle/.6):mix(-.5,.5,smooth((cycle-.6)/.4));return{cycle,support,travel,lift:support?0:Math.sin((cycle-.6)/.4*Math.PI)*h*.04};};
    const longest=Math.max(...[0,1].map(i=>Math.abs(footData(i).travel*stride))),legReach=h*.344-1;
    const walkHip=h*.025+Math.sqrt(Math.max(0,legReach*legReach-longest*longest));
    const hipY=mix(mix(h*.365,walkHip,s.gait),h*.24,s.seat),breath=Math.sin(w.time*1.7)*h*.0017;
    const dock=seat?[seat[0],seat[1]+hipY-h*.025]:[w.x,w.y];
    const root=[mix(w.x,dock[0],s.seat),mix(w.y,dock[1],s.seat)];s.root=root;
    const lean=(s.work*.025+s.seat*(1-s.seat)*.045)*h;
    const joints={pelvis:[0,hipY,0],spine:[0,hipY+h*.12,lean*.45],chest:[0,hipY+h*.25+breath,lean],neck:[0,hipY+h*.31+breath,lean]};
    const bones=[{name:'pelvis',parent:null,a:[0,0,0],b:joints.pelvis},{name:'spine',parent:'pelvis',a:joints.pelvis,b:joints.spine},{name:'chest',parent:'spine',a:joints.spine,b:joints.chest},{name:'neck',parent:'chest',a:joints.chest,b:joints.neck}];
    const limbs=[];
    const worldTarget=(x,y,height)=>{const px=x-root[0],pz=(y-root[1]+height)/.32;return [px*cy-pz*sy,height,px*sy+pz*cy];};
    for(let i=0;i<2;i++){
      const side=i?1:-1,hip=add(joints.pelvis,[side*h*.047,0,0]);
      // Foot trajectories use an explicit support/swing cycle. Pelvis is not
      // advanced by the renderer; movement and phase come from NPC navigation.
      const {cycle,support,travel,lift}=footData(i);
      const foot=[side*h*.047,h*.025+lift*s.gait,travel*stride*s.gait];
      foot[2]=mix(foot[2],h*.15,s.seat);
      const [knee,ankle]=ik(hip,foot,h*.172,h*.172,[0,.12,1]);
      joints['hip'+i]=hip;joints['knee'+i]=knee;joints['ankle'+i]=ankle;
      bones.push({name:'thigh'+i,parent:'pelvis',a:hip,b:knee},{name:'shin'+i,parent:'thigh'+i,a:knee,b:ankle},{name:'foot'+i,parent:'shin'+i,a:ankle,b:add(ankle,[0,0,h*.06])});
      joints['tail'+i]=add(hip,mul(sub(knee,hip),.66));bones.push({name:'coatTail'+i,parent:'pelvis',a:hip,b:joints['tail'+i]});
      const shoulder=add(joints.chest,[side*h*.09,0,0]);
      let target=[side*h*.115,hipY-h*.035,-Math.cos((s.cycle+i*.5)*Math.PI*2)*h*.05*s.gait];
      const contact=w.targetStation?.contact;
      if(contact){const height=clamp(root[1]-contact[1],hipY+h*.08,hipY+h*.3),hands=worldTarget(contact[0]+side*9,contact[1]+Math.sin(w.time*8+i)*1.4,height);target=target.map((v,k)=>mix(v,hands[k],s.work));}
      const scratch=add(joints.neck,[side*h*.075,h*.09,h*.018]);
      target=target.map((v,k)=>mix(v,scratch[k],s.think*(i===1?1:.08)));
      const folded=add(joints.chest,[-side*h*.065,-h*.09,h*.06]);target=target.map((v,k)=>mix(v,folded[k],s.fold));
      let held=add(joints.chest,[side*h*.035,-h*.12,h*.09]);
      if(w.prop&&w.prop.location!=='hands'){
        const p=w.prop,t=p.progress||0,ground=worldTarget(p.home.x+side*7,p.home.y,hipY+h*.1);
        held=ground.map((v,k)=>mix(v,held[k],t));
      }
      target=target.map((v,k)=>mix(v,held[k],s.hold));
      if(i===1)target[2]+=4*s.think*(1-s.think)*h*.16;
      const delta=sub(target,shoulder),reach=h*.29-.01;
      if(length(delta)>reach)target=add(shoulder,mul(unit(delta),reach));
      // Retarget wrists at a bounded speed. Starting work at a distant device
      // must not snap either wrist (or flip its elbow) in one frame.
      s.armTargets ||= [];
      if(s.armTargets[i]){const change=sub(target,s.armTargets[i]),amount=Math.min(1,h*.9*dt/(length(change)||1));target=add(s.armTargets[i],mul(change,amount));}
      s.armTargets[i]=target;
      s.elbows ||= [];
      const axis=unit(sub(target,shoulder)),down=[side*.25,-1,.05];
      const desiredBend=unit(sub(down,mul(axis,dot(down,axis))));
      let pole=desiredBend;
      if(s.elbows[i]){
        const previous=sub(s.elbows[i],shoulder),projected=sub(previous,mul(axis,dot(previous,axis)));
        if(length(projected)>.001){
          const old=unit(projected),cosine=clamp(dot(old,desiredBend),-1,1),angle=Math.acos(cosine),turn=Math.min(angle,dt*3);
          let tangent=sub(desiredBend,mul(old,cosine));if(length(tangent)<.001)tangent=cross(axis,old);
          pole=add(mul(old,Math.cos(turn)),mul(unit(tangent),Math.sin(turn)));
        }
      }
      const [elbow,hand]=ik(shoulder,target,h*.145,h*.145,pole);s.elbows[i]=elbow;
      joints['shoulder'+i]=shoulder;joints['elbow'+i]=elbow;joints['hand'+i]=hand;
      bones.push({name:'clavicle'+i,parent:'chest',a:joints.chest,b:shoulder},{name:'upperArm'+i,parent:'clavicle'+i,a:shoulder,b:elbow},{name:'forearm'+i,parent:'upperArm'+i,a:elbow,b:hand},{name:'hand'+i,parent:'forearm'+i,a:hand,b:add(hand,[0,-h*.025,0])});
      limbs.push({side,index:i,hip,knee,ankle,shoulder,elbow,hand,support});
    }
    joints.head=add(joints.neck,[0,h*.16,0]);bones.push({name:'head',parent:'neck',a:joints.neck,b:joints.head});
    const project=p=>({x:root[0]+p[0]*cy+p[2]*sy,y:root[1]-p[1]+(p[2]*cy-p[0]*sy)*.32,depth:p[2]*cy-p[0]*sy});
    const result={h,root,yaw:s.yaw,seat:s.seat,gait:s.gait,joints,bones,limbs,project,look:s.look*Math.sin(w.time*1.3)*.035};s.result=result;return result;
  }
  function draw(g,w,images){
    if(window.IslandHankSkin&&images?.skin?.naturalWidth&&images.identity?.naturalWidth)return window.IslandHankSkin.draw(g,w,images,solve(w));
    // During loading, keep one intact neutral silhouette. Never run the old
    // rectangular costume fragments if the new skin has not arrived yet.
    if(!images?.views?.naturalWidth)return false;
    const side=Math.abs(Math.cos(w.heading))>.8,back=Math.sin(w.heading)<0;
    const frame=side?[1156,33,266,950,1276,983]:back?[642,35,300,945,803,980]:[119,33,315,945,286,978];
    const [x,y,width,height,fx,fy]=frame,scale=w.height/height;
    g.save();g.translate(w.x,w.y);if(side&&Math.cos(w.heading)>0)g.scale(-1,1);g.drawImage(images.views,x,y,width,height,(x-fx)*scale,(y-fy)*scale,width*scale,height*scale);g.restore();return true;
  }
  function hand(w){const r=states.get(w)?.result;if(!r)return null;const a=r.project(r.joints.hand0),b=r.project(r.joints.hand1);return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  function snapshot(w){const r=states.get(w)?.result||solve(w);return{type:'articulated-2.5d',seat:r.seat,gait:r.gait,yaw:r.yaw,root:r.root,bones:r.bones.map(b=>({...b,a:[...b.a],b:[...b.b]})),joints:structuredClone(r.joints)};}
  window.IslandHankRig=Object.freeze({draw,solve,ik,hand,snapshot,travelScale});
})();
