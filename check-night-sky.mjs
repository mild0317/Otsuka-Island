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


  const setHour=hour=>evaluate(`(()=>{const s=document.querySelector('#light-time');s.value=${hour};s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const setRate=rate=>evaluate(`(()=>{const s=document.querySelector('#time-rate');s.value=${rate};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const state=()=>evaluate('islandGame.getState()');
  const hour=s=>s.lighting.hour+s.lighting.minute/60+s.lighting.second/3600;
  await setHour(22);await delay(350);
  check(await evaluate(`(()=>{const a=__qaAtmosphere,v=__qaSkyView,c=a.galaxyTexture(v),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let sum=0,clear=0,resolved=0;for(let i=3;i<p.length;i+=4){sum+=p[i];if(p[i]<3)clear++;if(p[i]>3)resolved++;}return c===a.galaxyTexture(v)&&sum>50000&&clear>p.length/12&&resolved>1000&&a.stars(v).some(s=>s.radius<.5)&&a.stars(v).some(s=>s.radius>.95)})()`),'Cached catalogue stars, unresolved galactic dust and magnitude-dependent sizes are present');
  check(await evaluate(`(()=>{const a=__qaAtmosphere,v=__qaSkyView,c=a.moonTexture(),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data,values=[];for(let i=0;i<p.length;i+=4)if(p[i+3]>250)values.push(p[i]);const m=a.moon(v);return Math.max(...values)-Math.min(...values)>60&&m.elevation>0&&m.x>0&&m.x<v.width&&m.radius>=10&&m.alpha>.9&&a.moon({...v,lighting:{hour:12,minute:0}}).alpha===0})()`),'Textured moon follows the independent night path above the cloud horizon');
  const layers=await evaluate(`(()=>{const a=__qaAtmosphere,v=__qaSkyView,paint=fn=>{const c=document.createElement('canvas');c.width=v.width;c.height=v.height;const g=c.getContext('2d');fn(g);const p=g.getImageData(0,0,c.width,c.height).data;let alpha=0;for(let i=3;i<p.length;i+=4)alpha+=p[i];return alpha},moonlight=paint(g=>a.drawMoonlight(g,v)),night=paint(g=>a.drawNightSky(g,v));const original=a.visualCloudFrame;const cloud=document.createElement('canvas');cloud.width=64;cloud.height=32;cloud.getContext('2d').fillRect(0,0,64,32);a.visualCloudFrame=()=>({canvas:cloud});const blocked=paint(g=>a.drawNightSky(g,v));a.visualCloudFrame=()=>null;const clear=paint(g=>a.drawNightSky(g,v));a.visualCloudFrame=original;return{moonlight,night,blocked,clear}})()`);
  check(layers.moonlight>10000&&layers.night>10000&&layers.blocked<layers.clear*.05,'Cloud banks receive moonlight and obscure celestial objects '+JSON.stringify(layers));
  const meteor=await evaluate(`(()=>{const a=__qaAtmosphere,v=__qaSkyView,start=a.nightSince;let visible;for(let t=0;t<12;t+=.05){const m=a.meteors({...v,time:start+t});if(m[0]?.alpha>.95){visible={elapsed:t,...m[0]};break;}}let active=0;for(let t=0;t<180;t+=.1)if(a.meteors({...v,time:start+t}).length)active++;return{visible,duty:active/1800,day:a.meteors({...v,lighting:{hour:12,minute:0}}).length}})()`);
  check(meteor.visible&&meteor.duty>.01&&meteor.duty<.07&&meteor.day===0,'Occasional short meteors appear after nightfall, never by day '+JSON.stringify(meteor));
  await evaluate(`__qaAtmosphere.nightSince=__qaSkyView.time-${meteor.visible.elapsed}`);await delay(80);await screenshot('night-sky-meteor-v89.png');
  check(await evaluate('islandGame.getState().timeRate===0'),'Scrubbing time freezes the selected hour');
  await setRate(3600);const before=await state();await delay(2200);const after=await state();
  const seconds=((hour(after)-hour(before)+24)%24)*3600,animation=after.cloudTime-before.cloudTime;
  check(seconds/animation>3000&&seconds/animation<3900,'3600x advances lighting independently of animation '+JSON.stringify({seconds,animation,ratio:seconds/animation}));
  await setRate(0);const frozen=await state();await delay(450);const later=await state();check(hour(frozen)===hour(later)&&later.cloudTime>frozen.cloudTime,'Time pause holds lighting while clouds and people continue');
  await setHour(23.99);const dayBefore=(await state()).lighting.day;await setRate(3600);await delay(350);await setRate(0);const dayAfter=await state();check(hour(dayAfter)<1&&dayAfter.lighting.day===dayBefore+1,'Accelerated time advances the date through midnight');
  await setHour(16.5);await setRate(1);const normal=await state();await delay(350);const normalLater=await state();check(hour(normalLater)>hour(normal)&&Math.abs(hour(normalLater)-hour(normal))<.001,'1x resumes from the selected time');
  await evaluate('document.querySelector("#live-time").click()');check(await evaluate('islandGame.getState().timeMode==="live"&&islandGame.getState().timeRate===1&&document.querySelector("#time-rate").value==="1"'),'Live resets acceleration and returns to Taiwan time');
  await setHour(22);await setRate(900);await choose('clock');const roomBefore=await state();await delay(600);const roomAfter=await state();check(hour(roomAfter)>hour(roomBefore)&&roomAfter.room!==null,'Time continues inside rooms');await clickUI('.room-close');
  await setHour(22);await setRate(900);await evaluate('document.querySelector("#motion-toggle").click()');const stopped=await state();await delay(350);const stoppedLater=await state();check(hour(stopped)===hour(stoppedLater)&&stopped.cloudTime===stoppedLater.cloudTime,'Global motion pause also stops accelerated time and meteor motion');await evaluate('document.querySelector("#motion-toggle").click()');await setRate(0);
  for(const [width,height]of [[1440,1000],[390,844],[3840,2160]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});await clickUI('#fit');await setHour(22);await delay(200);await screenshot('night-sky-'+width+'-v89.png');
    await clickUI('#ui-toggle');check(await evaluate(`(()=>{const s=document.querySelector('#time-rate');s.scrollIntoView({block:'center'});const r=s.getBoundingClientRect();return r.width>=90&&r.height>=44&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()`),'Time multiplier is reachable and sized for touch '+width);await screenshot('time-controls-'+width+'-v89.png');await clickUI('#ui-toggle');
  }
  check(errors.length===0,'No browser errors '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
