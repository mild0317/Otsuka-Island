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
  const click = async (x, y) => { await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
  const check = (ok, message) => { if (!ok) throw Error(message); console.log('PASS', message); };
  await call('Runtime.enable');await call('Log.enable');await call('Page.enable');
  await call('Page.navigate',{url:process.env.ISLAND_TEST_URL||'http://127.0.0.1:4173'});
  for(let i=0;i<100;i++){if(await evaluate('window.islandGame?.getState().ready'))break;await delay(100);}
  check(await evaluate('window.islandGame?.getState().ready'),'Full-screen scene and all local assets load');
  const textures=await evaluate('islandGame.sceneSnapshot()');
  check(textures.detailTextures.length===4&&textures.detailTextures.every(t=>t.width>=1200&&t.height>=1200),'Four independently rendered high-detail interior textures load');
  check(textures.displayResolution.width===768&&textures.displayResolution.height===480,'Animated PCB screens retain high-resolution display buffers');
  const clickElement=async selector=>{const p=await evaluate('(()=>{const b=document.querySelector('+JSON.stringify(selector)+');b.scrollIntoView({block:"nearest"});const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await click(p.x,p.y)};
  for(const [w,h] of [[3840,2160],[1440,1000],[320,640],[390,844],[844,390]]){
    await call('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<900});await delay(200);
    await clickElement('#fit');
    const layout=await evaluate('(()=>{const c=document.querySelector("#world").getBoundingClientRect(),a=islandGame.worldToScreen({x:31,y:80}),b=islandGame.worldToScreen({x:1100,y:1930});const rectangles=[document.querySelector(".brand"),...document.querySelectorAll(".scene-dock button")].map(e=>e.getBoundingClientRect());return {canvas:{x:c.x,y:c.y,w:c.width,h:c.height},hidden:document.querySelector("#island-controls").hidden,rectangles:rectangles.map(r=>({x:r.x,y:r.y,w:r.width,h:r.height})),overlay:rectangles.reduce((n,r)=>n+r.width*r.height,0)/(innerWidth*innerHeight),island:{a,b}}})()');
    check(layout.canvas.x===0&&layout.canvas.y===0&&layout.canvas.w===w&&layout.canvas.h===h,'Island canvas fills viewport '+w+'x'+h);
    if(w===3840)check(await evaluate('document.querySelector("#world").width>=3840&&document.querySelector("#world").height>=2160'),'4K viewport uses a full-resolution drawing buffer');
    check(layout.hidden&&layout.overlay<.05,'Default controls cover less than 5% of the screen: '+(100*layout.overlay).toFixed(2)+'%');
    check(layout.rectangles.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=w&&r.y+r.h<=h),'Minimal controls stay inside screen');
    check(layout.island.a.x>=0&&layout.island.a.y>=0&&layout.island.b.x<=w&&layout.island.b.y<=h,'Complete island fits without cropping');
    check((layout.island.b.x-layout.island.a.x)/w>.85||(layout.island.b.y-layout.island.a.y)/h>.9,'Island uses available width or height');
    await screenshot('scene-'+w+'x'+h+'-v10.png');
    await clickElement('#ui-toggle');
    check(await evaluate('!document.querySelector("#island-controls").hidden&&document.querySelector("#ui-toggle").getAttribute("aria-expanded")==="true"'),'Tool button reveals destinations and controls');
    const menu=await evaluate('(()=>{const r=document.querySelector("#island-controls").getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}})()');
    check(menu.x>=0&&menu.y>=0&&menu.right<=w&&menu.bottom<=h,'Tool panel fits '+w+'x'+h);
    await screenshot('scene-tools-'+w+'x'+h+'-v10.png');
    const zoom=await evaluate('islandGame.getState().zoom');await clickElement('#zoom-in');
    check(await evaluate('islandGame.getState().zoom')>zoom,'Zoom remains accessible in the compact panel');
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    check(await evaluate('document.querySelector("#island-controls").hidden&&document.activeElement.id==="ui-toggle"'),'Escape closes tools and restores focus');
  }
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  const touchElement=async selector=>{const p=await evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:0}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})};
  await touchElement('#fit');await touchElement('#ui-toggle');
  check(await evaluate('!document.querySelector("#island-controls").hidden'),'Phone touch opens controls');
  await touchElement('[data-place=clock]');
  check(await evaluate('document.querySelector("#island-controls").hidden&&islandGame.roomState().pending==="clock"&&islandGame.getState().moving'),'Choosing a room starts walking and automatically clears the view');
  await evaluate('window.walkSample=()=>{const s=islandGame.getState();let p=s,remaining=0;for(const q of s.route){remaining+=Math.hypot(q.x-p.x,q.y-p.y);p=q}return{remaining,time:performance.now(),phase:s.phase}}');
  const startWalk=await evaluate('walkSample()');let safe=true;
  for(let i=0;i<12;i++){await delay(100);safe=safe&&await evaluate('islandGame.isWalkable(islandGame.getState())');}
  const endWalk=await evaluate('walkSample()'),walked=startWalk.remaining-endWalk.remaining,pace=walked/((endWalk.time-startWalk.time)/1000);
  check(safe&&pace>175&&pace<225,'Faster walking stays on paving at about 200 units per second: '+pace.toFixed(1));
  check(endWalk.phase>startWalk.phase,'Footsteps continue while the doctor moves faster');
  const zoomBefore=await evaluate('islandGame.getState().zoom');
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:130,y:400,id:0},{x:240,y:400,id:1}]});await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y:400,id:0},{x:270,y:400,id:1}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check(await evaluate('islandGame.getState().zoom')>zoomBefore*1.3,'Two-finger pinch works with the UI hidden');
  check(errors.length===0,'No browser errors: '+JSON.stringify(errors));await call('Browser.close');
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
