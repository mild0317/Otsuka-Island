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
  for(const key of ['clock','library']){
    await choose(key);await evaluate('__qaNPC.load('+JSON.stringify(key)+')');await evaluate('__qaNPC.update=()=>{}');
    for(const station of key==='clock'?['computer','stool']:['computer','second']){
      await place(key,station,'type');await delay(120);await screenshot('seat-v36-'+key+'-'+station+'.png');
      const contact=await evaluate('(()=>{const key='+JSON.stringify(key)+',w=__qaNPC.workers[key],c=document.createElement("canvas");c.width=1536;c.height=1024;const g=c.getContext("2d");IslandNPCRenderer.draw(g,w,__qaNPC.images[key]);const pixels=g.getImageData(0,0,1536,1024).data;let bottom=-1;outer:for(let y=1023;y>=0;y--)for(let x=0;x<1536;x++)if(pixels[(y*1536+x)*4+3]>180){bottom=y;break outer}let mask=null;if(w.targetStation.back){const x=key==="clock"?1144:w.station==="computer"?720:1010,y=key==="clock"?660:w.station==="computer"?530:590;__qaNPC.draw(key,g,document.querySelector("#room-art"));const actual=g.getImageData(x,y,1,1).data,ref=document.createElement("canvas");ref.width=1536;ref.height=1024;const rg=ref.getContext("2d");rg.drawImage(document.querySelector("#room-art"),0,0,1536,1024);const expected=rg.getImageData(x,y,1,1).data;mask=[0,1,2].every(i=>Math.abs(actual[i]-expected[i])<=2)}return{bottom,floor:w.targetStation.floorY,mask}})()');
      check(Math.abs(contact.bottom-contact.floor)<3,'Rendered shoe sole touches the floor: '+key+'/'+station+' '+JSON.stringify(contact));
      if(contact.mask!==null)check(contact.mask,'Chair back is composited in front of the person: '+key+'/'+station);
    }
    if(key==='clock'){
      await evaluate('(()=>{const w=__qaNPC.workers.clock;w.x=910;w.y=875;w.station="pause";w.targetStation=w.profile.stations.pause;w.pose=w.previousPose="front";w.poseSign=w.previousSign=1;w.kind="stand";w.blend=1;w.time+=2})()');
      await evaluate('document.querySelector("#light-time").value=9.5;document.querySelector("#light-time").dispatchEvent(new Event("input"))');await delay(250);
      check(await evaluate('document.querySelector(".room-clock").dataset.time==="09:30:00"&&getComputedStyle(document.querySelector(".room-clock")).display!=="none"'),'Visible indoor clock follows the island time preview');
      await screenshot('room-clock-v36.png');
      const region=await evaluate('(()=>{const r=document.querySelector(".room-scene").getBoundingClientRect();return{x:r.x+1080*r.width/1536,y:r.y+110*r.height/1024,width:140*r.width/1536,height:150*r.height/1024,scale:4}})()');const cropped=await call('Page.captureScreenshot',{format:'png',clip:region});await writeFile(path.join(out,'room-clock-detail-v36.png'),Buffer.from(cropped.data,'base64'));
      await floorClick({x:340,y:736});await waitFor('document.querySelector(".copyright-dialog").open','Book opens copyright');
      await waitFor('document.querySelector(".copyright-dialog iframe").contentDocument?.querySelector("header img")?.naturalWidth>0','Copyright logo loads');
      check(await evaluate('(()=>{const d=document.querySelector(".copyright-dialog iframe").contentDocument;return d.body.textContent.includes("Copyright © 大塚資訊科技股份有限公司")&&d.body.textContent.includes("All Rights Reserved.")&&d.querySelectorAll("main p").length===4&&d.body.textContent.includes("本權利聲明不得視為授予第三人任何明示或默示之授權或其他權利。")})()'),'Copyright contains the supplied full declaration');
      await screenshot('copyright-desktop-v36.png');
      await clickUI('.copyright-close');check(await evaluate('document.querySelector("#room-dialog").open&&!document.querySelector(".copyright-dialog").open'),'Copyright closes back to the same room');
      for(const [width,height]of [[390,844],[3840,2160]]){
        await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});await delay(120);await floorClick({x:340,y:736});await waitFor('document.querySelector(".copyright-dialog").open','Responsive book click');
        check(await evaluate('(()=>{const f=document.querySelector(".copyright-dialog iframe"),d=f.contentDocument;return d.documentElement.scrollWidth<=f.clientWidth+1&&d.querySelector("header img").naturalWidth>0})()'),'Copyright and logo fit '+width+'x'+height);await screenshot('copyright-'+width+'-v36.png');await clickUI('.copyright-close');
      }
      await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate('document.querySelector("#live-time").click()');await delay(250);check(await evaluate('document.querySelector(".room-clock").dataset.time.slice(0,5)===document.querySelector("#island-time").textContent'),'Room clock returns to live island time');
    }
    await clickUI('.room-close');
  }
  check(errors.length===0,'No browser errors: '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
