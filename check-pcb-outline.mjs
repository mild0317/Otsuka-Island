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




  await choose('lab');await waitFor('__qaNPC.ready("lab")','NPC and chair assets ready',300);
  await evaluate('__qaNPC.update=()=>{};__qaCat.location="island";document.querySelector("#motion-toggle").click()');
  const group='.room-object[data-station="1"]';
  const probes=[[621,541],[644,521],[666,500],[790,474],[840,481],[885,488],[918,491],[915,532],[886,565],[861,593],[650,587],[690,595],[730,604]];
  for(const station of ['stand','computer','second']){
    if(station==='stand')await evaluate('(()=>{const w=__qaNPC.workers.lab;w.lastFixedPose=null;__qaNPC.random=()=>.9;__qaNPC.settle(w)})()');else await place('lab',station,'type');
    await delay(100);
    const region=await evaluate('(()=>{const r=document.querySelector(".room-scene").getBoundingClientRect();return{x:Math.floor(r.x+580/1536*r.width),y:Math.floor(r.y+450/1024*r.height),width:Math.ceil(380/1536*r.width),height:Math.ceil(185/1024*r.height),scale:1,sceneX:r.x,sceneY:r.y,sceneWidth:r.width,sceneHeight:r.height}})()');
    const {sceneX,sceneY,sceneWidth,sceneHeight,...clip}=region;
    const visible=await call('Page.captureScreenshot',{format:'png',clip});
    await evaluate('document.querySelector('+JSON.stringify(group)+').style.visibility="hidden"');await delay(35);
    const hidden=await call('Page.captureScreenshot',{format:'png',clip});
    await evaluate('document.querySelector('+JSON.stringify(group)+').style.removeProperty("visibility")');
    const comparison=await evaluate(`(async()=>{
      const load=async data=>{const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.drawImage(im,0,0);return{width:c.width,height:c.height,data:g.getImageData(0,0,c.width,c.height).data}};
      const a=await load(${JSON.stringify(visible.data)}),b=await load(${JSON.stringify(hidden.data)}),r=${JSON.stringify(region)};
      return ${JSON.stringify(probes)}.map(([x,y])=>{const px=Math.round(r.sceneX+x/1536*r.sceneWidth-r.x),py=Math.round(r.sceneY+y/1024*r.sceneHeight-r.y);let strongest=0;
        for(let yy=py-4;yy<=py+4;yy++)for(let xx=px-4;xx<=px+4;xx++){if(xx<0||yy<0||xx>=a.width||yy>=a.height)continue;const i=(yy*a.width+xx)*4;strongest=Math.max(strongest,(a.data[i]+a.data[i+1]+a.data[i+2]-b.data[i]-b.data[i+1]-b.data[i+2])/3)}return{x,y,brightnessGain:strongest};});
    })()`);
    const count=comparison.filter(p=>p.brightnessGain>8).length;
    check(count>=11,'PCB outer border is visibly rendered in actual screenshot: '+station+' '+count+'/'+probes.length+' '+JSON.stringify(comparison.map(p=>Math.round(p.brightnessGain))));
    await writeFile(path.join(out,'pcb-outer-border-'+station+'-v74.png'),Buffer.from(visible.data,'base64'));
  }
  await evaluate('window.__qaFast=true');await floorClick({x:770,y:550});await waitFor('islandGame.roomState().topicOpen&&islandGame.roomState().topic===1','PCB opens second PPT',260);
  await waitFor('document.querySelector(".ppt-slide").src.includes("/labtwo/")&&!document.querySelector(".ppt-slide").hidden','Correct central PCB presentation');await clickUI('.room-back');await evaluate('window.__qaFast=false');
  for(const [width,height]of [[390,844],[3840,2160]]){await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});await delay(150);await screenshot('pcb-outer-border-'+width+'-v74.png');}
  check(errors.length===0,'No browser errors '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
