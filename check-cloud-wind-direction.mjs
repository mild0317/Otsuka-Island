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



  await evaluate(`document.querySelector('#motion-toggle').click();(()=>{const s=document.querySelector('#light-time');s.value=12;s.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(180);
  for(const direction of [90,270]){
    const measured=await evaluate(`(()=>{
      const original=__qaAtmosphere,a=new IslandAtmosphere(null,null,()=>.0235,original.skyPlate,original.sunSky);window.__qaAtmosphere=original;
      a.setWind({mode:'manual',speed:20,direction:${direction}});a.applyWeather({...__qaSkyView,lighting:{...__qaSkyView.lighting,hour:12,minute:0,second:0}});
      const time=3.125,result=[];
      for(const near of [false,true]){
        a.windOffset={x:.17,y:0};a.windTime=0;const first=new Uint8ClampedArray(a.cloudFrame(0,near).pixels.data);a.updateWind(time);const frame=a.cloudFrame(time,near),last=new Uint8ClampedArray(frame.pixels.data),w=frame.canvas.width,h=frame.canvas.height;
        const dx=(a.windOffset.x-.17)*w*(near?1.7:1),dy=a.windOffset.y*w*(near?1.7:1);
        for(const band of ['sky','sea']){
          const y0=Math.ceil(h*(band==='sky'?.09:.79)),y1=Math.floor(h*(band==='sky'?.40:.93));
          const score=(sx,sy)=>{let error=0,n=0;for(let y=y0;y<y1;y+=3)for(let x=25;x<w-25;x+=3){const xx=x+sx,yy=y+sy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const i=(y*w+x)*4,j=(yy*w+xx)*4;if(band==='sky')error+=Math.abs(first[i+3]-last[j+3]);else error+=Math.abs(first[i]-last[j])+Math.abs(first[i+1]-last[j+1]);n++;}return error/n};
          const best=(x,y)=>{let match={error:Infinity};for(let sy=Math.round(y)-2;sy<=Math.round(y)+2;sy++)for(let sx=Math.round(x)-2;sx<=Math.round(x)+2;sx++){const error=score(sx,sy);if(error<match.error)match={x:sx,y:sy,error};}return match};
          const forward=best(dx,dy),backward=best(-dx,-dy),cos=(forward.x*dx+forward.y*dy)/(Math.hypot(forward.x,forward.y)*Math.hypot(dx,dy));result.push({near,band,expected:{x:dx,y:dy},forward,backward,cos});
        }
      }return result;
    })()`);
    check(measured.every(r=>r.cos>.94&&r.forward.error<r.backward.error*.85),'Actual upper clouds and cloud-sea textures follow '+direction+' degrees '+JSON.stringify(measured));
  }
  const projection=await evaluate(`(()=>{
    const original=__qaAtmosphere,a=new IslandAtmosphere(null,null,()=>.0235,original.skyPlate,original.sunSky);window.__qaAtmosphere=original;
    const v={...__qaSkyView,width:1440,height:1000,time:0},frame=document.createElement('canvas');frame.width=768;frame.height=384;a.prepareClouds=()=>true;a.visualCloudFrame=()=>({canvas:frame});
    const measure=(near,shift)=>{const f=frame.getContext('2d');f.clearRect(0,0,768,384);f.fillStyle='#fff';f.fillRect(768*.3+shift*12-3,384*.85-shift*8-3,7,7);const c=document.createElement('canvas');c.width=1440;c.height=1000;near?a.drawSea(c.getContext('2d'),v,true):a.drawIslandCloudCover(c.getContext('2d'),v);const p=c.getContext('2d').getImageData(0,0,1440,1000).data;let x=0,y=0,mass=0;for(let yy=0;yy<1000;yy++)for(let xx=0;xx<1440;xx++){const alpha=p[(yy*1440+xx)*4+3];x+=xx*alpha;y+=yy*alpha;mass+=alpha;}return{x:x/mass,y:y/mass}};
    const moves=[false,true].map(near=>{const p=measure(near,0),q=measure(near,1);return{near,dx:q.x-p.x,dy:q.y-p.y}});
    const layer1=a.sea(v),layer2=a.sea({...v,time:999}),near1=a.sea(v,true),near2=a.sea({...v,time:999},true);return{moves,stationary:layer1.x===layer2.x&&layer1.y===layer2.y&&near1.x===near2.x&&near1.y===near2.y};
  })()`);
  check(projection.moves.every(m=>m.dx>0&&m.dy<0&&Math.abs(m.dx/-m.dy-1.5)<.05),'Actual far and foreground compositing preserve both screen axes '+JSON.stringify(projection));
  check(projection.stationary,'Cloud layers have no wind-independent container oscillation');
  const zero=await evaluate(`(()=>{const original=__qaAtmosphere,a=new IslandAtmosphere(null,null,()=>.0235);window.__qaAtmosphere=original;a.setWind({mode:'manual',speed:0,direction:90});const p=a.cloudFlow(.3,.3,0);a.updateWind(200);const q=a.cloudFlow(.3,.3,200);return{still:p.u===q.u&&p.v===q.v,evolves:p.threshold!==q.threshold,offset:a.windSnapshot().offset}})()`);
  check(zero.still&&zero.evolves,'Zero wind stops bulk translation while condensation can continue '+JSON.stringify(zero));
  await screenshot('cloud-wind-direction-v87.png');check(errors.length===0,'No browser errors '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
