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



  const change=async(id,value)=>evaluate(`(()=>{const e=document.getElementById('${id}');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const hour=async(value)=>evaluate(`(()=>{const e=document.querySelector('#light-time');e.value=${value};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await hour(22);await delay(300);
  check(await evaluate('__qaAtmosphere.getStarMap().stars.length===41411'),'Real catalogue loads locally');
  check(await evaluate('!document.querySelector("#star-date")&&!document.querySelector("#star-direction")'), 'Date and direction selectors are removed');
  check(await evaluate('(()=>{const m=__qaAtmosphere.getStarMap();return Math.abs(m.latitude-(25+45.4/3600))<1e-10&&Math.abs(m.longitude-(121+27/60+48.7/3600))<1e-10&&m.azimuth===150})()'), 'Requested DMS coordinates and fixed southeast view are used');
  const frame=await evaluate(`(()=>{const a=__qaAtmosphere,v=__qaSkyView,m=a.getStarMap(),s=a.stars(v),later=a.stars({...v,lighting:{...v.lighting,hour:23}}),index=new Map(later.map(s=>[s.id,s]));const common=s.filter(s=>index.has(s.id));return{count:s.length,move:Math.max(...common.map(s=>Math.hypot(s.x-index.get(s.id).x,s.y-index.get(s.id).y))),below:m.visible(v).some(s=>s.altitude<=0),date:new Date(m.utc(v.lighting)).toISOString()}})()`);
  check(frame.count>30&&frame.move>50&&!frame.below&&frame.date.includes('T14:'),'Scene UTC+8 clock drives visible stars above the true horizon '+JSON.stringify(frame));
  const arcs=await evaluate(`(()=>{const a=__qaAtmosphere,v=__qaSkyView,at=h=>({...v,lighting:{...v.lighting,hour:h,minute:0,second:0}}),first=new Map(a.stars(at(21)).map(s=>[s.id,s])),last=new Map(a.stars(at(23)).map(s=>[s.id,s]));return a.stars(at(22)).filter(s=>first.has(s.id)&&last.has(s.id)).map(q=>{const p=first.get(q.id),r=last.get(q.id),dx=r.x-p.x,dy=r.y-p.y;return Math.abs(dx*(p.y-q.y)-(p.x-q.x)*dy)/Math.hypot(dx,dy)})})()`);
  check(arcs.length>10&&arcs.filter(s=>s>1).length>arcs.length*.7,'Browser star positions follow curved tracks, including shallow arcs near inflections '+JSON.stringify({samples:arcs.length,curved:arcs.filter(s=>s>1).length,minSag:Math.min(...arcs),maxSag:Math.max(...arcs)}));
  const seasonal=await evaluate(`(()=>{const v=__qaSkyView,m=__qaAtmosphere.getStarMap(),summer=m.visible({...v,lighting:{...v.lighting,day:Math.floor(Date.parse('2026-07-15')/86400000)}},4.6),winter=m.visible({...v,lighting:{...v.lighting,day:Math.floor(Date.parse('2026-01-15')/86400000)}},4.6),ids=new Set(summer.map(s=>s.id));return{summer:summer.length,winter:winter.length,common:winter.filter(s=>ids.has(s.id)).length}})()`);
  check(seasonal.common<Math.min(seasonal.summer,seasonal.winter)*.8,'Different seasons show different visible star fields '+JSON.stringify(seasonal));
  const fixed=await evaluate(`(()=>{const a=__qaAtmosphere,v=__qaSkyView,seed=a.seed,before=a.stars(v);a.seed+=13;const after=a.stars(v);a.seed=seed;return before.every((s,i)=>s.id===after[i].id&&s.x===after[i].x&&s.y===after[i].y)&&before.some((s,i)=>s.alpha!==after[i].alpha)})()`);
  check(fixed,'Random session changes scintillation without scrambling actual constellations');
  await evaluate('document.querySelector("#star-lines").click()');await delay(100);
  check(await evaluate('__qaAtmosphere.getStarMap().showLines&&document.querySelector("#star-lines").getAttribute("aria-pressed")==="true"'),'Constellation lines and names toggle on');
  const ink=await evaluate(`(()=>{const v=__qaSkyView,c=document.createElement('canvas');c.width=v.width;c.height=v.height;__qaAtmosphere.getStarMap().drawConstellations(c.getContext('2d'),v);const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<p.length;i+=4)if(p[i])n++;return n})()`);
  check(ink>2000,'Constellation lines and labels produce visible pixels '+ink);
  const before=await evaluate('({stars:__qaAtmosphere.stars(__qaSkyView).map(s=>({id:s.id,x:s.x,y:s.y})),key:__qaAtmosphere.galaxy.key})');
  await change('time-rate','3600');await delay(650);await change('time-rate','0');
  const advance=await evaluate(`(()=>{const before=${JSON.stringify(before)},a=__qaAtmosphere,s=a.stars(__qaSkyView),map=new Map(s.map(s=>[s.id,s]));return{move:Math.max(...before.stars.filter(s=>map.has(s.id)).map(s=>Math.hypot(s.x-map.get(s.id).x,s.y-map.get(s.id).y))),galaxy:a.galaxy.key!==before.key}})()`);
  check(advance.move>5&&advance.galaxy,'Time multiplier rotates both real stars and Milky Way '+JSON.stringify(advance));
  const pause=await evaluate(`(()=>{const a=__qaAtmosphere,v=__qaSkyView,p=a.stars(v),q=a.stars({...v,time:v.time+3});return{stable:p.every((s,i)=>s.id===q[i].id&&s.x===q[i].x&&s.y===q[i].y),twinkle:p.filter((s,i)=>Math.abs(s.alpha-q[i].alpha)>.02).length}})()`);
  check(pause.stable&&pause.twinkle>15,'Clock pause holds positions while stars scintillate '+JSON.stringify(pause));
  await hour(22);await evaluate('document.querySelector("#motion-toggle").click()');await delay(150);
  await screenshot('real-stars-fixed-v99.png');
  for(const [width,height,dpr] of [[390,844,3],[3840,2160,1]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:width<900});await delay(200);
    const size=await evaluate('({w:__qaAtmosphere.celestialCanvas.width,h:__qaAtmosphere.celestialCanvas.height})');
    check(size.w>=width*dpr&&size.h>=height*dpr,'Native star resolution at '+width+' DPR '+dpr);
    await screenshot('real-stars-'+width+'-v99.png');
    await evaluate('document.querySelector("#ui-toggle").click();document.querySelector(".star-panel").scrollIntoView({block:"center"})');await delay(100);
    check(await evaluate('(()=>{const r=document.querySelector(".star-panel").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})()'),'Star controls fit viewport '+width);
    await screenshot('real-stars-controls-'+width+'-v99.png');
    await evaluate('document.querySelector("#ui-toggle").click()');
  }
  await evaluate('document.querySelector("#live-time").click()');
  check(await evaluate('islandGame.getState().timeMode==="live"&&islandGame.getState().lighting.day===Math.floor((Date.now()+8*3600000)/86400000)'),'Live time restores current Taiwan date');
  await hour(12);await delay(150);check(await evaluate('__qaAtmosphere.stars(__qaSkyView).length===0'),'Daylight hides stars');
  check(errors.length===0,'No browser errors '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
