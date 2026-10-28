(() => {
  'use strict';
  class IslandPPTViewer {
    static titleFromSource(source,fallback=''){
      if(typeof source!=='string')return fallback;
      const match=/^[^_]+_\d+_(.+)\.pptx$/i.exec(source);
      return match?.[1].trim()||fallback;
    }
    constructor(container) {
      this.container=container;this.request=0;this.frame=0;this.cache=new Map();this.cacheKey=null;
      this.ahead=matchMedia('(max-width:760px)').matches?2:3;
      container.innerHTML='<div class="ppt-stage"><img class="ppt-slide" alt="" hidden><p class="ppt-status" role="status"></p></div><nav class="ppt-controls" aria-label="簡報翻頁"><button class="ppt-prev" aria-label="上一頁">←</button><span class="ppt-count" aria-live="polite"></span><button class="ppt-next" aria-label="下一頁">→</button></nav>';
      this.image=container.querySelector('img');
      container.querySelector('.ppt-prev').onclick=()=>this.go(-1);
      container.querySelector('.ppt-next').onclick=()=>this.go(1);
      container.closest('dialog').addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();if(e.key==='Home')this.show(0);else if(e.key==='End')this.show((this.deck?.slides.length||1)-1);else this.go(e.key==='ArrowLeft'?-1:1);}});
      let start=null;
      container.querySelector('.ppt-stage').addEventListener('touchstart',e=>{if(e.touches.length===1)start={x:e.touches[0].clientX,y:e.touches[0].clientY};else start=null;},{passive:true});
      container.querySelector('.ppt-stage').addEventListener('touchend',e=>{if(!start)return;const p=e.changedTouches[0],dx=p.clientX-start.x,dy=p.clientY-start.y;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5)this.go(dx<0?1:-1);start=null;},{passive:true});
    }
    status(text){this.container.querySelector('.ppt-status').textContent=text;}
    async open(key){
      const request=++this.request;this.frame++;this.deck=null;this.index=0;this.image.hidden=true;this.controls();this.status('正在開啟簡報…');
      try{
        const response=await fetch('PPT/manifest.json',{cache:'no-cache'});if(!response.ok)throw Error('manifest');
        const manifest=await response.json();if(request!==this.request)return;
        const deck=manifest[key];if(!deck||!Array.isArray(deck.slides)||!deck.slides.length||!deck.slides.every(s=>/^rendered\/[a-z]+\/[a-f0-9]+\/slide-\d+\.jpg$/.test(s)))throw Error('deck');
        const cacheKey=key+':'+deck.sha256;if(cacheKey!==this.cacheKey){this.cache.clear();this.cacheKey=cacheKey;}
        this.deck=deck;this.show(0);return deck;
      }catch{if(request===this.request)this.status('簡報尚未準備完成，請稍後重新開啟。');}
    }
    controls(){const count=this.deck?.slides.length||0;this.container.querySelector('.ppt-prev').disabled=!count||this.index===0;this.container.querySelector('.ppt-next').disabled=!count||this.index===count-1;this.container.querySelector('.ppt-count').textContent=count?(this.index+1)+' / '+count:'';}
    go(delta){if(this.deck)this.show(Math.max(0,Math.min(this.deck.slides.length-1,this.index+delta)));}
    load(index,priority='low'){
      const src='PPT/'+this.deck.slides[index];let entry=this.cache.get(src);if(entry)return entry;
      const image=new Image();image.className='ppt-slide';image.decoding='async';image.fetchPriority=priority;
      entry={image,ready:false,promise:null};this.cache.set(src,entry);
      entry.promise=new Promise((resolve,reject)=>{image.onload=async()=>{try{await image.decode();entry.ready=true;resolve(entry);}catch(error){reject(error);}};image.onerror=()=>reject(Error('slide'));image.src=src;});
      entry.promise.catch(()=>{if(this.cache.get(src)===entry)this.cache.delete(src);});
      return entry;
    }
    preload(){
      const keep=new Set();
      for(let i=Math.max(0,this.index-1);i<=Math.min(this.deck.slides.length-1,this.index+this.ahead);i++){const entry=this.load(i,i===this.index?'high':'low');keep.add('PPT/'+this.deck.slides[i]);entry.promise.catch(()=>{});}
      for(const src of this.cache.keys())if(!keep.has(src))this.cache.delete(src);
    }
    async show(index){
      if(!this.deck)return;this.index=index;this.controls();
      const frame=++this.frame,request=this.request,deck=this.deck,entry=this.load(index,'high');
      this.status(entry.ready?'':'正在載入投影片…');this.preload();
      try{
        await entry.promise;if(frame!==this.frame||request!==this.request)return;
        // Attach the decoded preloaded image without blanking the current page.
        entry.image.alt=deck.source+'，第 '+(index+1)+' 頁';entry.image.hidden=false;
        if(this.image!==entry.image){this.image.replaceWith(entry.image);this.image=entry.image;}
        this.status('');
      }catch{if(frame===this.frame&&request===this.request)this.status('投影片載入失敗，請再按一次翻頁重試。');}
    }
  }
  window.IslandPPTViewer=IslandPPTViewer;
})();
