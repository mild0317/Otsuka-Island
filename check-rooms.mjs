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
  for(const key of ['clock','workshop','library','lab']){
    await choose(key);
    const coworkers=await evaluate('islandGame.roomState().world.coworkers'),expected={clock:'小公主',library:'Hank',lab:'安東尼'}[key];
    check(expected?coworkers.length===1&&coworkers[0].name===expected&&coworkers[0].working:coworkers.length===0,'Correct coworker assigned to '+key);
    if(expected){check(!await evaluate('islandGame.roomWalkable('+JSON.stringify(coworkers[0])+')'),'Coworker footprint blocks walking: '+key);await delay(100);check((await evaluate('islandGame.roomState().world.coworkers[0].animationTime'))>coworkers[0].animationTime,'Working animation advances: '+key);}
    await screenshot('indoor-coworker-'+key+'-v21.png');
    check(await evaluate('document.querySelectorAll(".room-object").length===1&&!document.querySelector(".room-zoom")'),'One equipment topic with no room enlargement: '+key);
    check(await evaluate('(()=>{const r=document.querySelector("#room-dialog").getBoundingClientRect();return r.width===innerWidth&&r.height===innerHeight})()'),'Indoor scene fills the browser: '+key);
    check(await evaluate('islandGame.roomWalkable(islandGame.roomState().world.actor)'),'Doctor enters on valid indoor floor: '+key);
    const target=await evaluate('(()=>{const w=islandGame.roomState().world,n=IslandRoomWorld.navigation('+JSON.stringify(key)+');return n.nodes.find(p=>Math.hypot(p.x-w.actor.x,p.y-w.actor.y)>145&&Math.hypot(p.x-w.actor.x,p.y-w.actor.y)<230&&n.findPath(w.actor,p))})()');
    await floorClick(target);check(await evaluate('islandGame.roomState().world.actor.route.length>0&&!islandGame.roomState().topicOpen'),'Floor click starts walking without a topic: '+key);
    for(let i=0;i<100;i++){const state=await evaluate('islandGame.roomState()');if(!await evaluate('islandGame.roomWalkable(islandGame.roomState().world.actor)'))throw Error('Indoor step crossed furniture');if(!state.world.actor.route.length)break;await delay(30);}
    await atRest();const settled=await evaluate('islandGame.roomState().world.actor');check(Math.hypot(settled.x-target.x,settled.y-target.y)<1,'Doctor reaches clicked floor: '+key);
    await floorClick({x:60,y:70});await delay(100);check(await evaluate('!islandGame.roomState().world.actor.route.length'),'Wall/sky click cannot walk through the room: '+key);
    if(key==='clock'){
      await clickUI('.room-object');check(await evaluate('islandGame.roomState().world.pendingStation===0&&!islandGame.roomState().topicOpen'),'Equipment click waits for walking instead of opening immediately');
      await delay(180);await floorClick(target);await atRest();await delay(500);check(await evaluate('!islandGame.roomState().topicOpen&&islandGame.roomState().world.pendingStation===null'),'Floor click cancels pending equipment topic');
      for(const [w,h] of [[320,640],[390,844],[844,390],[3840,2160]]){await call('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<900});await delay(100);check(await evaluate('(()=>{const r=document.querySelector(".room-scene").getBoundingClientRect(),s=document.querySelector(".room-stage").getBoundingClientRect();return r.width>0&&r.left>=-1&&r.right<=innerWidth+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1})()'),'Complete indoor map fits '+w+'x'+h);await screenshot('indoor-map-'+w+'-v21.png');}
      await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await delay(100);
      const pp=await evaluate('(()=>{const r=document.querySelector(".room-object").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...pp,id:0}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await waitFor('islandGame.roomState().topicOpen','Phone equipment arrival');check(true,'Phone equipment tap walks to the device before opening');
    }else await openEquipment();
    const state=await evaluate('islandGame.roomState()');check(Math.hypot(state.world.actor.x-state.world.equipment.target.x,state.world.actor.y-state.world.equipment.target.y)<1,'Topic opens only at the equipment approach point: '+key);
    check(await evaluate('!document.querySelector(".room-stage").hidden&&document.querySelector(".room-topic-dialog").open'),'Topic is a separate window over the retained map: '+key);
    check(await evaluate('document.querySelector(".room-detail h3").textContent===IslandRoomTopics['+JSON.stringify(key)+'].title'),'Correct customer topic: '+key);
    await clickUI('.room-action');await waitFor('islandGame.roomState().run==="complete"','Workflow complete');
    const filename=path.join(downloads,'otsuka-'+key+'-pcb-checklist.txt');await rm(filename,{force:true});await clickUI('.topic-download');let text='';for(let i=0;i<40;i++){try{text=await readFile(filename,'utf8');if(text)break;}catch{}await delay(50);}check(text.includes('https://')&&text.includes(await evaluate('IslandRoomTopics['+JSON.stringify(key)+'].title')),'Customer checklist downloads: '+key);
    await evaluate('document.querySelector(".room-content").scrollTop=0');await screenshot('indoor-topic-'+key+'-v21.png');
    if(key==='clock'){
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    }else await clickUI('.room-back');
    check(await evaluate('islandGame.roomState().open&&!islandGame.roomState().topicOpen'),'Closing topic keeps the room open: '+key);
    const after=await evaluate('islandGame.roomState().world.actor');check(Math.hypot(after.x-state.world.actor.x,after.y-state.world.actor.y)<.01,'Doctor remains at the equipment after closing: '+key);
    await call('Emulation.setTouchEmulationEnabled',{enabled:false});await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    if(key==='clock'){
      await evaluate('(()=>{const c=__qaCat,d=c.island.doors.clock;c.setLocation("island",d.porch);c.moveTo(d.porch,{kind:"enter",key:"clock"});})()');
      await waitFor('islandGame.catState().location==="clock"','Cat enters through doorway');await evaluate('__qaCat.wait=99999;__qaCatPaints=[]');await delay(120);
      check(await evaluate('__qaCatPaints.length>0&&__qaCatPaints.every(key=>key==="clock")'),'The one cat appears only in its current room');
      const before=await evaluate('islandGame.audioState().catVoicesPlayed');await evaluate('__qaCat.greet()');await delay(130);
      check(await evaluate('!!islandGame.catState().speech&&islandGame.audioState().catVoicesPlayed>'+before+'&&islandGame.audioState().lastCatVoice.location==="clock"'),'Cat greeting has a speech bubble and same-room sound');
      const rms=await evaluate('(()=>{const a=new Float32Array(__qaCatAnalyser.fftSize);__qaCatAnalyser.getFloatTimeDomainData(a);return Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length)})()');check(rms>.00001&&rms<.5,'Cat sound produces a bounded audio signal');
      await evaluate('__qaCat.wait=99999');
      const voiceCount=await evaluate('islandGame.audioState().catVoicesPlayed');await evaluate('__qaAudio.catVoice({kind:"meow",location:"island"})');check(await evaluate('islandGame.audioState().catVoicesPlayed')===voiceCount,'A cat in another scene cannot be heard');
      await screenshot('indoor-cat-clock-v21.png');
    }else{
      await evaluate('__qaCatPaints=[]');await delay(120);check(await evaluate('islandGame.catState().location==="clock"&&__qaCatPaints.length===0'),'Cat stays in the first room and is absent here: '+key);
    }
    await clickUI('.room-close');await evaluate('__qaCatPaints=[]');await delay(100);check(await evaluate('!islandGame.roomState().open&&islandGame.catState().location==="clock"&&__qaCatPaints.length===0'),'Cat inside a room does not reappear on the island');
  }
  await evaluate('(()=>{const c=__qaCat;c.moveTo({x:IslandRoomWorld.layouts.clock.spawn[0],y:IslandRoomWorld.layouts.clock.spawn[1]},{kind:"exit",key:"clock"});})()');
  await waitFor('islandGame.catState().location==="island"','Cat exits room');await evaluate('__qaCat.wait=99999;__qaCatPaints=[]');await delay(120);check(await evaluate('__qaCatPaints.length>0&&__qaCatPaints.every(key=>key==="island")'),'Cat returns to island only after exiting the room');
  await screenshot('island-cat-return-v21.png');
  await evaluate('window.__qaFast=true;__qaCat.moveTo(__qaCat.island.doors.workshop.porch,{kind:"enter",key:"workshop"})');await waitFor('islandGame.catState().location==="workshop"','Cat visits next room',300);check(await evaluate('islandGame.catState().history.every(change=>change.from==="island"||change.to==="island")'),'Cat reaches another room through the island, without cloning or room teleportation');
  check(errors.length===0,'No browser errors: '+JSON.stringify(errors));await call('Browser.close');
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
