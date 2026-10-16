import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Exercise the actual selector functions without waiting for hundreds of waves.
const source=readFileSync(new URL('./game.js',import.meta.url),'utf8');
const data=source.slice(source.indexOf('  function loadGreetingTopics('),source.indexOf('  const reducedMotion'));
const functions=source.slice(source.indexOf('  function nextGreeting(){'),source.indexOf('  function resize()'));
const library=readFileSync(new URL('./doctor-greetings.js',import.meta.url),'utf8');
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const libraryIndex=html.indexOf('src="doctor-greetings.js?'),gameIndex=html.indexOf('src="game.js?');
assert(libraryIndex>=0&&gameIndex>libraryIndex,'Load the library before the game');
const libraryContext=vm.createContext({window:{}});vm.runInContext(library,libraryContext);
const current=libraryContext.window.DOCTOR_GREETINGS;
assert(Array.isArray(current),'The editable library is an array of topics');
assert(current.every(group=>group&&typeof group.product==='string'&&group.product.trim()&&Array.isArray(group.lines)&&group.lines.every(line=>typeof line==='string')),'Each topic needs a name and an array of text lines');
let seed=731;
for(const [name,random] of [['seeded',()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;}],['minimum',()=>0],['maximum',()=>.999999]]){
  const math=Object.create(Math);math.random=random;
  for(const [fixture,input] of [['editable file',current],['uneven added topics',[{product:'Custom PCB',lines:['New custom phrase','Another phrase','Third phrase']},{product:'Extra topic',lines:['One phrase']}]],['single topic',[{product:'Only topic',lines:['First','Second']}]],['single phrase',[{product:'Only topic',lines:['One phrase']}]],['empty file',[]],['missing file',undefined],['filtered input',[null,{product:'Empty',lines:[]},{product:' PCB ',lines:[' ',42,' First ','First','Second']}]]]){
    const context=vm.createContext({Math:math,window:{DOCTOR_GREETINGS:input}});
    vm.runInContext(data+functions+';globalThis.qa={next:()=>({text:nextGreeting(),topic:previousTopic}),topics:EDA_GREETING_TOPICS};',context);
    const {qa}=context,lines=qa.topics.flatMap(topic=>topic.lines),results=[],perTopic=qa.topics.map(()=>[]),count=Math.max(560,lines.length*10);
    assert.equal(new Set(lines).size,lines.length);
    for(let i=0;i<count;i++){
      const item=qa.next(),previous=results.at(-1),own=perTopic[item.topic],phrases=qa.topics[item.topic].lines;
      assert(phrases.includes(item.text));
      if(previous&&qa.topics.length>1){assert.notEqual(item.topic,previous.topic);assert.notEqual(item.text,previous.text);}
      if(own.length&&phrases.length>1)assert.notEqual(item.text,own.at(-1));
      results.push(item);own.push(item.text);
    }
    for(let i=0;i+qa.topics.length<=count;i+=qa.topics.length)assert.equal(new Set(results.slice(i,i+qa.topics.length).map(x=>x.topic)).size,qa.topics.length);
    perTopic.forEach((chosen,topic)=>{const n=qa.topics[topic].lines.length;for(let i=0;i+n<=chosen.length;i+=n)assert.equal(new Set(chosen.slice(i,i+n)).size,n);});
    if(qa.topics.every(topic=>topic.lines.length===qa.topics[0].lines.length))for(let i=0;i+lines.length<=count;i+=lines.length)assert.equal(new Set(results.slice(i,i+lines.length).map(x=>x.text)).size,lines.length);
    console.log('PASS '+name+' / '+fixture+': '+qa.topics.length+' topics, '+lines.length+' phrases, '+count+' choices with balanced topic and phrase rounds');
  }
}
