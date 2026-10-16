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
  const downloads=path.join(out,'downloads');await mkdir(downloads,{recursive:true});
  await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`Object.defineProperty(window,'IslandAudio',{configurable:true,set(Class){const original=Class.prototype.createContext;Class.prototype.createContext=function(){original.call(this);window.__qaAudio=this;const a=this.context.createAnalyser();a.fftSize=2048;this.effects.connect(a);window.__qaRoomAnalyser=a};Object.defineProperty(window,'IslandAudio',{value:Class,writable:true,configurable:true})}})`});
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'(()=>{const raf=window.requestAnimationFrame.bind(window);let fake=0,last=0;window.requestAnimationFrame=cb=>raf(t=>{fake+=(last?t-last:16)*(window.__qaFast?8:1);last=t;cb(fake)})})()'});
  await call('Page.navigate',{url:process.env.ISLAND_TEST_URL||'http://127.0.0.1:4173'});
  for(let i=0;i<100;i++){if(await evaluate('window.islandGame?.getState().ready'))break;await delay(150);}
  check(await evaluate('window.islandGame?.getState().ready'),'Island and assets load');
  check(await evaluate('[...document.querySelectorAll(".place strong")].map(x=>x.textContent).join()')==='設計工作室,製作工坊,驗証工作室,模擬實驗室','Four room names follow the top-to-bottom island order');
  const canvasRect=await evaluate('(()=>{const r=document.querySelector("#world").getBoundingClientRect();return{x:r.x,y:r.y}})()');
  const tapWorld=async p=>{const s=await evaluate('islandGame.worldToScreen('+JSON.stringify(p)+')');await click(s.x+canvasRect.x,s.y+canvasRect.y)};
  const clickUI=async selector=>{const p=await evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await click(p.x,p.y)};
  const chooseRoom=async key=>{if(await evaluate('document.querySelector("#island-controls").hidden'))await clickUI('#ui-toggle');await clickUI('[data-place='+key+']');};
  await evaluate('window.__qaFast=true');await chooseRoom('clock');
  check(await evaluate('islandGame.roomState().pending==="clock"&&!islandGame.roomState().open'),'Room stays closed while doctor walks');
  await tapWorld({x:697,y:1536});await delay(350);
  check(await evaluate('islandGame.roomState().pending===null&&!islandGame.roomState().open'),'Clicking ground cancels a pending room visit');
  const names={clock:'設計工作室',workshop:'製作工坊',library:'驗証工作室',lab:'模擬實驗室'},images=new Set();
  for(const key of Object.keys(names)){
    if(key==='workshop') await tapWorld({x:850,y:800});
    else await chooseRoom(key);
    check(await evaluate('document.querySelector("#island-controls").hidden'),'Room selection clears the island view');
    let entering=false,unsafe=0;
    for(let i=0;i<180;i++){
      const s=await evaluate('({room:islandGame.roomState(),actor:islandGame.getState()})');
      if(s.room.entering)entering=true;
      if(!await evaluate('islandGame.isWalkable({x:'+s.actor.x+',y:'+s.actor.y+'})'))unsafe++;
      if(s.room.open)break;await delay(80);
    }
    const s=await evaluate('islandGame.roomState()');check(s.open&&s.key===key,'Doctor enters correct room: '+key+(s.open?'':' '+JSON.stringify({room:s,actor:await evaluate('islandGame.getState()'),errors})));
    check(await evaluate('islandGame.audioState().roomKey==='+JSON.stringify(key)),'Room entry selects its contextual soundscape: '+key);
    if(key==='clock'){
      await delay(60);
      check(await evaluate('islandGame.audioState().enabled&&document.querySelector("#sound-toggle").getAttribute("aria-pressed")==="true"&&document.querySelector(".room-sound").getAttribute("aria-pressed")==="true"'),'Entering a room keeps default audio enabled and synchronizes both toggles');
      const rms=await evaluate('(()=>{const data=new Float32Array(__qaRoomAnalyser.fftSize);__qaRoomAnalyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length)})()');
      check(rms>.00001&&rms<.5,'Room effects produce a bounded audio signal independent of BGM: '+rms);
      await clickUI('.room-sound');await delay(160);
      check(await evaluate('!islandGame.audioState().enabled&&islandGame.audioState().activeRoomVoices===0'),'Room toggle cancels active effects when muted');
      await clickUI('.room-sound');await delay(60);
    }
    check(await evaluate('islandGame.audioState().lastRoomEffect.key==='+JSON.stringify(key)+'&&islandGame.audioState().lastRoomEffect.type==="enter"'),'Entry chime matches the current room: '+key);
    await evaluate('__qaAudio.nextRoomSound=0;__qaAudio.schedule()');
    check(await evaluate('islandGame.audioState().lastRoomEffect.type==="ambient"&&islandGame.audioState().activeRoomVoices>0'),'Contextual ambient work sounds are scheduled: '+key);
    check(entering&&unsafe===0,'Entry transition follows a safe walking route: '+key);
    for(let i=0;i<80;i++){if(await evaluate('islandGame.roomState().imageReady'))break;await delay(100);}
    check(await evaluate('islandGame.roomState().imageReady'),'Room illustration loaded: '+key);
    check(await evaluate('document.querySelector("#room-title").textContent')===names[key],'Room title matches the selected building');
    check(await evaluate('islandGame.roomState().topic===null&&document.querySelector(".room-content").hidden'),'Entering room shows scene before a topic');
    check(await evaluate('!document.querySelector(".room-number,.room-hotspots")&&[...document.querySelectorAll(".room-stations button")].every(b=>!/^\\d/.test(b.textContent))'),'No numbered room markers');
    check(await evaluate('document.querySelectorAll(".room-object").length===1&&document.querySelectorAll(".room-stations button").length===1'),'Each room has exactly one outlined object and one topic');
    check(await evaluate('!document.querySelector(".room-zoom,.is-zoomed")&&!document.querySelector(".room-stage").getAttribute("aria-label").includes("放大")'),'Room enlargement control and mode are removed: '+key);
    await screenshot('room-'+key+'-overview-v12.png');
    if(key==='clock'){
      await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
      await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
      await delay(150);await screenshot('room-design-overview-mobile-v12.png');
      const p=await evaluate('(()=>{const r=document.querySelector(".room-object[data-station=\\"0\\"]").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
      await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:0}]});
      await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      check(await evaluate('islandGame.roomState().topic===0'),'Phone tap on breadboard outline opens topic without a numbered tag');
      await evaluate('document.querySelector(".room-action").click();document.querySelector(".room-back").click()');await delay(900);
      check(await evaluate('islandGame.roomState().topic===null&&islandGame.roomState().run==="idle"'),'Returning to room cancels a running topic demo');
      await call('Emulation.setTouchEmulationEnabled',{enabled:false});
      await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
      await evaluate('document.querySelector(".room-object[data-station=\\"0\\"]").focus()');
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      check(await evaluate('islandGame.roomState().topic===0'),'Keyboard Enter opens the single equipment topic');
      await clickUI('.room-back');
      check(await evaluate('document.activeElement.matches(".room-object[data-station=\\"0\\"]")'),'Returning restores focus to the selected object');
    }
    await clickUI('.room-object[data-station="0"]');
    check(await evaluate('islandGame.roomState().topic===0&&!document.querySelector(".room-content").hidden'),'Clicking the illustrated object opens its topic');
    check(await evaluate('islandGame.audioState().lastRoomEffect.type==="select"&&islandGame.audioState().lastRoomEffect.index===0'),'Equipment selection plays a room-specific cue: '+key);
    check(await evaluate('document.querySelector(".room-stage").hidden&&document.querySelector(".room-detail h3").textContent===IslandRoomTopics['+JSON.stringify(key)+'].title'),'Selecting equipment opens its customer presentation: '+key);
    check(await evaluate('document.querySelectorAll(".topic-products a").length>0&&document.querySelectorAll(".topic-prepare li").length===3&&document.querySelectorAll(".topic-flow span").length===3&&!!document.querySelector(".topic-diagram svg")'),'Presentation includes product resources, diagram, workflow and preparation checklist: '+key);
    const filename=path.join(downloads,'otsuka-'+key+'-pcb-checklist.txt');await rm(filename,{force:true});
    await evaluate('document.querySelector(".topic-download").scrollIntoView({block:"center"})');await clickUI('.topic-download');
    let briefing='';for(let i=0;i<40;i++){try{briefing=await readFile(filename,'utf8');if(briefing)break;}catch{}await delay(50);}
    const expected=await evaluate('({title:IslandRoomTopics['+JSON.stringify(key)+'].title,materials:IslandRoomTopics['+JSON.stringify(key)+'].materials})');
    check(briefing.includes(expected.title)&&expected.materials.every(line=>briefing.includes(line))&&briefing.includes('https://')&&briefing.includes('示意'),'Download provides this room\'s actual customer checklist: '+key);
    await evaluate('document.querySelector(".room-scroll").scrollTop=0');
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
      check(await evaluate('document.querySelectorAll(".topic-flow .is-done").length===3&&document.querySelector(".topic-figure figcaption").textContent===IslandRoomTopics.clock.after'),'Completed workflow updates the diagram caption and all three stages');
      await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(200);
      check(await evaluate('(()=>{const r=document.querySelector("#room-dialog").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()'),'Breadboard workbench room fits the phone viewport');
      await screenshot('room-design-topic-mobile-v12.png');
      await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    }
    images.add(await evaluate('document.querySelector("#room-art").src'));
    if(key==='clock')check(await evaluate('islandGame.audioState().roomEventCounts["clock:complete"]>0'),'Design workflow plays its completion chime');
    await evaluate('window.__qaFast=false');await screenshot('room-'+key+'-topic-desktop-v12.png');
    await clickUI('.room-back');
    check(await evaluate('islandGame.roomState().topic===null&&document.querySelector(".room-content").hidden&&islandGame.roomState().run==="idle"'),'Back returns to clean room overview');
    await clickUI('.room-object[data-station="0"]');
    check(await evaluate('document.querySelector(".room-objects [data-station]").getAttribute("aria-pressed")==="true"'),'Object outline and topic selection stay in sync');
    if(key==='library'){
      await evaluate('document.querySelector(".room-action").click()');await delay(2600);
      check(await evaluate('islandGame.roomState().run==="complete"&&document.querySelector(".room-result").textContent.includes("PASS")'),'PCB validation demo reaches PASS');
      for(const [w,h] of [[320,640],[390,844],[844,390]]){
        await call('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:true});await delay(200);
        check(await evaluate('(()=>{const d=document.querySelector("#room-dialog"),r=d.getBoundingClientRect(),b=document.querySelector(".room-close").getBoundingClientRect(),a=document.querySelector(".room-sound").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth&&b.width>=44&&b.height>=44&&a.width>=44&&a.height>=44&&a.right<=b.left&&a.left>=r.left})()'),'Room and audio control fit mobile portrait/landscape '+w+'x'+h);
        check(await evaluate('document.querySelector(".room-scroll").scrollWidth<=document.querySelector(".room-scroll").clientWidth+1'),'Customer topic has no horizontal overflow '+w+'x'+h);
        await screenshot('room-verification-mobile-'+w+'-v12.png');
        await clickUI('.room-back');
        check(await evaluate('(()=>{const stage=document.querySelector(".room-stage"),scene=document.querySelector(".room-scene");return !stage.hidden&&stage.clientWidth>0&&stage.scrollWidth<=stage.clientWidth+1&&scene.getBoundingClientRect().width<=stage.clientWidth+1})()'),'Complete room illustration fits without enlargement or horizontal panning '+w+'x'+h);
        await screenshot('room-verification-overview-mobile-'+w+'-v20.png');
        await clickUI('.room-object[data-station="0"]');
      }
      await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    }
    if(key==='lab'){
      await call('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false});await delay(150);
      check(await evaluate('document.querySelector(".room-scroll").scrollWidth<=document.querySelector(".room-scroll").clientWidth+1&&parseFloat(getComputedStyle(document.querySelector(".topic-value")).fontSize)>=16'),'Customer topic remains readable and fits the 4K display');
      await evaluate('document.querySelector(".room-action").click()');
      check(await evaluate('document.querySelector(".room-result").textContent.includes("PCB")'),'Simulation starts with PCB design data');
      await delay(2600);
      check(await evaluate('islandGame.roomState().run==="complete"&&document.querySelector(".room-result").textContent.includes("PCB")'),'PCB simulation completes with board analysis results');
      for(let i=0;i<10;i++){if(await evaluate('getComputedStyle(document.querySelector(".topic-eye-after")).opacity==="1"'))break;await delay(80);}
      check(await evaluate('getComputedStyle(document.querySelector(".topic-eye-after")).opacity==="1"'),'Completed simulation reveals its comparison illustration');
      await screenshot('room-simulation-topic-4k-v20.png');
      await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    }
    if(key==='workshop'){
      await evaluate('document.querySelector(".room-action").click()');await delay(2600);
      check(await evaluate('islandGame.audioState().roomEventCounts["workshop:complete"]>0'),'Workshop demo plays its completion chime');
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    }else await evaluate('document.querySelector(".room-close").click()');
    check(await evaluate('islandGame.audioState().roomKey===null&&islandGame.audioState().activeRoomVoices===0&&islandGame.audioState().enabled'),'Leaving a room cancels its effects and keeps music enabled');
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
