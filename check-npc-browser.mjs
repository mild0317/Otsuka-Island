import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
const out = path.resolve('.preview');
await mkdir(out, { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9338', `--user-data-dir=${path.join(out, 'chrome-' + Date.now())}`, 'about:blank'
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
chrome.stderr.on('data', data => { if (String(data).includes('DevTools')) console.log(String(data).trim()); });
let socket;
const keepAlive = setInterval(() => {}, 1000);
const delay = ms => new Promise(r => setTimeout(r, ms));
try {
  let pages;
  for (let i = 0; i < 40; i++) { try { pages = await (await fetch('http://127.0.0.1:9338/json/list')).json(); if (pages.length) break; } catch {} await delay(250); }
  if (!pages?.length) throw Error('Chrome did not start');
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => socket.addEventListener('open', r, { once: true }));
  let sequence = 0; const pending = new Map(), errors = [];
  socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id) { const p = pending.get(msg.id); if (p) { pending.delete(msg.id); msg.error ? p.reject(Error(JSON.stringify(msg.error))) : p.resolve(msg.result); } }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(msg.params.entry.text);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(()=>reject(Error('CDP timed out: '+method)),10000); pending.set(id, { resolve: r=>{clearTimeout(timer);resolve(r)}, reject: e=>{clearTimeout(timer);reject(e)} }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const screenshot = async filename => { const r = await call('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(out, filename), Buffer.from(r.data, 'base64')); };
  const click = async (x, y) => { await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
  const check = (ok, message) => { if (!ok) throw Error(message); console.log('PASS', message); };
  await call('Runtime.enable');await call('Log.enable');await call('Page.enable');
  const downloads=path.join(out,'downloads');await mkdir(downloads,{recursive:true});await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__qaCatPaints=[];Object.defineProperty(window,'IslandCat',{configurable:true,set(Class){class Observed extends Class{constructor(options){super(options);window.__qaCat=this;}draw(g,key,scale){const visible=super.draw(g,key,scale);if(visible){__qaCatPaints.push(key);if(__qaCatPaints.length>90)__qaCatPaints.shift();}return visible;}}Object.defineProperty(window,'IslandCat',{value:Observed,writable:true,configurable:true})}});Object.defineProperty(window,'IslandAudio',{configurable:true,set(Class){const original=Class.prototype.createContext;Class.prototype.createContext=function(){original.call(this);window.__qaAudio=this;window.__qaCatAnalyser=this.context.createAnalyser();this.cats.connect(__qaCatAnalyser);};Object.defineProperty(window,'IslandAudio',{value:Class,writable:true,configurable:true})}});const raf=requestAnimationFrame.bind(window);let fake=0,last=0;window.requestAnimationFrame=cb=>raf(t=>{fake+=(last?t-last:16)*(window.__qaFast?8:1);last=t;cb(fake)});})()`});
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'IslandNPCLife',{configurable:true,set(Class){class Observed extends Class{constructor(...args){super(...args);window.__qaNPC=this;}}Object.defineProperty(window,'IslandNPCLife',{value:Observed,writable:true,configurable:true})}})"});
  await call('Page.navigate',{url:process.env.ISLAND_TEST_URL||'http://127.0.0.1:4173'});
  const waitFor=async(expression,label,max=160)=>{for(let i=0;i<max;i++){if(await evaluate(expression))return;await delay(50);}throw Error(label+' '+JSON.stringify({errors,state:await evaluate('({room:islandGame?.roomState(),cat:islandGame?.catState()})')}));};
  await waitFor('!!window.islandGame?.getState().ready','Assets ready');check(true,'Island, shared doctor renderer and cat sprite load');
  check(await evaluate('document.querySelector("#loading p").textContent==="正在前往Otsuka-Island"'),'Loading message matches the requested wording');
  await evaluate('__qaCat.wait=99999');
  const clickUI=async selector=>{await evaluate('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"nearest"})');const p=await evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await click(p.x,p.y);};
  const roomPoint=async p=>evaluate('(()=>{const r=document.querySelector(".room-scene").getBoundingClientRect();return{x:r.x+'+p.x+'/1536*r.width,y:r.y+'+p.y+'/1024*r.height}})()');
  const floorClick=async p=>{const s=await roomPoint(p);await click(s.x,s.y);};
  const choose=async key=>{await evaluate('window.__qaFast=true');await clickUI('#ui-toggle');await clickUI('[data-place='+key+']');await waitFor('islandGame.roomState().open&&islandGame.roomState().key==='+JSON.stringify(key),'Enter '+key,240);await waitFor('islandGame.roomState().imageReady','Room art ready');await evaluate('window.__qaFast=false');};
  const atRest=()=>waitFor('!islandGame.roomState().world.actor.route.length','Indoor arrival');
  const openEquipment=async()=>{await clickUI('.room-object');await waitFor('islandGame.roomState().topicOpen','Topic after arrival');};
  const place=async(key,station,kind)=>evaluate('(()=>{const l=__qaNPC,w=l.workers['+JSON.stringify(key)+'],s=w.profile.stations['+JSON.stringify(station)+'];w.x=s.x;w.y=s.y;w.time+=2;w.heading=Math.atan2(s.look.y-s.y,s.look.x-s.x);l.start(w,{kind:'+JSON.stringify(kind)+',time:999,station:'+JSON.stringify(station)+'});w.blend=1;w.prop=null;return l.snapshot('+JSON.stringify(key)+');})()');
  function auditWalking(key){
    const original=__qaNPC.workers[key],w={...original,x:220,y:430,items:[],prop:null,kind:'walk',blend:1,poseSign:1,previousSign:1,targetStation:null},canvas=document.createElement('canvas');canvas.width=440;canvas.height=480;
    const g=canvas.getContext('2d'),reports=[];
    const holeSize=()=>{const width=440,height=Math.floor(430-w.height*.30),pixels=g.getImageData(0,0,width,height).data,visited=new Uint8Array(width*height),queue=new Int32Array(width*height);let largest=0;
      for(let seed=0;seed<visited.length;seed++){if(visited[seed]||pixels[seed*4+3]>=16)continue;let head=0,tail=1,border=false;queue[0]=seed;visited[seed]=1;while(head<tail){const at=queue[head++],x=at%width,y=Math.floor(at/width);if(x===0||x===width-1||y===0||y===height-1)border=true;for(const next of [x?at-1:-1,x<width-1?at+1:-1,y?at-width:-1,y<height-1?at+width:-1])if(next>=0&&!visited[next]&&pixels[next*4+3]<16){visited[next]=1;queue[tail++]=next;}}if(!border)largest=Math.max(largest,tail);}
      return largest;};
    for(const pose of ['front','back','side']){w.pose=w.previousPose=pose;let baseline=0,max=0;for(let i=0;i<7;i++){w.time+=2;w.phase=i*.9;w.speed=i?100:0;g.clearRect(0,0,440,480);IslandNPCRenderer.draw(g,w,__qaNPC.images[key]);const size=holeSize();if(!i)baseline=size;max=Math.max(max,size);}reports.push({pose,baseline,max,ok:max<=Math.max(35,baseline+20)});}
    return reports;
  }
  for(const key of ['clock','library','lab']){
    await choose(key);await evaluate('__qaNPC.load('+JSON.stringify(key)+')');await evaluate('__qaNPC.update=()=>{}');
    check(await evaluate('islandGame.coworkerState('+JSON.stringify(key)+').assetsReady'),'All new pose sheets load: '+key);
    const pixels=await evaluate('('+auditWalking.toString()+')('+JSON.stringify(key)+')');
    check(pixels.every(p=>p.ok),'Front, back and side walking keep clothes intact: '+key+' '+JSON.stringify(pixels));
    await place(key,'computer','type');await delay(180);await screenshot('npc-'+key+'-seated-v23.png');
    await place(key,key==='lab'?'overview':'bench','work');await delay(180);await screenshot('npc-'+key+'-working-v23.png');
    for(const kind of ['scratch','fold','inspect']){
      await place(key,key==='lab'?'overview':'bench',kind);
      if(kind==='inspect')await evaluate('(()=>{const w=__qaNPC.workers['+JSON.stringify(key)+'];w.prop={kind:w.targetStation.prop,home:w.targetStation.item,location:"hands"};w.time+=1})()');
      await delay(100);await screenshot('npc-'+key+'-'+kind+'-v23.png');
    }
    await place(key,'computer','sit');
    const transitions=await evaluate('(()=>{const w=__qaNPC.workers['+JSON.stringify(key)+'];w.previousPose="work";w.pose="sit";w.blend=0;const states=[];for(let i=0;i<15;i++){IslandNPCLife.prototype.update.call(__qaNPC,.05);states.push(__qaNPC.snapshot('+JSON.stringify(key)+').transition)}return states})()');
    check(transitions.every((v,i)=>!i||v>=transitions[i-1])&&transitions[0]<.1&&transitions.at(-1)>.7,'Sit transition eases through intermediate values: '+key);
    await delay(100);await screenshot('npc-'+key+'-transition-v23.png');
    for(const [width,height]of [[390,844],[3840,2160]]){
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});await delay(100);
      check(await evaluate('(()=>{const r=document.querySelector(".room-scene").getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})()'),'NPC room fits '+width+'x'+height+': '+key);
      await screenshot('npc-'+key+'-'+width+'-v23.png');
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await clickUI('.room-close');
  }
  await call('Page.navigate',{url:'file:///'+path.resolve('index.html').replace(/\\/g,'/')});
  await waitFor('location.protocol==="file:"&&!!window.islandGame?.getState().ready','Local HTML loads');await choose('library');await evaluate('__qaNPC.load("library")');
  check(await evaluate('islandGame.coworkerState("library").assetsReady'),'Hank poses also load in a directly opened HTML file');
  check(errors.length===0,'No browser rendering errors: '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
