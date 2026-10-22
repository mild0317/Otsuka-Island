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

  await evaluate(String.raw`(()=>{const clear=CanvasRenderingContext2D.prototype.clearRect,draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.clearRect=function(...a){if(this.canvas.matches?.('.room-world'))window.__qaSeatPaints=[];return clear.apply(this,a)};CanvasRenderingContext2D.prototype.drawImage=function(im,...a){if(this.canvas.matches?.('.room-world')&&im?.src&&/assets\/(chair-|npc-.*(?:office|stool|seated-chair)-v42)/.test(im.src))(__qaSeatPaints||=[]).push(im.src.split('/').at(-1));return draw.call(this,im,...a)}})()`);
  for(const key of ['clock','library','lab']){
    await choose(key);await evaluate('__qaNPC.load('+JSON.stringify(key)+')');await waitFor('IslandRoomSeating.ready('+JSON.stringify(key)+')','Seating assets ready',500);await evaluate('__qaNPC.update=()=>{}');
    const stations=key==='clock'?['computer','stool']:['computer','second'];
    for(const station of [...stations,'stand']){
      if(station==='stand')await evaluate('(()=>{const w=__qaNPC.workers['+JSON.stringify(key)+'];__qaNPC.random=()=>.9;w.lastFixedPose=null;__qaNPC.settle(w);w.time+=2;})()');
      else await place(key,station,'type');
      await delay(180);
      const snapshot=await evaluate('IslandRoomSeating.snapshot('+JSON.stringify(key)+',__qaNPC.workers['+JSON.stringify(key)+'])');
      check(snapshot.chairs.length===2&&snapshot.chairs.filter(c=>c.layer==='person-with-chair').length===(station==='stand'?0:1),'Exactly two seats, occupied seat replaces its empty image: '+key+'/'+station);
      check(await evaluate('document.querySelector("#room-art").src.includes("chair-clean-v42")'),'Room art contains no baked-in chairs: '+key);
      const paints=await evaluate('[...new Set(__qaSeatPaints)]');
      check(paints.length===new Set(snapshot.chairs.map(c=>c.asset)).size&&snapshot.chairs.every(c=>paints.includes(c.asset)),'Rendered chair assets agree with layer state: '+JSON.stringify(paints));
      await screenshot('seating-'+key+'-'+station+'-v42.png');
      if(station!=='stand'){
        const stable=await evaluate('(()=>{const w=__qaNPC.workers['+JSON.stringify(key)+'],s=IslandRoomSeating.snapshot(w.key,w).chairs.find(c=>c.layer==="person-with-chair"),create=()=>{const c=document.createElement("canvas");c.width=1536;c.height=1024;return c},a=create(),b=create(),time=w.time;IslandRoomSeating.drawOccupied(a.getContext("2d"),w);w.time+=1;IslandRoomSeating.drawOccupied(b.getContext("2d"),w);w.time=time;const y=Math.ceil(s.y+s.height*.55),height=Math.floor(s.height*.44),x=Math.floor(s.x),width=Math.ceil(s.width),p=a.getContext("2d").getImageData(x,y,width,height).data,q=b.getContext("2d").getImageData(x,y,width,height).data;return p.every((v,i)=>v===q[i]);})()');
        check(stable,'Seat, legs and wheels remain pinned during breathing: '+key+'/'+station);
      }
    }
    await evaluate('window.__qaFast=true');await openEquipment();await evaluate('window.__qaFast=false');await waitFor('document.querySelector(".ppt-slide").naturalWidth>0&&!document.querySelector(".ppt-slide").hidden','PPT still opens after seating change',400);await clickUI('.room-back');
    for(const [width,height]of [[390,844],[3840,2160]]){
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});await delay(150);
      check(await evaluate('(()=>{const r=document.querySelector(".room-scene").getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})()'),'Room layers fit '+width+' '+key);
      await screenshot('seating-'+key+'-'+width+'-v42.png');
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await clickUI('.room-close');
  }
  check(errors.length===0,'No browser errors: '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
