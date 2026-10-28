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
  const downloads=path.join(out,'downloads');await mkdir(downloads,{recursive:true});await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__qaCatPaints=[];Object.defineProperty(window,'IslandCat',{configurable:true,set(Class){class Observed extends Class{constructor(options){super(options);window.__qaCat=this;}draw(g,key,scale){const visible=super.draw(g,key,scale);if(visible){__qaCatPaints.push(key);if(__qaCatPaints.length>90)__qaCatPaints.shift();}return visible;}}Object.defineProperty(window,'IslandCat',{value:Observed,writable:true,configurable:true})}});Object.defineProperty(window,'IslandAudio',{configurable:true,set(Class){const original=Class.prototype.createContext;Class.prototype.createContext=function(){original.call(this);window.__qaAudio=this;window.__qaCatAnalyser=this.context.createAnalyser();this.cats.connect(__qaCatAnalyser);};Object.defineProperty(window,'IslandAudio',{value:Class,writable:true,configurable:true})}});const raf=requestAnimationFrame.bind(window);let fake=0,last=0;window.requestAnimationFrame=cb=>raf(t=>{fake+=(last?t-last:16)*(window.__qaFast?8:1);last=t;cb(fake)});})()`});
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'IslandNPCLife',{configurable:true,set(Class){class Observed extends Class{constructor(...args){super(...args);window.__qaNPC=this;}}Object.defineProperty(window,'IslandNPCLife',{value:Observed,writable:true,configurable:true})}})"});
  await call('Page.navigate',{url:process.env.ISLAND_TEST_URL||'http://127.0.0.1:4173'});
  const waitFor=async(expression,label,max=160)=>{for(let i=0;i<max;i++){if(await evaluate(expression))return;await delay(50);}throw Error(label+' '+JSON.stringify({errors,state:await evaluate('({room:islandGame?.roomState(),cat:islandGame?.catState()})')}));};
  await waitFor('!!window.islandGame?.getState().ready','Assets ready');check(true,'Island, shared doctor renderer and cat sprite load');
  check(await evaluate('document.querySelector("#loading p").textContent==="正在前往Otsuka-Island"'),'Loading message matches the requested wording');
  await evaluate('__qaCat.wait=99999');
  const clickUI=async selector=>{await evaluate('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"nearest"})');const p=await evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await click(p.x,p.y);};
  const roomPoint=async p=>evaluate('(()=>{const r=document.querySelector(".room-scene").getBoundingClientRect();return{x:r.x+'+p.x+'/1536*r.width,y:r.y+'+p.y+'/1024*r.height}})()');
  const floorClick=async p=>{const s=await roomPoint(p);await click(s.x,s.y);};
  const choose=async key=>{await evaluate('window.__qaFast=true');await clickUI('#ui-toggle');await clickUI('[data-place='+key+']');await waitFor('islandGame.roomState().open&&islandGame.roomState().key==='+JSON.stringify(key),'Enter '+key,240);await waitFor('islandGame.roomState().imageReady','Room art ready');await evaluate('window.__qaFast=false');};
  const atRest=()=>waitFor('!islandGame.roomState().world.actor.route.length','Indoor arrival');
  const openEquipment=async()=>{await clickUI('.room-object');await waitFor('islandGame.roomState().topicOpen','Topic after arrival');};
  const place=async(key,station,kind)=>evaluate('(()=>{const l=__qaNPC,w=l.workers['+JSON.stringify(key)+'],s=w.profile.stations['+JSON.stringify(station)+'];w.x=s.x;w.y=s.y;w.time+=2;w.heading=Math.atan2(s.look.y-s.y,s.look.x-s.x);l.start(w,{kind:'+JSON.stringify(kind)+',time:999,station:'+JSON.stringify(station)+'});w.blend=1;w.prop=null;return l.snapshot('+JSON.stringify(key)+');})()');




  const inspect=async(key,index=null)=>evaluate(`(()=>{
    const w=__qaNPC.roomWorkers(${JSON.stringify(key)})[${index??0}],oldTime=w.time,oldLocation={x:w.x,y:w.y,pose:w.pose,station:w.station};
    let time=oldTime;for(let t=oldTime;t<oldTime+35;t+=.06)if(IslandNPCRenderer.idleMotion({...w,time:t}).envelope>.98){time=t;break;}
    const render=t=>{w.time=t;const c=document.createElement('canvas');c.width=1536;c.height=1024;const g=c.getContext('2d');IslandNPCRenderer.draw(g,w,__qaNPC.images[w.assetRoom||w.key],null);return g.getImageData(0,0,1536,1024).data};
    const a=render(time),b=render(time+.35),c=render(time+1.1),seat=IslandRoomSeating.occupied(w);
    const differences=(p,q,rect)=>{const [x,y,width,height]=rect;let changed=0;for(let yy=Math.max(0,Math.floor(y));yy<Math.min(1024,y+height);yy++)for(let xx=Math.max(0,Math.floor(x));xx<Math.min(1536,x+width);xx++){const i=(yy*1536+xx)*4;if(p[i]!==q[i]||p[i+1]!==q[i+1]||p[i+2]!==q[i+2]||p[i+3]!==q[i+3])changed++;}return changed;};
    let hands,upper,feet,chair;
    if(seat){const centers={hank:[[.294,.543],[.366,.509]],anthony:[[.289,.485],[.363,.446]],princessOffice:[[.265,.475],[.349,.444]],princessRound:[[.265,.431],[.351,.399]]}[seat.occupied];
      hands=centers.map(([x,y])=>[seat.x+(seat.flip?1-x:x)*seat.width-14,seat.y+y*seat.height-14,28,28]);
      upper=[seat.x+seat.width*.3,seat.y,seat.width*.5,seat.height*.35];feet=[seat.x,Math.ceil(seat.y+seat.height*.70),seat.width,Math.floor(seat.height*.29)];
      // Anthony has a backless stool: probe its cushion, not his shirt.
      chair=seat.occupied==='anthony'?[seat.x+(seat.flip?.22:.68)*seat.width,seat.y+seat.height*.735,seat.width*.10,seat.height*.04]:[seat.x+(seat.flip?.04:.79)*seat.width,seat.y+seat.height*.46,seat.width*.14,seat.height*.16];
    }else{hands=[-1,1].map(side=>[w.x+side*w.height*.13-18,w.y-w.height*.41-22,36,44]);upper=[w.x-w.height*.3,w.y-w.height,w.height*.6,w.height*.3];feet=[w.x-100,w.y-w.height*.23,200,w.height*.23+5];}
    const result={name:w.name,pose:w.pose,station:w.station,breathChanged:differences(a,c,upper),handsChanged:hands.reduce((n,r)=>n+differences(a,b,r),0),feetChanged:differences(a,b,feet),chairChanged:chair?differences(a,b,chair):0,gesture:time};
    w.time=oldTime;result.positionUnchanged=w.x===oldLocation.x&&w.y===oldLocation.y&&w.pose===oldLocation.pose&&w.station===oldLocation.station;return result;
  })()`);
  const inspectOperation=async(key)=>evaluate(`(()=>{
    const w=__qaNPC.workers[${JSON.stringify(key)}],oldTime=w.time,seat=IslandRoomSeating.occupied(w);
    const samples=Array.from({length:1000},(_,i)=>({time:i*.03,...IslandNPCRenderer.idleMotion({...w,time:i*.03})}));
    const points={hank:[[.294,.543],[.366,.509]],anthony:[[.289,.485],[.363,.446]],princessOffice:[[.265,.475],[.349,.444]],princessRound:[[.265,.431],[.351,.399]]}[seat.occupied];
    const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=1024;const g=canvas.getContext('2d',{willReadFrequently:true});
    const sheet=document.createElement('canvas');sheet.width=Math.ceil(seat.width*8);sheet.height=Math.ceil(seat.height*2+32);const p=sheet.getContext('2d');p.fillStyle='#eee8df';p.fillRect(0,0,sheet.width,sheet.height);
    const motion=[];
    for(let hand=0;hand<2;hand++){
      const field=hand?'right':'left',reach=hand?'rightReach':'leftReach';
      const extremes=[samples.reduce((a,b)=>a[field]<b[field]?a:b),samples.find(s=>s.envelope>.99&&s[field]>-.03),samples.reduce((a,b)=>a[reach]<b[reach]?a:b)];
      const centroids=[];
      for(let frame=0;frame<extremes.length;frame++){
        const sample=extremes[frame];w.time=sample.time;g.clearRect(0,0,1536,1024);IslandNPCRenderer.draw(g,w,__qaNPC.images[w.key],null);
        const [hx,hy]=points[hand],x=seat.x+(seat.flip?1-hx:hx)*seat.width,y=seat.y+hy*seat.height;
        const pixels=g.getImageData(Math.floor(x-19),Math.floor(y-21),38,38).data;let sx=0,sy=0,count=0;
        for(let yy=0;yy<38;yy++)for(let xx=0;xx<38;xx++){const i=(yy*38+xx)*4,r=pixels[i],green=pixels[i+1],b=pixels[i+2];if(pixels[i+3]>180&&r>145&&r>green*1.13&&green>b*1.12){sx+=xx;sy+=yy;count++;}}
        centroids.push(count?{x:sx/count,y:sy/count}:null);
        if(hand===0||frame===2){const col=hand===0?frame:3;p.drawImage(canvas,seat.x,seat.y,seat.width,seat.height,col*seat.width*2,0,seat.width*2,seat.height*2);p.fillStyle='#28433a';p.font='18px sans-serif';p.fillText((hand?'Far hand reach':frame===0?'Key lift':frame===1?'Key press':'Near hand reach'),col*seat.width*2+12,seat.height*2+24);}
      }
      const travel=Math.max(...centroids.flatMap(a=>centroids.filter(Boolean).map(b=>a?Math.hypot(a.x-b.x,a.y-b.y):0)));
      motion.push({hand,travel,centroids});
    }
    w.time=oldTime;
    return{motion,activeFraction:samples.filter(s=>s.envelope>.5).length/samples.length,image:sheet.toDataURL()};
  })()`);
  for(const key of ['clock','library','lab']){
    await choose(key);await waitFor('__qaNPC.ready('+JSON.stringify(key)+')','NPC assets ready',300);await evaluate('__qaNPC.update=()=>{}');
    for(const station of ['stand',...(key==='clock'?['computer','stool']:['computer','second'])]){
      if(station==='stand')await evaluate('(()=>{const w=__qaNPC.workers['+JSON.stringify(key)+'];w.lastFixedPose=null;__qaNPC.random=()=>.9;__qaNPC.settle(w)})()');else await place(key,station,'type');
      const r=await inspect(key);check(r.breathChanged>15&&r.handsChanged>5&&r.feetChanged===0&&r.chairChanged===0&&r.positionUnchanged,'Breathing and wrist movement with fixed feet/chair '+JSON.stringify(r));
      if(station!=='stand'){
        const operation=await inspectOperation(key);await writeFile(path.join(out,'seated-operation-'+key+'-'+station+'-v76.png'),Buffer.from(operation.image.split(',')[1],'base64'));
        check(operation.activeFraction>.7&&operation.motion.every(m=>m.travel>2),'Both seated hands visibly operate controls '+JSON.stringify({room:key,station,activeFraction:operation.activeFraction,hands:operation.motion}));
      }
    }
    await clickUI('.room-close');
  }
  await choose('workshop');await evaluate('__qaNPC.settleWorkshop("portrait")');await waitFor('__qaNPC.ready("workshop")','All workshop coworkers ready',300);
  for(let i=0;i<3;i++){const r=await inspect('workshop',i);check(r.breathChanged>15&&r.handsChanged>5&&r.feetChanged===0&&r.positionUnchanged,'Workshop coworker idle motion '+JSON.stringify(r));}
  check(await evaluate('(()=>{const a=__qaNPC.workshopWorkers.map(w=>IslandNPCRenderer.idleMotion({...w,time:12}));return new Set(a.map(x=>x.breath.toFixed(4))).size===3})()'),'Three people have independent breathing phases');
  await screenshot('workshop-idle-poses-v76.png');
  check(errors.length===0,'No browser errors '+JSON.stringify(errors));
}finally{clearInterval(keepAlive);socket?.close();chrome.kill();}
