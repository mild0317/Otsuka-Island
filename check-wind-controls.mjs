import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
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
  const check = (ok, message) => { if (!ok) throw Error(message); console.log('PASS', message); };
  await call('Runtime.enable');await call('Log.enable');await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'IslandAtmosphere',{configurable:true,set(Class){class Observed extends Class{constructor(...args){super(...args);window.__qaAtmosphere=this;this.seed=23.5;}background(g,view){window.__qaSkyView={...view,camera:{...view.camera}};super.background(g,view)}}Object.defineProperty(window,'IslandAtmosphere',{value:Observed,writable:true,configurable:true})}})"});
  await call('Page.navigate',{url:process.env.ISLAND_TEST_URL||'http://127.0.0.1:4173'});
  const waitFor=async(expression,label,max=160)=>{for(let i=0;i<max;i++){if(await evaluate(expression))return;await delay(50);}throw Error(label+' '+JSON.stringify({errors,state:await evaluate('({room:islandGame?.roomState(),cat:islandGame?.catState()})')}));};
  await waitFor('!!window.islandGame?.getState().ready','Assets ready');check(true,'Island, shared doctor renderer and cat sprite load');
  check(await evaluate('document.querySelector("#loading p").textContent==="正在前往Otsuka-Island"'),'Loading message matches the requested wording');


  const input=async(id,value)=>evaluate(`(()=>{const e=document.getElementById('${id}');e.value=${value};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const snapshot=()=>evaluate('islandGame.getState().wind');
  check((await snapshot()).mode==='random','Wind direction is random by default');
  await evaluate('document.querySelector("#motion-toggle").click()');await delay(200);
  const offset=(await snapshot()).offset;
  await input('wind-speed',8);await input('wind-direction',90);
  check(await evaluate('islandGame.getState().wind.speed===8&&islandGame.getState().wind.mode==="manual"&&document.querySelector("#wind-random").getAttribute("aria-pressed")==="false"'),'Speed and direction sliders switch to manual wind');
  check(JSON.stringify(offset)===JSON.stringify((await snapshot()).offset),'Changing controls does not relocate existing clouds');
  const mechanics=await evaluate(`(()=>{
    const observed=window.__qaAtmosphere;
    const result={cardinals:[],speeds:[],angles:[],maxTurn:0};
    for(const direction of [0,90,180,270]){const a=new IslandAtmosphere();a.setWind({mode:'manual',speed:1,direction});a.updateWind(10);result.cardinals.push(a.windSnapshot().offset);}
    for(const speed of [0,1,4]){const a=new IslandAtmosphere();a.setWind({mode:'manual',speed,direction:90});a.updateWind(10);result.speeds.push(a.windSnapshot().offset.x);}
    const a=new IslandAtmosphere(null,null,()=>.0235);let previous=a.wind.direction;
    for(let t=1;t<=240;t++){a.updateWind(t);const angle=a.wind.direction;result.maxTurn=Math.max(result.maxTurn,Math.abs(((angle-previous+540)%360)-180));if(t%20===0)result.angles.push(angle);previous=angle;}
    window.__qaAtmosphere=observed;return result;
  })()`);
  const [north,east,south,west]=mechanics.cardinals;
  check(north.y<0&&Math.abs(north.x)<1e-8&&east.x>0&&Math.abs(east.y)<1e-8&&south.y>0&&west.x<0,'North/east/south/west blow in the displayed screen direction');
  check(mechanics.speeds[0]===0&&Math.abs(mechanics.speeds[2]/mechanics.speeds[1]-4)<1e-8,'Zero wind stops drift and 4x wind travels four times farther');
  check(Math.max(...mechanics.angles)-Math.min(...mechanics.angles)>45&&mechanics.maxTurn<15,'Random wind changes smoothly over time');
  const pixels=await evaluate(`(()=>{
    const original=__qaAtmosphere,a=new IslandAtmosphere(null,null,()=>.0235,original.skyPlate,original.sunSky);window.__qaAtmosphere=original;
    const grab=(x,y)=>{a.windOffset={x,y};return new Uint8ClampedArray(a.cloudFrame(0).pixels.data)},before=grab(0,0),east=grab(.02,0),south=grab(0,.02);
    const error=(after,dx,dy)=>{let total=0;for(let y=50;y<150;y+=2)for(let x=140;x<620;x+=2)total+=Math.abs(before[(y*768+x)*4+3]-after[((y+dy)*768+x+dx)*4+3]);return total;};
    return {east:error(east,15,0),eastWrong:error(east,-15,0),south:error(south,0,8),southWrong:error(south,0,-8)};
  })()`);
  console.log('INFO rendered direction errors',pixels);
  check(pixels.east<pixels.eastWrong*.6&&pixels.south<pixels.southWrong*.6,'Rendered cloud texture follows east and south controls, including vertical motion');
  await evaluate('document.querySelector("#motion-toggle").click()');
  await waitFor('islandGame.getState().wind.offset.x>'+offset.x+'+.0001','Clouds follow the selected east wind');
  await input('wind-direction',270);const start=(await snapshot()).offset.x;
  await waitFor('islandGame.getState().wind.offset.x<'+start+'-.0001','Clouds reverse under west wind');
  await input('wind-direction',180);const down=(await snapshot()).offset.y;
  await waitFor('islandGame.getState().wind.offset.y>'+down+'+.0001','Vertical wind moves upper clouds down');
  await input('wind-speed',0);const stopped=(await snapshot()).offset;await delay(250);
  check(JSON.stringify(stopped)===JSON.stringify((await snapshot()).offset),'Zero speed freezes accumulated drift while the scene remains active');
  await evaluate('document.querySelector("#wind-random").click()');
  check((await snapshot()).mode==='random','Random direction can be restored');
  await input('wind-speed',4);
  console.log('INFO weather',await evaluate('({failed:__qaAtmosphere.workerFailed,error:__qaAtmosphere.weatherError,time:__qaAtmosphere.weatherTime})'));
  await waitFor('__qaAtmosphere.weatherTime!==undefined&&!__qaAtmosphere.workerFailed','Wind-aware background renderer ready');
  for(const [width,height]of [[1440,1000],[390,844]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
    await evaluate('document.querySelector("#ui-toggle").click()');
    await evaluate('document.querySelector(".wind-panel").scrollIntoView({block:"center"})');await delay(150);
    check(await evaluate('(()=>{const r=document.querySelector(".wind-panel").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()'),'Wind controls remain visible at '+width);
    await screenshot('wind-controls-'+width+'-v66.png');
    await evaluate('document.querySelector("#ui-toggle").click()');
  }
  check(errors.length===0,'No browser errors '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
