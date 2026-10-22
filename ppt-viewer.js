(() => {
  'use strict';
  class IslandPPTViewer {
    constructor(container) {
      this.container=container;this.request=0;
      container.innerHTML='<div class="ppt-stage"><img class="ppt-slide" alt="" hidden><p class="ppt-status" role="status"></p></div><nav class="ppt-controls" aria-label="簡報翻頁"><button class="ppt-prev" aria-label="上一頁">←</button><span class="ppt-count" aria-live="polite"></span><button class="ppt-next" aria-label="下一頁">→</button><a class="ppt-source" download>下載 PPT</a></nav>';
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
      const request=++this.request;this.deck=null;this.index=0;this.image.hidden=true;
      this.container.querySelector('.ppt-source').hidden=true;this.controls();this.status('正在開啟簡報…');
      try{
        const response=await fetch('PPT/manifest.json',{cache:'no-cache'});if(!response.ok)throw Error('manifest');
        const manifest=await response.json();if(request!==this.request)return;
        const deck=manifest[key];if(!deck||!Array.isArray(deck.slides)||!deck.slides.length||!deck.slides.every(s=>/^rendered\/[a-z]+\/[a-f0-9]+\/slide-\d+\.jpg$/.test(s)))throw Error('deck');
        this.deck=deck;const link=this.container.querySelector('.ppt-source');link.href='PPT/'+encodeURIComponent(deck.source);link.hidden=false;
        this.show(0);
      }catch{if(request===this.request)this.status('簡報尚未準備完成，請稍後重新開啟。');}
    }
    controls(){const count=this.deck?.slides.length||0;this.container.querySelector('.ppt-prev').disabled=!count||this.index===0;this.container.querySelector('.ppt-next').disabled=!count||this.index===count-1;this.container.querySelector('.ppt-count').textContent=count?`${this.index+1} / ${count}`:'';}
    go(delta){if(this.deck)this.show(Math.max(0,Math.min(this.deck.slides.length-1,this.index+delta)));}
    show(index){
      if(!this.deck)return;this.index=index;this.controls();this.image.hidden=true;this.status('正在載入投影片…');
      const src='PPT/'+this.deck.slides[index];
      this.image.onload=()=>{this.image.hidden=false;this.status('');};this.image.onerror=()=>this.status('投影片載入失敗，請重新開啟簡報。');
      this.image.alt=`${this.deck.source}，第 ${index+1} 頁`;this.image.src=src;
      if(index+1<this.deck.slides.length){const next=new Image();next.src='PPT/'+this.deck.slides[index+1];}
    }
  }
  window.IslandPPTViewer=IslandPPTViewer;
})();
