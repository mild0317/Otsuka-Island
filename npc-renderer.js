(() => {
  'use strict';
  // Alpha bounds measured from the delivered PNGs. No pixel reads at runtime,
  // so local file previews and GitHub Pages use exactly the same sprites.
  const bounds={
    anthony:{portrait:[[205,10,179,500,294,510]],gestures:[[114,16,398,961,340,977],[634,15,310,964,779,979],[1121,18,318,962,1266,980]],seats:[[72,193,408,740,190,933],[648,131,346,812,807,943],[1094,44,387,908,1328,952]],views:[[173,17,318,963,335,980],[640,18,316,952,802,970],[1113,19,245,958,1241,977]]},
    hank:{gestures:[[115,33,355,949,300,982],[622,35,318,947,782,982],[1126,43,327,942,1313,985]],seats:[[74,212,410,759,220,971],[594,119,370,853,797,972],[1029,33,453,950,1333,983]],views:[[119,33,315,945,286,978],[642,35,300,945,803,980],[1156,33,266,950,1276,983]]},
    princess:{gestures:[[125,34,362,921,277,955],[633,31,318,925,739,956],[1073,34,363,923,1233,957]],seats:[[75,197,446,765,205,962],[569,111,400,859,787,970],[1028,34,438,940,1325,974]],views:[[190,16,318,963,348,979],[645,20,326,961,824,981],[1102,15,270,969,1266,984]]}
  };
  const poses={sit:['seats',0],half:['seats',1],work:['seats',2],scratch:['gestures',0],fold:['gestures',1],hold:['gestures',2],front:['views',0],back:['views',1],side:['views',2]};
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const personalities={princess:{rate:1.6,phase:.7},hank:{rate:1.3,phase:2.3},anthony:{rate:1.45,phase:4.8}};
  const noise=x=>{const v=Math.sin(x*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
  function socialMotion(w){
    if(w.key!=='workshop')return{nod:0,turn:0,gesture:0};
    const seed=w.idleSeed||0,t=w.time||0,period=6.5+noise(seed)*4,cycle=Math.floor((t+seed)/period),local=(t+seed)-cycle*period;
    const duration=2+noise(seed+cycle+7)*2,envelope=local>1&&local<1+duration?Math.sin((local-1)/duration*Math.PI)**2:0;
    const action=Math.floor(noise(seed+cycle+19)*3);
    return{nod:action===0?Math.sin(local*4.4)*envelope*2.8:0,turn:action===1?Math.sin(local*1.8)*envelope*.026:0,
      gesture:envelope*(action===2?1:.35)};
  }
  function idleMotion(w){
    const p=personalities[w.profile.asset],seed=(w.idleSeed??w.phase??0)+p.phase,t=w.time||0;
    const breath=Math.sin(t*p.rate+seed)*1.1+Math.sin(t*p.rate*.47+seed)*.22,sway=Math.sin(t*.43+seed)*.45;
    if(w.pose==='sit'){
      // Work in sustained bursts: alternate key presses, move one hand across
      // the controls, then briefly rest. Each person's rhythm is independent.
      const period=9+noise(seed)*2,cycle=Math.floor((t+seed)/period),local=(t+seed)-cycle*period;
      const envelope=smooth(local/.45)*(1-smooth((local-period+1.5)/.55));
      const phase=local*(7.4+(p.rate-1.3)*2)+seed,reachStart=3.2+noise(seed+cycle+17)*.8;
      const reachTime=(local-reachStart)/2.1,reach=reachTime>0&&reachTime<1?Math.sin(Math.PI*reachTime)**2:0;
      const leftReach=cycle%2===0?reach:0,rightReach=cycle%2===1?reach:0;
      return{breath,sway,envelope,
        left:(-5.8*(.5+.5*Math.sin(phase))**1.5*(1-leftReach*.8)-leftReach*2)*envelope,
        right:(-5.2*(.5+.5*Math.sin(phase+2.7))**1.5*(1-rightReach*.8)-rightReach*2)*envelope,
        leftReach:(Math.sin(local*1.8+seed)*1.2-leftReach*9)*envelope,
        rightReach:(Math.sin(local*1.6+seed+1)*1.1-rightReach*9)*envelope};
    }
    const period=7+noise(seed)*3,cycle=Math.floor((t+seed)/period),local=(t+seed)-cycle*period-(1+noise(seed+cycle)*1.5),duration=3+noise(seed+cycle+11);
    const envelope=local>0&&local<duration?Math.sin(Math.PI*local/duration)**2:0;
    return{breath,sway,left:Math.sin(local*2.5+seed)*envelope*3.6,right:Math.sin(local*2.5+seed+1.8)*envelope*3,envelope};
  }
  const seatedHands={hank:[[.294,.543],[.366,.509]],anthony:[[.289,.485],[.363,.446]],princessOffice:[[.265,.475],[.349,.444]],princessRound:[[.265,.431],[.351,.399]]};
  // A compact smooth influence moves a wrist and fingers without shifting a
  // rectangular cutout or any of the surrounding chair pixels.
  const influence=(x,y,cx,cy,rx,ry)=>Math.max(0,1-((x-cx)/rx)**2-((y-cy)/ry)**2)**2;
  const caches=new WeakMap();
  const seatedCaches=new WeakMap();
  const heads={
    hank:{seats:[[295,345],[745,245],[1260,160]],gestures:[[300,175],[800,175],[1310,175]],views:[[275,160],[800,170],[1270,160]]},
    princess:{seats:[[300,330],[720,245],[1260,160]],gestures:[[345,170],[790,165],[1300,170]],views:[[350,175],[810,175],[1245,170]]},
    anthony:{portrait:[[295,84]],seats:[[285,325],[760,250],[1280,165]],gestures:[[360,160],[800,150],[1300,150]],views:[[345,165],[795,160],[1240,155]]}
  };
  // Contact with the cushion is the underside of the seated pelvis, not its
  // centre. Pinning the centre made the character sink in front of the chair.
  // The pelvis rests on the cushion; the hanging coat hem is not a seat anchor.
  const hips={hank:[380,760],princess:[370,710],anthony:[380,735]};
  // Match the intact seated figure to the chair's seat-to-floor distance.
  // Hank's standing-sheet scale previously required lengthening his shins.
  const seatedScale=w=>w.height/bounds[w.profile.asset].seats[2][3]*(w.profile.asset==='hank'?1.22:1);
  function seatOffset(w,sign=w.poseSign||(Math.cos(w.heading)<0?-1:1)){
    const station=w.targetStation;if(!station?.seatHip)return station?.seatShift||[0,0];
    const frames=bounds[w.profile.asset].seats,frame=frames[0],scale=seatedScale(w),mirror=sign===-1?1:-1,hip=hips[w.profile.asset];
    return [station.seatHip[0]-w.x-(hip[0]-frame[4])*scale*mirror,station.seatHip[1]-w.y-(hip[1]-frame[5])*scale];
  }
  function description(w,pose,sign=1){const [part,index]=w.profile.asset==='anthony'&&pose==='front'?['portrait',0]:poses[pose]||poses.front,frames=bounds[w.profile.asset][part],frame=frames[index],reference=part==='seats'?frames[2][3]:(frames[1]||frames[0])[3],scale=pose==='sit'?seatedScale(w):w.height/reference,base=part==='seats'?-1:part==='views'?(pose==='side'&&w.profile.asset==='hank'?-1:1):w.profile.asset==='anthony'?1:-1,mirror=base===sign?1:-1,amount=pose==='sit'?1:pose==='half'?.5:0,shift=seatOffset(w,sign),head=heads[w.profile.asset][part][index];return {part,index,frame,scale,mirror,top:-frame[3]*scale,head:{x:(head[0]-frame[4])*scale*mirror+shift[0]*amount,y:(head[1]-frame[5])*scale+shift[1]*amount}};}
  function hand(w){const base=w.profile.asset==='anthony'?1:-1,current=w.poseSign||(Math.cos(w.heading)<0?-1:1),old=w.previousSign||current,sign=old+(current-old)*smooth(w.blend);return {x:w.x+sign*29,y:w.y-w.height*.62+Math.sin(w.time*1.7)*.6,base,sign};}
  function triangle(g,image,s,d,padding=.35){
    const [a,b,c]=s,[p,q,r]=d,den=a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y);if(Math.abs(den)<.001)return;
    const coefficient=(v1,v2,v3)=>[(v1*(b.y-c.y)+v2*(c.y-a.y)+v3*(a.y-b.y))/den,(v1*(c.x-b.x)+v2*(a.x-c.x)+v3*(b.x-a.x))/den,(v1*(b.x*c.y-c.x*b.y)+v2*(c.x*a.y-a.x*c.y)+v3*(a.x*b.y-b.x*a.y))/den];
    const xx=coefficient(p.x,q.x,r.x),yy=coefficient(p.y,q.y,r.y),cx=(p.x+q.x+r.x)/3,cy=(p.y+q.y+r.y)/3;
    g.save();g.beginPath();for(let i=0;i<3;i++){const v=d[i],dx=v.x-cx,dy=v.y-cy,l=Math.hypot(dx,dy)||1,x=v.x+dx/l*padding,y=v.y+dy/l*padding;i?g.lineTo(x,y):g.moveTo(x,y);}g.closePath();g.clip();g.transform(xx[0],yy[0],xx[1],yy[1],xx[2],yy[2]);
    const sx=Math.max(0,Math.min(a.x,b.x,c.x)-4),sy=Math.max(0,Math.min(a.y,b.y,c.y)-4),sw=Math.min(image.naturalWidth,Math.max(a.x,b.x,c.x)+4)-sx,sh=Math.min(image.naturalHeight,Math.max(a.y,b.y,c.y)+4)-sy;
    g.drawImage(image,sx,sy,sw,sh,sx,sy,sw,sh);g.restore();
  }
  function drawSeated(g,seat,image,w,name){
    const key=name+':'+seat.width+':'+seat.height+':'+w.idleSeed;
    let cache=seatedCaches.get(w);
    if(!cache||cache.key!==key){const layer=document.createElement('canvas');layer.width=seat.width*2;layer.height=seat.height*2;layer.dataset.seatingAsset=image.src;cache={key,layer,time:-Infinity};seatedCaches.set(w,cache);}
    if(w.time-cache.time>=1/24||w.time<cache.time){
      cache.time=w.time;const p=cache.layer.getContext('2d');p.setTransform(1,0,0,1,0,0);p.clearRect(0,0,cache.layer.width,cache.layer.height);p.setTransform(2,0,0,2,0,0);p.imageSmoothingEnabled=true;p.imageSmoothingQuality='high';
      rasterSeated(p,seat,image,w,name);
    }
    g.drawImage(cache.layer,0,0,cache.layer.width,cache.layer.height,0,0,seat.width,seat.height);
  }
  function rasterSeated(g,seat,image,w,name){
    const edge=Math.round(seat.height*2*.61)/2,cut=edge/seat.height*image.naturalHeight,motion=idleMotion(w),social=socialMotion(w),hands=seatedHands[name],breathStop={hank:.58,anthony:.56,princessOffice:.56,princessRound:.52}[name];
    // This entire lower strip remains pixel-identical: hips, cushion, legs and wheels.
    g.drawImage(image,0,cut,image.naturalWidth,image.naturalHeight-cut,0,edge,seat.width,seat.height-edge);
    const xs=[...new Set([0,1,...Array.from({length:17},(_,i)=>i/16),.54,.60,.65,...hands.flatMap(([x])=>[x-.08,x,x+.08])])].sort((a,b)=>a-b);
    const ys=[...new Set([0,.1,.2,.3,.4,.42,.48,.55,cut/image.naturalHeight,...hands.flatMap(([,y])=>[y-.05,y,y+.05])])].filter(y=>y<=cut/image.naturalHeight).sort((a,b)=>a-b),source=[],vertices=[];
    for(const ny of ys)for(const nx of xs){
      const x=nx*seat.width,y=ny*seat.height,chairLocked=name!=='anthony'&&ny>=.42&&nx>=.60;
      const upper=(1-smooth((ny-.30)/(breathStop-.30)))*(chairLocked?0:1);
      let dx=motion.sway*upper*.45,dy=-motion.breath*upper;
      const head=1-smooth((ny-.24)/.13);dx-=(y-seat.height*.20)*social.turn*head;dy+=((x-seat.width*.52)*social.turn+social.nod)*head;
      hands.forEach(([hx,hy],index)=>{
        // Move the hand almost rigidly at its centre; blend the wrist motion
        // into the sleeve toward the elbow rather than stretching fingers.
        const distance=Math.hypot((nx-hx)/.085,(ny-hy)/.05);
        const wrist=1-smooth((distance-.4)/.6);
        const forearm=influence(nx,ny,hx+.075,hy+.01,.10,.045)*.45;
        const weight=Math.max(wrist,forearm)*(1-smooth((ny-breathStop+.015)/.025))*(chairLocked?0:1);
        const movement=index?motion.right:motion.left,reach=index?motion.rightReach:motion.leftReach;
        dx+=(reach+movement*.18)*weight*seat.height/308;dy+=movement*weight*seat.height/308;
      });
      source.push({x:nx*image.naturalWidth,y:ny*image.naturalHeight});vertices.push({x:x+dx,y:y+dy});
    }
    const cols=xs.length;
    // Supersampled coverage overlaps internal edges, then the final image is
    // resampled once. Keep the upper/lower join on an exact raster row.
    g.save();g.beginPath();g.rect(0,0,seat.width,edge);g.clip();
    for(let row=0;row<ys.length-1;row++)for(let col=0;col<cols-1;col++){
      const a=row*cols+col,b=a+1,c=a+cols,d=c+1;
      triangle(g,image,[source[a],source[b],source[d]],[vertices[a],vertices[b],vertices[d]],.9);
      triangle(g,image,[source[a],source[d],source[c]],[vertices[a],vertices[d],vertices[c]],.9);
    }
    g.restore();
  }
  function mesh(g,w,images,pose,headOffset,sign,alpha){
    const d=description(w,pose,sign),image=images[d.part];if(!image?.naturalWidth||alpha<=0)return;
    const [x,y,width,height,footX,footY]=d.frame,mirror=d.mirror;
    const cols=8,vertices=[],source=[],walking=w.gait??(w.kind==='walk'?Math.min(1,w.speed/60):0),cycle=w.phase;
    const seat=pose==='sit',work=['work','sit'].includes(pose),idle=idleMotion(w),social=socialMotion(w),seatAmount=seat?1:pose==='half'?.5:0,shift=seatOffset(w,sign);
    const handPixels={princess:{sit:[140,510],work:[1100,397]},hank:{sit:[140,560],work:[1115,420]},anthony:{sit:[130,535],work:[1130,435]}},hp=handPixels[w.profile.asset][seat?'sit':'work'];
    const hx=(hp[0]-footX)*d.scale*mirror,hy=(hp[1]-footY)*d.scale,contact=w.targetStation?.contact;
    const floorY=seat?w.targetStation?.floorY:undefined,extension=w.profile.asset!=='hank'&&Number.isFinite(floorY)?Math.max(-28,floorY-w.y-shift[1]):0;
    const knots=seat&&extension?(w.profile.asset==='hank'?[735,755,810,815,875,890,900]:[685,750,790,805,815]):[];
    const rowY=[...new Set([...Array.from({length:19},(_,i)=>y+height*i/18),...knots.filter(v=>v>y&&v<y+height)])].sort((a,b)=>a-b),rows=rowY.length-1;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const sx=x+width*i/cols,sy=rowY[j],px=(sx-footX)*d.scale*mirror,py=(sy-footY)*d.scale,down=(py-d.top)/(-d.top),lower=smooth((down-(w.profile.asset==='hank'?.70:.56))/.44),side=Math.tanh(px/8),swing=Math.sin(cycle+side*Math.PI*.5)*walking;
      const step=IslandGait.sample(cycle,px<0?0:1,{stride:pose==='side'?Math.min(w.height*.22,Math.PI*2*.6/.055):w.height*.12,lift:w.height*.045,heading:pose==='side'?sign===1?0:Math.PI:Math.PI/2}),leg=IslandGait.deform(down,w.profile.asset==='hank'?.70:.57,.81,.92,step);
      let dx=leg.x*walking,dy=leg.y*walking;
      // Align whole poses during a transition; never stretch the neck, torso
      // or legs to make different sprite anchors coincide.
      const upper=1-smooth((down-.34)/.26);
      dx+=idle.sway*upper+headOffset.x;dy+=idle.breath*upper+headOffset.y;
      const headWeight=1-smooth((down-.23)/.13);dx-=(py-d.head.y)*social.turn*headWeight;dy+=((px-d.head.x)*social.turn+social.nod)*headWeight;
      if(pose==='front')for(const [side,amount]of [[-1,idle.left],[1,idle.right]]){
        const weight=influence(px,py,side*w.height*.13,-w.height*.41,w.height*.075,w.height*.105);
        dx+=side*amount*.3*weight;dy-=amount*weight;
      }
      // Seat docking moves the complete pose. Pinning the shoes while moving
      // the pelvis sideways was bending/shrinking both shins into diagonals.
      dx+=shift[0]*seatAmount;dy+=shift[1]*seatAmount;
      // Extend only the exposed shin, then translate each complete boot/shoe.
      // Pelvis, thighs, coat/skirt and the original shoe shapes stay anchored.
      // Move the ankle toward the desk with a continuous knee bend. Once past
      // the ankle the translation is constant, preserving both complete shoes.
      if(seat&&w.profile.asset==='hank'){dx-=55*d.scale*mirror*smooth((sy-760)/140);}
      if(extension){const rear=sx>245,start=w.profile.asset==='hank'?(rear?815:755):(rear?750:685),end=w.profile.asset==='hank'?(rear?890:875):(rear?805:790);dy+=extension*smooth((sy-start)/(end-start));}
      // Shared vertices deform the intact coat/skirt and both legs together.
      if(work){
        const weight=Math.exp(-((px-hx)**2/950+(py-hy)**2/650)),tx=contact?Math.max(-18,Math.min(18,contact[0]-w.x-hx-shift[0]*seatAmount)):0,ty=contact?Math.max(-20,Math.min(20,contact[1]-w.y-hy-shift[1]*seatAmount)):0;
        const workshop=w.key==='workshop',rate=w.kind==='toolWork'?3.8:2.1,active=.35+social.gesture*.65;
        dx+=weight*(tx+Math.sin(w.time*(workshop?rate:7.3))*(workshop?5*active:1));dy+=weight*(ty+Math.sin(w.time*(workshop?rate*1.3:9.7))*(workshop?5*active:1.2));
      }
      if(w.key==='workshop'&&(pose==='hold'||pose==='fold')){
        const centers=pose==='hold'?[[1310,368],[1400,340]]:[[770,360],[840,340]];
        for(let hand=0;hand<2;hand++){
          const [sx,sy]=centers[hand],hx=(sx-footX)*d.scale*mirror,hy=(sy-footY)*d.scale;
          const weight=influence(px,py,hx,hy,w.height*.09,w.height*.10),gesture=social.gesture*(pose==='fold'?.3:1),phase=w.time*2.5+(w.idleSeed||0)+hand*2;
          dx+=Math.sin(phase)*gesture*6*weight;dy-=Math.cos(phase*.9)*gesture*5*weight;
        }
      }
      if(pose==='scratch'){const side=w.profile.asset==='anthony'?-sign:sign,weight=Math.exp(-((px-side*w.height*.16)**2/1200+(py+w.height*.82)**2/1000));dx+=weight*(Math.sin(w.time*6)*2.5+(w.kind==='glasses'?sign*7:0));dy+=weight*(w.kind==='glasses'?12:Math.sin(w.time*5)*1.4);}
      if(walking&&d.part==='views'){const arm=Math.exp(-((Math.abs(px)-w.height*.15)**2/900+(py+w.height*.40)**2/1800)),phase=cycle+(px<0?Math.PI:0);dx+=Math.sin(phase)*arm*5*walking;dy+=Math.cos(phase)*arm*2.5*walking;}
      if(pose==='hold'&&w.prop&&w.prop.location!=='hands'){const h=hand(w),p=w.prop,t=p.progress||0,tx=p.home.x+(h.x-p.home.x)*t-h.x,ty=p.home.y+(h.y-p.home.y)*t-Math.sin(t*Math.PI)*12-h.y,weight=Math.exp(-((px-sign*29)**2/1400+(py+w.height*.62)**2/1000));dx+=weight*Math.max(-65,Math.min(65,tx));dy+=weight*Math.max(-60,Math.min(60,ty));}
      if(w.kind==='stretch'){dx+=px*.035*Math.sin(w.elapsed*1.2)*(1-down);dy-=Math.sin(w.elapsed*1.2)*3*(1-down);}
      if(w.kind==='nod'||w.kind==='seatedLook'||w.kind==='glasses'){dy+=Math.sin(w.elapsed*2.1)*2.3*(1-smooth(down/.4));}
      if(w.kind==='look'||w.kind==='seatedLook'){const weight=1-smooth(down/.36),angle=Math.sin(w.elapsed*1.1)*.035,cx=(x+width/2-footX)*d.scale*mirror,cy=d.top+height*d.scale*.15;dx-=(py-cy)*angle*weight;dy+=(px-cx)*angle*weight;}
      if(w.kind==='reach'||w.kind==='sort'){dx+=sign*Math.sin(w.elapsed*1.7)*3.5*(1-down);}
      source.push({x:sx,y:sy});vertices.push({x:px+dx,y:py+dy});
    }
    g.save();g.globalAlpha=alpha;
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;triangle(g,image,[source[a],source[b],source[d]],[vertices[a],vertices[b],vertices[d]]);triangle(g,image,[source[a],source[d],source[c]],[vertices[a],vertices[d],vertices[c]]);}
    g.restore();
  }
  function prop(g,w,p){
    if(!p||p.location==='table'&&p.hiddenAtRest)return;const h=hand(w),progress=p.location==='hands'?1:p.progress||0,x=p.home.x+(h.x-p.home.x)*progress,y=p.home.y+(h.y-p.home.y)*progress-Math.sin(progress*Math.PI)*12;
    const right=p.home.x>900,tableSlope=right?.30:-.25;
    g.save();g.translate(x,y);g.rotate(Math.sin(w.time*.8)*.025*progress);g.transform(1,tableSlope+(.12-tableSlope)*progress,(right?-.6:.55)*(1-progress),.28+.37*progress,0,0);
    if(p.kind==='clipboard'){g.fillStyle='#734c32';g.fillRect(-20,-15,40,30);g.fillStyle='#f5eedc';g.fillRect(-17,-12,34,25);g.fillStyle='#858e87';g.fillRect(-6,-17,12,5);g.strokeStyle='#718c7c';g.lineWidth=1;for(let i=0;i<3;i++){g.strokeRect(-13,-7+i*7,3,3);g.beginPath();g.moveTo(-6,-5+i*7);g.lineTo(13,-5+i*7);g.stroke();}}
    else if(p.kind==='tablet'){g.fillStyle='#394b51';g.beginPath();g.roundRect(-25,-17,50,34,4);g.fill();g.fillStyle='#103b45';g.fillRect(-21,-13,42,26);g.strokeStyle='#7ee2c6';g.lineWidth=1.5;g.beginPath();for(let i=0;i<35;i++){const y=Math.sin(i*.62)*6;i?g.lineTo(i-17,y):g.moveTo(i-17,y);}g.stroke();}
    else{g.fillStyle=p.kind==='tray'?'#a78a51':'#236a46';g.fillRect(-23,-16,46,32);g.fillStyle='#267a50';g.fillRect(-20,-13,40,26);g.strokeStyle='#c9ce7b';g.lineWidth=1;for(let i=0;i<5;i++){g.beginPath();g.moveTo(-18,-10+i*5);g.lineTo(15,-10+i*5);g.stroke();}g.fillStyle='#263639';g.fillRect(-7,-8,14,16);g.fillStyle='#dcd9bb';for(let i=0;i<3;i++){g.fillRect(-17+i*13,9,5,3);g.fillRect(-18+i*14,-12,5,3);}}
    g.restore();
  }
  function draw(g,w,images,fallback){
    if(w.pose==='sit'&&window.IslandRoomSeating?.handles(w.key)){IslandRoomSeating.drawOccupied(g,w);return;}
    const seated=w.pose==='sit',shadowShift=seated?seatOffset(w):[0,0],shadowY=seated?(w.targetStation?.floorY??w.y+shadowShift[1]):w.y;
    g.save();g.fillStyle='#49342626';g.beginPath();g.ellipse(w.x+shadowShift[0],shadowY+2,29,8,0,0,Math.PI*2);g.fill();g.restore();
    if(!images?.seats||!images?.gestures||!images?.views){
      if(fallback?.naturalWidth){const [x,y,width,height,footX,footY]=bounds[w.profile.asset].seats[2],s=w.height/height;g.save();g.translate(w.x,w.y);g.scale(Math.cos(w.heading)<0?1:-1,1);g.drawImage(fallback,x,y,width,height,(x-footX)*s,(y-footY)*s,width*s,height*s);g.restore();}return;
    }
    let cache=caches.get(w);if(!cache){const make=()=>{const c=document.createElement('canvas');c.width=880;c.height=960;return c;};cache={layer:make(),a:make(),b:make(),time:-1};caches.set(w,cache);}
    const key=[w.pose,w.previousPose,w.poseSign,w.previousSign,w.station,w.x,w.y,w.height,w.idleSeed].join(':');
    if(cache.key!==key||w.time-cache.time>=1/24||w.time<cache.time){
      cache.key=key;cache.time=w.time;const ctx=cache.layer.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,880,960);
      const t=smooth(w.blend),sign=w.poseSign||(Math.cos(w.heading)<0?-1:1),a=description(w,w.previousPose,w.previousSign||sign),b=description(w,w.pose,sign),head={x:a.head.x+(b.head.x-a.head.x)*t,y:a.head.y+(b.head.y-a.head.y)*t};
      // Rasterize each intact mesh with source-over first. Adding triangles
      // directly would brighten every shared edge into a visible white grid.
      const paint=(layer,pose,offset,sign)=>{const p=layer.getContext('2d');p.setTransform(1,0,0,1,0,0);p.clearRect(0,0,880,960);p.setTransform(2,0,0,2,440,860);p.globalCompositeOperation='source-over';mesh(p,w,images,pose,offset,sign,1);};
      if(t<1){paint(cache.a,w.previousPose,{x:head.x-a.head.x,y:head.y-a.head.y},w.previousSign||sign);ctx.globalAlpha=1-t;ctx.drawImage(cache.a,0,0);ctx.globalCompositeOperation='lighter';}
      paint(cache.b,w.pose,{x:head.x-b.head.x,y:head.y-b.head.y},sign);ctx.globalAlpha=t;ctx.drawImage(cache.b,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    }
    g.drawImage(cache.layer,0,0,880,960,w.x-220,w.y-430,440,480);
    if(w.key==='workshop'&&w.kind==='toolWork'){
      const d=description(w,'work',w.poseSign),social=socialMotion(w),active=.35+social.gesture*.65;
      const x=w.x+(1115-d.frame[4])*d.scale*d.mirror,y=w.y+(420-d.frame[5])*d.scale,contact=w.targetStation.contact;
      const hx=x+Math.max(-18,Math.min(18,contact[0]-x))+Math.sin(w.time*3.8)*5*active;
      const hy=y+Math.max(-20,Math.min(20,contact[1]-y))+Math.sin(w.time*3.8*1.3)*5*active;
      g.save();g.lineCap='round';g.strokeStyle='#46575b';g.lineWidth=4;g.beginPath();g.moveTo(hx+3,hy-3);g.lineTo(hx-8,hy+4);g.stroke();g.strokeStyle='#c6c9bf';g.lineWidth=1.6;g.beginPath();g.moveTo(hx-8,hy+4);g.lineTo(hx-18,hy+12);g.stroke();g.restore();
    }
  }
  window.IslandNPCRenderer=Object.freeze({draw,drawSeated,idleMotion,socialMotion,hand,bounds,poses,seatOffset});
})();
