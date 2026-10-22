import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({window:{},Math});vm.runInContext(readFileSync(new URL('./gait.js',import.meta.url),'utf8'),c);
const {sample,deform}=c.window.IslandGait;
for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  let leftLift=0,rightLift=0;
  for(let p=0;p<Math.PI*2;p+=.01){const a=sample(p,0,{heading}),b=sample(p,1,{heading});assert(a.support||b.support,'At least one support foot remains grounded');if(!a.support)leftLift++;if(!b.support)rightLift++;const foot=deform(.96,.6,.8,.92,a),sole=deform(1,.6,.8,.92,a);assert.equal(foot.x,sole.x);assert.equal(foot.y,sole.y,'Shoe and ankle translate together');}
  assert(leftLift>100&&rightLift>100,'Both feet take turns swinging');
  for(const boundary of [0,.6*Math.PI*2,Math.PI*2]){const a=sample(boundary-1e-5,0,{heading}),b=sample(boundary+1e-5,0,{heading});assert(Math.hypot(a.foot.x-b.foot.x,a.foot.y-b.foot.y)<.01,'Contact and swing transitions are continuous');}
}
console.log('PASS alternating left/right support, smooth lift/landing, continuous cycle and rigid shoes in every direction');
const stride=Math.PI*2*.6/.055,anchor=sample(0,0,{stride}).foot.x;
for(let distance=0;distance<stride;distance+=.5)assert(Math.abs(distance+sample(distance*.055,0,{stride}).foot.x-anchor)<.001,'A side-view support foot stays planted as the body advances');
console.log('PASS supporting foot stays planted during horizontal travel');
