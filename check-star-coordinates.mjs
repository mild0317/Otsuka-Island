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
const f=map.frame(view),left=map.projectHorizontal(map.elevation,map.azimuth-20,f),right=map.projectHorizontal(map.elevation,map.azimuth+20,f);
assert(f.cx===view.width/2&&Math.abs((left.x+right.x)/2-f.cx)<1e-8&&Math.abs(left.y-right.y)<1e-8,'The camera has a centred, symmetric projection');
const travel=az=>{const p=map.projectHorizontal(map.elevation,az-.001,f),q=map.projectHorizontal(map.elevation,az+.001,f);return Math.hypot(q.x-p.x,q.y-p.y);};
assert(Math.abs(travel(map.azimuth-20)-travel(map.azimuth+20))<1e-8,'Equivalent left/right angular movement has the same projection scale');
console.log('PASS centred optical axis and equal projection scale on both sides');
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
