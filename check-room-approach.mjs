import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({window:{},console,Math});
for(const file of ['cat-terrain','room-world','npc-routines','npc-life']){vm.runInContext(readFileSync(new URL(file+'.js',import.meta.url),'utf8'),c);Object.assign(c,c.window);}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
for(const key of Object.keys(c.IslandRoomWorld.layouts))for(let pose=0;pose<(key==='workshop'?1:3);pose++){
  const life=new c.IslandNPCLife({random:()=>.2}),worker=life.workers[key];
  if(worker){worker.lastFixedPose=null;life.random=()=>[.1,.45,.9][pose];life.settle(worker);}
  let opened=0;const world=new c.IslandRoomWorld.RoomWorld({key,npcLife:life,canvas:{},art:{},onArrive:index=>{assert.equal(index,0);opened++;}});world.draw=()=>{};
  const target=world.layout.equipment.target,original={x:target[0],y:target[1]},location=worker&&{x:worker.x,y:worker.y};
  if(key==='lab'&&pose===1)assert.equal(world.nav.findPath(world.actor,original,life.people(key)),null,'Old single target is occupied by the left-seat coworker');
  assert(world.visit(0),'A nearby approach is reachable: '+key+'/'+pose);
  for(let i=0;i<600&&!world.topicOpen;i++){world.update(.025);assert(world.nav.isWalkable(world.actor));assert(c.IslandCatTerrain.peopleClear(world.actor,world.actor,life.people(key),66),'No crossing a person');}
  assert(world.topicOpen,'Topic opens without waiting at an occupied target: '+key+'/'+pose);assert.equal(opened,1);assert(distance(world.actor,original)<=110.01);
  if(worker){assert.equal(worker.x,location.x);assert.equal(worker.y,location.y);assert.equal(world.walkTo(location),false,'Floor click cannot plan through an occupied destination');}
  console.log('PASS '+key+'/'+pose+': reaches available floor within 110px, opens once, preserves worker position');
}
{
  const life=new c.IslandNPCLife({random:()=>.2}),worker=life.workers.lab,s=worker.profile.stations.second;Object.assign(worker,{x:s.x,y:s.y});
  const world=new c.IslandRoomWorld.RoomWorld({key:'lab',npcLife:life,canvas:{},art:{},onArrive:()=>{}});world.draw=()=>{};Object.assign(world.actor,{x:420,y:700});
  assert(world.visit(0));assert.equal(world.actor.route.length,0,'Already near the monitor does not need an extra walk');for(let i=0;i<30;i++)world.update(.025);assert(world.topicOpen);
  world.topicOpen=false;world.actor.route=[{x:420,y:660}];world.pendingStation=0;for(let i=0;i<160&&!world.topicOpen;i++)world.update(.025);assert(world.topicOpen,'An already blocked old route selects a nearby approach');
  console.log('PASS near-screen click and recovery from an occupied old target');
}
