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
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'(()=>{const raf=window.requestAnimationFrame.bind(window);let fake=0,last=0;window.requestAnimationFrame=cb=>raf(t=>{fake+=(last?t-last:16)*(window.__qaFast?8:1);last=t;cb(fake)})})()'});
  await call('Page.navigate',{url:process.env.ISLAND_TEST_URL||'http://127.0.0.1:4173'});
  for(let i=0;i<100;i++){if(await evaluate('window.islandGame?.getState().ready'))break;await delay(150);}
  check(await evaluate('window.islandGame?.getState().ready'),'Island v09 and assets load');
  check(await evaluate('[...document.querySelectorAll(".place strong")].map(x=>x.textContent).join()')==='設計工作室,製作工坊,驗証工作室,模擬實驗室','Four room names follow the top-to-bottom island order');
  const canvasRect=await evaluate('(()=>{const r=document.querySelector("#world").getBoundingClientRect();return{x:r.x,y:r.y}})()');
  const tapWorld=async p=>{const s=await evaluate('islandGame.worldToScreen('+JSON.stringify(p)+')');await click(s.x+canvasRect.x,s.y+canvasRect.y)};
  await evaluate('window.__qaFast=true;document.querySelector("[data-place=clock]").click()');
  check(await evaluate('islandGame.roomState().pending==="clock"&&!islandGame.roomState().open'),'Room stays closed while doctor walks');
  await tapWorld({x:697,y:1536});await delay(350);
  check(await evaluate('islandGame.roomState().pending===null&&!islandGame.roomState().open'),'Clicking ground cancels a pending room visit');
  const names={clock:'設計工作室',workshop:'製作工坊',library:'驗証工作室',lab:'模擬實驗室'},images=new Set();
  for(const key of Object.keys(names)){
    if(key==='workshop') await tapWorld({x:850,y:800});
    else await evaluate('document.querySelector("[data-place='+key+']").click()');
    let entering=false,unsafe=0;
    for(let i=0;i<180;i++){
      const s=await evaluate('({room:islandGame.roomState(),actor:islandGame.getState()})');
      if(s.room.entering)entering=true;
      if(!await evaluate('islandGame.isWalkable({x:'+s.actor.x+',y:'+s.actor.y+'})'))unsafe++;
      if(s.room.open)break;await delay(80);
    }
    const s=await evaluate('islandGame.roomState()');check(s.open&&s.key===key,'Doctor enters correct room: '+key);
    check(entering&&unsafe===0,'Entry transition follows a safe walking route: '+key);
    for(let i=0;i<80;i++){if(await evaluate('islandGame.roomState().imageReady'))break;await delay(100);}
    check(await evaluate('islandGame.roomState().imageReady'),'Room illustration loaded: '+key);
    check(await evaluate('document.querySelector("#room-title").textContent')===names[key],'Room title matches the selected building');
    const copy=await evaluate('document.querySelector(".room-content").textContent');
    check(copy.includes('PCB')&&!/機械手臂|鐘樓機構|加工與列印|機械零件/.test(copy),'Room equipment describes EDA and PCB: '+key);
    if(key==='clock'){
      check(['麵包板','電錶','單芯','烙鐵','電子零件'].every(word=>copy.includes(word)),'Design room introduces the breadboard bench and electronics tools');
      await evaluate('document.querySelector(".room-action").click()');
      check(await evaluate('document.querySelector(".room-result").textContent.includes("麵包板")'),'Design workflow starts with a breadboard circuit prototype');
      await delay(850);
      check(await evaluate('document.querySelector(".room-result").textContent.includes("電錶")'),'Breadboard workflow continues to measurement');
      await delay(1800);
      check(await evaluate('islandGame.roomState().run==="complete"&&document.querySelector(".room-result").textContent.includes("PCB")'),'Confirmed circuit prototype leads to PCB design');
      await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(200);
      check(await evaluate('(()=>{const r=document.querySelector("#room-dialog").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()'),'Breadboard workbench room fits the phone viewport');
      await screenshot('room-design-breadboard-mobile-v9.png');
      await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    }
    images.add(await evaluate('document.querySelector("#room-art").src'));
    await evaluate('window.__qaFast=false');await screenshot('room-'+key+'-desktop-v9.png');
    await evaluate('document.querySelectorAll(".room-stations [data-station]")[1].click()');
    check(await evaluate('document.querySelectorAll(".room-hotspots [data-station]")[1].getAttribute("aria-pressed")==="true"'),'Equipment buttons and scene hotspots select together');
    if(key==='library'){
      await evaluate('document.querySelector(".room-action").click()');await delay(2600);
      check(await evaluate('islandGame.roomState().run==="complete"&&document.querySelector(".room-result").textContent.includes("PASS")'),'PCB validation demo reaches PASS');
      for(const [w,h] of [[320,640],[390,844],[844,390]]){
        await call('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:true});await delay(200);
        check(await evaluate('(()=>{const d=document.querySelector("#room-dialog"),r=d.getBoundingClientRect(),b=document.querySelector(".room-close").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth&&b.width>=44&&b.height>=44})()'),'Room fits mobile portrait/landscape '+w+'x'+h);
        await screenshot('room-verification-mobile-'+w+'-v9.png');
      }
      await evaluate('document.querySelector(".room-zoom").click()');
      check(await evaluate('document.querySelector(".room-stage").scrollWidth>document.querySelector(".room-stage").clientWidth'),'Zoomed room allows detail panning');
      await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    }
    if(key==='lab'){
      await evaluate('document.querySelector(".room-action").click()');
      check(await evaluate('document.querySelector(".room-result").textContent.includes("PCB")'),'Simulation starts with PCB design data');
      await delay(2600);
      check(await evaluate('islandGame.roomState().run==="complete"&&document.querySelector(".room-result").textContent.includes("PCB")'),'PCB simulation completes with board analysis results');
    }
    if(key==='workshop'){
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    }else await evaluate('document.querySelector(".room-close").click()');
    check(await evaluate('!islandGame.roomState().open&&islandGame.roomState().key===null&&islandGame.isWalkable(islandGame.getState())'),'Closing room returns doctor to safe doorway');
    await evaluate('window.__qaFast=true');
  }
  check(images.size===4,'Each building opens a different room illustration');
  await evaluate('window.__qaFast=false;document.querySelector("#fit").click()');
  const p=await evaluate('(()=>{const p=islandGame.worldToScreen({x:285,y:1080}),r=document.querySelector("#world").getBoundingClientRect();return{x:p.x+r.x,y:p.y+r.y}})()');
  await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:p.x,y:p.y,deltaX:0,deltaY:-1100});await delay(300);await screenshot('verification-exterior-v9.png');
  check(errors.length===0,'No browser errors: '+JSON.stringify(errors));
  await call('Browser.close');
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
