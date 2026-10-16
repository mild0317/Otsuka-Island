import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({window:{},console,Math});
for(const file of ['cat-terrain','room-world','npc-routines','npc-life']){
  vm.runInContext(readFileSync(new URL(file+'.js',import.meta.url),'utf8'),c);
  Object.assign(c,c.window);
}
const seeded=value=>()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/2**32;};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
for(const seed of [7,731,2026]){
  const life=new c.IslandNPCLife({random:seeded(seed)}),seen={},jobs={},times={};
  for(const [key,w]of Object.entries(life.workers)){
    const nav=c.IslandRoomWorld.navigation(key);seen[key]=new Set();jobs[key]=new Set();times[key]=0;
    for(const [name,s]of Object.entries(w.profile.stations)){assert(nav.isWalkable(s),key+' '+name+' feet');assert(nav.findPath(w,s),key+' '+name+' connected');}
  }
  for(let i=0;i<40000;i++){
    const before=Object.fromEntries(Object.entries(life.workers).map(([key,w])=>[key,{x:w.x,y:w.y}]));life.update(.1);
    for(const [key,w]of Object.entries(life.workers)){
      assert(c.IslandRoomWorld.navigation(key).isWalkable(w),key+' never walks into furniture');
      assert(distance(w,before[key])<=w.profile.speed[1]*.1+.01,key+' movement has a bounded speed');
      seen[key].add(w.kind);jobs[key].add(w.job);if(w.kind==='type')times[key]+=.1;
      assert(w.blend>=0&&w.blend<=1);assert.equal(new Set(w.items.map(p=>p.id)).size,w.items.length);
      assert(w.items.filter(p=>p.location!=='table').length<=1,'One object is carried at a time');
      if(w.prop){assert(w.items.includes(w.prop),'Held object shares authoritative item state');assert(w.prop.progress>=0&&w.prop.progress<=1);}
      if(w.kind==='pick')assert(w.prop,'Pickup starts with an actual object at that station');
      if(w.kind==='walk'&&w.prop)assert.equal(w.prop.location,'hands');
    }
  }
  for(const [key,w]of Object.entries(life.workers)){
    for(const kind of ['walk','half','sit','type','stand','scratch','reach','pick','inspect','place'])assert(seen[key].has(kind),key+' '+kind);
    assert(jobs[key].size>=5,key+' varied purposeful jobs');assert(w.completed>30);
    console.log('PASS seed '+seed+' '+w.name+': '+w.completed+' jobs, '+seen[key].size+' actions, persistent props, safe routes');
  }
  assert(times.lab>times.clock&&times.lab>times.library,'Anthony spends more time in seated analysis');
  const before=JSON.stringify(Object.values(life.workers).map(w=>life.snapshot(w.key)));life.update(0);assert.equal(JSON.stringify(Object.values(life.workers).map(w=>life.snapshot(w.key))),before);
}
// Exercise the real indoor doctor and worker at the same time, including late
// arrival into a previously clear route and a room doorway occupied by a worker.
for(const key of ['clock','library','lab']){
  let world;const life=new c.IslandNPCLife({random:seeded(71),getDoctor:()=>world?{location:key,...world.actor}:null});
  const w=life.workers[key],nav=c.IslandRoomWorld.navigation(key);
  w.x=nav.layout.spawn[0];w.y=nav.layout.spawn[1];w.duration=99;
  world=new c.IslandRoomWorld.RoomWorld({key,npcLife:life,canvas:{},art:{}});world.draw=()=>{};
  assert(distance(world.actor,w)>=66,'Occupied doorway chooses a free doctor spawn');
  let completed=0,min=Infinity;
  for(const station of Object.values(w.profile.stations)){
    if(distance(world.actor,station)<20)continue;
    if(!world.walkTo(station))continue;
    for(let i=0;i<1600&&world.actor.route.length;i++){
      life.update(.025);world.update(.025);min=Math.min(min,distance(world.actor,w));
      assert(distance(world.actor,w)>=65.9,key+' worker and doctor never cross');
    }
    if(!world.actor.route.length)completed++;
  }
  assert(completed>=3,key+' doctor completes multiple paths with moving worker');
  console.log('PASS '+key+': dynamic doctor/worker avoidance, yielding, occupied doorway; clearance '+min.toFixed(1));
}
{
  let world;const life=new c.IslandNPCLife({getDoctor:()=>world?{location:'lab',...world.actor}:null,random:seeded(12)}),w=life.workers.lab;
  Object.assign(w,{x:465,y:635,heading:-2,pose:'sit',poseSign:-1});life.start(w,{kind:'type',time:99,station:'second'});
  world=new c.IslandRoomWorld.RoomWorld({key:'lab',npcLife:life,canvas:{},art:{},onArrive:()=>{}});world.draw=()=>{};world.actor.x=440;world.actor.y=700;
  assert(world.visit(0));
  for(let i=0;i<2000&&!world.topicOpen;i++){life.update(.025);world.update(.025);assert(distance(world.actor,w)>=65.9);}
  assert(world.topicOpen,'A seated worker replans the exit after the doctor blocks the old route');
  console.log('PASS seated Anthony stands, finds an available side and lets doctor reach the equipment');
}
vm.runInContext(readFileSync(new URL('./island-cat.js',import.meta.url),'utf8'),c);Object.assign(c,c.window);
for(const [i,key]of ['clock','library','lab'].entries()){
  let cat;const life=new c.IslandNPCLife({getCat:()=>cat,random:seeded(99+i)});
  const keys=Object.keys(c.IslandRoomWorld.layouts),island={points:[{x:675,y:1530},{x:450,y:635},{x:750,y:1070},{x:300,y:1218},{x:750,y:1510}],isWalkable:p=>p.x>=0&&p.x<=1600&&p.y>=0&&p.y<=2048,findPath:(a,b)=>[{...b}],doors:Object.fromEntries(keys.map((key,n)=>[key,{porch:{x:450+n*60,y:635+n*180},door:{x:470+n*60,y:600+n*180}}]))};
  cat=new c.IslandCat({image:{width:1254},island,random:seeded(2026+i),getPeople:location=>life.people(location)});
  const [x,y]=c.IslandRoomWorld.layouts[key].spawn;cat.setLocation(key,{x,y});cat.wait=1;
  let movement=0;
  for(let n=0;n<8000;n++){
    cat.update(.05);life.update(.05);if(cat.route.length||cat.jump)movement++;
    const worker=life.workers[cat.location];if(worker&&cat.z<1&&!cat.jump)assert(distance(cat,worker)>=63.9,'Live worker and the one cat keep floor clearance');
    assert.equal(cat.snapshot().count,1);
  }
  assert(movement>0);assert(life.workers[key].completed>=3);
  console.log('PASS '+key+': the same cat and an independently moving worker yield without crossing');
}
