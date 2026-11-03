(() => {
  'use strict';
  const D=Math.PI/180,wrap=(n,m)=>((n%m)+m)%m;
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const mix=(a,b,x,y)=>a.map((v,i)=>v*x+b[i]*y);
  const vector=(ra,dec)=>{ra*=D;dec*=D;return [Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec)];};
  // J2000 -> equator/equinox of date, IAU 1976 precession. UTC approximates UT1.
  const precess=(v,jd)=>{
    const t=(jd-2451545)/36525,s=D/3600;
    const a=(2306.2181*t+.30188*t*t+.017998*t*t*t)*s;
    const b=(2306.2181*t+1.09468*t*t+.018203*t*t*t)*s;
    const c=(2004.3109*t-.42665*t*t-.041833*t*t*t)*s;
    const x=v[0]*Math.cos(a)-v[1]*Math.sin(a),y=v[0]*Math.sin(a)+v[1]*Math.cos(a);
    const xx=x*Math.cos(c)-v[2]*Math.sin(c),z=x*Math.sin(c)+v[2]*Math.cos(c);
    return [xx*Math.cos(b)-y*Math.sin(b),xx*Math.sin(b)+y*Math.cos(b),z];
  };
  class IslandStarMap {
    constructor(catalog=globalThis.ISLAND_STAR_CATALOG){
      this.latitude=25+45.4/3600;this.longitude=121+27/60+48.7/3600;
      this.azimuth=150;this.elevation=45;this.showLines=false;
      this.catalog=catalog;
      this.stars=(catalog?.stars||[]).map(([id,ra,dec,mag,bv,name])=>({id,ra,dec,mag,bv,name,v:vector(ra,dec)}));
      this.constellations=(catalog?.constellations||[]).map(c=>({...c,v:vector(...c.at),paths:c.lines.map(path=>path.map(p=>vector(...p)))}));
      this.revision=0;
    }
    configure(settings){
      if(typeof settings.showLines==='boolean')this.showLines=settings.showLines;
      this.revision++;
    }
    utc(lighting={}){
      const day=lighting.day??Math.floor((Date.now()+8*3600000)/86400000);
      return day*86400000+((lighting.hour??22)-8)*3600000+(lighting.minute||0)*60000+(lighting.second||0)*1000;
    }
    static sidereal(jd,longitude=0){
      const midnight=Math.floor(jd-.5)+.5,d=midnight-2451545,h=(jd-midnight)*24,t=(jd-2451545)/36525;
      return wrap((6.697375+.065709824279*d+1.0027379*h+.0000258*t*t)*15+longitude,360);
    }
    frame(view,utc=this.utc(view.lighting)){
      const jd=utc/86400000+2440587.5,lst=IslandStarMap.sidereal(jd,this.longitude)*D,lat=this.latitude*D;
      const columns=[[1,0,0],[0,1,0],[0,0,1]].map(v=>precess(v,jd));
      const e=[-Math.sin(lst),Math.cos(lst),0],n=[-Math.sin(lat)*Math.cos(lst),-Math.sin(lat)*Math.sin(lst),Math.cos(lat)],u=[Math.cos(lat)*Math.cos(lst),Math.cos(lat)*Math.sin(lst),Math.sin(lat)];
      const east=columns.map(c=>dot(e,c)),north=columns.map(c=>dot(n,c)),up=columns.map(c=>dot(u,c));
      // Unwrap local sky angles into a rectangular window. Reducing the angular
      // scale reveals more sky without exposing the rim of an orthographic globe.
      const az=this.azimuth*D,el=this.elevation*D,heading=mix(east,north,Math.sin(az),Math.cos(az));
      const forward=mix(heading,up,Math.cos(el),Math.sin(el)),cy=view.height*.5;
      // Keep the +/-90-degree limits beyond the longest viewport edges.
      const focal=Math.max(view.width,view.height)*.33;
      return {utc,jd,lst:lst/D,east,north,up,forward,
        right:mix(east,north,Math.cos(az),-Math.sin(az)),top:mix(heading,up,-Math.sin(el),Math.cos(el)),
        centerRA:Math.atan2(forward[1],forward[0]),centerDec:Math.asin(forward[2]),
        focal,azimuth:this.azimuth,elevation:this.elevation,horizon:view.skyHorizon??view.height*.72,cx:view.width*.5-(view.camera.x-562.5)*view.baseScale*.006,
        cy,width:view.width,height:view.height};
    }
    project(v,frame,clip=true){
      const altitude=dot(v,frame.up);
      if(altitude<=0||dot(v,frame.forward)<=0)return null;
      const right=dot(v,frame.right),top=dot(v,frame.top),forward=dot(v,frame.forward);
      const x=frame.cx+Math.atan2(right,forward)*frame.focal;
      const y=frame.cy-Math.atan2(top,Math.hypot(right,forward))*frame.focal;
      if(clip&&(x<-40||x>frame.width+40||y<-40||y>frame.height+40))return null;
      return {x,y,altitude:Math.asin(Math.max(-1,Math.min(1,altitude)))/D};
    }
    projectHorizontal(altitude,azimuth,frame){
      const a=altitude*D,b=azimuth*D,east=Math.cos(a)*Math.sin(b),north=Math.cos(a)*Math.cos(b),up=Math.sin(a);
      const v=frame.east.map((n,i)=>n*east+frame.north[i]*north+frame.up[i]*up);
      return this.project(v,frame,false);
    }
    body(name,view){
      const utc=this.utc(view.lighting),frame=this.frame(view);
      if(this.bodyCache?.utc!==utc){
        const date=new Date(utc),observer=new Astronomy.Observer(this.latitude,this.longitude,0);
        this.bodyCache={utc,date,observer,bodies:{},phase:Astronomy.MoonPhase(date)/360};
      }
      const cache=this.bodyCache;
      if(!cache.bodies[name]){
        const eq=Astronomy.Equator(name,cache.date,cache.observer,true,true);
        cache.bodies[name]=Astronomy.Horizon(cache.date,cache.observer,eq.ra,eq.dec);
      }
      const coordinates=cache.bodies[name],point=this.projectHorizontal(coordinates.altitude,coordinates.azimuth,frame);
      // Objects outside the viewing direction remain outside it: never wrap or clamp into view.
      const x=point?.x??-view.width*4,y=point?.y??frame.horizon;
      const inView=!!point&&x>-500&&x<view.width+500&&y>-500&&y<view.height+500;
      return {x,y,inView,horizon:frame.horizon,altitude:coordinates.altitude,azimuth:coordinates.azimuth,
        elevation:Math.sin(coordinates.altitude*D),phase:cache.phase};
    }
    horizontal(ra,dec,utc){
      const dummy={width:1000,height:1000,camera:{x:562.5,y:1004.5},baseScale:1};
      const f=this.frame(dummy,utc),v=vector(ra,dec);
      return {altitude:Math.asin(dot(v,f.up))/D,azimuth:wrap(Math.atan2(dot(v,f.east),dot(v,f.north))/D,360)};
    }
    visible(view,limit=8,frame=this.frame(view)){
      const result=[];for(const star of this.stars){if(star.mag>limit)continue;const p=this.project(star.v,frame);if(p)result.push({...star,...p});}return result;
    }
    drawConstellations(g,view,opacity=1){
      if(!this.showLines)return;
      const f=this.frame(view),labels=[];g.save();g.globalAlpha*=opacity;g.lineWidth=.55;g.strokeStyle='#bfdcff40';g.beginPath();
      for(const c of this.constellations){
        for(const path of c.paths){
          // Subdivide the spherical arcs; never join across the horizon or back hemisphere.
          for(let i=1;i<path.length;i++){
            let previous=null;const a=path[i-1],b=path[i];
            for(let step=0;step<=12;step++){
              const t=step/12,v=mix(a,b,1-t,t),length=Math.hypot(...v),p=this.project(v.map(n=>n/length),f);
              if(p&&previous){g.moveTo(previous.x,previous.y);g.lineTo(p.x,p.y);}previous=p;
            }
          }
        }
        const p=this.project(c.v,f);if(p&&p.y>28&&p.y<view.height*.8)labels.push({...p,name:c.name});
      }
      g.stroke();g.font='11px system-ui';g.textAlign='center';g.fillStyle='#dce9ff99';g.shadowColor='#000';g.shadowBlur=5;
      const occupied=[];for(const p of labels){const w=g.measureText(p.name).width;if(p.x<w/2+8||p.x>view.width-w/2-8||p.y<60||occupied.some(q=>Math.abs(q.x-p.x)<(q.w+w)/2+12&&Math.abs(q.y-p.y)<22))continue;g.fillText(p.name,p.x,p.y);occupied.push({...p,w});}
      const names={11767:'北極星',32349:'天狼星',91262:'織女星',97649:'牛郎星',102098:'天津四',27989:'參宿四',24436:'參宿七',24608:'五車二',21421:'畢宿五',37279:'南河三',37826:'北河三',36850:'北河二',69673:'大角星',65474:'角宿一',80763:'心宿二',113368:'北落師門'};
      g.font='9px system-ui';g.textAlign='left';g.fillStyle='#fff0c4';
      for(const s of this.visible(view,1.5,f)){const name=names[s.id]||s.name;if(name)g.fillText(name,s.x+8,s.y-7);}
      // Polaris is useful even though it is fainter than the bright-star label limit.
      const polaris=this.stars.find(s=>s.id===11767),p=polaris&&this.project(polaris.v,f);if(p)g.fillText('北極星',p.x+8,p.y-7);
      g.restore();
    }
  }
  IslandStarMap.vector=vector;
  globalThis.IslandStarMap=IslandStarMap;
})();
