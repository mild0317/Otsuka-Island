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



  await evaluate('document.querySelector("#motion-toggle").click()');
  const setHour=hour=>evaluate(`(()=>{const s=document.querySelector('#light-time');s.value=${hour};s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const setRate=rate=>evaluate(`(()=>{const e=document.querySelector('#time-rate');e.value=${rate};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  check(await evaluate('(()=>{const d=document.querySelector("#playback-date");return d.tagName==="TIME"&&!d.isContentEditable&&!document.querySelector("#star-date")&&!document.querySelector("#star-direction")})()'),'Playback date is a read-only time element with no date/direction selectors');
  for(const [width,height]of [[1171,901],[390,844],[3840,2160]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});await clickUI('#fit');await setHour(6);await delay(160);
    const track=await evaluate(`(()=>{
      const a=__qaAtmosphere,v=__qaSkyView,m=a.getStarMap(),at=h=>({...v,lighting:{...v.lighting,hour:Math.floor(h),minute:0,second:(h%1)*3600}});
      const sun=[6,7,9,12,15,17,18].map(h=>a.sun(at(h))),moon=[18,19,21,0,3,5,6].map(h=>a.moon(at(h)));
      const anchors=list=>Math.abs(list[0].x)<.001&&Math.abs(list.at(-1).x-v.width)<.001&&Math.abs(list[0].y-list[0].horizon)<.001&&Math.abs(list.at(-1).y-list.at(-1).horizon)<.001;
      const travel=list=>list.every((p,i)=>!i||p.x>list[i-1].x)&&list.slice(0,4).every((p,i,l)=>!i||p.y<l[i-1].y)&&list.slice(3).every((p,i,l)=>!i||p.y>l[i-1].y);
      const before=a.moon(at(23.999999)),after=a.moon({...at(0),lighting:{...at(0).lighting,day:v.lighting.day+1}});
      const oldBody=m.body,oldAz=m.azimuth,oldEl=m.elevation,normal=[a.sun(at(9)),a.moon(at(22))];let independent;
      try{m.body=()=>{throw Error('The star-map body projection must not be used')};m.azimuth=270;m.elevation=12;independent=[a.sun(at(9)),a.moon(at(22))].every((p,i)=>p.x===normal[i].x&&p.y===normal[i].y);}finally{m.body=oldBody;m.azimuth=oldAz;m.elevation=oldEl;}
      return {sunAnchors:anchors(sun),moonAnchors:anchors(moon),sunTravel:travel(sun),moonTravel:travel(moon),independent,
        symmetric:[.1,.25,.4].every(p=>{const l=a.sun(at(6+p*12)),r=a.sun(at(18-p*12)),ml=a.moon(at(18+p*12)),mr=a.moon(at(6-p*12));return Math.abs(l.x+r.x-v.width)<1e-6&&Math.abs(l.y-r.y)<1e-6&&Math.abs(ml.x+mr.x-v.width)<1e-6&&Math.abs(ml.y-mr.y)<1e-6})&&Math.abs(a.sun(at(12)).x-v.width/2)<1e-6&&Math.abs(a.moon(at(0)).x-v.width/2)<1e-6,
        below:a.sun(at(5.75)).y>a.sun(at(5.75)).horizon&&a.sun(at(18.25)).y>a.sun(at(18.25)).horizon&&a.moon(at(17.75)).y>a.moon(at(17.75)).horizon&&a.moon(at(6.25)).y>a.moon(at(6.25)).horizon,
        midnight:Math.hypot(before.x-after.x,before.y-after.y),nightSun:a.sun(at(0)).alpha===0&&a.sun(at(22)).alpha===0,
        latitude:m.latitude,longitude:m.longitude};
    })()`);
    check(track.sunAnchors&&track.moonAnchors&&track.sunTravel&&track.moonTravel&&track.below&&track.symmetric,'Sun and Moon have symmetric left-to-right tracks with centred high points '+width+' '+JSON.stringify(track));
    check(track.independent&&track.midnight<.1&&track.nightSun,'The scene tracks are independent of the star map and continuous through midnight '+width);
    check(Math.abs(track.latitude-(25+45.4/3600))<1e-10&&Math.abs(track.longitude-(121+27/60+48.7/3600))<1e-10,'True stars retain the requested observer at '+width);
    for(const hour of [6,9,15,18,21,0]){await setHour(hour);await delay(100);await screenshot('horizon-track-'+width+'-'+hour+'-v94.png');}
    await evaluate('document.querySelector("#ui-toggle").click();document.querySelector(".playback-date-row").scrollIntoView({block:"center"})');await delay(100);
    check(await evaluate('(()=>{const r=document.querySelector(".playback-date-row").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})()'),'Read-only playback date fits viewport '+width);
    await screenshot('playback-date-'+width+'-v94.png');await evaluate('document.querySelector("#ui-toggle").click()');
  }
  await setHour(23.99);const day=await evaluate('islandGame.getState().lighting.day');
  await evaluate('document.querySelector("#motion-toggle").click()');await setRate(3600);
  await waitFor('islandGame.getState().lighting.day>'+day,'Accelerated clock crosses midnight');await setRate(0);
  const date=await evaluate('({day:islandGame.getState().lighting.day,date:document.querySelector("#playback-date").dateTime,text:document.querySelector("#playback-date").textContent})');
  check(date.day===day+1&&date.date===new Date(date.day*86400000).toISOString().slice(0,10)&&date.text===date.date.replaceAll('-','/'),'Read-only date rolls into the next playback day '+JSON.stringify(date));
  const stars=await evaluate(`(()=>{const a=__qaAtmosphere,v=__qaSkyView,at=day=>({...v,lighting:{...v.lighting,day,hour:22,minute:0,second:0}}),first=a.stars(at(v.lighting.day)),later=new Map(a.stars(at(v.lighting.day+1)).map(s=>[s.id,s]));return first.some(s=>later.has(s.id)&&Math.hypot(s.x-later.get(s.id).x,s.y-later.get(s.id).y)>1)})()`);
  check(stars,'The real star field changes with the playback date');
  await evaluate('document.querySelector("#live-time").click()');
  check(await evaluate('document.querySelector("#playback-date").dateTime===new Date(Date.now()+8*3600000).toISOString().slice(0,10)'),'Live time restores today in Taiwan');
  check(errors.length===0,'No browser errors '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
