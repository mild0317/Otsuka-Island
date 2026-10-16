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

  // Follow actual island paths and authored footholds, not teleports onto roofs.
  await evaluate('window.__qaFast=true;__qaCat.setLocation("island",__qaCat.island.doors.workshop.porch);__qaCat.moveTo(IslandCatTerrain.scenes.island.nodes.find(n=>n.id==="island-12"),{kind:"perch"})');
  await waitFor('!!islandGame.catState().jump&&islandGame.catState().jump.progress>.35','Visible jump arc',500);
  await screenshot('cat-jump-v22.png');
  await waitFor('islandGame.catState().surface==="roof"&&!islandGame.catState().moving','Roof landing',600);
  await evaluate('__qaCat.wait=99999');
  const roof=await evaluate('islandGame.catState()');check(roof.z>200&&roof.x===834&&roof.y===664,'Cat reaches roof by connected jumps');
  const rp=await evaluate('islandGame.worldToScreen({x:834,y:664})');
  const shot=await call('Page.captureScreenshot',{format:'png',clip:{x:Math.max(0,rp.x-110),y:Math.max(0,rp.y-110),width:220,height:200,scale:3}});await writeFile(path.join(out,'cat-roof-detail-v22.png'),Buffer.from(shot.data,'base64'));
  await evaluate('__qaCat.moveTo(__qaCat.island.doors.workshop.porch)');
  await waitFor('islandGame.catState().z===0&&!islandGame.catState().moving','Cat descends to floor',600);
  check(true,'Cat reverses the same footholds to return to floor');
  // A real user path must wait for the cat and the cat yields without overlap.
  await evaluate('window.__qaFast=false;__qaCat.setLocation("island",{x:697,y:1536});__qaCat.wait=99999');
  const before=await evaluate('islandGame.getState()'),p=await evaluate('islandGame.worldToScreen({x:720,y:1540})');await click(p.x,p.y);
  let arrived=false,min=Infinity;
  for(let i=0;i<240;i++){const s=await evaluate('({d:islandGame.getState(),c:islandGame.catState()})');min=Math.min(min,Math.hypot(s.d.x-s.c.x,s.d.y-s.c.y));if(!s.d.moving&&Math.hypot(s.d.x-before.x,s.d.y-before.y)>30){arrived=true;break;}await delay(35);}
  check(min>=42.9,'Doctor and cat never cross each other: clearance '+min.toFixed(1));if(!arrived)console.log(await evaluate('({d:islandGame.getState(),c:islandGame.catState()})'));check(arrived,'Cat yields so doctor can complete the clicked walk');
  // Enter a room already occupied at its doorway: no overlapping spawn.
  await evaluate('__qaCat.setLocation("clock",{x:760,y:865});__qaCat.wait=99999');
  await choose('clock');check(await evaluate('(()=>{const d=islandGame.roomState().world.actor,c=islandGame.catState();return Math.hypot(d.x-c.x,d.y-c.y)>=70})()'),'Room entry finds floor clear of the resident cat');
  await screenshot('room-scale-clock-v22.png');
  await evaluate('__qaCat.setLocation("island",{x:675,y:1530});__qaCat.wait=99999');await clickUI('.room-close');
  await choose('library');
  await evaluate('window.__qaWorkerDraws=[];const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(image.src?.includes("npc-hank-work-v22")){const m=this.getTransform();__qaWorkerDraws.push({crop:args.slice(0,4),c:m.c,d:m.d});}return original.call(this,image,...args)}');
  await delay(1600);await waitFor('__qaWorkerDraws.length>=12','Hank animation samples');const frames=await evaluate('__qaWorkerDraws');
  check(frames.length>=12&&new Set(frames.map(f=>JSON.stringify(f.crop))).size===1,'Hank uses one intact rear-facing work pose without abrupt sprite changes');
  check(frames.some(f=>Math.abs(f.c-frames[0].c)>.0005)&&frames.every((f,i)=>i===0||Math.abs(f.c-frames[i-1].c)<.01),'Working lean changes continuously between frames');
  check(await evaluate('IslandRoomWorld.coworkers.library.direction==="upper-left"'),'Hank faces the left workstation');
  await screenshot('room-scale-hank-v22.png');await clickUI('.room-close');await choose('lab');await screenshot('room-scale-lab-v22.png');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(150);await screenshot('room-scale-phone-v22.png');
  check(errors.length===0,'No browser errors: '+JSON.stringify(errors));await call('Browser.close');
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
