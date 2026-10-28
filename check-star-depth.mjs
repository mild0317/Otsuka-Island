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



  await evaluate(`document.querySelector('#motion-toggle').click();(()=>{const s=document.querySelector('#light-time');s.value=22;s.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(220);
  const depth=await evaluate(`(()=>{
    const a=__qaAtmosphere,v=__qaSkyView,stars=a.stars(v),moved=a.stars({...v,camera:{...v.camera,x:v.camera.x+300}}),later=a.stars({...v,time:v.time+3});
    const movedById=new Map(moved.map(s=>[s.id,s]));
    const near=stars.map(s=>s.flare&&movedById.has(s.id)?Math.abs(movedById.get(s.id).x-s.x):0).filter(Boolean),middle=stars.map(s=>!s.flare&&movedById.has(s.id)?Math.abs(movedById.get(s.id).x-s.x):0).filter(Boolean);
    return{near:[Math.min(...near),Math.max(...near)],middle:[Math.min(...middle),Math.max(...middle)],flares:stars.filter(s=>s.flare).length,steady:stars.every((s,i)=>s.x===later[i].x&&s.y===later[i].y),twinkles:stars.filter((s,i)=>Math.abs(s.alpha-later[i].alpha)>.04).length};
  })()`);
  check(depth.near[0]>0&&Math.abs(depth.near[1]-depth.middle[1])<1e-8&&depth.near[1]<10&&depth.flares>=1,'The real celestial sphere pans subtly without distorting constellations '+JSON.stringify(depth));
  check(depth.steady&&depth.twinkles>15,'Independent twinkles change brightness without jittering star positions');
  const optics=await evaluate(`(()=>{
    const a=__qaAtmosphere,original=a.stars,c=document.createElement('canvas');c.width=c.height=100;
    a.stars=()=>[{x:50,y:50,radius:1.5,alpha:1,flare:true,angle:.12,warm:false}];a.drawStars(c.getContext('2d'),__qaSkyView,false);a.stars=original;
    const p=c.getContext('2d').getImageData(0,0,100,100).data;let peak=0,halo=0,rays=0;
    for(let y=0;y<100;y++)for(let x=0;x<100;x++){const i=(y*100+x)*4,d=Math.hypot(x-50,y-50);peak=Math.max(peak,p[i+3]);if(d>5&&d<20&&p[i+3]>0)halo++;if(d>10&&d<23&&p[i+3]>2)rays++;}
    return{peak,halo,rays};
  })()`);
  check(optics.peak>230&&optics.halo>100&&optics.rays>10,'Bright stars have a concentrated white core, bloom and long faint rays '+JSON.stringify(optics));
  for(const [width,height,dpr]of [[1440,1000,1],[1440,1000,2],[390,844,3],[3840,2160,1]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:width<900});await clickUI('#fit');await delay(180);
    const render=await evaluate(`(()=>{const a=__qaAtmosphere,v=__qaSkyView,c=a.celestialCanvas,f=a.galaxy.canvas;return{celestial:[c.width,c.height],far:[f.width,f.height],points:a.galaxy.points,sky:[a.buffers.sky.canvas.width,a.buffers.sky.canvas.height],viewport:[v.width,v.height]}})()`);
    check(render.celestial[0]>=width*dpr&&render.celestial[1]>=height*dpr&&render.far[0]>=width*dpr&&render.far[1]>=height*dpr,'Resolved stars retain native display pixel density '+JSON.stringify({width,height,dpr,...render}));
    await screenshot('star-depth-'+width+'-dpr'+dpr+'-v99.png');
    const paused=await evaluate('(()=>{const c=__qaAtmosphere.celestialCanvas;return c.toDataURL()})()');await delay(160);
    check(await evaluate('(()=>{const c=__qaAtmosphere.celestialCanvas;return c.toDataURL()})()')===paused,'Pause freezes every celestial layer '+width+' DPR '+dpr);
  }
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await clickUI('#fit');await delay(120);
  const before=await evaluate('({camera:{...__qaSkyView.camera},stars:__qaAtmosphere.stars(__qaSkyView),point:islandGame.worldToScreen({x:562,y:1000})})');
  await call('Input.dispatchMouseEvent',{type:'mousePressed',x:150,y:380,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:350,y:480,button:'left',buttons:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:350,y:480,button:'left',clickCount:1});await delay(100);
  const after=await evaluate('({camera:{...__qaSkyView.camera},stars:__qaAtmosphere.stars(__qaSkyView),point:islandGame.worldToScreen({x:562,y:1000})})');
  const movedStars=new Map(after.stars.map(s=>[s.id,s]));
  const islandShift=after.point.x-before.point.x,starShift=Math.max(...before.stars.filter(s=>movedStars.has(s.id)).map(s=>Math.abs(movedStars.get(s.id).x-s.x)));
  check(Math.abs(islandShift-200)<1&&starShift>0&&starShift<islandShift*.10,'Real dragging separates the island from the distant celestial sphere '+JSON.stringify({islandShift,starShift}));await screenshot('star-depth-dragged-v99.png');
  await evaluate(`(()=>{const s=document.querySelector('#light-time');s.value=12;s.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(100);
  check(await evaluate('__qaAtmosphere.stars(__qaSkyView).length===0&&__qaAtmosphere.sun(__qaSkyView).elevation>0'),'Daylight sun remains separate from the true star-map projection');
  check(errors.length===0,'No browser errors '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
