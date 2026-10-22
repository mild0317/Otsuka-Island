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
  await call('Runtime.enable'); await call('Log.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  // Reproduce the setting that previously disabled the requested game animations.
  await call('Emulation.setEmulatedMedia', { features: [{name:'prefers-reduced-motion',value:'reduce'}] });
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'(()=>{let first=true,seed=907;Math.random=()=>{if(first){first=false;return .01}seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}})()'});
  await call('Page.navigate', { url: 'http://127.0.0.1:4173' });
  for (let i = 0; i < 60; i++) { if (await evaluate('window.islandGame?.getState().ready')) break; await delay(150); }
  check(await evaluate('islandGame.getState().ready'), 'All local image assets loaded');
  await delay(800); await screenshot('desktop.png');
  check(await evaluate('islandGame.getState().reducedMotion && islandGame.getState().motionEnabled'), 'Requested animation plays even with OS reduced motion enabled');
  await evaluate(`window.sampleRegion=(rect)=>{const c=document.querySelector('canvas'),p=islandGame.worldToScreen({x:rect[0],y:rect[1]}),q=islandGame.worldToScreen({x:rect[0]+rect[2],y:rect[1]+rect[3]}),ratio=c.width/c.clientWidth;return c.getContext('2d').getImageData(Math.floor(p.x*ratio),Math.floor(p.y*ratio),Math.max(1,Math.ceil((q.x-p.x)*ratio)),Math.max(1,Math.ceil((q.y-p.y)*ratio))).data};window.motionRects={cloud:[850,365,300,180],water:[455,770,32,65],foam:[435,846,75,45],doctor:[565,1380,120,160],coat:[590,1498,28,30],screen:[738,835,17,24],pcb:[278,1008,46,64],tree:[258,330,155,180]};window.motionSamples=Object.fromEntries(Object.entries(motionRects).map(([k,r])=>[k,sampleRegion(r)]));`);
  await delay(1400);
  const differences = await evaluate(`Object.fromEntries(Object.entries(motionRects).map(([k,r])=>{const a=motionSamples[k],b=sampleRegion(r);let changed=0;for(let i=0;i<a.length;i+=4){if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>18)changed++}return[k,changed]}))`);
  check(differences.cloud > 150, `Rendered cloud pixels visibly move (${differences.cloud} pixels)`);
  check(differences.water > 10, `Thin flowing highlights animate over the static water (${differences.water} changed pixels)`);
  check(differences.foam === 0, `Original splash stays static (${differences.foam} changed pixels)`);
  check(differences.screen > 3, `Screen content changes (${differences.screen} pixels)`);
  check(differences.pcb > 3, `PCB monitor content animates (${differences.pcb} pixels)`);
  check(differences.tree > 10, `Leaves visibly move (${differences.tree} pixels)`);
  check(differences.doctor > 30, `Idle breathing changes the rendered doctor silhouette (${differences.doctor} pixels)`);
  check(differences.coat > 3, `Idle coat tails visibly flutter (${differences.coat} pixels)`);
  check(await evaluate('!islandGame.getState().moving && islandGame.getState().wave===0'), 'Breathing and coat pixel checks run at rest, before any greeting');
  await screenshot('motion-after.png');
  await evaluate('document.querySelector("#motion-toggle").click()');
  const paused = await evaluate('islandGame.getState().cloudTime');
  await delay(350);
  check(await evaluate(`!islandGame.getState().motionEnabled && islandGame.getState().cloudTime === ${paused}`), 'Visible animation control actually pauses the scene');
  await evaluate('document.querySelector("#motion-toggle").click()');
  const idleBefore = await evaluate('islandGame.getState()');
  await evaluate('document.querySelector("#wave").click()'); await delay(900);
  const waving = await evaluate('islandGame.getState()');
  check(waving.wave > 0 && idleBefore.x === waving.x && idleBefore.y === waving.y, 'Waving preserves planted position');
  await evaluate('document.querySelector("#follow").click()');
  for (let i = 0; i < 3; i++) await evaluate('document.querySelector("#zoom-in").click()');
  await delay(1300); await screenshot('doctor-wave.png');
  const waveClothing = await evaluate('islandGame.clothingDiagnostics()');
  check(waveClothing.holes === 0 && waveClothing.components === 1, 'Raised waving sleeve remains connected to the coat');
  await evaluate('document.querySelector("#fit").click()');
  check(await evaluate('(()=>{const r=islandGame.sceneSnapshot().resolution;return r.width>=1536&&r.height>=2752})()'), 'Island renders from original 1536 by 2752 detail, above the previous 937 by 1678 cutout');
  check(await evaluate('[0,2,4,6,8].every(t=>islandGame.treeCoverageAt(t)===0)'), 'Five tree sway phases preserve all opaque coverage without background cracks');
  const flockAudit = await evaluate(`(()=>{let seed=8172;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};const flock=new IslandBirds({random,isWalkable:islandGame.isWalkable}),counts=new Set(),targets=new Set(),states=new Set(),perches=new Set();let invalid=0;for(let t=0;t<480;t+=.125){flock.update(t);const s=flock.snapshot();counts.add(s.count);targets.add(s.targetCount);if(s.count<0||s.count>3||flock.birds.length>3)invalid++;for(const b of s.birds){states.add(b.state);if(!Number.isFinite(b.x)||!Number.isFinite(b.y))invalid++;if(b.state==='perched'){perches.add(b.mode);if(b.mode==='ground'&&!islandGame.isWalkable(b))invalid++}}}return{counts:[...counts].sort(),targets:[...targets].sort(),states:[...states],perches:[...perches],invalid}})()`);
  check(flockAudit.invalid===0 && flockAudit.counts.join()==='0,1,2,3' && flockAudit.targets.join()==='0,1,2,3', `Bird count randomly covers 0 through 3 and never exceeds 3: ${JSON.stringify(flockAudit)}`);
  check(['flying','approaching','landing','perched','departing','hopping'].every(s=>flockAudit.states.includes(s)) && ['roof','ground'].every(s=>flockAudit.perches.includes(s)), 'Birds fly past, land on roofs and safe ground, hop, and depart');
  const clockTarget = await evaluate('islandGame.resolveTarget({x:540,y:270})');
  const labTarget = await evaluate('islandGame.resolveTarget({x:870,y:1320})');
  check(clockTarget.key === 'clock' && labTarget.key === 'lab', 'Building clicks resolve to correct entrances');
  check(await evaluate('islandGame.resolveTarget({x:30,y:120}) === null'), 'Sky clicks are ignored');
  const route = await evaluate('islandGame.findPath({x:625,y:1540},islandGame.resolveTarget({x:540,y:270}))');
  check(route.length > 20 && route.some(p => p.y > 1300) && route.some(p => p.x < 350 && p.y < 850), 'Cross-island path uses lower stairs, bridge and spiral stairs');
  check(await evaluate(`[{x:610,y:1380},{x:170,y:1510},{x:930,y:1660}].every(p=>!islandGame.isWalkable(p))`), 'Waterfall, vegetation and cliff edges are not walkable');
  check(await evaluate(`[{x:540,y:270},{x:830,y:800},{x:260,y:1000},{x:870,y:1320}].every(p=>{const t=islandGame.resolveTarget(p);return t.key&&islandGame.isWalkable(t.point)})`), 'All four building destinations end on safe paving');
  const safeRoutes = await evaluate(`(()=>{const start={x:625,y:1540};for(const p of [{x:540,y:270},{x:830,y:800},{x:260,y:1000},{x:870,y:1320}]){let a=start;for(const b of islandGame.findPath(start,islandGame.resolveTarget(p))){const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4);for(let i=0;i<=n;i++){if(!islandGame.isWalkable({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false}a=b}}return true})()`);
  check(safeRoutes, 'Every sampled step to all four buildings remains inside the walkable ground');
  await evaluate('document.querySelector("#light-time").value=8;document.querySelector("#light-time").dispatchEvent(new Event("input"))');
  const morning = await evaluate('islandGame.getState().lighting');
  await evaluate('document.querySelector("#light-time").value=16;document.querySelector("#light-time").dispatchEvent(new Event("input"))');
  const afternoon = await evaluate('islandGame.getState().lighting');
  check(morning.shadowX < 0 && afternoon.shadowX > 0 && morning.hour === 8 && afternoon.hour === 16, 'Time preview turns shadows and drives the clock hands');
  await evaluate('document.querySelector("#live-time").click()');
  await evaluate('document.querySelector("[data-place=clock]").click()'); await delay(1100);
  const walking = await evaluate('islandGame.getState()');
  check(walking.selectedBuilding === 'clock', 'Building click activates its foggy white outline');
  await screenshot('selected-building.png');
  check(walking.moving && walking.phase > 0 && Math.hypot(walking.x-idleBefore.x,walking.y-idleBefore.y) > 80 && Math.hypot(walking.x-idleBefore.x,walking.y-idleBefore.y) < 280, 'Doctor walks continuously at the faster pace');
  // Retarget by an actual pointer click on a reachable part of the lower plaza.
  const targetScreen = await evaluate('islandGame.worldToScreen({x:625,y:1540})');
  const canvasRect = await evaluate('(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x,y:r.y}})()');
  await click(targetScreen.x + canvasRect.x, targetScreen.y + canvasRect.y);
  let arrived;
  for(let i=0;i<80;i++){await delay(100);arrived=await evaluate('islandGame.getState()');if(!arrived.moving&&Math.hypot(arrived.x-625,arrived.y-1540)<2)break;}
  check(!arrived.moving && Math.hypot(arrived.x-625,arrived.y-1540) < 2, 'Pointer retarget reaches clicked ground and stops');
  await delay(600);
  const resting = await evaluate('islandGame.getState()');
  check(arrived.x === resting.x && arrived.y === resting.y, 'Idle animation does not move feet');
  let autoWave;
  for (let i=0;i<50;i++) { autoWave=await evaluate('islandGame.getState()'); if(autoWave.wave>0)break; await delay(500); }
  check(autoWave.wave>0 && autoWave.x===resting.x && autoWave.y===resting.y, 'Random idle greeting occurs without position drift: '+JSON.stringify(autoWave));
  // Sample each direction explicitly on the safe plaza; diagonal stair timing
  // alone can miss a view when rendering speed or capture timing changes.
  const clothingSamples = [];
  const plazaStart=await evaluate('islandGame.worldToScreen({x:650,y:1550})');
  await click(plazaStart.x+canvasRect.x,plazaStart.y+canvasRect.y);await delay(350);
  for(const [key,code] of [['ArrowUp',38],['ArrowDown',40],['ArrowLeft',37]]){
    await evaluate('document.querySelector("#world").focus()');
    await call('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});
    for(let i=0;i<9;i++){await delay(40);clothingSamples.push(await evaluate('islandGame.clothingDiagnostics()'));}
  }
  await evaluate('document.querySelector("[data-place=clock]").click();document.querySelector("#follow").click();');
  for (let i=0;i<3;i++) await evaluate('document.querySelector("#zoom-in").click()');
  for (let i=0;i<28;i++) {
    await delay(160);
    const diagnosis = await evaluate('islandGame.clothingDiagnostics()');
    clothingSamples.push(diagnosis);
    if ([2,10,16,24].includes(i)) await screenshot(`walk-coat-${i}.png`);
  }
  await evaluate('document.querySelector("[data-place=lab]").click()');
  for (let i=0;i<10;i++) {
    await delay(160); clothingSamples.push(await evaluate('islandGame.clothingDiagnostics()'));
    if(i===4) await screenshot('walk-coat-return.png');
  }
  const badClothing = clothingSamples.filter(s => s.holes > 0 || s.components !== 1);
  check(!badClothing.length, `Coat remains connected with no transparent holes across ${clothingSamples.length} walking poses: ${JSON.stringify(badClothing)}`);
  check(new Set(clothingSamples.map(s=>s.direction)).size === 3, 'Walking clothing checked from front, side and back');
  await evaluate('if(islandGame.roomState().open)document.querySelector(".room-close").click();document.querySelector("#fit").click()');
  const park=await evaluate('islandGame.worldToScreen({x:625,y:1540})');
  await click(park.x+canvasRect.x,park.y+canvasRect.y);
  check(await evaluate('!islandGame.roomState().open&&islandGame.roomState().pending===null'),'Mobile gesture checks start with no pending room dialog');
  for (const [mobileWidth,mobileHeight] of [[320,640],[390,844],[430,932]]) {
    await call('Emulation.setDeviceMetricsOverride', { width: mobileWidth, height: mobileHeight, deviceScaleFactor: 1, mobile: true });
    await delay(400);
    await evaluate('if(document.querySelector("#island-controls").hidden)document.querySelector("#ui-toggle").click()');
    check(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `Mobile ${mobileWidth}px stays within viewport`);
    check(await evaluate('[...document.querySelectorAll(".place,#wave,.map-tools button")].every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&r.width>=44&&r.height>=44})'), `Mobile ${mobileWidth}px destinations, waving and zoom controls have visible 44px touch targets`);
    check(await evaluate('(()=>{const a=document.querySelector(".doctor-card").getBoundingClientRect(),b=document.querySelector(".map-tools").getBoundingClientRect();return a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom})()'), `Mobile ${mobileWidth}px controls do not overlap`);
    await screenshot(`mobile-${mobileWidth}.png`);
  }
  await call('Emulation.setTouchEmulationEnabled', {enabled:true,maxTouchPoints:2});
  await evaluate('document.querySelector("#controls-close").click()');
  const zoomBeforePinch = await evaluate('islandGame.getState().zoom');
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:140,y:400,id:0},{x:230,y:400,id:1}]});
  await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:115,y:400,id:0},{x:255,y:400,id:1}]});
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check(await evaluate(`islandGame.getState().zoom > ${zoomBeforePinch} * 1.2`), 'Mobile two-finger pinch changes the actual map zoom');
  await evaluate('document.querySelector("#ui-toggle").click()');
  const buttonPoint = await evaluate('(()=>{const r=document.querySelector("[data-place=library]").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...buttonPoint,id:0}]});
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await delay(200);
  check(await evaluate('islandGame.getState().moving && islandGame.getState().selectedBuilding==="library"'), 'Touching a destination starts the doctor walking to that building');
  // The no-server entry point is part of the requested handoff.
  await call('Page.navigate', { url: new URL('index.html', `file:///${process.cwd().replaceAll('\\','/')}/`).href });
  for (let i=0;i<40;i++) { if (await evaluate('window.islandGame?.getState().ready')) break; await delay(100); }
  check(await evaluate('islandGame.getState().ready'), 'Double-click file:// HTML loads without a server');
  check(errors.filter(e=>!e.includes('favicon.ico')).length === 0, `No browser errors: ${JSON.stringify(errors)}`);
  console.log('Screenshots:', out);
  await call('Browser.close');
} finally { clearInterval(keepAlive); socket?.close(); chrome.kill(); }
