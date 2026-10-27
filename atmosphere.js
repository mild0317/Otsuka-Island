(() => {
  'use strict';
  const wrap=(value,span)=>((value%span)+span)%span;
  const clamp=value=>Math.max(0,Math.min(1,value));
  const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
  const makeCanvas=()=>typeof document==='undefined'?new OffscreenCanvas(1,1):document.createElement('canvas');
  const workerURL=typeof document==='undefined'?null:document.currentScript?.src;
  class IslandAtmosphere {
    constructor(image,distantImage,random=Math.random,skyPlate,sunSky){
      this.seed=random()*1000;this.distantImage=distantImage;this.skyPlate=skyPlate;this.sunSky=sunSky;
      this.wind={mode:'random',speed:1,direction:wrap(Math.sin(this.seed*1.71)*43758.5453,1)*360};
      this.windOffset={x:0,y:0};this.windTime=0;this.windRevision=0;
    }
    setWind(settings){
      if(settings.mode==='random'||settings.mode==='manual')this.wind.mode=settings.mode;
      if(Number.isFinite(settings.speed))this.wind.speed=Math.max(0,Math.min(8,settings.speed));
      if(Number.isFinite(settings.direction))this.wind.direction=wrap(settings.direction,360);
      this.windRevision++;
    }
    updateWind(time){
      const elapsed=Math.max(0,time-this.windTime);if(!elapsed)return;
      // Integrate velocity: changing a control never relocates existing clouds.
      const steps=Math.ceil(elapsed/.25),dt=elapsed/steps;
      for(let step=0;step<steps;step++){
        const t=this.windTime+(step+.5)*dt;
        if(this.wind.mode==='random'){
          const epoch=Math.floor(t/70),fraction=smooth(t/70-epoch);
          const hash=n=>wrap(Math.sin(n*127.1+this.seed*1.71)*43758.5453,1)*360;
          const start=hash(epoch),turn=wrap(hash(epoch+1)-start+180,360)-180,target=start+turn*fraction;
          const difference=wrap(target-this.wind.direction+180,360)-180;
          const turnStep=difference*(1-Math.exp(-dt/5));
          this.wind.direction=wrap(this.wind.direction+Math.max(-8*dt,Math.min(8*dt,turnStep)),360);
        }
        const angle=this.wind.direction*Math.PI/180;
        const speed=this.wind.speed*(this.wind.mode==='random'?.88+.12*Math.sin(t/19+this.seed):1)*.00032;
        this.windOffset.x+=Math.sin(angle)*speed*dt;this.windOffset.y-=Math.cos(angle)*speed*dt;
      }
      this.windTime=time;
    }
    windSnapshot(){return {...this.wind,offset:{...this.windOffset}};}
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
      g.putImageData(pixels,0,0);this.cloudCover=canvas;this.cloudSource=pixels.data;
      // Extend the edges before diffusion. Blurring against transparent canvas
      // would create a dark seam every time the wind reaches a mirrored boundary.
      const padded=document.createElement('canvas');padded.width=1056;padded.height=544;
      const edge=padded.getContext('2d');edge.drawImage(canvas,16,16);
      edge.drawImage(canvas,0,0,1,512,0,16,16,512);edge.drawImage(canvas,1023,0,1,512,1040,16,16,512);
      edge.drawImage(padded,0,16,1056,1,0,0,1056,16);edge.drawImage(padded,0,527,1056,1,0,528,1056,16);
      const soft=document.createElement('canvas');soft.width=1024;soft.height=512;
      const p=soft.getContext('2d',{willReadFrequently:true});p.filter='blur(4px)';p.drawImage(padded,-16,-16);
      this.cloudSoft=p.getImageData(0,0,1024,512).data;
      this.cloudFrames={};return true;
    }
    blueAt(v){
      const rows=this.skyRows;if(!rows?.length)return [61,163,239];
      const pos=Math.min(rows.length-1,Math.max(0,v*32)),lo=Math.floor(pos),hi=Math.min(rows.length-1,lo+1),f=pos-lo;
      return rows[lo].rgb.map((c,i)=>c+(rows[hi].rgb[i]-c)*f);
    }
    cloudFlow(u,v,time,near=false){
      // Slow wind shear and two travelling eddies deform different parts of a bank.
      // All terms are continuous in time, including after a long paused interval.
      const phase=this.seed,sea=smooth((v-.55)/.20),speed=near?1.7:1;
      const t=time*speed;
      const eddy=Math.sin(u*10+v*7-t*.026+phase),curl=Math.cos(u*6-v*12+t*.019+phase*.7);
      const moisture=Math.sin(u*13+v*9-t*.037+phase)+.48*Math.sin(u*27-v*17+t*.052+phase*.31);
      return {
        // Bulk drift is uniform. Differential wind is bounded: multiplying a
        // height-dependent speed by elapsed time eventually stretches the horizon.
        u:u-this.windOffset.x*speed+.006*eddy+.003*curl+(1-sea)*.012*Math.sin(t/100+phase),
        v:v+(1-sea)*(.0035*Math.cos(u*9+v*5-t*.021+phase))+.0015*Math.sin(u*17+t*.025+phase),
        threshold:(.047*moisture+.035*Math.sin(u*5+v*11+t*.014+phase))*(1-sea*.7),
        diffusion:.5+.5*Math.sin(u*8-v*5-t*.029+phase*.4),
        sea
      };
    }
    cloudFrame(time,near=false){
      if(!this.prepareClouds())return null;
      const name=near?'near':'far',tick=Math.floor(time*12),key=[tick,this.windOffset.x,this.windOffset.y,this.windRevision].join(':');
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
          // Mirror sampling has no wrap seam and keeps the cloud-sea horizon intact.
          const skyWeight=1-smooth((y/(height-1)-.50)/.13);
          const mirror=wrap(u,2),sx=(mirror>1?2-mirror:mirror)*1022;
          const vertical=wrap(v-this.windOffset.y*(near?1.7:1),1.10),skyV=vertical>.55?1.10-vertical:vertical;
          const sy=(skyWeight===1?skyV:clamp(v))*510;
          const px=Math.floor(sx),py=Math.floor(sy),dx=sx-px,dy=sy-py;
          const i=(py*1024+px)*4,j=(y*width+x)*4;
          const sa=(1-dx)*(1-dy),sb=dx*(1-dy),sc=(1-dx)*dy,sd=dx*dy;
          let alpha=(source[i+3]*sa+source[i+7]*sb+source[i+4099]*sc+source[i+4103]*sd)/255;
          let spread=(soft[i+3]*sa+soft[i+7]*sb+soft[i+4099]*sc+soft[i+4103]*sd)/255;
          if(skyWeight>0&&skyWeight<1){
            // Blend independent upper-air advection into a level cloud-sea bank.
            // Vertical wind moves wisps without tilting or stretching the horizon.
            const yy=skyV*510,yi=Math.floor(yy),yf=yy-yi,si=(yi*1024+px)*4;
            const aa=(1-dx)*(1-yf),ab=dx*(1-yf),ac=(1-dx)*yf,ad=dx*yf;
            const upper=(source[si+3]*aa+source[si+7]*ab+source[si+4099]*ac+source[si+4103]*ad)/255;
            const upperSoft=(soft[si+3]*aa+soft[si+7]*ab+soft[si+4099]*ac+soft[si+4103]*ad)/255;
            alpha+=skyWeight*(upper-alpha);spread+=skyWeight*(upperSoft-spread);
          }
          // Diffusion broadens the edges. Local humidity condenses adjoining wisps
          // or evaporates them, changing their silhouette rather than scaling a sprite.
          const density=alpha+(spread-alpha)*diffusion*.65;
          const evolved=clamp(density+humidity*smooth(density*10)*(1-density));
          const final=Math.pow(evolved,1.08-humidity*3.4);
          for(let ch=0;ch<3;ch++)out[j+ch]=source[i+ch]*sa+source[i+4+ch]*sb+source[i+4096+ch]*sc+source[i+4100+ch]*sd;
          out[j+3]=Math.round(255*(final*(1-sea*.12)+alpha*sea*.12));
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
            if(this.buffers){this.buffers.sky.key=null;this.buffers.fog.key=null;}
          };
          this.weatherWorker.onerror=event=>{this.weatherError=event.message;this.weatherWorker.terminate();this.workerFailed=true;this.weatherBusy=false;};
        }catch{this.workerFailed=true;return;}
      }
      const tick=Math.floor(time*12),key=tick+':'+this.windRevision;if(this.weatherBusy||this.weatherRequested===key)return;
      const message={time:tick/12,seed:this.seed,windOffset:this.windOffset,windRevision:this.windRevision};
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
    sun(view){
      const {width,height,camera,baseScale,time,lighting}=view;
      const hour=lighting?lighting.hour+lighting.minute/60+(lighting.second||0)/3600:12;
      const day=Math.max(0,Math.min(1,(hour-5.5)/13));
      const elevation=Math.sin(day*Math.PI);
      const daylight=Math.max(0,Math.min(1,(hour-5.5)*2,(18.5-hour)*2));
      const weather=.72+.18*Math.sin(time/130+this.seed)+.10*Math.sin(time/57+this.seed*2);
      const x=width*(.77+(day-.5)*.06+Math.sin(this.seed)*.012)-(camera.x-562.5)*baseScale*.018;
      const y=height*(.29-elevation*.19+Math.cos(this.seed)*.025+this.light(view).dusk*.29)-(camera.y-1004.5)*baseScale*.018;
      return {x,y,radius:Math.max(14,Math.min(36,Math.min(width,height)*.04)),alpha:daylight*(.88+.12*weather),
        warmth:1-elevation,rayAngle:.85+Math.sin(time/170+this.seed)*.09,rayStrength:daylight*weather};
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
    stars(view){
      const strength=this.night(view);if(strength<=0)return [];
      const hash=n=>{const value=Math.sin(n*127.1+this.seed*3.17)*43758.5453;return value-Math.floor(value);};
      const {width,height,camera,baseScale,time}=view,count=width<760?45:95;
      return Array.from({length:count},(_,i)=>{
        const phase=hash(i+300)*Math.PI*2;
        return {x:width*(.025+hash(i+1)*.95)-(camera.x-562.5)*baseScale*.012,
          y:height*(.025+hash(i+101)*.59)-(camera.y-1004.5)*baseScale*.012,
          radius:.45+hash(i+201)*.95,alpha:Math.pow(strength,1.7)*(.52+.28*Math.sin(time*(.32+hash(i+401)*.2)+phase)),warm:hash(i+501)>.84};
      });
    }
    drawNight(g,view){
      const strength=this.night(view);if(strength<=0)return;
      g.save();g.globalAlpha=strength;
      const tint=g.createLinearGradient(0,0,0,view.height);
      tint.addColorStop(0,'#030c25f5');tint.addColorStop(.6,'#112343ed');tint.addColorStop(1,'#243b60dc');
      g.fillStyle=tint;g.fillRect(0,0,view.width,view.height);g.restore();
    }
    drawStars(g,view){
      g.save();for(const star of this.stars(view)){
        g.globalAlpha=star.alpha*(1-this.cloudAt(view,star.x,star.y,true)*.96);g.fillStyle=star.warm?'#fff0d5':'#e1edff';
        g.beginPath();g.arc(star.x,star.y,star.radius,0,Math.PI*2);g.fill();
        if(star.radius>1.15){const glow=g.createRadialGradient(star.x,star.y,0,star.x,star.y,star.radius*3);glow.addColorStop(0,'#d8eaff65');glow.addColorStop(1,'#d8eaff00');g.fillStyle=glow;g.fillRect(star.x-star.radius*3,star.y-star.radius*3,star.radius*6,star.radius*6);}
      }g.restore();
    }
    drawSun(g,view){
      const sun=this.sun(view),image=this.sunSky;if(sun.alpha<=0||!image?.naturalWidth)return;
      if(!this.sunTexture){
        // Blend actual illuminated sky and cloud edges, without a synthetic orb.
        const canvas=document.createElement('canvas');canvas.width=768;canvas.height=Math.round(768*(image.naturalHeight*.58)/(image.naturalWidth*.46));
        const p=canvas.getContext('2d');
        p.drawImage(image,image.naturalWidth*.52,0,image.naturalWidth*.46,image.naturalHeight*.58,0,0,canvas.width,canvas.height);
        p.globalCompositeOperation='destination-in';
        const horizontal=p.createLinearGradient(0,0,canvas.width,0);
        horizontal.addColorStop(0,'#ffffff00');horizontal.addColorStop(.15,'#ffffffff');horizontal.addColorStop(.85,'#ffffffff');horizontal.addColorStop(1,'#ffffff00');
        p.fillStyle=horizontal;p.fillRect(0,0,canvas.width,canvas.height);
        const vertical=p.createLinearGradient(0,0,0,canvas.height);
        vertical.addColorStop(0,'#ffffff00');vertical.addColorStop(.13,'#ffffffff');vertical.addColorStop(.75,'#ffffffff');vertical.addColorStop(1,'#ffffff00');
        p.fillStyle=vertical;p.fillRect(0,0,canvas.width,canvas.height);this.sunTexture=canvas;
      }
      const w=Math.min(780,Math.max(400,Math.min(view.width,view.height))),h=w*this.sunTexture.height/this.sunTexture.width;
      const cover=(this.cloudAt(view,sun.x,sun.y,true)+this.cloudAt(view,sun.x-w*.06,sun.y,true)+this.cloudAt(view,sun.x+w*.06,sun.y,true))/3;
      const movingLight=this.sunFrame(view.time,true);
      g.save();g.globalAlpha=Math.min(1,sun.alpha*1.08)*(1-Math.max(0,cover-.2)*.72);
      g.drawImage(movingLight,sun.x-w*((.77-.52)/.46),sun.y-h*(.14/.58),w,h);g.restore();
    }
    sunFrame(time,visual=false){
      const tick=Math.floor(time*12),key=[tick,this.windOffset.x,this.windOffset.y].join(':');if(this.sunFrameTick===key)return this.movingSun;
      const width=512,height=Math.round(width*this.sunTexture.height/this.sunTexture.width);
      if(!this.sunPixels){
        const source=makeCanvas();source.width=width;source.height=height;
        source.getContext('2d').drawImage(this.sunTexture,0,0,width,height);
        this.sunPixels=source.getContext('2d').getImageData(0,0,width,height).data;
        this.movingSun=makeCanvas();this.movingSun.width=width;this.movingSun.height=height;
        this.movingSunPixels=this.movingSun.getContext('2d').createImageData(width,height);
      }
      if(visual&&this.weatherWorker&&!this.workerFailed&&this.sunFrameTick!==undefined)return this.movingSun;
      const source=this.sunPixels,out=this.movingSunPixels.data,t=tick/12,phase=this.seed;
      const windX=-.035*Math.sin(this.windOffset.x*8)+.008*Math.sin(t*.012+phase),windY=-.018*Math.sin(this.windOffset.y*8)+.004*Math.sin(t*.019+phase*.4);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const u=x/width,v=y/height;
        // Keep the light source in place while the surrounding lit vapour flows.
        const distance=Math.hypot((u-(.77-.52)/.46),v-(.14/.58));
        const flow=smooth((distance-.045)/.22);
        const sx=Math.max(0,Math.min(width-1.001,x+windX*width*flow)),sy=Math.max(0,Math.min(height-1.001,y+windY*height*flow));
        const ix=Math.floor(sx),iy=Math.floor(sy),dx=sx-ix,dy=sy-iy,i=(iy*width+ix)*4,j=(y*width+x)*4;
        const a=(1-dx)*(1-dy),b=dx*(1-dy),c=(1-dx)*dy,d=dx*dy;
        for(let ch=0;ch<4;ch++)out[j+ch]=source[i+ch]*a+source[i+4+ch]*b+source[i+width*4+ch]*c+source[i+width*4+4+ch]*d;
        // Local condensation also varies the scattered light away from the core.
        out[j+3]*=1-flow*(.11+.11*Math.sin(u*14+v*8-t*.027+phase));
      }
      this.movingSun.getContext('2d').putImageData(this.movingSunPixels,0,0);this.sunFrameTick=key;return this.movingSun;
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
      const x=(width-w)*alignment-shiftX+Math.sin(time/(near?95:170)+this.seed)*w*(near?.025:.012);
      const y=(near?height*.81:(height-h)/2)-shiftY;
      return {x,y,w,h,horizon:near?y:y+h*.70,depth};
    }
    drawSea(g,view,near=false){
      if(!this.prepareClouds())return;
      const layer=this.sea(view,near);g.save();
      if(near){
        const frame=this.visualCloudFrame(view.time,true);g.globalAlpha=.5;
        g.translate(view.width,0);g.scale(-1,1);layer.x=view.width-layer.x-layer.w;
        g.drawImage(frame.canvas,0,frame.canvas.height*.76,frame.canvas.width,frame.canvas.height*.24,layer.x,layer.y,layer.w,layer.h);
      }else{
        const air=g.createLinearGradient(0,layer.y,0,layer.y+layer.h);
        for(let i=0;i<=20;i++){const blue=this.blueAt(i/20);air.addColorStop(i/20,`rgb(${blue.map(Math.round).join(',')})`);}
        g.fillStyle=air;g.fillRect(0,0,view.width,view.height);
      }
      g.restore();
    }
    render(g,name,view,paint){
      const key=[view.width,view.height,view.camera.x,view.camera.y,view.camera.zoom,Math.floor(view.time*15),view.lighting?.hour,view.lighting?.minute,Math.floor(view.lighting?.second||0)].join(':');
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
    background(g,view){this.render(g,'sky',view,(target,v)=>this.backgroundScene(target,v));}
    foreground(g,view){this.render(g,'fog',view,(target,v)=>this.foregroundScene(target,v));}
    backgroundScene(g,view){
      const {width,height}=view;
      g.fillStyle='#65b8f0';g.fillRect(0,0,width,height);
      this.drawSea(g,view);
      this.drawIslands(g,view);
      this.drawSun(g,view);
      this.drawIslandCloudCover(g,view);
      this.drawDusk(g,view);
      this.drawNight(g,view);
      this.drawStars(g,view);
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
        if(data.source){atmosphere.cloudSource=data.source;atmosphere.cloudSoft=data.soft;atmosphere.cloudFrames={};}
        if(data.sun){
          atmosphere.sunPixels=data.sun;atmosphere.sunTexture={width:data.sunWidth,height:data.sunHeight};
          atmosphere.movingSun=makeCanvas();atmosphere.movingSun.width=data.sunWidth;atmosphere.movingSun.height=data.sunHeight;
          atmosphere.movingSunPixels=atmosphere.movingSun.getContext('2d').createImageData(data.sunWidth,data.sunHeight);
        }
        const far=atmosphere.cloudFrame(data.time).pixels,near=atmosphere.cloudFrame(data.time,true).pixels;
        if(atmosphere.sunPixels)atmosphere.sunFrame(data.time);
        globalThis.postMessage({time:data.time,windOffset:data.windOffset,far,near,sun:atmosphere.movingSunPixels});
      }catch(error){globalThis.postMessage({error:String(error)});}
    };
  }
})();
