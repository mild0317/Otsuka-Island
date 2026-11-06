import { createChromeProfile, cleanupChrome } from './helpers/chrome-profile.mjs';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
const out = path.resolve('.preview');
await mkdir(out, { recursive: true });
const profile = createChromeProfile(out);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9338', `--user-data-dir=${profile}`, 'about:blank'
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
  await call('Page.addScriptToEvaluateOnNewDocument',{source:"(()=>{const raf=requestAnimationFrame.bind(window);let t=0,last=0;window.requestAnimationFrame=cb=>raf(now=>{t+=(last?now-last:16)*8;last=now;cb(t)})})()"});
  const base=process.env.ISLAND_TEST_URL||'http://127.0.0.1:4173';
  const waitFor=async(expression,label)=>{for(let i=0;i<(base.startsWith("https:")?1200:240);i++){if(await evaluate(expression))return;await delay(50);}throw Error(label+' '+JSON.stringify(errors));};
  const clickUI=async selector=>{const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await click(p.x,p.y);};

  await call('Page.navigate',{url:base});
  await waitFor('window.islandGame?.getState().ready','Island ready');
  const groups=[['clock',[1,2]],['library',[0,1]]];
  for(const [room,stations] of groups){
    await clickUI('#ui-toggle');await clickUI('[data-place='+room+']');
    await waitFor('islandGame.roomState().open&&islandGame.roomState().imageReady','Room ready');await delay(350);
    for(const index of stations){
      await clickUI('.room-object[data-station="'+index+'"]');
      await waitFor('islandGame.roomState().topicOpen&&document.querySelector(".ppt-video")?.readyState>=2','Video decodes');
      const expected=await evaluate(`IslandRoomTopics.${room}.pptLinks[${index}].video`);
      const info=await evaluate('(()=>{const v=document.querySelector(".ppt-video");return{src:v.currentSrc,duration:v.duration,width:v.videoWidth,height:v.videoHeight,inline:v.playsInline,controls:v.controls,fullscreen:!!document.fullscreenElement,dialog:document.querySelector(".room-topic-dialog").open}})()');
      check(info.src.endsWith(expected)&&info.duration>0&&info.width>0&&info.inline&&info.controls&&!info.fullscreen&&info.dialog,'Embedded video '+JSON.stringify(info));
      await evaluate('window.__qaVideo=document.querySelector(".ppt-video");__qaVideo.currentTime=Math.min(30,__qaVideo.duration/2)');
      await waitFor('!__qaVideo.seeking&&__qaVideo.currentTime>0','Video seek');
      await clickUI('.room-back');check(await evaluate('__qaVideo.paused'),'Return stops video');
    }
    await clickUI('.room-close');
  }
  check(errors.length===0,'No browser errors '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();await cleanupChrome(chrome, profile);}
