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

  await evaluate('document.querySelector("#motion-toggle").click()');await delay(100);

  await evaluate(`(()=>{const slider=document.querySelector('#light-time');slider.value=12;slider.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await delay(100);

  await waitFor('__qaAtmosphere.weatherTime!==undefined&&__qaAtmosphere.weatherRenderedKey===__qaAtmosphere.weatherKey', 'Background weather frame ready');
  check(await evaluate('!!__qaAtmosphere.weatherWorker&&!__qaAtmosphere.workerFailed&&!!__qaAtmosphere.visualClouds.far.pixels'), 'Cloud computation runs in a background worker');
  check(await evaluate(`(()=>{const a=__qaAtmosphere,offset=a.windOffset,actual=a.visualClouds.far.pixels.data;a.windOffset=a.weatherWindOffset;const expected=a.cloudFrame(a.weatherTime).pixels.data;a.windOffset=offset;return actual.every((v,i)=>v===expected[i]);})()`),'Worker output matches the deterministic cloud renderer');
  await evaluate('document.querySelector("#motion-toggle").click()');
  const first=await evaluate('__qaAtmosphere.weatherTime');
  await waitFor('__qaAtmosphere.weatherTime>'+first, 'Worker advances with animation');
  await evaluate('document.querySelector("#motion-toggle").click()');await delay(250);
  const paused=await evaluate('__qaAtmosphere.weatherTime');await delay(200);
  check((await evaluate('__qaAtmosphere.weatherTime'))===paused,'Pausing freezes cloud evolution');
  await evaluate('__qaAtmosphere.weatherWorker.terminate();__qaAtmosphere.workerFailed=true');
  const cloudAmount=await evaluate(`(()=>{
    const a=__qaAtmosphere,baseline=new IslandAtmosphere(null,null,()=>.0235,a.skyPlate,a.sunSky);window.__qaAtmosphere=a;
    baseline.skyCloudAmount=1;baseline.seed=a.seed;baseline.windOffset={...a.windOffset};baseline.dailyWeather={...a.dailyWeather};baseline.weatherKey=a.weatherKey;
    const current=a.cloudFrame(0),reference=baseline.cloudFrame(0);let reduced=0,original=0,seaDifference=0;
    for(let y=0;y<current.canvas.height;y++)for(let x=0;x<current.canvas.width;x++){
      const i=(y*current.canvas.width+x)*4+3;
      if(y<current.canvas.height*.48){reduced+=current.pixels.data[i];original+=reference.pixels.data[i];}
      if(y>current.canvas.height*.7)seaDifference=Math.max(seaDifference,Math.abs(current.pixels.data[i]-reference.pixels.data[i]));
    }
    let sourceReduced=0,sourceOriginal=0;for(let y=0;y<266;y++)for(let x=0;x<1024;x++){sourceReduced+=a.cloudSource[(y*1024+x)*4+3];sourceOriginal+=baseline.cloudSource[(y*1024+x)*4+3];}return {ratio:sourceReduced/sourceOriginal,renderedRatio:reduced/original,seaDifference};
  })()`);
  console.log('INFO upper cloud amount versus v66',cloudAmount);await screenshot('clouds-final-v93.png');
  check(cloudAmount.ratio>.35&&cloudAmount.ratio<.45,'Prepared upper cloud optical mass is 40% of the unthinned reference');
  check(cloudAmount.seaDifference===0,'Cloud-sea density below the horizon is preserved');
  const changes=await evaluate(`(()=>{
    const a=__qaAtmosphere,grab=t=>new Uint8ClampedArray(a.cloudFrame(t).pixels.data),before=grab(0),next=grab(1/12),later=grab(60);
    let tiny=0,long=0,grow=0,fade=0,count=0;
    for(let y=0;y<220;y++)for(let x=0;x<768;x++){
      const i=(y*768+x)*4+3,d=later[i]-before[i];tiny+=Math.abs(next[i]-before[i]);long+=Math.abs(d);if(d>30)grow++;if(d< -30)fade++;count++;
    }
    // Compare two density fields after following the same parcel of wind.
    let diffusion=0,condense=0,evaporate=0;
    for(let y=0;y<20;y++)for(let x=0;x<36;x++){
      const u=x/36,v=y/36,f=a.cloudFlow(u,v,0),h=a.cloudFlow(u,v,60);
      const drift=(h.u-f.u)*768,xx=Math.round(x/36*767-drift),yy=Math.round(v*383);
      if(xx<0||xx>=768)continue;
      const one=before[(yy*768+Math.round(u*767))*4+3],two=later[(yy*768+xx)*4+3];
      diffusion+=Math.abs(two-one);if(two-one>15)condense++;if(one-two>15)evaporate++;
    }
    const cover=[],windOffset=a.windOffset;for(let t=0;t<=900;t+=30){a.windOffset={x:t*.001,y:0};const v={...__qaSkyView,time:t},s=a.sun(v);cover.push(a.cloudAt(v,s.x,s.y));}a.windOffset=windOffset;
    const start=performance.now();for(let t=501;t<506;t++)a.cloudFrame(t);const frameMs=(performance.now()-start)/5;
    return {short:tiny/count,long:long/count,grow,fade,shape:diffusion/720,condense,evaporate,coverMin:Math.min(...cover),coverMax:Math.max(...cover),frameMs};
  })()`);
  console.log('INFO evolving clouds',changes);
  check(changes.short<1&&changes.long>changes.short*10,'Cloud motion is continuous between updates');
  // Wind offset stays fixed for these captures. Count the actual changing pixels,
  // rather than a sparse grid that can miss narrow disappearing cloud edges.
  check(changes.grow>200&&changes.fade>200,'Cloud contours visibly expand and erode at fixed bulk position');
  check(changes.shape>2,'Shapes evolve beyond a rigid translation');
  const contour=await evaluate(`(()=>{
    const a=__qaAtmosphere,frames=[0,20,40,60].map(t=>new Uint8ClampedArray(a.cloudFrame(t).pixels.data)),counts=[];
    const w=768,h=200;let grown=0,eroded=0;
    for(let k=1;k<frames.length;k++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4+3,p=frames[k-1][i],q=frames[k][i];if(p<40&&q>65)grown++;if(p>65&&q<40)eroded++;}
    for(const pixels of frames){const seen=new Uint8Array(w*h),queue=new Uint32Array(w*h);let components=0;
      for(let start=0;start<w*h;start++){if(seen[start]||pixels[start*4+3]<60)continue;let head=0,tail=1;queue[0]=start;seen[start]=1;
        while(head<tail){const at=queue[head++],x=at%w;for(const next of [x?at-1:-1,x<w-1?at+1:-1,at-w,at+w])if(next>=0&&next<w*h&&!seen[next]&&pixels[next*4+3]>=60){seen[next]=1;queue[tail++]=next;}}
        if(tail>=30)components++;
      }counts.push(components);
    }
    return {grown,eroded,components:counts};
  })()`);
  check(contour.grown>100&&contour.eroded>100&&new Set(contour.components).size>1,'Twenty-second captures show growing/disappearing contours and regrouping cloud patches '+JSON.stringify(contour));
  check(changes.coverMax-changes.coverMin>.1,'Clouds independently cross the solar position');
  const stability=await evaluate(`(()=>{
    const a=__qaAtmosphere;let minX=Infinity,maxX=-Infinity,maxY=0,colourFaults=0,minSeaAlpha=255;
    for(const time of [0,60,600,1800,7200])for(let y=0;y<20;y++)for(let x=0;x<36;x++){
      const u=x/36,v=y/20,f=a.cloudFlow(u,v,time),r=a.cloudFlow(u+.001,v,time),down=a.cloudFlow(u,v+.001,time);
      minX=Math.min(minX,(r.u-f.u)/.001);maxX=Math.max(maxX,(r.u-f.u)/.001);maxY=Math.max(maxY,Math.abs((down.u-f.u)/.001));
    }
    for(const time of [0,600,1800]){const data=a.cloudFrame(time).pixels.data;for(let i=0;i<data.length;i+=4)if(data[i+3]>10&&(data[i]>data[i+1]+2||data[i+1]>data[i+2]+2))colourFaults++;}
    for(const time of [600,1800,7200]){const f=a.cloudFrame(time),data=f.pixels.data;for(let y=Math.floor(f.canvas.height*.9);y<f.canvas.height;y++)for(let x=0;x<f.canvas.width;x++)minSeaAlpha=Math.min(minSeaAlpha,data[(y*f.canvas.width+x)*4+3]);}
    return {minX,maxX,maxY,colourFaults,minSeaAlpha};
  })()`);
  console.log('INFO long-running stability',stability);
  check(stability.minX>.65&&stability.maxX<1.35&&stability.maxY<.4,'Cloud deformation stays bounded after two hours');
  check(stability.colourFaults===0,'Cloud texture has no magenta or green colour fringes');
  check(stability.minSeaAlpha>235,'Dense cloud sea stays continuous across the mirrored texture boundary');
  for(const time of [0,60,600,1800]){
    const result=await evaluate(`(()=>{const a=__qaAtmosphere,v={...__qaSkyView,time:${time},lighting:{hour:12,minute:0,second:0}},c=document.createElement('canvas');c.width=v.width;c.height=v.height;a.backgroundScene(c.getContext('2d'),v);return c.toDataURL()})()`);
    await writeFile(path.join(out,'cloud-evolution-'+time+'-v93.png'),Buffer.from(result.split(',')[1],'base64'));
  }
  check(await evaluate(`(()=>{
    const a=__qaAtmosphere,grab=t=>{const c=a.sunFrame(t);return c.getContext('2d').getImageData(0,0,c.width,c.height)},before=grab(0),after=grab(60);
    const x=Math.round(before.width*((.77-.52)/.46)),y=Math.round(before.height*(.14/.58)),i=(y*before.width+x)*4;
    let change=0;for(let n=0;n<before.data.length;n+=4)change+=Math.abs(before.data[n]-after.data[n]);
    return before.data[i]===after.data[i]&&before.data[i+3]===after.data[i+3]&&change===0;
  })()`),'Solar light contains no attached moving cloud texture');
  check(await evaluate(`(()=>{
    const a=__qaAtmosphere,v={...__qaSkyView,time:60,lighting:{hour:22,minute:0,second:0}},c=document.createElement('canvas');c.width=1440;c.height=1000;
    const stars=a.stars,cover=a.cloudAt;a.stars=()=>[{x:100,y:100,alpha:1,radius:2,warm:false}];
    const g=c.getContext('2d');a.cloudAt=()=>0;a.drawStars(g,v);const clear=g.getImageData(100,100,1,1).data[3];g.clearRect(0,0,1440,1000);
    a.cloudAt=()=>1;a.drawStars(g,v);const cloudy=g.getImageData(100,100,1,1).data[3];a.stars=stars;a.cloudAt=cover;return cloudy<clear*.1;
  })()`),'Night clouds also attenuate the stars behind them');
  await screenshot('cloud-island-v93.png');
  await evaluate(`(()=>{const a=__qaAtmosphere,background=a.background,foreground=a.foreground;a.background=function(g,v){background.call(this,g,{...v,time:1800})};a.foreground=function(g,v){foreground.call(this,g,{...v,time:1800})};})()`);
  await delay(250);await screenshot('cloud-island-30minutes-v93.png');
  check(errors.length===0,'No browser errors '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
