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
    const goals={seat:seated?1:rising?.5:0,work:['work','type','seatedWork','sort','reach'].includes(w.kind)?1:0,think:['scratch','glasses'].includes(w.kind)?1:0,fold:w.kind==='fold'?1:0,hold:['pick','inspect','place'].includes(w.kind)||w.prop?1:0,gait:w.kind==='walk'?clamp(w.speed/70,0,1):0,look:['look','seatedLook','nod'].includes(w.kind)?1:0};
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
    const hipY=mix(.33,.24,s.seat)*h,breath=Math.sin(w.time*1.7)*h*.0017;
    const dock=seat?[seat[0],seat[1]+hipY-h*.025]:[w.x,w.y];
    const root=[mix(w.x,dock[0],s.seat),mix(w.y,dock[1],s.seat)];s.root=root;
    const lean=(s.work*.025+s.seat*(1-s.seat)*.045)*h;
    const joints={pelvis:[0,hipY,0],spine:[0,hipY+h*.12,lean*.45],chest:[0,hipY+h*.275+breath,lean],neck:[0,hipY+h*.335+breath,lean]};
    const bones=[{name:'pelvis',parent:null,a:[0,0,0],b:joints.pelvis},{name:'spine',parent:'pelvis',a:joints.pelvis,b:joints.spine},{name:'chest',parent:'spine',a:joints.spine,b:joints.chest},{name:'neck',parent:'chest',a:joints.chest,b:joints.neck}];
    const limbs=[];
    const worldTarget=(x,y,height)=>{const px=x-root[0],pz=(y-root[1]+height)/.32;return [px*cy-pz*sy,height,px*sy+pz*cy];};
    for(let i=0;i<2;i++){
      const side=i?1:-1,hip=add(joints.pelvis,[side*h*.047,0,0]);
      // Foot trajectories use an explicit support/swing cycle. Pelvis is not
      // advanced by the renderer; movement and phase come from NPC navigation.
      const cycle=((s.cycle+i*.5)%1+1)%1,support=cycle<.6;
      const travel=support?mix(.5,-.5,cycle/.6):mix(-.5,.5,smooth((cycle-.6)/.4));
      const lift=support?0:Math.sin((cycle-.6)/.4*Math.PI)*h*.055;
      const foot=[side*h*.047,h*.025+lift*s.gait,travel*stride*s.gait];
      foot[2]=mix(foot[2],h*.15,s.seat);
      const [knee,ankle]=ik(hip,foot,h*.165,h*.165,[0,.12,1]);
      joints['hip'+i]=hip;joints['knee'+i]=knee;joints['ankle'+i]=ankle;
      bones.push({name:'thigh'+i,parent:'pelvis',a:hip,b:knee},{name:'shin'+i,parent:'thigh'+i,a:knee,b:ankle},{name:'foot'+i,parent:'shin'+i,a:ankle,b:add(ankle,[0,0,h*.06])});
      joints['tail'+i]=add(hip,mul(sub(knee,hip),.66));bones.push({name:'coatTail'+i,parent:'pelvis',a:hip,b:joints['tail'+i]});
      const shoulder=add(joints.chest,[side*h*.09,0,0]);
      let target=[side*h*.12,hipY+h*.025,-Math.cos((s.cycle+i*.5)*Math.PI*2)*h*.07*s.gait];
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
  function path(g,points){g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();}
  function segment(g,a,b,width,colors){
    const grad=g.createLinearGradient(a.x-width/2,a.y,b.x+width/2,b.y);grad.addColorStop(0,colors[0]);grad.addColorStop(.45,colors[1]);grad.addColorStop(1,colors[2]);
    g.lineCap='round';g.lineJoin='round';g.lineWidth=width;g.strokeStyle=grad;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
  }
  const white=['#b8c4cc','#fffefa','#d9e0e2'],pants=['#202731','#454b56','#282e37'];
  // Bind the original costume to rigid bone strips. These are texture regions
  // of ONE neutral pose per direction, not independent action pictures.
  const skins={
    front:{torso:[[198,330],[350,330],[370,730],[174,730]],arms:[[[185,365],[156,495],[150,610],[150,662]],[[363,365],[389,495],[395,610],[390,662]]],legs:[[[230,712],[220,817],[209,907],[180,946]],[[332,712],[344,817],[347,907],[380,946]]]},
    back:{torso:[[695,325],[851,325],[890,730],[677,730]],arms:[[[697,359],[679,490],[677,613],[689,660]],[[851,359],[884,490],[903,613],[909,660]]],legs:[[[739,712],[724,817],[714,907],[712,946]],[[822,712],[842,817],[851,907],[893,946]]]},
    side:{torso:[[1240,330],[1335,330],[1360,725],[1195,725]],arms:[[[1285,365],[1260,495],[1260,615],[1263,665]],[[1285,365],[1260,495],[1260,615],[1263,665]]],legs:[[[1268,720],[1290,817],[1300,907],[1230,946]],[[1288,720],[1320,817],[1325,907],[1260,946]]]}
  };
  function texturedTriangle(g,image,s,d){
    const [a,b,c]=s,[p,q,r]=d,den=a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y);if(Math.abs(den)<.001)return;
    const coefficient=(u,v,w)=>[(u*(b.y-c.y)+v*(c.y-a.y)+w*(a.y-b.y))/den,(u*(c.x-b.x)+v*(a.x-c.x)+w*(b.x-a.x))/den,(u*(b.x*c.y-c.x*b.y)+v*(c.x*a.y-a.x*c.y)+w*(a.x*b.y-b.x*a.y))/den];
    const x=coefficient(p.x,q.x,r.x),y=coefficient(p.y,q.y,r.y);g.save();path(g,d);g.clip();g.transform(x[0],y[0],x[1],y[1],x[2],y[2]);g.drawImage(image,0,0);g.restore();
  }
  function quad(g,image,s,d){for(const indices of [[0,1,2],[0,2,3]])texturedTriangle(g,image,indices.map(i=>Array.isArray(s[i])?{x:s[i][0],y:s[i][1]}:s[i]),indices.map(i=>d[i]));}
  function strip(g,image,a,b,sourceWidth,p,q,width){
    const edge=(a,b,w)=>{const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len*w/2,ny=dx/len*w/2;return[{x:a.x+nx,y:a.y+ny},{x:a.x-nx,y:a.y-ny},{x:b.x-nx,y:b.y-ny},{x:b.x+nx,y:b.y+ny}];};
    const angle=Math.atan2(q.y-p.y,q.x-p.x),len=Math.hypot(q.x-p.x,q.y-p.y);
    g.save();g.translate(p.x,p.y);g.rotate(angle);g.beginPath();g.roundRect(0,-width/2,Math.max(.01,len),width,Math.min(width/2,len/2));g.clip();g.rotate(-angle);g.translate(-p.x,-p.y);
    quad(g,image,edge({x:a[0],y:a[1]},{x:b[0],y:b[1]},sourceWidth),edge(p,q,width));g.restore();
  }
  function draw(g,w,images){
    if(!images?.views?.naturalWidth)return false;
    const r=solve(w),{h,project:p,joints:j}=r,limbs=[...r.limbs].sort((a,b)=>p(a.hip).depth-p(b.hip).depth);
    const sideView=Math.abs(Math.sin(r.yaw))>.84,skin=skins[sideView?'side':Math.cos(r.yaw)>0?'front':'back'];
    const mirror=sideView?Math.sin(r.yaw)>0?-1:1:Math.cos(r.yaw)>0?1:Math.sin(r.yaw)<0?-1:1;
    const tex=(a,b,width,pa,pb,targetWidth)=>strip(g,images.views,a,b,width,pa,pb,targetWidth);
    g.save();g.fillStyle='#49342626';g.beginPath();g.ellipse(r.root[0],r.root[1]+2,h*.085,h*.022,0,0,Math.PI*2);g.fill();
    const leg=l=>{const source=skin.legs[l.index];segment(g,p(l.hip),p(l.knee),h*.067,pants);segment(g,p(l.knee),p(l.ankle),h*.058,pants);tex(source[0],source[1],88,p(l.hip),p(l.knee),h*.09);tex(source[1],source[2],88,p(l.knee),p(l.ankle),h*.085);const a=p(l.ankle),shoe=skin===skins.front?(l.index?[293,887,143,90]:[133,887,132,90]):skin===skins.back?(l.index?[780,887,160,90]:[660,887,130,90]):[1161,887,150,92];g.save();g.translate(a.x,a.y);if(skin===skins.side&&Math.sin(r.yaw)>0)g.scale(-1,1);g.drawImage(images.views,...shoe,-h*.06,-h*.055,h*.12,h*.08);g.restore();};
    const arm=l=>{const source=skin.arms[l.index];segment(g,p(l.shoulder),p(l.elbow),h*.064,white);segment(g,p(l.elbow),p(l.hand),h*.052,white);tex(source[0],source[1],80,p(l.shoulder),p(l.elbow),h*.083);tex(source[1],source[2],80,p(l.elbow),p(l.hand),h*.077);const hand=p(l.hand),elbow=p(l.elbow),dx=hand.x-elbow.x,dy=hand.y-elbow.y,len=Math.hypot(dx,dy)||1,tip={x:hand.x+dx/len*h*.035,y:hand.y+dy/len*h*.035};segment(g,hand,tip,h*.038,['#c78b64','#f5c59d','#dba27a']);tex(source[2],source[3],76,hand,tip,h*.063);};
    limbs.forEach(leg);arm(limbs[0]);
    // Coat is attached to chest and pelvis; split tails follow the thighs.
    // It covers the hip joints while the trousers stay attached underneath.
    const left=p(add(j.chest,[-h*.095,h*.009,0])),right=p(add(j.chest,[h*.095,h*.009,0]));
    const bottomL=p(add(j.tail0,[-h*.044,0,0])),bottomR=p(add(j.tail1,[h*.044,0,0]));
    const cloth=g.createLinearGradient(left.x,left.y,right.x+h*.03,bottomR.y);cloth.addColorStop(0,'#d7e0e5');cloth.addColorStop(.45,'#fffefa');cloth.addColorStop(1,'#bac7cf');
    path(g,[left,right,bottomR,bottomL]);g.fillStyle=cloth;g.fill();g.strokeStyle='#b9c6cb';g.lineWidth=.8;g.stroke();
    const neck=p(j.neck),chest=p(j.chest),waist=p(add(j.pelvis,[0,h*.09,0])),front=Math.cos(r.yaw)>0;
    if(front){path(g,[{x:neck.x-h*.028,y:neck.y},{x:neck.x+h*.028,y:neck.y},waist]);g.fillStyle='#82b6da';g.fill();for(const side of [-1,1]){path(g,[{x:neck.x+side*h*.027,y:neck.y},{x:chest.x+side*h*.065,y:chest.y+h*.025},{x:waist.x,y:waist.y}]);g.fillStyle=side<0?'#f9fbfa':'#e7eeee';g.fill();g.strokeStyle='#c6d1d5';g.stroke();}}
    else{g.strokeStyle='#c4d0d5';g.lineWidth=.9;g.beginPath();g.moveTo(chest.x,chest.y);g.lineTo(waist.x,waist.y+h*.13);g.stroke();}
    const halfWidth=h*.112*(.72+.28*Math.abs(Math.cos(r.yaw))),top=p(add(j.chest,[0,h*.025,0])),bottom={x:(bottomL.x+bottomR.x)/2,y:(bottomL.y+bottomR.y)/2};
    const body=[{x:top.x-halfWidth,y:top.y},{x:top.x+halfWidth,y:top.y},{x:bottom.x+halfWidth*1.07,y:bottom.y},{x:bottom.x-halfWidth*1.07,y:bottom.y}];
    quad(g,images.views,mirror<0?[skin.torso[1],skin.torso[0],skin.torso[3],skin.torso[2]]:skin.torso,body);
    arm(limbs[1]);
    // Keep the original cartoon identity. Only the head uses directional art;
    // every body pose below it is the same joint hierarchy and skin.
    const head=p(j.head),angle=Math.abs(Math.atan2(Math.sin(r.yaw),Math.cos(r.yaw))),sideWeight=Math.sin(angle)**2;
    const frontWeight=Math.max(0,Math.cos(angle))**2,backWeight=Math.max(0,-Math.cos(angle))**2;
    const heads=[{frame:[154,33,246,286],weight:frontWeight,mirror:Math.sin(r.yaw)<0?-1:1},{frame:[658,35,264,280],weight:backWeight,mirror:Math.sin(r.yaw)<0?-1:1},{frame:[1156,33,266,287],weight:sideWeight,mirror:Math.sin(r.yaw)>0?-1:1}];
    // Offscreen additive blending preserves opacity through a turn.
    let cache=headCaches.get(w);if(!cache){cache=document.createElement('canvas');cache.width=256;cache.height=300;headCaches.set(w,cache);}
    const ctx=cache.getContext('2d');ctx.clearRect(0,0,256,300);ctx.globalCompositeOperation='lighter';
    for(const view of heads){if(view.weight<.001)continue;ctx.save();ctx.globalAlpha=view.weight;ctx.translate(128,0);ctx.scale(view.mirror,1);ctx.drawImage(images.views,...view.frame,-128,0,256,300);ctx.restore();}
    ctx.globalCompositeOperation='source-over';g.save();g.translate(head.x,head.y);g.rotate(r.look);g.drawImage(cache,-h*.145,-h*.157,h*.29,h*.34);g.restore();g.restore();return true;
  }
  const headCaches=new WeakMap();
  function hand(w){const r=states.get(w)?.result;if(!r)return null;const a=r.project(r.joints.hand0),b=r.project(r.joints.hand1);return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  function snapshot(w){const r=states.get(w)?.result||solve(w);return{type:'articulated-2.5d',seat:r.seat,gait:r.gait,yaw:r.yaw,root:r.root,bones:r.bones.map(b=>({...b,a:[...b.a],b:[...b.b]})),joints:structuredClone(r.joints)};}
  window.IslandHankRig=Object.freeze({draw,solve,ik,hand,snapshot});
})();
