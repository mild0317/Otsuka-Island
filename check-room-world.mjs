import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context=vm.createContext({window:{},Math,console});
vm.runInContext(readFileSync(new URL('./room-world.js',import.meta.url),'utf8'),context);
context.IslandRoomWorld=context.window.IslandRoomWorld;
vm.runInContext(readFileSync(new URL('./cat-terrain.js',import.meta.url),'utf8'),context);
context.IslandCatTerrain=context.window.IslandCatTerrain;
vm.runInContext(readFileSync(new URL('./island-cat.js',import.meta.url),'utf8'),context);
const {navigation,layouts}=context.IslandRoomWorld,p=([x,y])=>({x,y});
let totalDetours=0;
for(const key of Object.keys(layouts)){
  const nav=navigation(key),layout=layouts[key],spawn=p(layout.spawn),target=p(layout.equipment.target);
  assert(nav.isWalkable(spawn));assert(nav.isWalkable(target));assert(!nav.isWalkable({x:0,y:0}));
  let reachable=0,detours=0;
  for(const goal of nav.nodes){const path=nav.findPath(spawn,goal);if(!path)continue;reachable++;if(path.length>1)detours++;let previous=spawn;for(const next of path){const n=Math.max(1,Math.ceil(Math.hypot(next.x-previous.x,next.y-previous.y)/3));for(let i=0;i<=n;i++)assert(nav.isWalkable({x:previous.x+(next.x-previous.x)*i/n,y:previous.y+(next.y-previous.y)*i/n}));previous=next;}}
  assert(nav.findPath(spawn,target));assert(reachable>40);totalDetours+=detours;
  console.log('PASS '+key+': '+reachable+' reachable floor cells, '+detours+' furniture detours, equipment reachable');
}
assert(totalDetours>0,'Indoor maps support safe routes around furniture');
const allVisited=new Set();
for(const seedValue of [21,731,2026]){
  let seed=seedValue;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  let player={location:'island',x:700,y:1500},voices=0;
  const island={points:[{x:675,y:1530},{x:450,y:635},{x:750,y:1070},{x:300,y:1218},{x:750,y:1510}],isWalkable:p=>p.x>=0&&p.x<=1600&&p.y>=0&&p.y<=2048,findPath:(start,target)=>[{...target}],doors:Object.fromEntries(Object.keys(layouts).map((key,i)=>[key,{porch:{x:450+i*60,y:635+i*180},door:{x:470+i*60,y:600+i*180}}]))};
  const cat=new context.window.IslandCat({image:{width:1254},island,random,getPlayer:()=>player,onVoice:v=>{assert.equal(v.location,player.location);voices++;}}),visited=new Set(),poses=new Set();
  const g=new Proxy({measureText:()=>({width:32})},{get:(o,k)=>k in o?o[k]:()=>{}});
  for(let i=0;i<90000;i++){
    if(i%400===0)player={...player,location:['island',...Object.keys(layouts)][(i/400)%5]};
    cat.update(.2);const state=cat.snapshot();visited.add(state.location);poses.add(state.pose);assert.equal(state.id,'island-cat');assert.equal(state.count,1);if(!cat.jump&&cat.z===0)assert(cat.nav().isWalkable(state));else assert(cat.jump||cat.terrain().nodes.some(n=>n.id===state.surfaceNode));
    if(i%20===0){let visible=0;for(const key of ['island',...Object.keys(layouts)])visible+=Number(cat.draw(g,key,1));assert.equal(visible,1);}
    for(const change of state.history)assert(change.from==='island'||change.to==='island');
  }
  visited.forEach(key=>allVisited.add(key));assert(visited.size>=3);for(const pose of ['walking','running','jumping','sitting','lying','scratching','sleeping'])assert(poses.has(pose),pose);assert(voices>0);const before=JSON.stringify(cat.snapshot());cat.update(0);assert.equal(JSON.stringify(cat.snapshot()),before);
  console.log('PASS cat seed '+seedValue+': one identity, '+visited.size+' locations, varied pace, perching and rest, safe movement, same-scene voice and pause');
}

assert.equal(allVisited.size,5);
