(() => {
  'use strict';
  // Clean isolated pieces, with overlap beyond each bind joint. No rectangles
  // sampled across neighbouring limbs and no generated replacement face.
  const rows=[
    {body:[83,17,185,325],upper:[392,56,90,260],upperBind:[[437,77],[437,303]],lower:[622,54,83,283],lowerBind:[[664,73],[664,275]],thigh:[931,156,79,161],thighBind:[[969,168],[969,305]],shin:[1122,54,96,264],shinBind:[[1170,69],[1170,303]],shoe:[1321,229,172,109],shoeAnchor:[1374,250]},
    {body:[84,358,183,304],upper:[395,393,92,247],upperBind:[[441,413],[441,626]],lower:[624,396,81,260],lowerBind:[[665,413],[665,603]],thigh:[934,483,79,159],thighBind:[[973,495],[973,629]],shin:[1130,392,96,253],shinBind:[[1178,408],[1178,630]],shoe:[1340,543,118,113],shoeAnchor:[1400,560]},
    {body:[85,677,159,319],upper:[391,712,90,255],upperBind:[[436,733],[436,953]],lower:[618,713,88,266],lowerBind:[[662,734],[662,926]],thigh:[871,807,99,175],thighBind:[[921,821],[921,970]],shin:[1124,709,95,262],shinBind:[[1172,724],[1172,956]],shoe:[1309,880,190,101],shoeAnchor:[1374,902]}
  ];
  const heads=[
    {rect:[148,8,144,176],anchor:[220,181]},
    {rect:[468,9,151,174],anchor:[549,180]},
    {rect:[834,10,150,172],anchor:[915,179]},
    {rect:[1150,12,155,164],anchor:[1216,174]},
    {rect:[145,551,139,142],anchor:[219,693]},
    {rect:[505,551,144,145],anchor:[565,698]},
    {rect:[826,550,154,154],anchor:[904,705]},
    {rect:[1171,550,153,164],anchor:[1244,714]}
  ];
  const caches=new WeakMap();
  function bind(g,image,region,sourceA,sourceB,a,b,width,mirror=1){
    const angle=Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2,length=Math.hypot(b.x-a.x,b.y-a.y),sourceLength=sourceB[1]-sourceA[1];
    g.save();g.translate(a.x,a.y);g.rotate(angle);g.scale(mirror*width/region[2],Math.max(.04,length/sourceLength));
    g.drawImage(image,...region,region[0]-sourceA[0],region[1]-sourceA[1],region[2],region[3]);g.restore();
  }
  function triangle(g,image,s,d){
    const [a,b,c]=s,[p,q,r]=d,den=a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y);if(Math.abs(den)<.01)return;
    const coefficient=(u,v,w)=>[(u*(b.y-c.y)+v*(c.y-a.y)+w*(a.y-b.y))/den,(u*(c.x-b.x)+v*(a.x-c.x)+w*(b.x-a.x))/den,(u*(b.x*c.y-c.x*b.y)+v*(c.x*a.y-a.x*c.y)+w*(a.x*b.y-b.x*a.y))/den];
    const x=coefficient(p.x,q.x,r.x),y=coefficient(p.y,q.y,r.y);g.save();g.beginPath();d.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.clip();g.transform(x[0],y[0],x[1],y[1],x[2],y[2]);g.drawImage(image,0,0);g.restore();
  }
  function draw(g,w,images,r){
    const {h,project:p,joints:j}=r,cos=Math.cos(r.yaw),sin=Math.sin(r.yaw),isSide=Math.abs(sin)>.84;
    const row=isSide?2:cos>0?0:1,skin=rows[row],mirror=isSide?(sin>0?-1:1):1;
    const limbs=[...r.limbs].sort((a,b)=>p(a.hip).depth-p(b.hip).depth);
    g.save();g.fillStyle='#49342622';g.beginPath();g.ellipse(r.root[0],r.root[1]+2,h*.085,h*.02,0,0,Math.PI*2);g.fill();
    const leg=l=>{
      bind(g,images.skin,skin.thigh,...skin.thighBind,p(l.hip),p(l.knee),h*.078,mirror);
      bind(g,images.skin,skin.shin,...skin.shinBind,p(l.knee),p(l.ankle),h*.065,mirror);
      const ankle=p(l.ankle),shoe=skin.shoe,scale=h*.12/shoe[2],flip=isSide?(sin>0?1:-1):l.side;
      g.save();g.translate(ankle.x,ankle.y);g.scale(flip,1);g.drawImage(images.skin,...shoe,(shoe[0]-skin.shoeAnchor[0])*scale,(shoe[1]-skin.shoeAnchor[1])*scale-h*.008,shoe[2]*scale,shoe[3]*scale);g.restore();
    };
    const arm=l=>{
      bind(g,images.skin,skin.upper,...skin.upperBind,p(l.shoulder),p(l.elbow),h*.068,mirror);
      bind(g,images.skin,skin.lower,...skin.lowerBind,p(l.elbow),p(l.hand),h*.062,mirror);
    };
    limbs.forEach(leg);arm(limbs[0]);
    // Use clean front/back torso even in profile: the generated side torso
    // contains an attached sleeve, which must never become a stationary arm.
    const torso=rows[cos>0?0:1].body,top=p(j.neck),tail0=p(j.tail0),tail1=p(j.tail1),bottom={x:(tail0.x+tail1.x)/2,y:(tail0.y+tail1.y)/2};
    const width=h*(.17+.075*Math.abs(cos)),sway=Math.sin(w.time*1.6)*h*.0015;
    const source=[{x:torso[0],y:torso[1]},{x:torso[0]+torso[2],y:torso[1]},{x:torso[0]+torso[2],y:torso[1]+torso[3]},{x:torso[0],y:torso[1]+torso[3]}];
    const dest=[{x:top.x-width/2,y:top.y-h*.007},{x:top.x+width/2,y:top.y-h*.007},{x:bottom.x+width/2+sway,y:bottom.y},{x:bottom.x-width/2+sway,y:bottom.y}];
    triangle(g,images.skin,[source[0],source[1],source[2]],[dest[0],dest[1],dest[2]]);triangle(g,images.skin,[source[0],source[2],source[3]],[dest[0],dest[2],dest[3]]);
    arm(limbs[1]);
    // Eight original views: exactly ONE face at a time. Angular hysteresis
    // prevents direction flicker around a boundary without double exposures.
    let cache=caches.get(w);if(!cache){cache={head:Math.round(-r.yaw/(Math.PI/4))};caches.set(w,cache);}
    const wanted=-r.yaw,centre=cache.head*Math.PI/4,error=Math.atan2(Math.sin(wanted-centre),Math.cos(wanted-centre));
    if(Math.abs(error)>.47)cache.head+=Math.sign(error);
    const head=heads[(cache.head%8+8)%8],scale=h/500;
    g.save();g.translate(top.x,top.y);g.rotate(r.look);g.scale(scale,scale);
    // The original eight-view sheet wears a dark suit. Mask its collar below
    // the neck so it cannot appear as black triangles over the lab coat.
    const [x,y,headWidth,headHeight]=head.rect,ax=head.anchor[0],ay=head.anchor[1],headBottom=y+headHeight;
    g.beginPath();g.moveTo(x-ax,y-ay);g.lineTo(x+headWidth-ax,y-ay);g.lineTo(x+headWidth-ax,headBottom-ay-18);g.lineTo(14,headBottom-ay);g.lineTo(-14,headBottom-ay);g.lineTo(x-ax,headBottom-ay-18);g.closePath();g.clip();
    g.drawImage(images.identity,...head.rect,x-ax,y-ay,headWidth,headHeight);g.restore();g.restore();
    cache.row=row;return true;
  }
  window.IslandHankSkin=Object.freeze({draw,rows,heads});
})();
