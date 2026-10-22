import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context={window:{},Math,structuredClone};vm.createContext(context);
vm.runInContext(readFileSync(new URL('./hank-rig.js',import.meta.url),'utf8'),context);
const rig=context.window.IslandHankRig,h=341,w={x:610,y:685,height:h,time:0,heading:-2,phase:0,kind:'stand',speed:0,targetStation:{seatHip:[690,575],contact:[610,520]}};
const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
let previous,maximum=0;
for(const kind of ['stand','half','sit','type','seatedLook','half','stand','walk','scratch','fold','pick','inspect','place']){
  w.kind=kind;w.speed=kind==='walk'?100:0;
  for(let i=0;i<180;i++){
    w.time+=1/60;w.phase+=w.speed*.055/60;
    if(kind==='walk'){w.heading+=.007;w.x+=Math.cos(w.heading)*w.speed/60;w.y+=Math.sin(w.heading)*w.speed/60;}
    const r=rig.solve(w),s=rig.snapshot(w);
    assert.equal(s.bones.length,21);
    for(const bone of s.bones){assert(bone.a.every(Number.isFinite)&&bone.b.every(Number.isFinite));if(bone.parent)assert(s.bones.some(b=>b.name===bone.parent));}
    for(let side=0;side<2;side++)for(const [a,b,ratio]of [['hip','knee',.165],['knee','ankle',.165],['shoulder','elbow',.145],['elbow','hand',.145]])assert(Math.abs(distance(r.joints[a+side],r.joints[b+side])-h*ratio)<.001,kind+' preserves bone length '+a);
    if(previous){for(const key of Object.keys(r.joints)){const moved=distance(r.joints[key],previous[key]);maximum=Math.max(maximum,moved);assert(moved<13,'Joint continuity at '+kind+'/'+key+': '+moved);}}
    previous=structuredClone(r.joints);
  }
  if(kind==='type'){const pelvis=r=>r.project(r.joints.pelvis);const p=pelvis(rig.solve(w));assert(Math.hypot(p.x-690,p.y-(575-h*.025))<1,'Pelvis docks to cushion');}
}
const [knee,end]=rig.ik([0,0,0],[999,0,0],30,40,[0,1,0]);assert(Math.abs(distance([0,0,0],knee)-30)<.001);assert(Math.abs(distance(knee,end)-40)<.001);
for(const heading of [0,-Math.PI/2,Math.PI/4]){
  const walker={x:0,y:0,height:h,time:0,heading,phase:0,kind:'walk',speed:100};let previousFeet;
  for(let i=0;i<600;i++){
    walker.time+=1/120;walker.x+=Math.cos(heading)*100/120;walker.y+=Math.sin(heading)*100/120;
    const r=rig.solve(walker),feet=r.limbs.map(l=>({support:l.support,p:r.project(l.ankle)}));
    if(i>180)for(let side=0;side<2;side++)if(feet[side].support&&previousFeet[side].support)assert(Math.hypot(feet[side].p.x-previousFeet[side].p.x,feet[side].p.y-previousFeet[side].p.y)<.08,'Planted foot slides at heading '+heading);
    previousFeet=feet;
  }
}
for(const station of [{x:625,y:745,look:[535,510],contact:[555,540],kind:'work'},{x:610,y:685,look:[570,430],contact:[610,520],seatHip:[690,575],kind:'type'},{x:1055,y:785,look:[1160,470],contact:[1130,580],seatHip:[1050,640],kind:'type'}]){
  const worker={...station,height:h,time:0,heading:Math.atan2(station.look[1]-station.y,station.look[0]-station.x),phase:0,speed:0,targetStation:station};
  for(let i=0;i<300;i++){worker.time+=1/60;rig.solve(worker);}
  const r=rig.solve(worker);for(let side=0;side<2;side++){const hand=r.project(r.joints['hand'+side]);assert(Math.hypot(hand.x-station.contact[0],hand.y-station.contact[1])<22,'Hands reach real workstation: '+JSON.stringify(station)+' '+JSON.stringify(hand));}
}
console.log('PASS Hank: 21 connected bones, fixed arm/leg lengths, reachable IK, continuous walk/sit/work/gesture transitions, chair contact; max joint step '+maximum.toFixed(2));
console.log('PASS support feet remain planted during horizontal, vertical and diagonal travel');
console.log('PASS both hands reach the bench and both seated workstations');
