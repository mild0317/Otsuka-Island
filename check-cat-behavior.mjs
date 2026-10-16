import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context=vm.createContext({window:{},Math,console});
for(const [file,name] of [['cat-terrain.js','IslandCatTerrain'],['room-world.js','IslandRoomWorld'],['island-cat.js','IslandCat']]){vm.runInContext(readFileSync(new URL(file,import.meta.url),'utf8'),context);context[name]=context.window[name];}
const {IslandCat:Cat,IslandCatTerrain:terrain,IslandRoomWorld:rooms}=context;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),point=([x,y])=>({x,y});
const island={points:[{x:675,y:1530},{x:450,y:635},{x:751,y:1070},{x:302,y:1218},{x:748,y:1490}],doors:Object.fromEntries(Object.keys(rooms.layouts).map((key,i)=>[key,{porch:{x:450+i*60,y:635+i*180},door:{x:470+i*60,y:600+i*180}}])),isWalkable:p=>p.x>=0&&p.x<1600&&p.y>0&&p.y<2048,findPath:(start,target)=>[{...target}]};
const create=(extra={})=>new Cat({image:{width:1254},island,getPeople:()=>[],getPlayer:()=>({location:'island',x:50,y:50}),...extra});
for(const [key,scene] of Object.entries(terrain.scenes)){
  const nav=key==='island'?island:rooms.navigation(key),start=key==='island'?{x:675,y:1530}:point(nav.layout.spawn);
  for(const access of scene.nodes.filter(n=>n.z===0))assert(nav.isWalkable(access),key+' floor access '+JSON.stringify(access));
  for(const target of scene.nodes.filter(n=>n.z>0)){
    const cat=create();cat.setLocation(key,start);assert(cat.moveTo(target,{kind:'perch'}),key+' reachable perch '+target.id);let jumps=0;
    for(let i=0;i<2200&&(cat.route.length||cat.jump);i++){cat.update(.05);if(cat.jump)jumps++;assert(Number.isFinite(cat.x+cat.y+cat.z));}
    assert(distance(cat,target)<.01&&cat.z===target.z,key+' lands precisely on '+target.id);assert(jumps>0);
    assert(cat.moveTo(start));for(let i=0;i<2200&&(cat.route.length||cat.jump);i++)cat.update(.05);
    assert(distance(cat,start)<.01&&cat.z===0,key+' can descend safely from '+target.id+' '+JSON.stringify(cat.snapshot()));
  }
  console.log('PASS '+key+': all authored rail, wall and roof footholds reachable and reversible');
}
// Cat reroutes around a stationary or suddenly arriving person.
for(const location of ['island','library','lab']){
  const worker={x:location==='island'?200:800,y:location==='island'?1000:845};
  const cat=create({getPeople:()=>[worker]});cat.setLocation(location,location==='island'?{x:100,y:1000}:{x:710,y:850});
  const target=location==='island'?{x:300,y:1000}:{x:950,y:840};
  if(cat.moveTo(target))for(let i=0;i<350;i++){const previous={x:cat.x,y:cat.y};cat.update(.04);assert(terrain.peopleClear(previous,cat,[worker],location==='island'?43:64));}
  assert(distance(cat,worker)>=(location==='island'?43:64)-.01);
}
const blocker={x:1000,y:1000},cat=create({getPeople:()=>[blocker]});cat.setLocation('island',{x:100,y:1000});assert(cat.moveTo({x:500,y:1000}));blocker.x=260;
for(let i=0;i<300;i++){cat.update(.04);assert(distance(cat,blocker)>=43-.01,'Cat stops before a person who enters its route');}
cat.setLocation('island',{x:200,y:1000});assert(!cat.allowsPersonStep({x:140,y:1000},{x:240,y:1000},'island'),'Swept collision catches a doctor stepping across cat');
assert(cat.allowsPersonStep({x:140,y:1000},{x:100,y:1000},'island'),'Doctor can move away');
console.log('PASS bidirectional swept collision, detours and late-arriving people');
const doctor={x:697,y:1536},doorIsland={...island,doors:{lab:{porch:{x:748,y:1490},door:{x:777,y:1432}}}},doorCat=create({island:doorIsland,getPeople:key=>key==='island'?[doctor]:[]});doorCat.setLocation('island',doorIsland.doors.lab.porch);doorCat.wait=99999;
for(let i=0;i<500&&distance(doctor,doorIsland.doors.lab.porch)>.1;i++){
  const target=doorIsland.doors.lab.porch,d=distance(doctor,target),step=Math.min(4,d),next={x:doctor.x+(target.x-doctor.x)*step/d,y:doctor.y+(target.y-doctor.y)*step/d};
  if(doorCat.allowsPersonStep(doctor,next,'island'))Object.assign(doctor,next);doorCat.update(.02);
  if(doorCat.location==='island')assert(distance(doctor,doorCat.collisionPoint())>=43-.01);
}
for(let i=0;i<100&&doorCat.transition;i++)doorCat.update(.02);
assert(distance(doctor,doorIsland.doors.lab.porch)<.1&&doorCat.location==='lab','Cat enters nearby room to yield at a dead-end doorstep');
console.log('PASS doorway yielding completes without overlap or permanently blocking doctor');
const waits={},paces=new Set(),samples=[];const calm=create();
for(let i=0;i<100;i++){calm.rest();waits[calm.pose]=calm.wait;assert(calm.wait>=(calm.pose==='stretching'?3:7));calm.moveTo({x:500,y:1400});paces.add(calm.pace);calm.setLocation('island',{x:675,y:1530});}
assert(paces.has('run')&&paces.has('walk'));assert(waits.sleeping>=90&&waits.lying>=45&&waits.sitting>=30);
assert(calm.moveTo({x:675,y:1700}));for(let i=0;i<20;i++){calm.update(.02);samples.push(calm.speed);}assert(samples[0]<samples.at(-1),'Speed eases up instead of instant constant movement');
const snapshot=JSON.stringify(calm.snapshot());calm.update(0);assert.equal(JSON.stringify(calm.snapshot()),snapshot);
console.log('PASS varied walking/running, eased acceleration, long sitting/lying/sleep and pause');
