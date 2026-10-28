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
  await call('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'IslandAtmosphere',{configurable:true,set(Class){class Observed extends Class{constructor(...args){super(...args);window.__qaAtmosphere=this;}background(g,view){window.__qaSkyView={...view,camera:{...view.camera}};super.background(g,view)}}Object.defineProperty(window,'IslandAtmosphere',{value:Observed,writable:true,configurable:true})}})"});
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

  await evaluate('document.querySelector("#motion-toggle").click()');await delay(100);
  await evaluate('(()=>{const slider=document.querySelector("#light-time");slider.value=12;slider.dispatchEvent(new Event("input",{bubbles:true}));})()');await delay(150);
  const sample=()=>evaluate('({sea:__qaAtmosphere.sea(__qaSkyView),nearSea:__qaAtmosphere.sea(__qaSkyView,true),island:islandGame.worldToScreen({x:562,y:1000}),view:__qaSkyView})');
  check(await evaluate('__qaAtmosphere.skyPlate.naturalWidth>1000&&!__qaAtmosphere.layout'),'Selected reference sky includes upper wisps without repeated sprites');
  check(await evaluate('(()=>{const c=__qaAtmosphere.buffers.sky.canvas,p=c.getContext("2d").getImageData(Math.floor(c.width*.5),Math.floor(c.height*.4),1,1).data;return p[2]>p[0]*2&&p[0]<140&&p[2]>180})()'),'Upper sky matches the bright azure reference');
  check(await evaluate('getComputedStyle(document.querySelector(".brand")).color==="rgb(245, 250, 255)"'),'White wordmark remains readable');
  check(await evaluate('(()=>{const a=__qaAtmosphere,v=__qaSkyView,noon=a.sun({...v,lighting:{hour:12,minute:0,second:0}}),night=a.sun({...v,lighting:{hour:0,minute:0,second:0}}),morning=a.sun({...v,lighting:{hour:8,minute:0,second:0}});return noon.radius>=14&&noon.radius<=40&&noon.elevation>0&&noon.alpha>0&&night.alpha===0&&Math.abs(noon.x-morning.x)>10&&Math.abs(noon.y-morning.y)>5})()'),'Sun follows the independent left-to-right scene path by day and stays hidden at night');
  check(await evaluate('(()=>{const a=__qaAtmosphere,v=__qaSkyView;return Math.abs(a.sun({...v,time:0}).alpha-a.sun({...v,time:60}).alpha)<.6&&a.islands(v).length>=2&&a.islands(v).length<=3&&a.islands(v).every(i=>i.w<=96&&i.depth<.1&&i.alpha===1)})()'),'Gentle sun variability and full-opacity distant islands');
  check(await evaluate('!!islandGame.sceneSnapshot().unifiedArt&&islandGame.sceneSnapshot().plantPatches===6'),'Unified island master and six vegetation patches animated');
  for(const t of [0,2,7])check(await evaluate('islandGame.treeCoverageAt('+t+')===0'),'Wind leaves no transparent holes '+t);
  check(await evaluate('(()=>{const c=document.createElement("canvas");c.width=64;c.height=32;const g=c.getContext("2d");g.drawImage(__qaAtmosphere.skyPlate,0,0,64,32);const p=g.getImageData(0,16,64,16).data,values=[];for(let i=0;i<p.length;i+=4)if(p[i+3]>240)values.push((p[i]+p[i+1]+p[i+2])/3);return Math.max(...values)-Math.min(...values)>30})()'),'Cloud sea includes lit peaks and shaded valleys');
  check(await evaluate('(()=>{const a=__qaAtmosphere,v=__qaSkyView,back=a.sea(v),near=a.sea(v,true);return a.skyPlate.naturalWidth>1000&&back.x<0&&back.x+back.w>v.width&&back.y+back.h>v.height&&near.depth>back.depth&&back.horizon>v.height*.55&&back.horizon<v.height*.82})()'),'Continuous cloud sea fills the horizon and retains near/far depth');
  check(await evaluate('(()=>{const a=__qaAtmosphere,v={...__qaSkyView,width:390,height:844,time:0,lighting:{hour:12,minute:0,second:0}},c=document.createElement("canvas");c.width=390;c.height=844;const g=c.getContext("2d");g.fillStyle="#3b9fdf";g.fillRect(0,0,390,844);a.drawSun(g,v);const p=g.getImageData(0,0,390,844).data;let white=0;for(let i=0;i<p.length;i+=4)if(p[i]>240&&p[i+1]>240&&p[i+2]>240)white++;return white>200})()'),'Visible broad white solar core on phone');
  check(await evaluate('__qaAtmosphere.sunSky.naturalWidth>1000&&__qaAtmosphere.sunTexture.width===768&&!__qaAtmosphere.drawSunRays'),'Photographic sunlight replaces procedural orb and ray layers');
  check(await evaluate('(()=>{const a=__qaAtmosphere,v=__qaSkyView,night={...v,lighting:{hour:22,minute:0,second:0}},stars=a.stars(night),later=a.stars({...night,time:night.time+2});return a.stars({...v,lighting:{hour:12,minute:0,second:0}}).length===0&&stars.length>=45&&a.night({...v,lighting:{hour:18,minute:0,second:0}})>0&&a.night({...v,lighting:{hour:18,minute:0,second:0}})<1&&stars.every((s,i)=>s.x===later[i].x&&s.y===later[i].y)&&stars.some((s,i)=>Math.abs(s.alpha-later[i].alpha)>.05)})()'),'Stars fade at dusk, twinkle in place at night and vanish by day');
  check(await evaluate('(()=>{const birds=new IslandBirds({random:()=>.75});birds.update(4,null,true);if(!birds.birds.length)return false;birds.update(4,null,false);if(birds.snapshot().count||birds.targetCount||birds.active)return false;birds.update(500,null,false);if(birds.birds.length)return false;birds.update(501,null,true);return birds.active&&birds.targetCount===3&&birds.birds.length===3})()'),'Bird population stays empty overnight and restarts in daylight');
  check(await evaluate('(()=>{const a=__qaAtmosphere,im=a.islandTextures()[0],p=im.getContext("2d").getImageData(0,0,im.width,im.height).data,m=a.cloudCover.getContext("2d").getImageData(0,0,a.cloudCover.width,a.cloudCover.height).data;let opaque=0,clearCloud=0,solidCloud=0;for(let i=3;i<p.length;i+=4)if(p[i]>=245)opaque++;for(let i=3;i<m.length;i+=4){if(m[i]<5)clearCloud++;if(m[i]>240)solidCloud++;}return opaque>10000&&clearCloud>10000&&solidCloud>10000})()'),'Distant islands retain opaque artwork and actual clouds provide occlusion');
  const before=await sample();await screenshot('atmosphere-before-v81.png');
  await call('Input.dispatchMouseEvent',{type:'mousePressed',x:200,y:200,button:'left',clickCount:1});
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:400,y:300,button:'left',buttons:1});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:400,y:300,button:'left',clickCount:1});await delay(120);
  const after=await sample(),dx=after.island.x-before.island.x,dy=after.island.y-before.island.y;
  check(Math.abs(dx-200)<1&&Math.abs(dy-100)<1,'Island responds to real drag');
  for(const [name,depth]of [['sea',.065],['nearSea',.32]])check(Math.abs((after[name].x-before[name].x)/dx-depth)<.001&&Math.abs((after[name].y-before[name].y)/dy-depth)<.001,'Independent continuous '+name+' parallax '+depth);
  await screenshot('atmosphere-dragged-v81.png');
  const old=after.sea;await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:720,y:500,deltaX:0,deltaY:-500});await delay(150);
  const zoomed=await sample(),far=zoomed.sea;
  check(zoomed.view.camera.zoom>1&&far.w/old.w<1.04,'Zoom enlarges island while distant cloud scale stays stable');await screenshot('atmosphere-zoomed-v81.png');
  const t0=zoomed.view.time;await delay(150);check((await sample()).view.time===t0,'Pause freezes cloud wind without freezing drag');
  await evaluate('document.querySelector("#motion-toggle").click()');await delay(250);check((await sample()).view.time>t0,'Wind resumes');
  for(const [width,height]of [[390,844],[3840,2160]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});await clickUI('#fit');await delay(150);await screenshot('atmosphere-'+width+'-v81.png');
    const metrics=await evaluate('(async()=>{const values=[];let last=performance.now();for(let i=0;i<8;i++){await new Promise(requestAnimationFrame);const now=performance.now();values.push(now-last);last=now}return values.reduce((a,b)=>a+b,0)/values.length})()');console.log('INFO average frame ms',width,Math.round(metrics));
    check(await evaluate('__qaAtmosphere.skyPlate.naturalWidth>1000&&__qaAtmosphere.buffers.fog.canvas.width===Math.ceil(innerWidth*Math.min(1,1536/Math.max(innerWidth,innerHeight)))'),'Cached cloud textures and correctly resized fog buffer '+width);
  }
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await clickUI('#fit');
  const timeSamples={};
  for(const [hour,name]of [[17.8,'golden-hour'],[18.3,'dusk'],[22,'night'],[6,'dawn'],[12,'day']]){
    await evaluate('(()=>{const slider=document.querySelector("#light-time");slider.value='+hour+';slider.dispatchEvent(new Event("input",{bubbles:true}));})()');await delay(180);await screenshot('atmosphere-'+name+'-v81.png');
    check(await evaluate('islandGame.getState().lighting.hour===Math.floor('+hour+')'),'Time preview drives sky '+name);
    timeSamples[name]=await evaluate('(()=>{const c=__qaAtmosphere.buffers.sky.canvas,p=c.getContext("2d").getImageData(Math.floor(c.width*.85),Math.floor(c.height*.57),1,1).data;return {pixel:[...p],lighting:islandGame.getState().lighting,birds:islandGame.sceneSnapshot().birds}})()');
    if(hour<6.5||hour>=18.8)check(!timeSamples[name].birds.active&&timeSamples[name].birds.count===0&&timeSamples[name].birds.targetCount===0,'No birds at '+name);

  }
  check(timeSamples.dusk.pixel[0]/timeSamples.dusk.pixel[2]>timeSamples.day.pixel[0]/timeSamples.day.pixel[2]*1.4&&timeSamples.dusk.lighting.dusk>.8&&timeSamples.dusk.lighting.length>timeSamples.day.lighting.length*2,'Dusk sky is warmer with longer cast shadows');
  await choose('clock');await evaluate('(()=>{const slider=document.querySelector("#light-time");slider.value=17.8;slider.dispatchEvent(new Event("input",{bubbles:true}));})()');await waitFor('parseFloat(getComputedStyle(document.querySelector(".room-time-tone")).opacity)>.8','Room dusk transition');
  check(await evaluate('parseFloat(getComputedStyle(document.querySelector(".room-time-tone")).opacity)>.8'),'Room receives synchronized dusk lighting');await screenshot('room-dusk-v81.png');await clickUI('.room-close');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await clickUI('#fit');await evaluate('(()=>{const slider=document.querySelector("#light-time");slider.value=22;slider.dispatchEvent(new Event("input",{bubbles:true}));})()');await delay(150);await screenshot('atmosphere-night-mobile-v81.png');
  check(errors.length===0,'No browser errors '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
