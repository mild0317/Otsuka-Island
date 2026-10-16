import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const out = path.resolve('.preview');
await mkdir(out, { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy='+(process.env.ISLAND_AUTOPLAY==='allowed'?'no-user-gesture-required':'document-user-activation-required'),
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
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`Object.defineProperty(window,'IslandAudio',{configurable:true,set(Class){const original=Class.prototype.createContext;Class.prototype.createContext=function(){original.call(this);window.__qaAudio=this;const a=this.context.createAnalyser();a.fftSize=2048;this.master.disconnect();this.master.connect(a);a.connect(this.context.destination);window.__qaAnalyser=a};Object.defineProperty(window,'IslandAudio',{value:Class,writable:true,configurable:true})}})`});
  await call('Page.navigate',{url:process.env.ISLAND_TEST_URL||'http://127.0.0.1:4173'});
  for(let i=0;i<100;i++){if(await evaluate('window.islandGame?.getState().ready'))break;await delay(100);}
  check(await evaluate('window.islandGame?.getState().ready'),'Full-screen scene and all local assets load');
  const clickUI=async selector=>{const p=await evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await click(p.x,p.y);};
  const world=async(x,y)=>evaluate('islandGame.worldToScreen({x:'+x+',y:'+y+'})');
  const labelState=()=>evaluate('(()=>{const e=document.querySelector("#building-name"),r=e.getBoundingClientRect();return{hidden:e.hidden,text:e.textContent,key:e.dataset.building,x:r.x,y:r.y,right:r.right,bottom:r.bottom}})()');
  const touch=async p=>{await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:0}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
  check(await evaluate('islandGame.audioState().enabled&&document.querySelector("#sound-toggle").getAttribute("aria-pressed")==="true"'),'Music is enabled by default');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await delay(150);
  if(process.env.ISLAND_AUTOPLAY==='allowed')check(await evaluate('islandGame.audioState().contextState==="running"&&islandGame.audioState().musicNotesScheduled>0'),'Allowed autoplay starts music without a gesture');
  else check(await evaluate('islandGame.audioState().contextState==="suspended"&&islandGame.audioState().musicNotesScheduled===0'),'Blocked autoplay waits for a user gesture while remaining enabled');
  await touch({x:3,y:3});await delay(200);
  check(await evaluate('islandGame.audioState().contextState==="running"&&islandGame.audioState().musicNotesScheduled>0'),'First ordinary phone touch starts enabled music');
  await call('Emulation.setTouchEmulationEnabled',{enabled:false});
  await clickUI('#sound-toggle');await delay(200);await click(3,3);await delay(100);
  check(await evaluate('!islandGame.audioState().enabled&&islandGame.audioState().contextState==="suspended"'),'Subsequent ordinary gestures respect explicit mute');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await delay(100);
  check((await labelState()).hidden,'No permanent building name before interaction');
  for(const [key,name,x,y] of [['clock','設計工作室',550,400],['workshop','製作工坊',850,800],['library','驗証工作室',300,1000],['lab','模擬實驗室',860,1250]]){
    const p=await world(x,y);await call('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await delay(70);
    const l=await labelState();check(!l.hidden&&l.key===key&&l.text===name,'Hover shows correct building name: '+key);
    check(l.x>=0&&l.y>=0&&l.right<=1440&&l.bottom<=1000,'Building name stays inside viewport');
    check(await evaluate('islandGame.getState().selectedBuilding===null'),'Hover does not start a visit');
  }
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:3,y:3});await delay(60);check((await labelState()).hidden,'Leaving a building clears its hover name');
  const house=await world(850,800);await click(house.x,house.y);await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:3,y:3});await delay(70);
  check(!(await labelState()).hidden&&(await labelState()).key==='workshop','Clicked building name persists after pointer leaves');
  const ground=await world(697,1536);await click(ground.x,ground.y);await delay(70);check((await labelState()).hidden,'Clicking paving clears building name');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await delay(100);
  const mobileHouse=await world(300,1000);await touch(mobileHouse);await delay(80);
  check(!(await labelState()).hidden&&(await labelState()).text==='驗証工作室','Phone tap displays the selected building name');await screenshot('building-name-phone-v17.png');
  await touch(await world(625,1540));
  check(await evaluate('!islandGame.audioState().enabled'),'Walking and selecting buildings preserve explicit mute');
  const soundPoint=await evaluate('(()=>{const r=document.querySelector("#sound-toggle").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await touch(soundPoint);
  for(let i=0;i<50;i++){if(await evaluate('islandGame.audioState().contextState==="running"'))break;await delay(30);}
  await delay(450);
  check(await evaluate('islandGame.audioState().enabled&&document.querySelector("#sound-toggle").getAttribute("aria-pressed")==="true"'),'Phone audio control enables playback');
  let rms=0;
  for(let i=0;i<15;i++){rms=await evaluate('(()=>{const data=new Float32Array(__qaAnalyser.fftSize);__qaAnalyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length)})()');if(rms>.00001)break;await delay(100);}
  check(rms>.00001&&rms<.5,'Background music produces a bounded audio signal: '+rms);
  check(await evaluate('islandGame.audioState().musicNotesScheduled>0'),'Ambient melody and chord notes are scheduled');
  const chirpChecks=await evaluate(`(()=>{const a=__qaAudio,b={id:99001,state:'flying',mode:'roof',x:800,visibleAt:0};let before=a.chirpsPlayed;a.updateBirds([b],0);a.updateBirds([b],20);const flying=a.chirpsPlayed===before;b.state='perched';a.nextBirdSound=0;a.updateBirds([b],0);a.updateBirds([b],20);const perched=a.chirpsPlayed===before+1&&a.lastChirp.state==='perched';before=a.chirpsPlayed;a.updateBirds([b],100,false);return{flying,perched,paused:a.chirpsPlayed===before}})()`);
  check(chirpChecks.flying&&chirpChecks.perched&&chirpChecks.paused,'Bird calls trigger only while perched and animation is active');
  await evaluate('document.querySelector("#sound-volume").value=60;document.querySelector("#sound-volume").dispatchEvent(new Event("input"))');
  check(await evaluate('islandGame.audioState().volume===.6&&document.querySelector("#sound-volume-value").textContent==="60%"'),'Volume slider updates music and bird volume');
  await touch(soundPoint);await delay(250);
  check(await evaluate('!islandGame.audioState().enabled&&islandGame.audioState().contextState==="suspended"'),'Audio control silences music and birds');
  await touch(soundPoint);await delay(150);
  await evaluate('__qaAudio.enterRoom("lab");__qaAudio.roomEvent("run","lab")');
  check(await evaluate('islandGame.audioState().activeRoomVoices>0'),'Room effects start alongside enabled background music');
  const roomBefore=await evaluate('islandGame.audioState().roomEffectsPlayed');
  await evaluate('__qaAudio.roomEvent("step","workshop")');
  check(await evaluate('islandGame.audioState().roomEffectsPlayed')===roomBefore,'Stale events from a different room cannot play');
  await evaluate('__qaAudio.roomEvent("cancel","lab")');
  check(await evaluate('islandGame.audioState().activeRoomVoices===0'),'Cancelling a room workflow stops its scheduled effects');
  await evaluate('__qaAudio.roomEvent("run","lab")');
  await evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))');await delay(120);
  check(await evaluate('islandGame.audioState().contextState==="suspended"&&islandGame.audioState().activeRoomVoices===0'),'Hidden-page handler suspends audio and cancels room effects');
  const hiddenBefore=await evaluate('islandGame.audioState().roomEffectsPlayed');
  await evaluate('__qaAudio.roomEvent("complete","lab")');
  check(await evaluate('islandGame.audioState().roomEffectsPlayed')===hiddenBefore,'Hidden room completion does not queue an obsolete sound');
  await evaluate('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"))');await delay(150);
  check(await evaluate('islandGame.audioState().contextState==="running"'),'Returning-page handler resumes enabled audio');
  await evaluate('__qaAudio.leaveRoom()');
  await touch(soundPoint);await delay(150);
  await call('Page.reload',{ignoreCache:true});
  for(let i=0;i<100;i++){if(await evaluate('window.islandGame?.getState().ready'))break;await delay(100);}
  const freshSoundPoint=await evaluate('(()=>{const r=document.querySelector("#sound-toggle").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await touch(freshSoundPoint);await delay(200);await touch({x:3,y:3});await delay(150);
  check(await evaluate('!islandGame.audioState().enabled&&islandGame.audioState().contextState==="suspended"'),'Muting as the very first gesture cancels pending autoplay');
  check(errors.length===0,'No browser errors: '+JSON.stringify(errors));await call('Browser.close');
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
