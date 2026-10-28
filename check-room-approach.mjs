import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({window:{},console,Math});
for(const file of ['cat-terrain','room-topics','room-world','room-seating','npc-routines','npc-life']){vm.runInContext(readFileSync(new URL(file+'.js',import.meta.url),'utf8'),c);Object.assign(c,c.window);}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
for(const key of ['clock','library','lab','workshop'])for(const pose of [.1,.45,.9]){
  const life=new c.IslandNPCLife({random:()=>pose}),stations=c.IslandRoomTopics[key].pptLinks;
  const world=new c.IslandRoomWorld.RoomWorld({key,stations,npcLife:life,canvas:{},art:{},onArrive:index=>assert.equal(index,world.stationIndex)});world.draw=()=>{};
  for(const index of [...stations.map((_,i)=>i),0]){
    world.topicOpen=false;assert(world.visit(index),'Reach '+key+' station '+index);
    for(let i=0;i<1000&&!world.topicOpen;i++){world.update(.025);assert(world.nav.isWalkable(world.actor));assert(c.IslandCatTerrain.peopleClear(world.actor,world.actor,life.people(key),66));}
    assert(world.topicOpen);assert(distance(world.actor,{x:stations[index].target[0],y:stations[index].target[1]})<=110.01);
  }
  console.log('PASS all '+stations.length+' '+key+' PPT approaches and return path, coworker pose '+pose);
}
for(const key of Object.keys(c.IslandRoomWorld.layouts))for(let pose=0;pose<(key==='workshop'?1:3);pose++){
  const life=new c.IslandNPCLife({random:()=>.2}),worker=life.workers[key];
  if(worker){worker.lastFixedPose=null;life.random=()=>[.1,.45,.9][pose];life.settle(worker);}
  let opened=0;const world=new c.IslandRoomWorld.RoomWorld({key,npcLife:life,canvas:{},art:{},onArrive:index=>{assert.equal(index,0);opened++;}});world.draw=()=>{};
  const target=world.layout.equipment.target,original={x:target[0],y:target[1]},location=worker&&{x:worker.x,y:worker.y};
  if(worker)assert.equal(world.nav.findPath(world.actor,life.body(key),life.people(key)),null,'The actual seated or standing body cannot be a destination');
  assert(world.visit(0),'A nearby approach is reachable: '+key+'/'+pose);
  for(let i=0;i<600&&!world.topicOpen;i++){world.update(.025);assert(world.nav.isWalkable(world.actor));assert(c.IslandCatTerrain.peopleClear(world.actor,world.actor,life.people(key),66),'No crossing a person');}
  assert(world.topicOpen,'Topic opens without waiting at an occupied target: '+key+'/'+pose);assert.equal(opened,1);assert(distance(world.actor,original)<=110.01);
  if(worker){assert.equal(worker.x,location.x);assert.equal(worker.y,location.y);assert.equal(world.walkTo(life.body(key)),false,'Floor click cannot plan through an occupied destination');}
  console.log('PASS '+key+'/'+pose+': reaches available floor within 110px, opens once, preserves worker position');
}
{
  const life=new c.IslandNPCLife({random:()=>.2}),worker=life.workers.lab,s=worker.profile.stations.second;Object.assign(worker,{x:s.x,y:s.y});
  const world=new c.IslandRoomWorld.RoomWorld({key:'lab',npcLife:life,canvas:{},art:{},onArrive:()=>{}});world.draw=()=>{};Object.assign(world.actor,{x:420,y:700});
  assert(world.visit(0));assert.equal(world.actor.route.length,0,'Already near the monitor does not need an extra walk');for(let i=0;i<30;i++)world.update(.025);assert(world.topicOpen);
  world.topicOpen=false;world.actor.route=[{x:420,y:660}];world.pendingStation=0;for(let i=0;i<160&&!world.topicOpen;i++)world.update(.025);assert(world.topicOpen,'An already blocked old route selects a nearby approach');
  console.log('PASS near-screen click and recovery from an occupied old target');
}

for(const scene of ['portrait','discussion','production']){
 const life=new c.IslandNPCLife({random:()=>.2});life.settleWorkshop(scene);
 const stations=c.IslandRoomTopics.workshop.pptLinks,world=new c.IslandRoomWorld.RoomWorld({key:'workshop',stations,npcLife:life,canvas:{},art:{},onArrive:()=>{}});world.draw=()=>{};
 for(let index=0;index<stations.length;index++){
  world.topicOpen=false;assert(world.visit(index),'Workshop '+scene+' can approach PPT '+index);
  for(let frame=0;frame<1000&&!world.topicOpen;frame++){world.update(.025);assert(c.IslandCatTerrain.peopleClear(world.actor,world.actor,life.people('workshop'),66),'Avoid group '+scene);}
  assert(world.topicOpen,'Workshop '+scene+' reaches PPT '+index);
 }
 const old=life.workshopWorkers.map(w=>[w.x,w.y,w.pose,w.station].join(':'));life.doctorLocation='workshop';life.getDoctor=()=>({location:'workshop'});
 for(let frame=0;frame<1200;frame++)life.update(.05);
 assert.deepEqual(life.workshopWorkers.map(w=>[w.x,w.y,w.pose,w.station].join(':')),old,'Hold configuration without walking');
 assert.equal(c.IslandRoomSeating.emptyEntities('workshop',life.workshopWorkers).length,scene==='production'?0:2);
 console.log('PASS '+scene+': both PPTs reachable, correct chair count, group fixed for 60 seconds');
}
{
 const life=new c.IslandNPCLife({random:()=>.2});for(const [roll,scene]of [[.05,'portrait'],[.45,'discussion'],[.9,'production']]){life.random=()=>roll;life.enter('workshop');assert.equal(life.workshopScene,scene);}
 console.log('PASS every workshop configuration can be selected on entry');
}
