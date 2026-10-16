(() => {
  'use strict';
  // Alpha bounds measured from the delivered PNGs. No pixel reads at runtime,
  // so local file previews and GitHub Pages use exactly the same sprites.
  const bounds={
    anthony:{gestures:[[114,16,398,961,340,977],[634,15,310,964,779,979],[1121,18,318,962,1266,980]],seats:[[129,205,383,716,400,921],[512,134,416,800,825,934],[1133,30,355,914,1260,944]],views:[[173,17,318,963,335,980],[640,18,316,952,802,970],[1113,19,245,958,1241,977]]},
    hank:{gestures:[[115,33,355,949,300,982],[622,35,318,947,782,982],[1126,43,327,942,1313,985]],seats:[[80,232,389,725,240,957],[563,149,400,815,801,964],[1042,29,392,942,1297,971]],views:[[119,33,315,945,286,978],[642,35,300,945,803,980],[1156,33,266,950,1276,983]]},
    princess:{gestures:[[125,34,362,921,277,955],[633,31,318,925,739,956],[1073,34,363,923,1233,957]],seats:[[98,165,368,795,214,960],[613,95,320,861,760,956],[1026,17,380,942,1262,959]],views:[[190,16,318,963,348,979],[645,20,326,961,824,981],[1102,15,270,969,1266,984]]}
  };
  const poses={sit:['seats',0],half:['seats',1],work:['seats',2],scratch:['gestures',0],fold:['gestures',1],hold:['gestures',2],front:['views',0],back:['views',1],side:['views',2]};
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const caches=new WeakMap();
  function description(w,pose){const [part,index]=poses[pose]||poses.front,frames=bounds[w.profile.asset][part],frame=frames[index],reference=part==='seats'?frames[2][3]:frames[1][3];return {part,index,frame,scale:w.height/reference,top:-frame[3]*w.height/reference};}
  function hand(w){const base=w.profile.asset==='anthony'?1:-1,current=w.poseSign||(Math.cos(w.heading)<0?-1:1),old=w.previousSign||current,sign=old+(current-old)*smooth(w.blend);return {x:w.x+sign*29,y:w.y-w.height*.62+Math.sin(w.time*1.7)*.6,base,sign};}
  function triangle(g,image,s,d){
    const [a,b,c]=s,[p,q,r]=d,den=a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y);if(Math.abs(den)<.001)return;
    const coefficient=(v1,v2,v3)=>[(v1*(b.y-c.y)+v2*(c.y-a.y)+v3*(a.y-b.y))/den,(v1*(c.x-b.x)+v2*(a.x-c.x)+v3*(b.x-a.x))/den,(v1*(b.x*c.y-c.x*b.y)+v2*(c.x*a.y-a.x*c.y)+v3*(a.x*b.y-b.x*a.y))/den];
    const xx=coefficient(p.x,q.x,r.x),yy=coefficient(p.y,q.y,r.y),cx=(p.x+q.x+r.x)/3,cy=(p.y+q.y+r.y)/3;
    g.save();g.beginPath();for(let i=0;i<3;i++){const v=d[i],dx=v.x-cx,dy=v.y-cy,l=Math.hypot(dx,dy)||1,x=v.x+dx/l*.35,y=v.y+dy/l*.35;i?g.lineTo(x,y):g.moveTo(x,y);}g.closePath();g.clip();g.transform(xx[0],yy[0],xx[1],yy[1],xx[2],yy[2]);
    const sx=Math.max(0,Math.min(a.x,b.x,c.x)-4),sy=Math.max(0,Math.min(a.y,b.y,c.y)-4),sw=Math.min(image.naturalWidth,Math.max(a.x,b.x,c.x)+4)-sx,sh=Math.min(image.naturalHeight,Math.max(a.y,b.y,c.y)+4)-sy;
    g.drawImage(image,sx,sy,sw,sh,sx,sy,sw,sh);g.restore();
  }
  function mesh(g,w,images,pose,headOffset,sign,alpha){
    const d=description(w,pose),image=images[d.part];if(!image?.naturalWidth||alpha<=0)return;
    const [x,y,width,height,footX,footY]=d.frame,base=d.part==='views'?(pose==='side'&&w.profile.asset==='hank'?-1:1):w.profile.asset==='anthony'?1:-1,mirror=base===sign?1:-1;
    const cols=8,rows=18,vertices=[],source=[],walking=w.kind==='walk'?Math.min(1,w.speed/60):0,cycle=w.phase;
    const seat=pose==='sit',work=['work','sit'].includes(pose),breath=Math.sin(w.time*1.8)*.8,seatAmount=seat?1:pose==='half'?.5:0,shift=w.targetStation?.seatShift||[0,0];
    const handPixels={princess:{sit:[173,520],work:[1090,430]},hank:{sit:[160,565],work:[1122,365]},anthony:{sit:[415,555],work:[1420,405]}},hp=handPixels[w.profile.asset][seat?'sit':'work'];
    const hx=(hp[0]-footX)*d.scale*mirror,hy=(hp[1]-footY)*d.scale,contact=w.targetStation?.contact;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const sx=x+width*i/cols,sy=y+height*j/rows,px=(sx-footX)*d.scale*mirror,py=(sy-footY)*d.scale,down=(py-d.top)/(-d.top),lower=smooth((down-(w.profile.asset==='hank'?.70:.56))/.44),side=Math.tanh(px/8),swing=Math.sin(cycle+side*Math.PI*.5)*walking;
      let dx=lower*swing*(pose==='side'?12:6),dy=-lower*Math.max(0,swing)*10;
      dx+=Math.sin(w.time*.7)*1.1*(1-down);dy+=breath*(1-down)+headOffset*(1-smooth((down-.3)/.7));
      const seatWeight=1-smooth((down-.68)/.32);dx+=shift[0]*seatAmount*seatWeight;dy+=shift[1]*seatAmount*seatWeight;
      // Shared vertices deform the intact coat/skirt and both legs together.
      if(work){const weight=Math.exp(-((px-hx)**2/1700+(py-hy)**2/1100)),tx=contact?Math.max(-65,Math.min(65,contact[0]-w.x-hx-shift[0]*seatAmount)):0,ty=contact?Math.max(-60,Math.min(60,contact[1]-w.y-hy-shift[1]*seatAmount)):0;dx+=weight*(tx+Math.sin(w.time*7.3)*1.3);dy+=weight*(ty+Math.sin(w.time*9.7)*1.8);}
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
    if(!p)return;const h=hand(w),progress=p.location==='hands'?1:p.progress||0,x=p.home.x+(h.x-p.home.x)*progress,y=p.home.y+(h.y-p.home.y)*progress-Math.sin(progress*Math.PI)*12;
    const right=p.home.x>900,tableSlope=right?.30:-.25;
    g.save();g.translate(x,y);g.rotate(Math.sin(w.time*.8)*.025*progress);g.transform(1,tableSlope+(.12-tableSlope)*progress,(right?-.6:.55)*(1-progress),.28+.37*progress,0,0);
    if(p.kind==='clipboard'){g.fillStyle='#734c32';g.fillRect(-20,-15,40,30);g.fillStyle='#f5eedc';g.fillRect(-17,-12,34,25);g.fillStyle='#858e87';g.fillRect(-6,-17,12,5);g.strokeStyle='#718c7c';g.lineWidth=1;for(let i=0;i<3;i++){g.strokeRect(-13,-7+i*7,3,3);g.beginPath();g.moveTo(-6,-5+i*7);g.lineTo(13,-5+i*7);g.stroke();}}
    else if(p.kind==='tablet'){g.fillStyle='#394b51';g.beginPath();g.roundRect(-25,-17,50,34,4);g.fill();g.fillStyle='#103b45';g.fillRect(-21,-13,42,26);g.strokeStyle='#7ee2c6';g.lineWidth=1.5;g.beginPath();for(let i=0;i<35;i++){const y=Math.sin(i*.62)*6;i?g.lineTo(i-17,y):g.moveTo(i-17,y);}g.stroke();}
    else{g.fillStyle=p.kind==='tray'?'#a78a51':'#236a46';g.fillRect(-23,-16,46,32);g.fillStyle='#267a50';g.fillRect(-20,-13,40,26);g.strokeStyle='#c9ce7b';g.lineWidth=1;for(let i=0;i<5;i++){g.beginPath();g.moveTo(-18,-10+i*5);g.lineTo(15,-10+i*5);g.stroke();}g.fillStyle='#263639';g.fillRect(-7,-8,14,16);g.fillStyle='#dcd9bb';for(let i=0;i<3;i++){g.fillRect(-17+i*13,9,5,3);g.fillRect(-18+i*14,-12,5,3);}}
    g.restore();
  }
  function draw(g,w,images,fallback){
    g.save();g.fillStyle='#49342626';g.beginPath();g.ellipse(w.x,w.y+2,29,8,0,0,Math.PI*2);g.fill();g.restore();
    if(!images?.seats||!images?.gestures||!images?.views){
      const old=IslandRoomWorld.coworkers[w.key];if(fallback?.naturalWidth){const [x,y,width,height]=old.frames[0],s=w.height/height;g.drawImage(fallback,x,y,width,height,w.x-width*s/2,w.y-w.height,width*s,w.height);}return;
    }
    let cache=caches.get(w);if(!cache){const make=()=>{const c=document.createElement('canvas');c.width=880;c.height=960;return c;};cache={layer:make(),a:make(),b:make(),time:-1};caches.set(w,cache);}
    if(w.time-cache.time>=1/24||w.time<cache.time){
      cache.time=w.time;const ctx=cache.layer.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,880,960);
      const t=smooth(w.blend),a=description(w,w.previousPose),b=description(w,w.pose),sy=w.targetStation?.seatShift?.[1]||0,offset=pose=>pose==='sit'?sy:pose==='half'?sy*.5:0,ay=a.top+offset(w.previousPose),by=b.top+offset(w.pose),head=ay+(by-ay)*t;
      // Rasterize each intact mesh with source-over first. Adding triangles
      // directly would brighten every shared edge into a visible white grid.
      const paint=(layer,pose,offset,sign)=>{const p=layer.getContext('2d');p.setTransform(1,0,0,1,0,0);p.clearRect(0,0,880,960);p.setTransform(2,0,0,2,440,860);p.globalCompositeOperation='source-over';mesh(p,w,images,pose,offset,sign,1);};
      const sign=w.poseSign||(Math.cos(w.heading)<0?-1:1);
      if(t<1){paint(cache.a,w.previousPose,head-ay,w.previousSign||sign);ctx.globalAlpha=1-t;ctx.drawImage(cache.a,0,0);ctx.globalCompositeOperation='lighter';}
      paint(cache.b,w.pose,head-by,sign);ctx.globalAlpha=t;ctx.drawImage(cache.b,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    }
    for(const item of w.items||[])if(item!==w.prop)prop(g,w,item);
    g.drawImage(cache.layer,0,0,880,960,w.x-220,w.y-430,440,480);prop(g,w,w.prop);
  }
  window.IslandNPCRenderer=Object.freeze({draw,hand,bounds,poses});
})();
