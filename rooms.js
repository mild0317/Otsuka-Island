(() => {
  'use strict';
  const rooms = Object.fromEntries(Object.entries(window.IslandRoomTopics).map(([key,room])=>[key,{...room,stations:[[room.title,room.lead]]}]));

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
      const dialog = document.createElement('dialog');
      dialog.id = 'room-dialog'; dialog.className = 'room-dialog'; dialog.setAttribute('aria-labelledby', 'room-title');
      dialog.innerHTML = `
        <article class="room-shell">
          <header class="room-header">
            <div class="room-heading"><div><p id="room-en"></p><h2 id="room-title"></h2></div></div>
            <div class="room-header-actions"><button class="room-sound" aria-pressed="true" aria-label="關閉音樂與音效" title="關閉音樂與音效">♫</button><button class="room-close" aria-label="關閉房間，返回浮空島">返回小島 <span aria-hidden="true">×</span></button></div>
          </header>
          <div class="room-scroll">
            <div class="room-stage" aria-label="房間場景，點選發光物件進入主題">
              <div class="room-scene">
                <img id="room-art" alt="" decoding="async">
                <div class="room-light" aria-hidden="true"></div>
                <svg class="room-objects" viewBox="0 0 1536 1024" aria-label="點選發光設備，進入主題"></svg>
                <div class="room-doctor" aria-hidden="true"><canvas width="194" height="300"></canvas></div>
              </div>
              <p class="room-image-status" role="status">正在準備房間…</p>
            </div>
            <div class="room-scene-tools"><span><i></i> 點選發光物件，進入主題</span></div>
            <details class="room-topic-list"><summary>主題清單</summary><nav class="room-stations" aria-label="房間主題"></nav></details>
            <section class="room-content" hidden>
              <button class="room-back">← 返回房間</button>
              <div class="room-detail" aria-live="polite"><h3 tabindex="-1"></h3><p></p></div>
              <div class="topic-products" aria-label="對應軟體與原廠資料"></div>
              <div class="topic-main">
                <div class="topic-explainer"><article><h4>你也遇過這些狀況嗎？</h4><p class="topic-challenge"></p></article><article><h4>我們可以一起看什麼？</h4><p class="topic-value"></p></article><p class="topic-bench" hidden></p><p class="topic-extension" hidden></p></div>
                <div class="topic-demo"><p class="topic-example-label">PCB 示範案例</p><figure class="topic-figure"><div class="topic-diagram"></div><figcaption></figcaption></figure><div class="topic-flow" aria-label="示範流程"></div><div class="room-action-row"><button class="room-action"></button><span class="room-result" role="status">準備就緒</span></div><div class="room-progress" aria-hidden="true"><span></span></div><p class="room-footnote">圖像與結果為流程示意，未對實際 PCB 執行分析。</p></div>
              </div>
              <section class="topic-prepare"><div><h4>下一步，一起看看你的 PCB</h4><p>先準備手邊已有的資料，讓討論更具體。</p><ul></ul><p class="topic-deliverable"></p></div><button class="topic-download">下載準備清單 ↓</button></section>
            </section>
          </div>
        </article>`;
      document.body.append(dialog); this.dialog = dialog;
      this.$('.room-sound').addEventListener('click',()=>this.onSoundToggle?.());
      this.$('.room-close').addEventListener('click', () => this.close());
      dialog.addEventListener('click', e => { if (e.target === dialog) this.close(); });
      dialog.addEventListener('cancel', e => { e.preventDefault(); this.close(); });
      this.$('.room-action').addEventListener('click', () => this.simulate());
      this.$('.topic-download').addEventListener('click',()=>this.downloadBrief());
      this.$('.room-back').addEventListener('click', () => this.showRoom(true));
      this.$('#room-art').addEventListener('load', () => this.imageStatus(''));
      this.$('#room-art').addEventListener('error', () => this.imageStatus('房間圖片未載入，請重新整理後再試。'));
    }
    $(selector) { return this.dialog.querySelector(selector); }
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
    setCharacter(sprite) {
      const c = this.$('.room-doctor canvas'), g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(sprite, 212 / 2048 * sprite.width, 0, 444 / 2048 * sprite.width, sprite.height, 0, 0, c.width, c.height);
    }
    open(key) {
      const room = rooms[key]; if (!room || this.key) return;
      this.key = key; this.dialog.dataset.theme = room.theme;
      this.$('#room-en').textContent = room.en; this.$('#room-title').textContent = room.name;
      this.renderTopic();
      this.$('.room-stations').replaceChildren(); this.$('.room-objects').replaceChildren();
      room.stations.forEach(([name], i) => {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.station = i;
        button.textContent = name; button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => this.selectStation(i)); this.$('.room-stations').append(button);
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.classList.add('room-object'); group.dataset.station = i;
        group.setAttribute('role', 'button'); group.setAttribute('tabindex', '0');
        group.setAttribute('aria-label', `探索${name}`); group.setAttribute('aria-pressed', 'false');
        for (const layer of ['hit', 'halo', 'mist', 'core']) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', IslandOutlines.rooms[key][i]); path.setAttribute('class', `object-${layer}`);
          path.setAttribute('vector-effect', 'non-scaling-stroke'); group.append(path);
        }
        group.addEventListener('click', () => this.selectStation(i));
        group.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.selectStation(i); }
        });
        this.$('.room-objects').append(group);
      });
      this.showRoom(); this.imageStatus('正在準備房間…');
      const image = this.$('#room-art'); image.alt = `${room.name}：${room.lead}`; image.src = room.image;
      if (image.complete && image.naturalWidth) this.imageStatus('');
      this.dialog.showModal(); this.$('.room-scroll').scrollTop = 0; document.body.classList.add('inside-room');
      this.onOpen?.(key);
      this.$('.room-close').focus({ preventScroll: true });
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
      this.$('.room-content').hidden = true; this.$('.room-topic-list').open = false;
      this.$('.room-stage').hidden=false;this.$('.room-scene-tools').hidden=false;this.$('.room-topic-list').hidden=false;
      this.dialog.querySelectorAll('[data-station]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      this.$('.room-scroll').scrollTop = 0;
      if(restoreFocus)this.onSound?.('back',this.key);
      if (restoreFocus && previous !== null) this.$(`.room-object[data-station="${previous}"]`).focus({ preventScroll: true });
    }
    selectStation(index) {
      const station = rooms[this.key]?.stations[index];if(!station)return;
      this.resetDemo(); this.activeStation = index; this.$('.room-content').hidden = false;
      this.$('.room-topic-list').open = false;
      this.$('.room-stage').hidden=true;this.$('.room-scene-tools').hidden=true;this.$('.room-topic-list').hidden=true;
      this.$('.room-detail h3').textContent = station[0]; this.$('.room-detail p').textContent = station[1];
      this.dialog.querySelectorAll('[data-station]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.station) === index)));
      this.$('.room-scroll').scrollTop=0;
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
    setMotion(enabled) { this.dialog.classList.toggle('room-paused', !enabled); }
    close() {
      if (!this.key) return;
      const key = this.key; clearTimeout(this.timer); this.timer = null; this.key = null; this.run = 'idle'; this.activeStation = null;
      this.dialog.close(); document.body.classList.remove('inside-room'); this.onClose?.(key);
    }
    snapshot() { return { key: this.key, open: this.dialog.open, topic: this.activeStation, run: this.run, imageReady: this.$('#room-art').complete && this.$('#room-art').naturalWidth > 0 }; }
  }

  window.IslandRooms = IslandRooms;
})();
