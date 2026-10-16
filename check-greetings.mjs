import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Exercise the actual selector functions without waiting for hundreds of waves.
const source=readFileSync(new URL('./game.js',import.meta.url),'utf8');
const data=source.slice(source.indexOf('  const EDA_GREETING_TOPICS'),source.indexOf('  const reducedMotion'));
const functions=source.slice(source.indexOf('  function nextGreeting(){'),source.indexOf('  function resize()'));
let seed=731;
for(const [name,random] of [['seeded',()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;}],['minimum',()=>0],['maximum',()=>.999999]]){
  const math=Object.create(Math);math.random=random;
  const context=vm.createContext({Math:math});
  vm.runInContext(data+functions+';globalThis.qa={next:()=>({text:nextGreeting(),topic:EDA_GREETING_TOPICS[previousTopic].product}),topics:EDA_GREETING_TOPICS};',context);
  const {qa}=context,lines=qa.topics.flatMap(topic=>topic.lines),results=[];
  assert.equal(qa.topics.length,7);assert.equal(lines.length,56);assert.equal(new Set(lines).size,56);
  assert.equal(lines.filter(line=>/^hi/i.test(line)).length,1);
  for(let i=0;i<560;i++){
    const item=qa.next(),previous=results.at(-1);
    if(previous){assert.notEqual(item.topic,previous.topic);assert.notEqual(item.text,previous.text);}
    results.push(item);
  }
  for(let i=0;i<560;i+=7)assert.equal(new Set(results.slice(i,i+7).map(x=>x.topic)).size,7);
  for(let i=0;i<560;i+=56)assert.equal(new Set(results.slice(i,i+56).map(x=>x.text)).size,56);
  console.log('PASS '+name+': 560 choices, alternating topics, balanced rounds, 56 unique phrases per cycle');
}
