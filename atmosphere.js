(() => {
  'use strict';
  const wrap=(value,span)=>((value%span)+span)%span;
  const clamp=value=>Math.max(0,Math.min(1,value));
  const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
  const makeCanvas=()=>typeof document==='undefined'?new OffscreenCanvas(1,1):document.createElement('canvas');
  const hash=(x,y,seed)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(seed,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  const valueNoise=(x,y,seed)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);return (hash(ix,iy,seed)*(1-fx)+hash(ix+1,iy,seed)*fx)*(1-fy)+(hash(ix,iy+1,seed)*(1-fx)+hash(ix+1,iy+1,seed)*fx)*fy;};
  const nebulaNoise=(x,y,seed)=>valueNoise(x,y,seed)*.53+valueNoise(x*2.03,y*2.03,seed+1)*.27+valueNoise(x*4.13,y*4.13,seed+2)*.13+valueNoise(x*8.21,y*8.21,seed+3)*.07;
  const workerURL=typeof document==='undefined'?null:document.currentScript?.src;
  class IslandAtmosphere {
    constructor(image,distantImage,random=Math.random,skyPlate,sunSky){
      this.seed=random()*1000;this.distantImage=distantImage;this.skyPlate=skyPlate;this.sunSky=sunSky;
      this.skyCloudAmount=.4;
      this.wind={mode:'random',speedMode:'random',speed:1,direction:wrap(Math.sin(this.seed*1.71)*43758.5453,1)<.5?270:90};
      this.windOffset={x:0,y:0};this.windTime=0;this.windRevision=0;
    }
    setWind(settings){
      if(settings.mode==='random'||settings.mode==='manual')this.wind.mode=settings.mode;
      if(Number.isFinite(settings.speed)){this.wind.speed=Math.max(0,Math.min(20,settings.speed));this.wind.speedMode='manual';}
      if(settings.speedMode==='random'||settings.speedMode==='manual')this.wind.speedMode=settings.speedMode;
      if(Number.isFinite(settings.direction))this.wind.direction=wrap(settings.direction,360)<180?90:270;
      this.windRevision++;
    }
    updateWind(time){
      const elapsed=Math.max(0,time-this.windTime);if(!elapsed)return;
      // Integrate velocity: changing a control never relocates existing clouds.
      const steps=Math.ceil(elapsed/.25),dt=elapsed/steps;
      for(let step=0;step<steps;step++){
        const t=this.windTime+(step+.5)*dt;
        let flow=this.wind.direction===90?1:-1;
        if(this.wind.mode==='random'){
          // Reverse through calm air, without ever introducing vertical wind.
          // Keep each heading for at least three minutes before a possible reversal.
          const epoch=Math.floor(t/210),fraction=smooth((t%210-180)/30);
          const heading=n=>wrap(Math.sin(n*127.1+this.seed*1.71)*43758.5453,1)<.5?-1:1;
          flow=heading(epoch)+(heading(epoch+1)-heading(epoch))*fraction;
          this.wind.direction=flow>=0?90:270;
        }
        if(this.wind.speedMode==='random'){
          const epoch=Math.floor(t/50),fraction=smooth(t/50-epoch);
          const target=n=>.4+2.2*wrap(Math.sin((n+37)*91.7+this.seed*2.31)*43758.5453,1);
          const speedTarget=target(epoch)+(target(epoch+1)-target(epoch))*fraction;
          this.wind.speed+=(speedTarget-this.wind.speed)*(1-Math.exp(-dt/6));
        }
        const speed=this.wind.speed*.00032;
        this.windOffset.x+=flow*speed*dt;
      }
      this.windTime=time;
    }
    windSnapshot(){return {...this.wind,offset:{...this.windOffset}};}
    weatherProfile(view){
      const l=view.lighting||{},hour=(l.hour??12)+(l.minute||0)/60+(l.second||0)/3600;
      const stamp=(l.day??0)+hour/24,day=Math.floor(stamp),f=smooth(stamp-day),seed=Math.floor(this.seed*1000);
      const sample=d=>({shiftX:(hash(d,1,seed)-.5)*.44,shiftY:(hash(d,2,seed)-.5)*.12,
        humidity:(hash(d,3,seed)-.5)*.12,density:.65+hash(d,4,seed)*.7,fog:.35+hash(d,5,seed)*.6,
        sunX:(hash(d,6,seed)-.5)*.07,sunY:(hash(d,7,seed)-.5)*.04,sunScale:.85+hash(d,8,seed)*.3,
        sunshine:.76+hash(d,9,seed)*.24,moonX:(hash(d,10,seed)-.5)*.04,moonScale:.90+hash(d,11,seed)*.16});
      const a=sample(day),b=sample(day+1);return Object.fromEntries(Object.keys(a).map(key=>[key,a[key]+(b[key]-a[key])*f]));
    }
    applyWeather(view){this.dailyWeather=this.weatherProfile(view);this.weatherKey=Object.values(this.dailyWeather).map(v=>v.toFixed(3)).join(':');}
    prepareClouds(){
      if(this.cloudSource)return true;
      if(!this.skyPlate?.naturalWidth)return false;
      // Separate the reference photograph into blue air and optical cloud density.
      // The photograph supplies the fine texture; only the cloud layer is advected.
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
      const g=canvas.getContext('2d',{willReadFrequently:true});g.drawImage(this.skyPlate,0,0,1024,512);
      const pixels=g.getImageData(0,0,1024,512),data=pixels.data;
      const rows=[];
      for(let y=0;y<320;y+=16){
        const samples=[];for(let x=0;x<1024;x+=4){const i=(y*1024+x)*4;samples.push([data[i],data[i+1],data[i+2]]);}
        samples.sort((a,b)=>a[0]-b[0]);rows.push({y:y/512,rgb:samples[Math.floor(samples.length*.08)]});
      }
      this.skyRows=rows;
      for(let y=0;y<512;y++){
        const blue=this.blueAt(y/512),opaque=smooth((y/512-.66)/.17)*.97;
        for(let x=0;x<1024;x++){
          const i=(y*1024+x)*4;
          const a=Math.max(opaque,clamp((data[i]-blue[0])/(255-blue[0])));
          // Unmixing RGB by a tiny alpha amplifies compression/colour differences
          // into magenta edges. Keep neutral highlights and cool sea shadows instead.
          const lowCloud=smooth((y/512-.60)/.18);
          const shade=clamp((250-(data[i]+data[i+1]+data[i+2])/3)/90)*lowCloud;
          data[i]=Math.round(250-shade*95);data[i+1]=Math.round(252-shade*48);data[i+2]=Math.round(255-shade*10);
          data[i+3]=Math.round(a*255);
        }
      }
      // Thin complete cloud groups instead of subtracting their soft edges.
      // Pixel thresholds alone left only broken, overly white cloud-top streaks.
      const limit=328*1024,labels=new Int32Array(limit),queue=new Uint32Array(limit),groups=[];
      for(let start=0;start<limit;start++){
        if(labels[start]||data[start*4+3]<12)continue;
        const label=groups.length+1;let head=0,tail=1,mass=0;queue[0]=start;labels[start]=label;
        while(head<tail){
          const at=queue[head++],x=at%1024;if(at<266*1024)mass+=data[at*4+3];
          for(const next of [x?at-1:-1,x<1023?at+1:-1,at-1024,at+1024])if(next>=0&&next<limit&&!labels[next]&&data[next*4+3]>=12){labels[next]=label;queue[tail++]=next;}
        }
        groups.push({label,mass,order:hash(start%1024,Math.floor(start/1024),23),factor:0});
      }
      let remaining=groups.reduce((sum,c)=>sum+c.mass,0)*this.skyCloudAmount;
      for(const group of [...groups].sort((a,b)=>a.order-b.order)){if(!group.mass){group.factor=1;continue;}group.factor=Math.min(1,remaining/group.mass);remaining=Math.max(0,remaining-group.mass);}
      for(let at=0;at<limit;at++){const label=labels[at],factor=label?groups[label-1].factor:this.skyCloudAmount,upper=1-smooth((at/1024/512-.52)/.12);data[at*4+3]=Math.round(data[at*4+3]*(1+(factor-1)*upper));}
      g.putImageData(pixels,0,0);this.cloudCover=canvas;this.cloudSource=pixels.data;
      // Extend the edges before diffusion. Blurring against transparent canvas
      // would create a dark seam every time the wind reaches a mirrored boundary.
      const padded=document.createElement('canvas');padded.width=1056;padded.height=544;
      const edge=padded.getContext('2d');edge.drawImage(canvas,16,16);
      edge.drawImage(canvas,0,0,1,512,0,16,16,512);edge.drawImage(canvas,1023,0,1,512,1040,16,16,512);
      edge.drawImage(padded,0,16,1056,1,0,0,1056,16);edge.drawImage(padded,0,527,1056,1,0,528,1056,16);
      const soft=document.createElement('canvas');soft.width=1024;soft.height=512;
      const p=soft.getContext('2d',{willReadFrequently:true});p.filter='blur(1.5px)';p.drawImage(padded,-16,-16);
      this.cloudSoft=p.getImageData(0,0,1024,512).data;
      this.cloudFrames={};return true;
    }
    blueAt(v){
      const rows=this.skyRows;if(!rows?.length)return [61,163,239];
      const pos=Math.min(rows.length-1,Math.max(0,v*32)),lo=Math.floor(pos),hi=Math.min(rows.length-1,lo+1),f=pos-lo;
      return rows[lo].rgb.map((c,i)=>c+(rows[hi].rgb[i]-c)*f);
    }
    cloudFlow(u,v,time,near=false){
      const weather=this.dailyWeather||{},phase=this.seed+(near?5.7:0),sea=smooth((v-.55)/.20),speed=near?1.7:1;
      // Wind offsets are measured against texture width. Correct the vertical
      // aspect so diagonal winds retain their screen angle on every layer.
      const x=u-this.windOffset.x*speed,y=v-this.windOffset.y*2*speed,t=time*(near?1.7:1);
      const eddy=Math.sin(x*10+y*7+phase),curl=Math.cos(x*6-y*12+phase*.7);
      const moisture=Math.sin(x*13+y*9-t*.037+phase+(weather.shiftX||0)*5)+.48*Math.sin(x*27-y*17+t*.052+phase*.31+(weather.shiftY||0)*7);
      return {
        // Static spatial warp travels with each wind parcel. Shape changes use
        // condensation/diffusion, never an unrelated translation or oscillation.
        u:x+.006*eddy+.003*curl,
        v:y+.0035*Math.cos(x*9+y*5+phase)+.0015*Math.sin(x*17+phase),
        threshold:(.047*moisture+.035*Math.sin(x*5+y*11+t*.014+phase))*(1-sea*.7)+(weather.humidity||0)*(1-sea),
        diffusion:.5+.5*Math.sin(x*8-y*5-t*.029+phase*.4),sea
      };
    }
    cloudFrame(time,near=false){
      if(!this.prepareClouds())return null;
      const name=near?'near':'far',tick=Math.floor(time*12),key=[tick,this.windOffset.x,this.windOffset.y,this.windRevision,this.weatherKey].join(':');
      const frame=this.cloudFrames[name] ||= {canvas:makeCanvas(),tick:null};
      if(frame.tick===key)return frame;
      const width=near?384:768,height=width/2;
      if(frame.canvas.width!==width){frame.canvas.width=width;frame.canvas.height=height;frame.pixels=frame.canvas.getContext('2d').createImageData(width,height);}
      const out=frame.pixels.data,source=this.cloudSource,soft=this.cloudSoft;
      // A small smooth flow grid avoids evaluating trigonometry for every texel.
      const cols=49,rows=25,grid=new Float32Array(cols*rows*5);
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const flow=this.cloudFlow(x/(cols-1),y/(rows-1),tick/12,near),i=(y*cols+x)*5;
        grid[i]=flow.u;grid[i+1]=flow.v;grid[i+2]=flow.threshold;grid[i+3]=flow.diffusion;grid[i+4]=flow.sea;
      }
      for(let y=0;y<height;y++){
        const gy=y/(height-1)*(rows-1),iy=Math.min(rows-2,Math.floor(gy)),fy=gy-iy;
        for(let x=0;x<width;x++){
          const gx=x/(width-1)*(cols-1),ix=Math.min(cols-2,Math.floor(gx)),fx=gx-ix;
          const a=(iy*cols+ix)*5,b=a+5,c=a+cols*5,d=c+5;
          const wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,wd=fx*fy;
          const u=grid[a]*wa+grid[b]*wb+grid[c]*wc+grid[d]*wd;
          const v=grid[a+1]*wa+grid[b+1]*wb+grid[c+1]*wc+grid[d+1]*wd;
          const humidity=grid[a+2]*wa+grid[b+2]*wb+grid[c+2]*wc+grid[d+2]*wd;
          const diffusion=grid[a+3]*wa+grid[b+3]*wb+grid[c+3]*wc+grid[d+3]*wd;
          const sea=grid[a+4]*wa+grid[b+4]*wb+grid[c+4]*wc+grid[d+4]*wd;
          // Mirrored periodic sampling stays seamless while the whole texture
          // travels in one direction. Upper air and sea use separate vertical bands.
          const skyWeight=1-smooth((y/(height-1)-.44)/.10);
          const mirror=wrap(u,2),sx=(mirror>1?2-mirror:mirror)*1022;
          const vertical=wrap(v,1.10),skyV=vertical>.55?1.10-vertical:vertical;
          const seaVertical=wrap(v-.56,.88),seaV=.56+(seaVertical>.44?.88-seaVertical:seaVertical);
          const sy=(skyWeight===1?skyV:seaV)*510;
          const px=Math.floor(sx),py=Math.floor(sy),dx=sx-px,dy=sy-py;
          const i=(py*1024+px)*4,j=(y*width+x)*4;
          const sa=(1-dx)*(1-dy),sb=dx*(1-dy),sc=(1-dx)*dy,sd=dx*dy;
          let alpha=(source[i+3]*sa+source[i+7]*sb+source[i+4099]*sc+source[i+4103]*sd)/255;
          let spread=(soft[i+3]*sa+soft[i+7]*sb+soft[i+4099]*sc+soft[i+4103]*sd)/255;
          const seaWindow=smooth((y/(height-1)-.52)/.11);
          if(skyWeight<1){alpha*=seaWindow;spread*=seaWindow;}
          if(skyWeight>0&&skyWeight<1){
            // Both bands follow the same wind. The sea's stationary height
            // envelope retains a level horizon while its banks flow through it.
            const yy=skyV*510,yi=Math.floor(yy),yf=yy-yi,si=(yi*1024+px)*4;
            const aa=(1-dx)*(1-yf),ab=dx*(1-yf),ac=(1-dx)*yf,ad=dx*yf;
            const upper=(source[si+3]*aa+source[si+7]*ab+source[si+4099]*ac+source[si+4103]*ad)/255;
            const upperSoft=(soft[si+3]*aa+soft[si+7]*ab+soft[si+4099]*ac+soft[si+4103]*ad)/255;
            alpha+=skyWeight*(upper-alpha);spread+=skyWeight*(upperSoft-spread);
          }
          // Diffusion broadens the edges. Local humidity condenses adjoining wisps
          // or evaporates them, changing their silhouette rather than scaling a sprite.
          const density=alpha+(spread-alpha)*diffusion*.32;
          const evolved=clamp(density+humidity*smooth(density*10)*(1-density));
          const final=Math.pow(evolved,1.08-humidity*3.4);
          for(let ch=0;ch<3;ch++)out[j+ch]=source[i+ch]*sa+source[i+4+ch]*sb+source[i+4096+ch]*sc+source[i+4100+ch]*sd;
          const dailyDensity=1+((this.dailyWeather?.density??1)-1)*(1-sea);
          const seaFloor=smooth((y/(height-1)-.74)/.13)*.97*(1-skyWeight);
          out[j+3]=Math.round(255*Math.max(seaFloor,clamp((final*(1-sea*.12)+alpha*sea*.12)*dailyDensity)));
        }
      }
      frame.canvas.getContext('2d').putImageData(frame.pixels,0,0);frame.tick=key;return frame;
    }
    requestWeather(time){
      if(this.workerFailed||!workerURL||typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')return;
      if(!this.weatherWorker){
        try{
          this.weatherWorker=new Worker(workerURL);
          this.weatherWorker.onmessage=event=>{
            this.weatherBusy=false;
            if(event.data.error){this.weatherError=event.data.error;this.weatherWorker.terminate();this.workerFailed=true;return;}
            this.visualClouds ||= {};
            for(const name of ['far','near']){
              const pixels=event.data[name],frame=this.visualClouds[name] ||= {canvas:makeCanvas()};
              frame.canvas.width=pixels.width;frame.canvas.height=pixels.height;
              frame.canvas.getContext('2d').putImageData(pixels,0,0);frame.pixels=pixels;
            }
            if(event.data.sun){this.movingSun.getContext('2d').putImageData(event.data.sun,0,0);}
            this.weatherTime=event.data.time;
            this.weatherWindOffset=event.data.windOffset;
            this.weatherRenderedKey=event.data.weatherKey;
            this.weatherRenderedRevision=event.data.windRevision;
            if(this.buffers){this.buffers.sky.key=null;this.buffers.fog.key=null;}
          };
          this.weatherWorker.onerror=event=>{this.weatherError=event.message;this.weatherWorker.terminate();this.workerFailed=true;this.weatherBusy=false;};
        }catch{this.workerFailed=true;return;}
      }
      const tick=Math.floor(time*12),key=tick+':'+this.windRevision+':'+this.weatherKey;if(this.weatherBusy||this.weatherRequested===key)return;
      const message={time:tick/12,seed:this.seed,windOffset:this.windOffset,windRevision:this.windRevision,weather:this.dailyWeather,weatherKey:this.weatherKey};
      if(!this.weatherInitialized){message.source=this.cloudSource;message.soft=this.cloudSoft;this.weatherInitialized=true;}
      if(this.sunPixels&&!this.weatherSunInitialized){message.sun=this.sunPixels;message.sunWidth=this.movingSun.width;message.sunHeight=this.movingSun.height;this.weatherSunInitialized=true;}
      this.weatherBusy=true;this.weatherRequested=key;this.weatherWorker.postMessage(message);
    }
    visualCloudFrame(time,near=false){
      if(!this.prepareClouds())return null;
      this.requestWeather(time);
      // Keep the previous complete frame while the background worker evolves the
      // next one. Dragging, room navigation and PPT interaction never wait for it.
      return (!this.workerFailed&&this.visualClouds?.[near?'near':'far'])||this.cloudFrame(time,near);
    }
    cloudAt(view,x,y,visual=false){
      const frame=visual?this.visualCloudFrame(view.time):this.cloudFrame(view.time),layer=this.sea(view);if(!frame)return 0;
      const u=(x-layer.x)/layer.w,v=(y-layer.y)/layer.h;
      if(u<0||u>1||v<0||v>1)return 0;
      const px=Math.min(frame.canvas.width-1,Math.floor(u*frame.canvas.width)),py=Math.min(frame.canvas.height-1,Math.floor(v*frame.canvas.height));
      return frame.pixels.data[(py*frame.canvas.width+px)*4+3]/255;
    }
    islandTextures(){
      if(this.distantTextures)return this.distantTextures;
      const image=this.distantImage;if(!image?.naturalWidth)return [];
      const cell=image.naturalWidth/3;
      this.distantTextures=[0,1,2].map(variant=>{
        const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
        const g=canvas.getContext('2d');
        g.drawImage(image,cell*(variant+.13),image.naturalHeight*.15,cell*.74,image.naturalHeight*.72,8,8,240,240);
        return canvas;
      });return this.distantTextures;
    }
    horizonTrack(view,riseHour){
      const l=view.lighting||{},hour=(l.hour??12)+(l.minute||0)/60+(l.second||0)/3600;
      const continuous=riseHour===18&&hour<12?hour+24:hour,progress=(continuous-riseHour)/12;
      const horizon=this.sea(view).horizon,elevation=4*progress*(1-progress),height=horizon-view.height*.12;
      // A fixed left-to-right scene path. It is independent of the astronomical camera.
      // Slightly bias the high point rightwards so the clock tower does not hide it.
      return {x:view.width*(progress+.16*Math.sin(Math.PI*progress)),y:horizon-height*elevation,horizon,elevation,progress};
    }
    sun(view){
      const daily=this.weatherProfile(view),position=this.horizonTrack(view,6);
      const daylight=smooth((position.progress+1/24)*24)*smooth((1+1/24-position.progress)*24);
      const weather=.72+.18*Math.sin(view.time/130+this.seed)+.10*Math.sin(view.time/57+this.seed*2);
      return {...position,radius:Math.max(14,Math.min(36,Math.min(view.width,view.height)*.04*daily.sunScale)),
        scale:daily.sunScale,alpha:daylight*(.88+.12*weather)*(.95+.05*daily.sunshine),
        warmth:smooth((.30-position.elevation)/.30),rayAngle:.85+Math.sin(view.time/170+this.seed)*.09,rayStrength:daylight*weather};
    }
    static lightAt(hour){
      const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
      const night=smooth(Math.max((hour-17.5)/2,(6.8-hour)/1.8));
      const dusk=smooth((hour-16)/1.5)*(1-smooth((hour-18.3)/1.3));
      return {dusk,night,birdsActive:hour>=6.5&&hour<18.8};
    }
    light(view){
      const l=view.lighting,hour=l?l.hour+l.minute/60+(l.second||0)/3600:12;
      return IslandAtmosphere.lightAt(hour);
    }
    night(view){return this.light(view).night;}
    drawDusk(g,view){
      const {dusk}=this.light(view);if(dusk<=0)return;
      g.save();g.globalAlpha=dusk*.88;g.globalCompositeOperation='color';
      const tint=g.createLinearGradient(0,0,0,view.height);
      tint.addColorStop(0,'#73608e');tint.addColorStop(.38,'#b98799');tint.addColorStop(.70,'#f7b475');tint.addColorStop(1,'#a497af');
      g.fillStyle=tint;g.fillRect(0,0,view.width,view.height);
      g.globalCompositeOperation='source-over';g.globalAlpha=dusk*.18;
      const horizon=g.createLinearGradient(0,view.height*.35,0,view.height);
      horizon.addColorStop(0,'#ffc58b00');horizon.addColorStop(.55,'#ffc58b99');horizon.addColorStop(1,'#b986a155');
      g.fillStyle=horizon;g.fillRect(0,0,view.width,view.height);g.restore();
    }
    getStarMap(){return this.starMap ||= new IslandStarMap();}
    stars(view){
      const strength=this.night(view);if(strength<=0)return [];
      const map=this.getStarMap(),seed=Math.floor(this.seed*1000);
      return map.visible(view,4.6).map(star=>{
        const phase=hash(star.id,53,seed)*Math.PI*2,scintillation=.10+.10*(1-star.altitude/90);
        return {...star,radius:.23+1.65*Math.exp(-(star.mag+1.5)*.34),depth:.006,flare:star.mag<2.3,
          angle:hash(star.id,61,seed)*.55-.275,warm:star.bv>.8,
          alpha:Math.min(1,strength**1.7*(.30+.65*Math.exp(-(star.mag+1.5)*.22))*(1+scintillation*Math.sin(view.time*(.6+hash(star.id,59,seed))+phase)))};
      });
    }
    drawNight(g,view){
      const strength=this.night(view);if(strength<=0)return;
      g.save();g.globalAlpha=strength;
      const tint=g.createLinearGradient(0,0,0,view.height);
      tint.addColorStop(0,'#01020bff');tint.addColorStop(.45,'#030716fc');tint.addColorStop(.76,'#0b142cf8');tint.addColorStop(1,'#243855ef');
      g.fillStyle=tint;g.fillRect(0,0,view.width,view.height);g.restore();
    }
    stellarGlare(warm=false){
      this.stellarOptics ||= {};const key=warm?'warm':'white';if(this.stellarOptics[key])return this.stellarOptics[key];
      // A supersampled optical point-spread function: a white core, soft bloom,
      // and fine diffraction rays. Its shape is light, not a cross-shaped icon.
      const canvas=makeCanvas();canvas.width=canvas.height=192;const g=canvas.getContext('2d');g.setTransform(4,0,0,4,96,96);
      const glow=g.createRadialGradient(0,0,0,0,0,22);
      glow.addColorStop(0,warm?'#fff5df':'#f6faff');glow.addColorStop(.035,'#fffef4e8');glow.addColorStop(.10,warm?'#ffe2b573':'#dbeaff73');
      glow.addColorStop(.25,warm?'#ffe4bd20':'#dceaff20');glow.addColorStop(.60,'#e4edff06');glow.addColorStop(1,'#e4edff00');g.fillStyle=glow;g.fillRect(-24,-24,48,48);
      const ray=g.createLinearGradient(-18,0,18,0);ray.addColorStop(0,'#ffffff00');ray.addColorStop(.15,'#edf3ff0b');ray.addColorStop(.35,'#f1f5ff28');ray.addColorStop(.48,'#ffffffb0');ray.addColorStop(.5,'#ffffffff');ray.addColorStop(.52,'#ffffffb0');ray.addColorStop(.65,'#f1f5ff28');ray.addColorStop(.85,'#edf3ff0b');ray.addColorStop(1,'#ffffff00');
      for(let axis=0;axis<2;axis++){g.save();g.rotate(axis*Math.PI/2);g.scale(axis?.72:1,1);g.strokeStyle=ray;g.lineWidth=.70;g.beginPath();g.moveTo(-18,0);g.lineTo(18,0);g.stroke();g.restore();}
      g.fillStyle='#ffffff';g.beginPath();g.arc(0,0,.68,0,Math.PI*2);g.fill();this.stellarOptics[key]=canvas;return canvas;
    }
    drawStars(g,view,occlude=true){
      g.save();g.globalCompositeOperation='lighter';for(const star of this.stars(view)){
        const alpha=star.alpha*(occlude?1-this.cloudAt(view,star.x,star.y,true)*.96:1);if(alpha<.01)continue;g.globalAlpha=alpha;
        if(star.flare){
          g.save();g.translate(star.x,star.y);g.rotate(star.angle);const size=star.radius*(25+star.alpha*10);g.drawImage(this.stellarGlare(star.warm),-size/2,-size/2,size,size);g.restore();
          g.fillStyle='#ffffff';g.beginPath();g.arc(star.x,star.y,star.radius*.62,0,Math.PI*2);g.fill();
        }else{g.fillStyle=star.warm?'#fff1d7':'#f5f8ff';g.beginPath();g.arc(star.x,star.y,star.radius,0,Math.PI*2);g.fill();}
      }g.restore();
    }
    galaxyTexture(view={width:1536,height:1024,camera:{x:562.5,y:1004.5},baseScale:1,lighting:{}},ratio=1){
      const margin=24,seed=Math.floor(this.seed*1000),map=this.getStarMap();
      // Five physical seconds are less than a pixel of diurnal rotation at normal size.
      // The cache follows the astronomy clock, so accelerated time also rotates the galaxy.
      const utc=Math.floor(map.utc(view.lighting)/5000)*5000;
      const width=Math.ceil((view.width+margin*2)*ratio),height=Math.ceil((view.height+margin*2)*ratio);
      const key=[seed,width,height,ratio,utc,map.revision,view.camera.x,view.camera.y,view.baseScale].join(':');
      if(this.galaxy?.key===key)return this.galaxy.canvas;
      const canvas=this.galaxy?.canvas||makeCanvas();if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      const g=canvas.getContext('2d');g.setTransform(ratio,0,0,ratio,margin*ratio,margin*ratio);g.clearRect(-margin,-margin,width/ratio,height/ratio);
      const frame=map.frame(view,utc),bins=Array.from({length:12},()=>[]);
      // Every resolved star is a catalogue entry, with magnitude and B-V colour.
      for(const star of map.stars){
        if(star.mag<=4.6)continue;const p=map.project(star.v,frame);if(!p)continue;
        const strength=Math.max(0,Math.min(1,(8.4-star.mag)/3.8)),bin=Math.min(5,Math.floor(strength*6))+(star.bv>.8?6:0);
        bins[bin].push({x:p.x,y:p.y,r:.16+strength*.29});
      }
      if(this.galacticDust?.seed!==seed){
        const center=IslandStarMap.vector(266.4051,-28.936175),pole=IslandStarMap.vector(192.85948,27.12825);
        const tangent=[pole[1]*center[2]-pole[2]*center[1],pole[2]*center[0]-pole[0]*center[2],pole[0]*center[1]-pole[1]*center[0]],points=[];
        for(let i=0;i<40000;i++){
          const longitude=hash(i,11,seed)*Math.PI*2,latitude=(hash(i,17,seed)+hash(i,23,seed)+hash(i,29,seed)-1.5)*.15;
          // Unresolved stellar dust is artistic; the galactic plane has its real orientation.
          const x=Math.cos(latitude)*Math.cos(longitude),y=Math.cos(latitude)*Math.sin(longitude),z=Math.sin(latitude);
          const lane=Math.exp(-((latitude/.022)**2));if(hash(i,31,seed)<lane*.84)continue;
          points.push({v:center.map((n,j)=>n*x+tangent[j]*y+pole[j]*z),brightness:hash(i,37,seed)});
        }this.galacticDust={seed,points};
      }
      for(const star of this.galacticDust.points){const p=map.project(star.v,frame);if(p)bins[Math.floor(star.brightness*3)].push({x:p.x,y:p.y,r:.10+star.brightness*.14});}
      for(let bin=0;bin<bins.length;bin++){
        g.globalAlpha=.10+(bin%6)*.115;g.fillStyle=bin>=6?'#fff0d8':'#f3f7ff';g.beginPath();
        for(const star of bins[bin]){g.moveTo(star.x+star.r,star.y);g.arc(star.x,star.y,star.r,0,Math.PI*2);}g.fill();
      }
      g.globalAlpha=1;this.galaxy={key,seed,canvas,points:bins.reduce((n,b)=>n+b.length,0),ratio,margin};return canvas;
    }
    moon(view){
      const daily=this.weatherProfile(view),position=this.horizonTrack(view,18);
      const phase=Astronomy.MoonPhase(new Date(this.getStarMap().utc(view.lighting)))/360,illumination=(1-Math.cos(phase*Math.PI*2))/2;
      return {...position,radius:Math.max(10,Math.min(23,Math.min(view.width,view.height)*.023*daily.moonScale)),
        alpha:this.night(view),phase,illumination};
    }
    moonTexture(phase=.5){
      const key=Math.round(phase*90);this.lunarSurfaces ||= new Map();if(this.lunarSurfaces.has(key))return this.lunarSurfaces.get(key);
      const angle=key/90*Math.PI*2,sunX=Math.sin(angle),sunZ=-Math.cos(angle);
      const canvas=makeCanvas();canvas.width=192;canvas.height=192;const g=canvas.getContext('2d'),pixels=g.createImageData(192,192),data=pixels.data,seed=193;
      for(let y=0;y<192;y++)for(let x=0;x<192;x++){
        const nx=(x-95.5)/95,ny=(y-95.5)/95,r=Math.hypot(nx,ny);if(r>=1)continue;
        const nz=Math.sqrt(1-r*r),light=Math.max(0,nx*sunX-ny*.10+nz*sunZ),maria=nebulaNoise(nx*4+6,ny*4+6,seed),grain=valueNoise(x*.28,y*.28,seed+7);
        const tone=(.72+.28*smooth((maria-.28)/.4))*(.075+.925*Math.sqrt(light)),i=(y*192+x)*4;
        data[i]=Math.round((225+grain*14)*tone);data[i+1]=Math.round((234+grain*12)*tone);data[i+2]=Math.round((245+grain*10)*tone);data[i+3]=Math.round(255*smooth((1-r)*70));
      }
      g.putImageData(pixels,0,0);if(this.lunarSurfaces.size>=4)this.lunarSurfaces.delete(this.lunarSurfaces.keys().next().value);this.lunarSurfaces.set(key,canvas);return canvas;
    }
    drawMoon(g,view){
      const m=this.moon(view);if(m.alpha<=0)return;
      g.save();g.globalAlpha=m.alpha*(.25+.75*m.illumination);const r=m.radius,glow=g.createRadialGradient(m.x,m.y,r*.6,m.x,m.y,r*8);
      glow.addColorStop(0,'#c5dfff24');glow.addColorStop(.22,'#9ac4ff12');glow.addColorStop(1,'#9ac4ff00');g.fillStyle=glow;g.fillRect(m.x-r*8,m.y-r*8,r*16,r*16);
      g.globalAlpha=m.alpha;g.drawImage(this.moonTexture(m.phase),m.x-r,m.y-r,r*2,r*2);g.restore();
    }
    meteors(view){
      const strength=this.night(view);if(strength<.6)return [];
      const nightDay=Math.floor((view.lighting?.day??0)+((view.lighting?.hour??22)-12)/24);
      const hash=n=>wrap(Math.sin(n*91.7+this.seed*1.39+nightDay*17.13)*43758.5453,1),period=30+hash(1)*15;
      const elapsed=view.time-(this.nightSince??0),first=5+hash(2)*3;if(elapsed<first)return [];
      const cycle=Math.floor((elapsed-first)/period),local=elapsed-first-cycle*period,duration=1.15+hash(cycle+9)*.3;if(local>duration)return [];
      const progress=local/duration,side=hash(cycle+11)>.5?1:-1;
      // Keep the initial trails in the open side sky around the fitted island.
      const x=view.width*(side===1?.04+hash(cycle+12)*.05:.96-hash(cycle+12)*.05),y=view.height*(.08+hash(cycle+13)*.12);
      const dx=side*Math.min(210,view.width*.18),dy=Math.min(135,view.height*.15),distance=Math.hypot(dx,dy);
      return [{x:x+dx*progress,y:y+dy*progress,ux:dx/distance,uy:dy/distance,length:Math.min(150,view.width*.21)*smooth(progress/.24),alpha:Math.sin(progress*Math.PI)**.6*strength}];
    }
    drawMeteors(g,view){
      g.save();for(const m of this.meteors(view)){
        const tx=m.x-m.ux*m.length,ty=m.y-m.uy*m.length,tail=g.createLinearGradient(tx,ty,m.x,m.y);
        tail.addColorStop(0,'#a5cfff00');tail.addColorStop(.7,'#b6d7ff70');tail.addColorStop(1,'#f4faff');
        g.globalAlpha=m.alpha;g.strokeStyle=tail;g.lineWidth=1.2;g.lineCap='round';g.beginPath();g.moveTo(tx,ty);g.lineTo(m.x,m.y);g.stroke();
        const glow=g.createRadialGradient(m.x,m.y,0,m.x,m.y,3);glow.addColorStop(0,'#f4faff');glow.addColorStop(.25,'#e4f2ffbb');glow.addColorStop(1,'#a4ceff00');g.fillStyle=glow;g.fillRect(m.x-3,m.y-3,6,6);
      }g.restore();
    }
    drawNightSky(g,view){
      const strength=this.night(view);if(strength<=0){this.nightSince=null;return;}
      if(strength>.6&&this.nightSince==null)this.nightSince=view.time;
      const transform=g.getTransform(),deviceScale=Math.hypot(transform.a,transform.b);
      const scale=Math.min(deviceScale,3,Math.sqrt(16777216/(view.width*view.height))),canvas=this.celestialCanvas ||= makeCanvas();
      const w=Math.ceil(view.width*scale),h=Math.ceil(view.height*scale);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;this.celestialKey=null;}
      const frame=this.visualCloudFrame(view.time);
      const key=[view.width,view.height,scale,this.seed,view.camera.x,view.camera.y,view.camera.zoom,Math.floor(view.time*30),view.lighting?.day,view.lighting?.hour,view.lighting?.minute,view.lighting?.second,this.weatherTime,this.windRevision,this.getStarMap().revision].join(':');
      if(this.celestialKey!==key||this.celestialCloudCanvas!==frame?.canvas||this.celestialCloudReader!==this.visualCloudFrame){
        const p=canvas.getContext('2d');p.setTransform(scale,0,0,scale,0,0);p.clearRect(0,0,view.width,view.height);
        p.save();p.globalAlpha=strength**1.7;

        const far=this.galaxyTexture(view,scale),margin=this.galaxy.margin;
        p.drawImage(far,-margin,-margin,view.width+margin*2,view.height+margin*2);p.restore();
        this.drawStars(p,view,false);this.getStarMap().drawConstellations(p,view);this.drawMoon(p,view);this.drawMeteors(p,view);
        if(frame){const layer=this.sea(view);p.save();p.globalCompositeOperation='destination-out';p.globalAlpha=.97;p.drawImage(frame.canvas,layer.x,layer.y,layer.w,layer.h);p.restore();}
        this.celestialKey=key;
        this.celestialCloudCanvas=frame?.canvas;this.celestialCloudReader=this.visualCloudFrame;
      }
      g.save();g.globalCompositeOperation='screen';g.drawImage(canvas,0,0,view.width,view.height);g.restore();
    }
    drawMoonlight(g,view){
      const strength=this.night(view);if(strength<=0)return;
      const frame=this.visualCloudFrame(view.time);if(!frame)return;
      const layer=this.sea(view),moon=this.moon(view),canvas=this.moonlitClouds ||= makeCanvas();
      if(canvas.width!==frame.canvas.width||canvas.height!==frame.canvas.height){canvas.width=frame.canvas.width;canvas.height=frame.canvas.height;}
      const p=canvas.getContext('2d');p.clearRect(0,0,canvas.width,canvas.height);p.drawImage(frame.canvas,0,0);
      p.globalCompositeOperation='source-in';const x=(Math.max(-view.width,Math.min(view.width*2,moon.x))-layer.x)/layer.w*canvas.width,y=(Math.max(-view.height,Math.min(view.height,moon.y))+view.height*.48-layer.y)/layer.h*canvas.height,r=canvas.width*.62;
      const glow=p.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,'#b6d5ff8c');glow.addColorStop(.42,'#9cbfe95e');glow.addColorStop(1,'#809fc52b');p.fillStyle=glow;p.fillRect(0,0,canvas.width,canvas.height);p.globalCompositeOperation='source-over';
      g.save();g.globalAlpha=strength*.7*(.15+.85*Math.max(0,moon.elevation))*(.3+.7*moon.illumination);g.drawImage(canvas,layer.x,layer.y,layer.w,layer.h);g.restore();
    }
    drawSun(g,view){
      const sun=this.sun(view),image=this.sunSky;if(sun.alpha<=0||!image?.naturalWidth)return;
      if(!this.sunTexture){
        // The photographic core is near the crop's top edge. Extract it into a
        // centred square so every side of its halo has room to fade naturally.
        const source=makeCanvas();source.width=768;source.height=Math.round(768*(image.naturalHeight*.58)/(image.naturalWidth*.46));
        const p=source.getContext('2d',{willReadFrequently:true});
        p.drawImage(image,image.naturalWidth*.52,0,image.naturalWidth*.46,image.naturalHeight*.58,0,0,source.width,source.height);
        const light=p.getImageData(0,0,source.width,source.height).data,coarse=makeCanvas();coarse.width=source.width;coarse.height=source.height;
        const blur=coarse.getContext('2d',{willReadFrequently:true});blur.filter='blur(35px)';blur.drawImage(source,0,0);
        const low=blur.getImageData(0,0,source.width,source.height).data;
        const cx=(.77-.52)/.46*source.width,cy=.14/.58*source.height;
        const red=(data,x,y)=>{
          x=Math.max(0,Math.min(source.width-1.001,x));y=Math.max(0,Math.min(source.height-1.001,y));
          const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,i=(iy*source.width+ix)*4,stride=source.width*4;
          return (data[i]*(1-fx)+data[i+4]*fx)*(1-fy)+(data[i+stride]*(1-fx)+data[i+stride+4]*fx)*fy;
        };
        const canvas=makeCanvas();canvas.width=canvas.height=768;
        const g=canvas.getContext('2d'),output=g.createImageData(canvas.width,canvas.height);
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
          const dx=x-canvas.width/2,dy=y-canvas.height/2,distance=Math.hypot(dx,dy)/canvas.width;
          if(distance>=.31)continue;
          const core=1-smooth((distance-.035)/.025);
          const radiance=core>0?smooth((red(light,cx+dx,cy+dy)-90)/165):0;
          // Extend only the low-frequency scattered light using the fully sampled
          // lower sky. The smooth reflection never reaches the photo's cut edge;
          // the core retains its original shape and no cloud texture is attached.
          const sampleY=cy+Math.hypot(dy,35)-35;
          const halo=smooth((red(low,cx+dx,sampleY)-50)/205)*Math.exp(-((distance/.22)**2))*(1-smooth((distance-.18)/.13));
          const i=(y*canvas.width+x)*4;output.data[i]=255;output.data[i+1]=254;output.data[i+2]=251;output.data[i+3]=Math.round(255*(radiance*core+halo*(1-core)));
        }
        g.putImageData(output,0,0);this.sunTexture=canvas;
      }
      const w=Math.min(780,Math.max(400,Math.min(view.width,view.height)))*sun.scale,h=w*this.sunTexture.height/this.sunTexture.width;
      const cover=(this.cloudAt(view,sun.x,sun.y,true)+this.cloudAt(view,sun.x-w*.06,sun.y,true)+this.cloudAt(view,sun.x+w*.06,sun.y,true))/3;
      const movingLight=this.sunFrame(view.time,true);
      g.save();g.globalAlpha=Math.min(1,sun.alpha*1.08)*(1-Math.max(0,cover-.2)*.72);
      if(sun.warmth>0)g.filter=`sepia(${sun.warmth*.8}) saturate(${1+sun.warmth*2})`;
      g.drawImage(movingLight,sun.x-w/2,sun.y-h/2,w,h);g.restore();
    }
    sunFrame(){
      // Cloud motion belongs exclusively to the independent weather field.
      return this.sunTexture;
    }
    islands(view){
      const {width,height,camera,baseScale,time}=view,count=(width<760?1:2)+Math.floor(this.seed)%2;
      return Array.from({length:count},(_,i)=>{
        const phase=this.seed+i*2.17,depth=.025+i*.025;
        const w=Math.max(30,Math.min(96,width*([.04,.062,.03][i])))*Math.pow(camera.zoom,.025);
        const span=width+w*2;
        const x=wrap(width*([.12,.84,.28][i]+Math.sin(phase)*.045)+time*(.35+i*.12)-(camera.x-562.5)*baseScale*depth+w,span)-w;
        const y=height*(.65+i*.045+Math.cos(phase)*.018)-(camera.y-1004.5)*baseScale*depth+Math.sin(time*.018+phase)*3;
        return {x,y,w,h:w*.82,alpha:1,variant:(Math.floor(this.seed)+i)%3,depth};
      });
    }
    drawIslands(g,view){
      const textures=this.islandTextures();if(!textures.length)return;
      g.save();for(const island of this.islands(view)){
        g.globalAlpha=island.alpha;
        g.drawImage(textures[island.variant],island.x-island.w/2,island.y,island.w,island.h);
      }g.restore();
    }

    drawIslandCloudCover(g,view){
      const frame=this.visualCloudFrame(view.time);if(!frame)return;
      // The same evolving density covers distant islands and crosses the sun.
      const layer=this.sea(view);g.drawImage(frame.canvas,layer.x,layer.y,layer.w,layer.h);
    }
    sea(view,near=false){
      const {width,height,camera,baseScale,time}=view,image=this.skyPlate,depth=near?.32:.065;
      const aspect=(image?.naturalWidth||2)/(image?.naturalHeight||1);
      const w=near?Math.max(width*1.7,height*2.2):Math.max(width,height*aspect)*1.14;
      const h=near?Math.max(height*.24,w/aspect*.24):w/aspect;
      const shiftX=(camera.x-562.5)*baseScale*depth,shiftY=(camera.y-1004.5)*baseScale*depth;
      const alignment=!near&&width<760?.32:.5;
      const x=(width-w)*alignment-shiftX;
      const y=(near?height*.81:(height-h)/2)-shiftY;
      return {x,y,w,h,horizon:near?y:y+h*.70,depth};
    }
    drawSea(g,view,near=false){
      if(!this.prepareClouds())return;
      const layer=this.sea(view,near);g.save();
      if(near){
        const frame=this.visualCloudFrame(view.time,true);g.globalAlpha=.25+(this.dailyWeather?.fog??.5)*.4;
        g.drawImage(frame.canvas,0,frame.canvas.height*.76,frame.canvas.width,frame.canvas.height*.24,layer.x,layer.y,layer.w,layer.h);
      }else{
        const air=g.createLinearGradient(0,layer.y,0,layer.y+layer.h);
        for(let i=0;i<=20;i++){const blue=this.blueAt(i/20);air.addColorStop(i/20,`rgb(${blue.map(Math.round).join(',')})`);}
        g.fillStyle=air;g.fillRect(0,0,view.width,view.height);
      }
      g.restore();
    }
    render(g,name,view,paint){
      const key=[view.width,view.height,view.camera.x,view.camera.y,view.camera.zoom,Math.floor(view.time*15),view.lighting?.day,view.lighting?.hour,view.lighting?.minute,Math.floor(view.lighting?.second||0),this.getStarMap().revision].join(':');
      this.buffers ||= {};
      const buffer=this.buffers[name] ||= {canvas:document.createElement('canvas'),key:null};
      if(buffer.key!==key){
        const resolution=Math.min(1,1536/Math.max(view.width,view.height));
        const w=Math.ceil(view.width*resolution),h=Math.ceil(view.height*resolution);
        if(buffer.canvas.width!==w||buffer.canvas.height!==h){buffer.canvas.width=w;buffer.canvas.height=h;}
        const target=buffer.canvas.getContext('2d');target.setTransform(resolution,0,0,resolution,0,0);
        target.clearRect(0,0,view.width,view.height);paint(target,view);buffer.key=key;
      }
      g.drawImage(buffer.canvas,0,0,view.width,view.height);
    }
    background(g,view){this.render(g,'sky',view,(target,v)=>this.backgroundScene(target,v,false));this.drawNightSky(g,view);}
    foreground(g,view){this.render(g,'fog',view,(target,v)=>this.foregroundScene(target,v));}
    backgroundScene(g,view,celestial=true){
      this.applyWeather(view);
      const {width,height}=view;
      g.fillStyle='#65b8f0';g.fillRect(0,0,width,height);
      this.drawSea(g,view);
      this.drawIslands(g,view);
      this.drawSun(g,view);
      this.drawIslandCloudCover(g,view);
      this.drawDusk(g,view);
      this.drawNight(g,view);
      if(celestial)this.drawNightSky(g,view);
      this.drawMoonlight(g,view);
    }
    foregroundScene(g,view){
      const {width,height,camera}=view;
      // A low, translucent veil crosses the rock tip, never the walking terraces.
      const floorY=height/2+(1640-camera.y)*camera.scale;
      const top=Math.max(height*.72,floorY);
      if(top>=height)return;
      this.drawSea(g,view,true);
      const {dusk,night:darkness}=this.light(view);
      if(dusk>0){g.save();g.globalCompositeOperation='source-atop';g.globalAlpha=dusk*.45;g.fillStyle='#e5a487';g.fillRect(0,0,width,height);g.restore();}
      if(darkness>0){g.save();g.globalCompositeOperation='source-atop';g.globalAlpha=darkness*.84;g.fillStyle='#203a61';g.fillRect(0,0,width,height);g.restore();}
      const mask=g.createLinearGradient(0,top,0,Math.max(top+1,height));
      mask.addColorStop(0,'#ffffff00');mask.addColorStop(.65,'#ffffff99');mask.addColorStop(1,'#ffffffff');
      g.globalCompositeOperation='destination-in';g.fillStyle=mask;g.fillRect(0,0,width,height);
      g.globalCompositeOperation='source-over';
      const fade=g.createLinearGradient(0,top,0,Math.max(top+1,height));
      fade.addColorStop(0,'#eef6f900');fade.addColorStop(1,darkness>.5?'#405e8b24':'#eef6f92c');
      g.fillStyle=fade;g.fillRect(0,top,width,height-top);
    }
  }
  globalThis.IslandAtmosphere=IslandAtmosphere;
  if(typeof document==='undefined'){
    let atmosphere;
    globalThis.onmessage=event=>{
      try{
        const data=event.data;
        atmosphere ||= new IslandAtmosphere(null,null,()=>0);
        atmosphere.seed=data.seed;
        atmosphere.windOffset=data.windOffset;atmosphere.windRevision=data.windRevision;
        atmosphere.dailyWeather=data.weather;atmosphere.weatherKey=data.weatherKey;
        if(data.source){atmosphere.cloudSource=data.source;atmosphere.cloudSoft=data.soft;atmosphere.cloudFrames={};}
        if(data.sun){
          atmosphere.sunPixels=data.sun;atmosphere.sunTexture={width:data.sunWidth,height:data.sunHeight};
          atmosphere.movingSun=makeCanvas();atmosphere.movingSun.width=data.sunWidth;atmosphere.movingSun.height=data.sunHeight;
          atmosphere.movingSunPixels=atmosphere.movingSun.getContext('2d').createImageData(data.sunWidth,data.sunHeight);
        }
        const far=atmosphere.cloudFrame(data.time).pixels,near=atmosphere.cloudFrame(data.time,true).pixels;
        if(atmosphere.sunPixels)atmosphere.sunFrame(data.time);
        globalThis.postMessage({time:data.time,windOffset:data.windOffset,weatherKey:data.weatherKey,windRevision:data.windRevision,far,near,sun:atmosphere.movingSunPixels});
      }catch(error){globalThis.postMessage({error:String(error)});}
    };
  }
})();
