(() => {
  'use strict';
  const rooms = Object.fromEntries(Object.entries(window.IslandRoomTopics).map(([key,room])=>[key,{...room,stations:room.pptLinks?.map(link=>[link.title,room.lead])||[[room.title,room.lead]]}]));

  function topicDiagram(key){
    const board='<rect x="28" y="40" width="300" height="180" rx="15" fill="#214d47" stroke="#77a993" stroke-width="2"/><g fill="none" stroke="#a8c88c" stroke-width="3"><path d="M55 75H117L142 100V170H218L243 195H301M55 190H94V148L128 114H265V72H302M55 111H85L110 86H196L220 110V151H302"/><path d="M71 58V97M288 170V206M177 58V82"/></g><g fill="#d2b777">'+[[55,75],[55,111],[55,190],[71,58],[177,58],[302,72],[302,151],[288,206]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="6"/>`).join('')+'</g><rect x="142" y="107" width="70" height="49" rx="5" fill="#122d2d" stroke="#b0bdb0"/><text x="177" y="137" text-anchor="middle" fill="#d9e6ce" font-size="13">PCB</text>';
    const diagrams={
      clock:'<rect x="22" y="55" width="210" height="150" rx="12" fill="#f1e9d8" stroke="#b6b7a6"/>'+Array.from({length:9},(_,i)=>`<path d="M${42+i*21} 80v18m0 36v18m0 17v13" stroke="#c2b9a6" stroke-width="5" stroke-linecap="round"/>`).join('')+'<path d="M63 93V118H171V145" fill="none" stroke="#cb8159" stroke-width="4"/><rect x="99" y="111" width="48" height="25" rx="4" fill="#334641"/><circle cx="190" cy="100" r="7" fill="#c28452"/><path d="M253 130h48m-12-12 12 12-12 12" fill="none" stroke="#819b8b" stroke-width="3"/><g transform="translate(300 0)">'+board+'</g><path class="topic-after" d="M398 186h52l30-30h90" fill="none" stroke="#b8e3a6" stroke-width="5"/>',
      workshop:board+'<rect x="358" y="40" width="254" height="180" rx="13" fill="#f3e7d8"/><g fill="#b6914e">'+Array.from({length:6},(_,i)=>`<rect x="${385+i*33}" y="76" width="15" height="45" rx="3"/><circle cx="${392+i*33}" cy="159" r="8"/>`).join('')+'</g><g class="topic-before" fill="none" stroke="#cd805e" stroke-width="3"><circle cx="145" cy="98" r="28"/><circle cx="455" cy="99" r="29"/><path d="M450 128v17" stroke-dasharray="4 4"/></g><path class="topic-after" d="m438 156 19 19 39-44" fill="none" stroke="#3d895d" stroke-width="7" stroke-linecap="round"/>',
      library:board+'<rect x="360" y="40" width="252" height="180" rx="13" fill="#173936"/><g stroke="#38645c" stroke-width="1"><path d="M381 80h210M381 120h210M381 160h210M420 58v140M465 58v140M510 58v140M555 58v140"/></g><path d="m383 143 21-4 13-39 21 81 24-92 25 80 20-67 15 37 19 3" fill="none" stroke="#92c4a1" stroke-width="3"/><circle class="topic-before" cx="108" cy="137" r="25" fill="none" stroke="#d89468" stroke-width="3"/><g class="topic-after"><rect x="437" y="174" width="137" height="30" rx="8" fill="#bad3ad"/><text x="505" y="195" text-anchor="middle" fill="#214d35" font-size="19" font-weight="600">PASS</text><path d="m92 140 12 12 24-30" fill="none" stroke="#b9dfa5" stroke-width="5"/></g>',
      lab:'<rect x="24" y="35" width="280" height="190" rx="13" fill="#1c3b3a"/><rect x="337" y="35" width="280" height="190" rx="13" fill="#1c3b3a"/><g stroke="#39645e" stroke-width="1"><path d="M42 95h244M42 130h244M42 165h244M357 95h242M357 130h242M357 165h242M85 55v148M164 55v148M243 55v148M398 55v148M477 55v148M556 55v148"/></g><g fill="none" stroke="#c79371" stroke-width="2" opacity=".9"><path d="M43 94C80 50 110 193 164 135S246 40 285 163M43 163C85 205 124 62 164 128S244 205 285 94M43 115C91 76 115 176 164 132S244 78 285 147M43 147C90 177 113 92 164 132S246 182 285 113"/></g><g class="topic-eye-after" fill="none" stroke="#98d3b8" stroke-width="2.5"><path d="M356 76C404 53 424 203 477 187S550 58 597 76M356 187C404 203 424 53 477 76S550 203 597 187M356 83C406 62 425 195 477 180S549 66 597 83M356 180C406 195 426 62 477 83S549 195 597 180"/></g><text x="164" y="246" text-anchor="middle" fill="#927963" font-size="13">改善前・示意</text><text x="477" y="246" text-anchor="middle" fill="#518371" font-size="13">改善後・示意</text>',
    };
    return `<svg viewBox="0 0 640 265" role="img" xmlns="http://www.w3.org/2000/svg">${diagrams[key]}</svg>`;
  }

  class IslandRooms {
    constructor({ onClose, onOpen, onSound, onSoundToggle } = {}) {
      this.onOpen=onOpen;this.onSound=onSound;this.onSoundToggle=onSoundToggle;
      this.onClose = onClose; this.key = null; this.timer = null; this.run = 'idle'; this.step = 0; this.activeStation = null;
      this.world=null;this.renderCharacter=null;this.motion=true;this.cat=null;
      this.pptManifest={};this.catalogRequest=0;
      const dialog = document.createElement('dialog');
      dialog.id = 'room-dialog'; dialog.className = 'room-dialog'; dialog.setAttribute('aria-labelledby', 'room-title');
      dialog.innerHTML = `
        <article class="room-shell">
          <header class="room-header">
            <div class="room-heading"><div><p id="room-en"></p><h2 id="room-title"></h2></div></div>
            <div class="room-header-actions"><button class="room-sound" aria-pressed="true" aria-label="關閉音樂與音效" title="關閉音樂與音效">♫</button><button class="room-close" aria-label="關閉房間，返回浮空島">返回小島 <span aria-hidden="true">×</span></button></div>
          </header>
          <div class="room-scroll">
            <div class="room-stage" tabindex="0" aria-label="房間地圖，點地板走動，點設備靠近探索">
              <div class="room-scene">
                <img id="room-art" alt="" decoding="async">
                <div class="room-light" aria-hidden="true"></div><div class="room-time-tone" aria-hidden="true"></div>
                <svg class="room-clock" viewBox="0 0 1536 1024" role="img" aria-label="房內時鐘" hidden><g transform="translate(1144 182) matrix(.72 .24 0 1 0 0)"><circle r="40" fill="#f0e1c4" stroke="#97734d" stroke-width="1.6"/><g class="room-clock-marks"></g><g fill="none" stroke-linecap="round"><path class="room-clock-hour" d="M0 3V-20" stroke="#5f4936" stroke-width="3.7"/><path class="room-clock-minute" d="M0 4V-30" stroke="#5f4936" stroke-width="2.3"/><path class="room-clock-second" d="M0 7V-33" stroke="#ad563e" stroke-width=".9"/></g><circle r="2.8" fill="#5f4936"/></g></svg>
                <svg class="room-objects" viewBox="0 0 1536 1024" aria-label="點選發光設備，進入主題"></svg>
                <canvas class="room-world" width="1536" height="1024" aria-hidden="true"></canvas>
              </div>
              <p class="room-image-status" role="status">正在準備房間…</p>
            </div>
            <div class="room-scene-tools"><span><i></i> 點地板走動 · 點設備靠近探索</span><span class="room-walk-status sr-only" role="status"></span></div>
            <details class="room-topic-list"><summary>主題清單</summary><nav class="room-stations" aria-label="房間主題"></nav></details>
            <dialog class="room-topic-dialog" aria-labelledby="room-topic-title">
            <section class="room-content" hidden>
              <button class="room-back">← 返回房間</button>
              <div class="room-detail" aria-live="polite"><h3 id="room-topic-title" tabindex="-1"></h3><p></p></div>
              <div class="topic-products" aria-label="對應軟體與原廠資料"></div>
              <div class="topic-main">
                <div class="topic-explainer"><article><h4>你也遇過這些狀況嗎？</h4><p class="topic-challenge"></p></article><article><h4>我們可以一起看什麼？</h4><p class="topic-value"></p></article><p class="topic-bench" hidden></p><p class="topic-extension" hidden></p></div>
                <div class="topic-demo"><p class="topic-example-label">PCB 示範案例</p><figure class="topic-figure"><div class="topic-diagram"></div><figcaption></figcaption></figure><div class="topic-flow" aria-label="示範流程"></div><div class="room-action-row"><button class="room-action"></button><span class="room-result" role="status">準備就緒</span></div><div class="room-progress" aria-hidden="true"><span></span></div><p class="room-footnote">圖像與結果為流程示意，未對實際 PCB 執行分析。</p></div>
              </div>
              <section class="topic-prepare"><div><h4>下一步，一起看看你的 PCB</h4><p>先準備手邊已有的資料，讓討論更具體。</p><ul></ul><p class="topic-deliverable"></p></div><button class="topic-download">下載準備清單 ↓</button></section>
            </section>
            </dialog>
            <dialog class="copyright-dialog" aria-label="版權聲明"><div class="copyright-toolbar"><span>版權聲明</span><button type="button" class="copyright-close">返回工作室 <span aria-hidden="true">×</span></button></div><iframe title="大塚資訊科技股份有限公司版權聲明"></iframe></dialog>
          </div>
        </article>`;
      document.body.append(dialog); this.dialog = dialog;
      this.$('.room-sound').addEventListener('click',()=>this.onSoundToggle?.());
      this.$('.room-close').addEventListener('click', () => this.close());
      dialog.addEventListener('cancel', e => { if(e.target!==dialog)return;e.preventDefault();if(this.world?.actor.route.length||this.world?.pendingStation!==null&&this.world?.pendingStation!==undefined){this.world.cancel();this.updateSelection();}else this.close(); });
      const topic=this.$('.room-topic-dialog');
      const copyright=this.$('.copyright-dialog');
      this.$('.copyright-close').addEventListener('click',()=>this.closeCopyright());
      copyright.addEventListener('cancel',e=>{e.preventDefault();e.stopPropagation();this.closeCopyright();});
      copyright.addEventListener('click',e=>{if(e.target===copyright)this.closeCopyright();});
      const ppt=document.createElement('div');ppt.className='ppt-viewer';this.$('.room-content').append(ppt);this.ppt=new IslandPPTViewer(ppt);this.$('.room-topic-dialog').classList.add('ppt-dialog');
      const marks=this.$('.room-clock-marks');
      for(let i=0;i<12;i++){const angle=i*Math.PI/6,line=document.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('d',`M${Math.sin(angle)*35} ${-Math.cos(angle)*35}L${Math.sin(angle)*32} ${-Math.cos(angle)*32}`);line.setAttribute('stroke','#6e5740');line.setAttribute('stroke-width','1');marks.append(line);const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.setAttribute('x',Math.sin(angle)*27);text.setAttribute('y',-Math.cos(angle)*27);text.setAttribute('fill','#6e5740');text.setAttribute('font-size','8');text.setAttribute('font-family','Georgia,serif');text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','central');text.textContent=i||12;marks.append(text);}
      topic.addEventListener('cancel',e=>{e.preventDefault();e.stopPropagation();this.showRoom(true);});
      topic.addEventListener('click',e=>{if(e.target===topic)this.showRoom(true);});
      const scene=this.$('.room-scene');let down=null;
      scene.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
      scene.addEventListener('pointerup',e=>{
        if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>10)return;down=null;
        if(e.target.closest('.room-object')||!this.world||!this.snapshot().imageReady||this.activeStation!==null)return;
        const r=scene.getBoundingClientRect(),p={x:(e.clientX-r.left)/r.width*1536,y:(e.clientY-r.top)/r.height*1024};
        if(this.cat?.location===this.key&&Math.hypot(p.x-this.cat.x,p.y-this.cat.y)<50){this.cat.greet();return;}
        if(this.world.walkTo(p)){this.updateSelection();this.$('.room-walk-status').textContent='塚博士正在移動';}
      });
      scene.addEventListener('pointercancel',()=>{down=null;});
      this.$('.room-stage').addEventListener('keydown',e=>{const directions={ArrowLeft:[-65,0],ArrowRight:[65,0],ArrowUp:[0,-45],ArrowDown:[0,45]},d=directions[e.key];if(!d||!this.world||this.activeStation!==null)return;e.preventDefault();const a=this.world.actor;if(this.world.walkTo({x:a.x+d[0],y:a.y+d[1]}))this.updateSelection();});
      new ResizeObserver(()=>this.resizeScene()).observe(this.$('.room-stage'));
      this.$('.room-action').addEventListener('click', () => this.simulate());
      this.$('.topic-download').addEventListener('click',()=>this.downloadBrief());
      this.$('.room-back').addEventListener('click', () => this.showRoom(true));
      this.$('#room-art').addEventListener('load', () => this.imageStatus(''));
      this.$('#room-art').addEventListener('error', () => this.imageStatus('房間圖片未載入，請重新整理後再試。'));
    }
    $(selector) { return this.dialog.querySelector(selector); }
    stationInfo(key,index){
      const room=rooms[key],link=room.pptLinks?.[index],deck=this.pptManifest[link?.pptKey];
      const source=typeof deck?.source==='string'?deck.source:link?.source||'';
      return{source,title:IslandPPTViewer.titleFromSource(source,link?.title||room.stations[index][0])};
    }
    updatePPTLabels(key){
      if(this.key!==key)return;
      rooms[key].stations.forEach((_,index)=>{
        const {title,source}=this.stationInfo(key,index),group=this.$('.room-object[data-station="'+index+'"]');
        this.$('.room-stations [data-station="'+index+'"]').textContent=title;
        group.setAttribute('aria-label','探索'+title);group.dataset.pptSource=source;
        const tooltip=group.querySelector('title');if(tooltip)tooltip.textContent=title+'｜'+source;
      });
      if(this.activeStation!==null)this.$('.room-detail h3').textContent=rooms[key].name+'｜'+this.stationInfo(key,this.activeStation).title;
    }
    async refreshPPTLabels(key){
      const request=++this.catalogRequest;
      try{
        const response=await fetch('PPT/manifest.json',{cache:'no-cache'});if(!response.ok)return;
        const manifest=await response.json();if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||request!==this.catalogRequest||this.key!==key)return;
        this.pptManifest=manifest;this.updatePPTLabels(key);
      }catch{/* Existing fallback labels remain available until the catalog loads. */}
    }
    renderTopic(){
      const room=rooms[this.key];
      this.$('.topic-challenge').textContent=room.challenge;this.$('.topic-value').textContent=room.value;
      this.$('.topic-deliverable').textContent=room.deliverable;
      this.$('.topic-products').replaceChildren(...room.products.map(product=>{const a=document.createElement('a');a.href=product.url;a.target='_blank';a.rel='noopener noreferrer';a.title=product.role+'・原廠介紹';a.textContent=product.name+' ↗';return a;}));
      this.$('.topic-prepare ul').replaceChildren(...room.materials.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
      this.$('.topic-flow').replaceChildren(...room.steps.map(text=>{const span=document.createElement('span');span.textContent=text;return span;}));
      this.$('.topic-diagram').innerHTML=topicDiagram(this.key);
      this.$('.topic-diagram svg').setAttribute('aria-label',room.title+'示意圖');
      const bench=this.$('.topic-bench');bench.hidden=!room.bench;bench.textContent=room.bench||'';
      const extension=this.$('.topic-extension');extension.hidden=!room.extension;extension.replaceChildren();
      if(room.extension){extension.append(room.extension.text+' ');const a=document.createElement('a');a.textContent='認識 '+room.extension.name+' ↗';a.href=room.extension.url;a.target='_blank';a.rel='noopener noreferrer';extension.append(a);}
    }
    briefing(){
      if(!this.key)return '';
      const room=rooms[this.key];
      return [room.name+'｜'+room.title,'',room.lead,'','想討論的狀況',room.challenge,'','可以一起檢視的方向',room.value,'','可先準備的資料',...room.materials.map(text=>'□ '+text),'',room.deliverable,'','原廠介紹',...room.products.map(product=>product.name+' — '+product.role+'\n'+product.url),...(room.extension?['',room.extension.text,room.extension.url]:[]),'','本頁圖像、流程與結果為示意，未對實際 PCB 執行分析。'].join('\n');
    }
    downloadBrief(){
      if(!this.key)return;
      const url=URL.createObjectURL(new Blob(['\ufeff'+this.briefing()],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');
      a.href=url;a.download='otsuka-'+this.key+'-pcb-checklist.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    imageStatus(text) { this.$('.room-image-status').textContent = text; this.$('.room-image-status').hidden = !text; }
    setCharacterRenderer(renderer){this.renderCharacter=renderer;}
    setCat(cat){this.cat=cat;}
    setCoworkers(images){this.coworkerImages=images;}
    setNPCLife(service){this.npcLife=service;}
    resizeScene(){if(!this.key)return;const stage=this.$('.room-stage'),scene=this.$('.room-scene'),w=Math.min(stage.clientWidth,stage.clientHeight*1.5);scene.style.width=w+'px';scene.style.height=(w/1.5)+'px';this.world?.draw();}
    update(dt,time){if(time)this.$('.room-scene').style.setProperty('--room-dusk',String(time.dusk||0));if(time&&this.key==='clock'){const {hour,minute,second}=time,svg=this.$('.room-clock');svg.dataset.time=[hour,minute,Math.floor(second)].map(v=>String(v).padStart(2,'0')).join(':');svg.setAttribute('aria-label','房內時鐘 '+svg.dataset.time);this.$('.room-clock-hour').setAttribute('transform',`rotate(${(hour%12+minute/60+second/3600)*30})`);this.$('.room-clock-minute').setAttribute('transform',`rotate(${(minute+second/60)*6})`);this.$('.room-clock-second').setAttribute('transform',`rotate(${second*6})`);}this.world?.update(dt,this.motion);}
    updateSelection(){const pending=this.world?.pendingStation;this.dialog.querySelectorAll('[data-station]').forEach(b=>b.setAttribute('aria-pressed',String(this.activeStation===Number(b.dataset.station)||pending===Number(b.dataset.station))));}
    open(key) {
      const room = rooms[key]; if (!room || this.key) return;
      this.key = key; this.dialog.dataset.theme = room.theme;
      this.npcLife?.load(key);
      this.npcLife?.enter(key);
      this.world=new IslandRoomWorld.RoomWorld({key,stations:room.pptLinks,canvas:this.$('.room-world'),art:this.$('#room-art'),renderCharacter:this.renderCharacter,cat:this.cat,coworkerImages:this.coworkerImages,npcLife:this.npcLife,onArrive:index=>this.showTopic(index)});
      this.$('#room-en').textContent = room.en; this.$('#room-title').textContent = room.name;
      this.renderTopic();
      this.$('.room-stations').replaceChildren(); this.$('.room-objects').replaceChildren();
      this.$('.room-clock').toggleAttribute('hidden',key!=='clock');
      room.stations.forEach((station, i) => {
        const {title:name,source}=this.stationInfo(key,i);
        const button = document.createElement('button'); button.type = 'button'; button.dataset.station = i;
        button.textContent = name; button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => this.selectStation(i)); this.$('.room-stations').append(button);
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.classList.add('room-object'); group.dataset.station = i;
        group.setAttribute('role', 'button'); group.setAttribute('tabindex', '0');
        group.setAttribute('aria-label', `探索${name}`); group.setAttribute('aria-pressed', 'false');
        const link=room.pptLinks?.[i];
        if(link){group.dataset.pptSource=source;const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=name+'｜'+source;group.append(title);}
        for (const layer of ['hit', 'halo', 'mist', 'core']) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', IslandOutlines.rooms[key][link?.outline??this.world.layout.equipment.outline]); path.setAttribute('class', `object-${layer}`);
          path.setAttribute('vector-effect', 'non-scaling-stroke'); group.append(path);
        }
        group.addEventListener('click', () => this.selectStation(i));
        group.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.selectStation(i); }
        });
        this.$('.room-objects').append(group);
      });
      if(key==='clock'){
        const book=document.createElementNS('http://www.w3.org/2000/svg','g');book.classList.add('room-object','copyright-book');book.setAttribute('role','button');book.setAttribute('tabindex','0');book.setAttribute('aria-label','開啟版權聲明');
        const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent='版權聲明';book.append(title);
        for(const layer of ['hit','halo','mist','core']){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M300 702 L333 694 L386 710 L389 763 L360 777 L294 758 L294 718 Z');path.setAttribute('class','object-'+layer);path.setAttribute('vector-effect','non-scaling-stroke');book.append(path);}
        book.addEventListener('click',()=>this.openCopyright());book.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.openCopyright();}});this.$('.room-objects').append(book);
      }
      this.showRoom(); this.imageStatus('正在準備房間…');
      const image = this.$('#room-art'); image.alt = `${room.name}：${room.lead}`; image.src = room.image;
      if (image.complete && image.naturalWidth) this.imageStatus('');
      this.dialog.showModal(); this.$('.room-scroll').scrollTop = 0; document.body.classList.add('inside-room');
      this.resizeScene();
      this.onOpen?.(key);
      this.$('.room-close').focus({ preventScroll: true });
      this.refreshPPTLabels(key);
    }
    resetDemo() {
      if(this.run==='running')this.onSound?.('cancel',this.key);
      clearTimeout(this.timer); this.timer = null; this.run = 'idle'; this.step = 0;
      this.dialog.dataset.run = 'idle'; this.$('.room-action').disabled = false;
      this.$('.room-action').textContent = rooms[this.key].action; this.$('.room-result').textContent = '準備就緒';
      this.$('.topic-figure figcaption').textContent=rooms[this.key].before;
      this.$('.topic-flow').querySelectorAll('span').forEach(span=>{span.classList.remove('is-current','is-done');span.removeAttribute('aria-current');});
    }
    showRoom(restoreFocus = false) {
      const previous = this.activeStation; this.resetDemo(); this.activeStation = null;
      if(this.$('.room-topic-dialog').open)this.$('.room-topic-dialog').close();
      if(this.world)this.world.topicOpen=false;
      this.$('.room-content').hidden = true; this.$('.room-topic-list').open = false;
      this.$('.room-stage').hidden=false;this.$('.room-scene-tools').hidden=false;this.$('.room-topic-list').hidden=false;
      this.dialog.querySelectorAll('[data-station]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      this.$('.room-scroll').scrollTop = 0;
      if(restoreFocus)this.onSound?.('back',this.key);
      if (restoreFocus && previous !== null) this.$(`.room-object[data-station="${previous}"]`).focus({ preventScroll: true });
    }
    selectStation(index) {
      if(!this.world||!this.snapshot().imageReady||!rooms[this.key]?.stations[index])return;
      if(this.world.visit(index)){this.updateSelection();this.$('.room-topic-list').open=false;this.$('.room-walk-status').textContent='塚博士正在走向設備';}
    }
    openCopyright(){if(this.key!=='clock'||this.$('.copyright-dialog').open)return;this.world?.cancel();if(this.world)this.world.topicOpen=true;this.updateSelection();const frame=this.$('.copyright-dialog iframe');if(!frame.getAttribute('src'))frame.src='copyright.html?v=36';this.$('.copyright-dialog').showModal();this.$('.copyright-close').focus();}
    closeCopyright(restoreFocus=true){if(!this.$('.copyright-dialog').open)return;this.$('.copyright-dialog').close();if(this.world)this.world.topicOpen=false;if(restoreFocus)this.$('.copyright-book')?.focus({preventScroll:true});}
    showTopic(index) {
      const station = rooms[this.key]?.stations[index];if(!station)return;
      this.resetDemo(); this.activeStation = index; this.$('.room-content').hidden = false;
      this.$('.room-topic-list').open = false;
      const link=rooms[this.key].pptLinks?.[index];
      const key=this.key,pptKey=link?.pptKey||key;
      this.$('.room-detail h3').textContent = rooms[key].name+(link?'｜'+this.stationInfo(key,index).title:'');this.$('.room-detail p').textContent = '';
      this.ppt.open(pptKey).then(deck=>{if(deck&&this.key===key&&this.activeStation===index){this.pptManifest[pptKey]=deck;this.updatePPTLabels(key);}});
      this.dialog.querySelectorAll('[data-station]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.station) === index)));
      this.$('.room-topic-dialog').showModal();this.$('.room-content').scrollTop=0;
      this.$('.room-detail h3').focus({ preventScroll: true });
      this.onSound?.('select',this.key,index);
    }
    simulate() {
      if (!this.key || this.activeStation === null || this.run === 'running') return;
      this.run = 'running'; this.dialog.dataset.run = 'running'; this.$('.room-action').disabled = true; this.step = 0;
      this.onSound?.('run',this.key);
      const advance = () => {
        if (!this.key) return;
        const room = rooms[this.key];
        if (this.step < room.steps.length) {
          if(this.step)this.onSound?.('step',this.key,this.step);
          this.$('.topic-flow').querySelectorAll('span').forEach((span,i)=>{span.classList.toggle('is-current',i===this.step);span.classList.toggle('is-done',i<this.step);if(i===this.step)span.setAttribute('aria-current','step');else span.removeAttribute('aria-current');});
          this.$('.room-result').textContent = `${room.steps[this.step++]}…`; this.timer = setTimeout(advance, 800);
        } else {
          this.run = 'complete'; this.dialog.dataset.run = 'complete'; this.$('.room-result').textContent = room.result;
          this.$('.room-action').disabled = false; this.$('.room-action').textContent = '再體驗一次'; this.timer = null;
          this.onSound?.('complete',this.key);
          this.$('.topic-figure figcaption').textContent=room.after;
          this.$('.topic-flow').querySelectorAll('span').forEach(span=>{span.classList.remove('is-current');span.classList.add('is-done');span.removeAttribute('aria-current');});
        }
      };
      advance();
    }
    setAudioEnabled(enabled){const b=this.$('.room-sound');b.setAttribute('aria-pressed',String(enabled));b.textContent=enabled?'♫':'♪';b.title=enabled?'關閉音樂與音效':'開啟音樂與音效';b.setAttribute('aria-label',b.title);}
    setMotion(enabled) { this.motion=enabled;this.dialog.classList.toggle('room-paused', !enabled); }
    close() {
      if (!this.key) return;
      this.closeCopyright(false);
      if(this.$('.room-topic-dialog').open)this.$('.room-topic-dialog').close();
      this.world?.cancel();this.world=null;
      const key = this.key; clearTimeout(this.timer); this.timer = null; this.key = null; this.run = 'idle'; this.activeStation = null;
      this.dialog.close(); document.body.classList.remove('inside-room'); this.onClose?.(key);
    }
    snapshot() { return { key: this.key, open: this.dialog.open, topic: this.activeStation, topicOpen:this.$('.room-topic-dialog').open,run: this.run, imageReady: this.$('#room-art').complete && this.$('#room-art').naturalWidth > 0,world:this.world?.snapshot()||null }; }
  }

  window.IslandRooms = IslandRooms;
})();
