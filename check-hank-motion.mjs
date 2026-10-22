import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('.preview');await mkdir(out,{recursive:true});
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-sandbox','--no-first-run','--remote-debugging-port=9338','--user-data-dir='+path.join(out,'motion-'+Date.now()),'about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let socket;const pending=new Map();let sequence=0;
try{
  let pages;for(let i=0;i<80;i++){try{pages=await(await fetch('http://127.0.0.1:9338/json/list')).json();if(pages.length)break;}catch{}await delay(100);}
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
  socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const job=pending.get(m.id);if(job){pending.delete(m.id);m.error?job.reject(Error(JSON.stringify(m.error))):job.resolve(m.result);}}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await call('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'IslandNPCLife',{configurable:true,set(C){class Observed extends C{constructor(...args){super(...args);window.__life=this}}Object.defineProperty(window,'IslandNPCLife',{value:Observed,writable:true})}})"});
  await call('Page.navigate',{url:process.env.ISLAND_TEST_URL||'http://127.0.0.1:4173'});
  for(let i=0;i<200;i++){if(await evaluate('!!window.islandGame?.getState().ready'))break;await delay(100);}
  await evaluate('(window.__life ||= new IslandNPCLife()).load("library")');
  function capture(){
    const sheet=document.createElement('canvas');sheet.width=1800;sheet.height=1800;const g=sheet.getContext('2d');g.fillStyle='#eeeae1';g.fillRect(0,0,sheet.width,sheet.height);
    const headings=[0,Math.PI/2,-Math.PI/2,-Math.PI*.75],reports=[];
    for(let row=0;row<4;row++){
      const heading=headings[row],w={...__life.workers.library,x:0,y:0,time:0,phase:0,heading,kind:'walk',speed:100,items:[],prop:null,targetStation:null};let wasSupport=true,lifts=0;
      const profile=__life.workers.library.profile;
      for(let frame=0;frame<360;frame++){
        const factor=IslandHankRig.travelScale?.(heading)||1,step=100*factor/60;w.time+=1/60;w.x+=Math.cos(heading)*step;w.y+=Math.sin(heading)*step;w.phase+=step*.055;
        const r=IslandHankRig.solve(w);if(wasSupport&&!r.limbs[0].support)lifts++;wasSupport=r.limbs[0].support;
        if([120,130,140,150,160,170].includes(frame)){
          const col=(frame-120)/10;g.save();g.translate(col*300+150-w.x,row*450+415-w.y);g.fillStyle='#b1ad9e';g.fillRect(w.x-110,w.y+1,220,1);IslandHankRig.draw(g,w,__life.images.library);g.restore();
          g.fillStyle='#536356';g.font='15px sans-serif';g.fillText('direction '+row+' / '+(frame/60).toFixed(2)+' s',col*300+10,row*450+25);
        }
      }
      reports.push({heading,cyclesPerSecond:lifts/6});
    }
    return{png:sheet.toDataURL('image/png').split(',')[1],reports};
  }
  const result=await evaluate('('+capture.toString()+')()');
  const label=process.env.MOTION_LABEL||'after';await writeFile(path.join(out,'hank-motion-'+label+'.png'),Buffer.from(result.png,'base64'));await writeFile(path.join(out,'hank-motion-'+label+'.json'),JSON.stringify(result.reports,null,2));
  console.log('Motion cadence',JSON.stringify(result.reports));
  if(!process.env.MOTION_BASELINE&&result.reports.some(r=>r.cyclesPerSecond<.6||r.cyclesPerSecond>1.6))throw Error('Walking cadence changes unnaturally with direction');
  // Record a real-time turn, start, straight walk and stop for visual review.
  const video=await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=960;c.height=540;const g=c.getContext('2d'),w={...__life.workers.library,x:480,y:460,time:0,phase:0,heading:Math.PI/2,kind:'stand',speed:0,items:[],prop:null,targetStation:null};const stream=c.captureStream(30),rec=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];rec.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>rec.onstop=async()=>{const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));resolve(btoa(text))});rec.start();for(let f=0;f<180;f++){w.time+=1/30;if(f<30){w.heading=Math.PI/2+(Math.PI/2)*Math.min(1,f/20);w.kind='stand';w.speed=0}else if(f<135){w.kind='walk';w.speed=Math.min(95,w.speed+12);const step=w.speed/30;w.x-=step;w.phase+=step*.055}else{w.kind='stand';w.speed=0}g.fillStyle='#eeeae1';g.fillRect(0,0,960,540);g.strokeStyle='#b8b3a8';g.beginPath();g.moveTo(50,461);g.lineTo(900,461);g.stroke();IslandHankRig.draw(g,w,__life.images.library);await new Promise(resolve=>setTimeout(resolve,1000/30))}rec.stop();stream.getTracks().forEach(t=>t.stop());return done})()`);
  await writeFile(path.join(out,'hank-motion-'+label+'.webm'),Buffer.from(video,'base64'));console.log('PASS recorded continuous start/turn/walk/stop and saved filmstrip: '+label);
}finally{socket?.close();browser.kill();}
