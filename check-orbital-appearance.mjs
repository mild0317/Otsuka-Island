import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,Date,Math});
for(const file of ['assets/vendor/astronomy.browser.min.js','star-map.js','atmosphere.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
const atmosphere=new c.IslandAtmosphere(null,null,()=>.1),differentSeed=new c.IslandAtmosphere(null,null,()=>.9);
const view={width:1440,height:1000,camera:{x:562.5,y:1004.5},baseScale:1,time:20};
const at=iso=>{const utc=Date.parse(iso),local=new Date(utc+8*3600000);return {...view,lighting:{day:Math.floor(local.getTime()/86400000),hour:local.getUTCHours(),minute:local.getUTCMinutes(),second:local.getUTCSeconds()}};};
const values=[];
for(let day=0;day<366;day++){
  const date=new Date(Date.parse('2026-01-01T04:00:00Z')+day*86400000),v=at(date.toISOString());
  const optics=atmosphere.orbitalAppearance(v),sun=atmosphere.sun(v),moon=atmosphere.moon(v);
  assert(Math.abs(sun.radius/36-optics.sunScale)<1e-12,'Solar radius follows distance without being flattened by the size cap');
  assert(Math.abs(moon.radius/23-optics.moonScale)<1e-12,'Lunar radius follows distance without being flattened by the size cap');
  const alternateSun=differentSeed.sun(v),alternateMoon=differentSeed.moon(v);
  assert(sun.scale===alternateSun.scale&&moon.scale===alternateMoon.scale,'Apparent size is physical, independent of the random weather seed');
  assert(Math.abs(sun.scale*sun.distanceAU-1)<1e-12&&Math.abs(moon.scale*moon.distanceAU-384400/149597870.7)<1e-12,'Size is inversely proportional to geocentric distance');
  values.push(optics);
}
const range=key=>{const a=values.map(v=>v[key]);return{min:Math.min(...a),max:Math.max(...a),ratio:Math.max(...a)/Math.min(...a)};};
const sun=range('sunScale'),moon=range('moonScale');
assert(sun.ratio>1.03&&sun.ratio<1.04,'Annual solar size variation is about 3.4 percent');
assert(moon.ratio>1.12&&moon.ratio<1.16,'Lunar orbital size variation is physically plausible');
const winter=atmosphere.sun(at('2026-01-03T04:00:00Z')),summer=atmosphere.sun(at('2026-07-06T04:00:00Z'));
assert(winter.radius>summer.radius,'The Sun appears larger near January perihelion');
assert(winter.x===summer.x&&winter.y===summer.y,'Distance changes leave the requested scene trajectory intact');
const before=atmosphere.orbitalAppearance(at('2026-10-28T15:59:59Z')),after=atmosphere.orbitalAppearance(at('2026-10-28T16:00:01Z'));
assert(Math.abs(before.sunScale-after.sunScale)<1e-6&&Math.abs(before.moonScale-after.moonScale)<1e-5,'Size is continuous across Taiwan midnight');
console.log('PASS orbital apparent sizes, fixed trajectories, no random scaling and no midnight jumps',JSON.stringify({sun,moon}));
