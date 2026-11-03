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


  await call('Runtime.enable');await call('Log.enable');await call('Page.enable');await call('Network.enable');
  await call('Network.setCacheDisabled',{cacheDisabled:true});
  await call('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:512*1024,uploadThroughput:512*1024});
  await call('Network.setBlockedURLs',{urls:['*npc-*-seats-v24.png','*photographic-sun-sky*','*rounded-cloud-sky*','*distant-islands*','*cat-actions*','*island-cat-v21*','*/cloud.png','*sparrow-states*']});
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const base=process.env.ISLAND_TEST_URL||'http://127.0.0.1:4173',start=Date.now();
  await call('Page.navigate',{url:base});
  for(let i=0;i<800;i++){if(await evaluate('window.islandGame?.getState().ready'))break;await delay(50);}
  check(await evaluate('window.islandGame?.getState().ready&&document.querySelector("#loading").classList.contains("done")'),'Island is usable even when sky, wildlife and coworker assets cannot load');
  check(await evaluate('document.querySelector("#loading-progress").textContent.includes("2 / 2")'),'Only two core images gate startup');
  await delay(300);await screenshot('progressive-startup-v101.png');
  check(errors.filter(e=>!e.includes('ERR_BLOCKED_BY_CLIENT')).length===0,'No unexpected startup errors '+JSON.stringify(errors));
  console.log('INFO cold startup at 4 Mbps / 80 ms',Date.now()-start,'ms');
  await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await call('Network.setBlockedURLs',{urls:['*island-master-4k*']});
  await call('Page.navigate',{url:base});
  for(let i=0;i<100;i++){if(await evaluate('document.querySelector("#loading-retry")?.hidden===false'))break;await delay(50);}
  check(await evaluate('!document.querySelector("#loading-retry").hidden&&!window.islandGame?.getState().ready'),'Critical image failure offers a visible retry');
}finally{clearInterval(keepAlive);socket?.close();await cleanupChrome(chrome, profile);}
