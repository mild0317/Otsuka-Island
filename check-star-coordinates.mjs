import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context=vm.createContext({console,Date,Math});
for(const file of ['assets/star-catalog-v88.js','assets/vendor/astronomy.browser.min.js','star-map.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const {IslandStarMap}=context,map=new IslandStarMap();
const ref=JSON.parse(fs.readFileSync('scripts/fixtures/star-usno-taipei.json','utf8'));
assert.equal(map.stars.length,41411);
assert(Math.abs(map.latitude-ref.latitude)<1e-10&&Math.abs(map.longitude-ref.longitude)<1e-10,'The requested DMS observer matches the reference location');
assert(Math.abs(IslandStarMap.sidereal(2451545)-280.460623)<.00001,'J2000 Greenwich sidereal angle');
assert.equal(map.utc({day:Math.floor(Date.parse('2026-10-28')/86400000),hour:22}),Date.parse(ref.utc),'Taiwan local date converts to UTC');
let worst=0;
for(const expected of ref.stars){
  const star=map.stars.find(s=>s.id===expected.hip);assert(star,expected.name);
  const actual=map.horizontal(star.ra,star.dec,Date.parse(ref.utc));
  const altitudeError=Math.abs(actual.altitude-expected.altitude),azimuthError=Math.abs(((actual.azimuth-expected.azimuth+540)%360)-180);
  const angularError=Math.hypot(altitudeError,azimuthError*Math.cos(expected.altitude*Math.PI/180));
  worst=Math.max(worst,angularError);
  assert(angularError<.02,expected.name+' matches USNO within 0.02 angular degrees '+JSON.stringify({actual,expected}));
}
console.log('PASS',ref.stars.length,'independent USNO star positions; max sky angular error',worst.toFixed(5),'degrees');
const utc=Date.parse(ref.utc),polaris=map.stars.find(s=>s.id===11767);
for(let h=0;h<24;h++){
  const p=map.horizontal(polaris.ra,polaris.dec,utc+h*3600000);
  assert(Math.abs(p.altitude-map.latitude)<1,'Polaris remains near Taipei latitude');
}
const angleDiff=(a,b)=>Math.abs(((a-b+540)%360)-180),jd=utc/86400000+2440587.5;
assert(angleDiff(IslandStarMap.sidereal(jd+1),IslandStarMap.sidereal(jd))>.98,'Same clock hour on the next day shifts by about one degree');
assert(angleDiff(IslandStarMap.sidereal(jd+86164.09/86400),IslandStarMap.sidereal(jd))<.001,'Stars return after a sidereal day');
const view={width:1440,height:1000,camera:{x:562.5,y:1004.5},baseScale:1,lighting:{day:Math.floor(Date.parse('2026-10-28')/86400000),hour:22}};
const f=map.frame(view),degrees=180/Math.PI;
const along=angle=>f.forward.map((n,i)=>n*Math.cos(angle*Math.PI/180)+f.right[i]*Math.sin(angle*Math.PI/180));
const origin=map.project(along(0),f,false);assert(origin&&Math.hypot(origin.x-f.cx,origin.y-f.cy)<1e-8,'Sky camera is centred');
for(const angle of [-60,-30,0,30,60]){
  const p=map.project(along(angle-.001),f,false),q=map.project(along(angle+.001),f,false);
  const gain=Math.hypot(q.x-p.x,q.y-p.y)/(f.focal*.002*Math.PI/180);
  assert(gain>.85&&gain<1.00001,'Optical projection has bounded foreshortening and never enlarges the edges');
}
const pole=map.project(IslandStarMap.vector(0,90),f);
assert(pole===null,'Celestial rotation pole is outside the local sky view');
const at=hour=>({...view,lighting:{...view.lighting,hour}}),early=new Map(map.visible(at(21),4.6).map(s=>[s.id,s])),late=new Map(map.visible(at(23),4.6).map(s=>[s.id,s]));
const previousFrame=v=>({...map.frame(v),focal:Math.max(v.width,v.height)*.9});
const previousEarly=new Set(map.visible(at(21),4.6,previousFrame(at(21))).map(s=>s.id)),previousLate=new Set(map.visible(at(23),4.6,previousFrame(at(23))).map(s=>s.id));
const previousMiddle=new Set(map.visible(at(22),4.6,previousFrame(at(22))).map(s=>s.id));
const curves=map.visible(at(22),4.6).filter(s=>early.has(s.id)&&late.has(s.id)&&previousEarly.has(s.id)&&previousLate.has(s.id)&&previousMiddle.has(s.id)).map(q=>{
  const p=early.get(q.id),r=late.get(q.id),dx=r.x-p.x,dy=r.y-p.y;
  const sag=Math.abs(dx*(p.y-q.y)-(p.x-q.x)*dy)/Math.hypot(dx,dy);
  const cross=2*((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x));
  const ux=((q.x-p.x)**2+(q.y-p.y)**2)*(r.y-p.y)-((r.x-p.x)**2+(r.y-p.y)**2)*(q.y-p.y);
  const uy=(q.x-p.x)*((r.x-p.x)**2+(r.y-p.y)**2)-(r.x-p.x)*((q.x-p.x)**2+(q.y-p.y)**2);
  const x=p.x+ux/cross,y=p.y+uy/cross;
  return {sag,radius:Math.hypot(q.x-x,q.y-y),outside:x<0||x>view.width||y<0||y>view.height};
});
assert(curves.length>10&&curves.every(p=>p.sag>1&&p.radius>f.focal*2&&p.outside),'Real stars follow broad curved tracks whose local centres lie outside the frame');
console.log('PASS broad stellar arcs, offscreen turning centres and bounded edge scale',JSON.stringify({samples:curves.length,minRadius:Math.min(...curves.map(p=>p.radius)),sag:[Math.min(...curves.map(p=>p.sag)),Math.max(...curves.map(p=>p.sag))]}));
for(const [width,height] of [[1440,1000],[390,844],[3840,2160]]){
  const wideView={...view,width,height},wide=map.frame(wideView),narrow={...wide,focal:Math.max(width,height)*.455};
  const oldStars=map.visible(wideView,4.6,narrow),newStars=map.visible(wideView,4.6,wide);
  const allStars=map.visible(wideView).filter(s=>s.x>=0&&s.x<=width&&s.y>=height*.2&&s.y<=height*.5);
  assert(allStars.filter(s=>s.x<width*.03).length>2&&allStars.filter(s=>s.x>width*.97).length>2,'Real stars reach both outer sky edges without an inset globe boundary');
  const figures=frame=>map.constellations.filter(c=>{const points=c.paths.flat();return points.length&&points.filter(p=>map.project(p,frame)).length>=points.length*.75;}).length;
  assert(newStars.length>oldStars.length,'Wider view reveals more catalogue stars');
  assert(figures(wide)>=figures(narrow)+3,'Wider view reveals more mostly complete constellation figures');
  assert(wide.focal/narrow.focal<.73,'Constellation geometry is at least 27 percent smaller than V98');
  const reference=oldStars.slice(0,10).map(s=>({star:s.v,old:map.project(s.v,narrow,false)}));
  for(const {star,old} of reference){const p=map.project(star,wide,false),ratio=wide.focal/narrow.focal;
    assert(Math.abs(p.x-wide.cx-(old.x-narrow.cx)*ratio)<1e-8&&Math.abs(p.y-wide.cy-(old.y-narrow.cy)*ratio)<1e-8,'Zoom preserves spherical geometry and relative placement');
  }
  console.log('PASS wider field and smaller constellation figures',JSON.stringify({width,height,oldStars:oldStars.length,newStars:newStars.length,oldFigures:figures(narrow),newFigures:figures(wide),scale:wide.focal/narrow.focal}));
}
const normal=map.visible(view),tomorrow=map.visible({...view,lighting:{...view.lighting,day:view.lighting.day+1}}),byId=new Map(tomorrow.map(s=>[s.id,s]));
assert(normal.length>1000&&normal.every(s=>s.altitude>0),'Only above-horizon stars are projected');
assert(normal.some(s=>byId.has(s.id)&&Math.hypot(s.x-byId.get(s.id).x,s.y-byId.get(s.id).y)>2),'Each night changes the view continuously');
const before=map.visible({...view,lighting:{...view.lighting,hour:23,minute:59,second:59.9}}),after=map.visible({...view,lighting:{...view.lighting,day:view.lighting.day+1,hour:0,minute:0,second:.1}}),next=new Map(after.map(s=>[s.id,s]));
assert(Math.max(...before.filter(s=>next.has(s.id)).map(s=>Math.hypot(s.x-next.get(s.id).x,s.y-next.get(s.id).y)))<.1,'No midnight jump in the closer camera');
console.log('PASS sidereal motion, seasonal clock, above-horizon clipping, Polaris altitude and midnight continuity');
const bodies=JSON.parse(fs.readFileSync('scripts/fixtures/sun-moon-usno-taipei.json','utf8'));
for(const sample of bodies.samples){
  const d=new Date(Date.parse(sample.utc)+8*3600000);
  const v={...view,lighting:{day:Math.floor(d.getTime()/86400000),hour:d.getUTCHours(),minute:d.getUTCMinutes(),second:d.getUTCSeconds()}};
  const p=map.body(sample.body,v);
  assert(Math.abs(p.altitude-sample.altitude)<.02&&angleDiff(p.azimuth,sample.azimuth)<.02,sample.body+' agrees with independent USNO position '+JSON.stringify({p,sample}));
  const same=map.projectHorizontal(p.altitude,p.azimuth,map.frame(v));
  assert(same&&Math.hypot(same.x-p.x,same.y-p.y)<.00001,sample.body+' shares the star-map camera');
  for(const azimuth of [0,90,180,270]){
    map.configure({azimuth});const q=map.body(sample.body,v);
    assert(map.azimuth===150&&q.altitude===p.altitude&&q.azimuth===p.azimuth,'The sky direction remains fixed');
  }
}
console.log('PASS requested observer, Sun/Moon reference positions and fixed viewing direction');
