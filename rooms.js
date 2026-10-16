(() => {
  'use strict';
  const rooms = {
    clock: {
      name: '設計工作室', en: 'EDA DESIGN STUDIO', image: 'assets/room-design-v9.jpg', theme: 'blue',
      intro: '先在麵包板上搭起電路、量測與調整，再把想法帶進原理圖與 PCB 設計。', action: '體驗電路原型到 PCB', result: '電路原型確認，銜接 PCB 設計',
      steps: ['麵包板搭建電路原型', '電錶量測與電路調整', '整理原理圖並進入 PCB 佈局'],
      stations: [
        ['麵包板工作台', '白色麵包板接上單芯跳線、IC、LED、電阻與電容；桌邊散放電子零件、電錶與烙鐵，方便搭建及量測電路原型。', 35, 51],
        ['PCB 佈局佈線', '在 EDA 畫面中配置元件、規劃走線，並檢視焊盤、過孔與銅層。', 80, 53],
        ['元件與電路資料', '對照電阻、電容、電晶體與 IC 資料，將麵包板確認過的連接方式整理到原理圖，再銜接 PCB 設計。', 64, 20]
      ]
    },
    workshop: {
      name: '製作工坊', en: 'PCB PROTOTYPING WORKSHOP', image: 'assets/room-workshop-v8.jpg', theme: 'copper',
      intro: '把 EDA 設計資料帶到工作台，製作、焊接與檢視 PCB 原型。', action: '體驗 PCB 打樣流程', result: 'PCB 原型準備完成',
      steps: ['檢視 PCB 製作資料', '配置電子元件與焊接', '檢視 PCB 原型'],
      stations: [
        ['PCB 打樣工作台', '防靜電工作墊上放著實體 PCB、元件料盤與焊接工具，將電路設計做成板件。', 43, 58],
        ['PCB 回焊設備', '將配置好表面黏著元件的 PCB 放入回焊設備，依溫度曲線完成焊接，再檢視元件位置與焊點。', 76, 49],
        ['PCB 製作資料站', '在雙螢幕對照 PCB 板圖、原理圖與元件清單，確認封裝、腳位和製作資料，準備打樣與組裝。', 25, 43]
      ]
    },
    library: {
      name: '驗証工作室', en: 'PCB VALIDATION STUDIO', image: 'assets/room-verification-v7.jpg', theme: 'green',
      intro: '兩台 EDA 工作站，對同一塊 PCB 進行設計規則檢查與量測比對。', action: '執行 PCB 驗証', result: 'PASS · PCB 驗証完成',
      steps: ['PCB 設計規則檢查', 'PCB 電路量測比對', '確認 PCB 驗証結果'],
      stations: [
        ['PCB 規則檢查站', '第一台電腦檢視 PCB 板圖，檢查走線間距、過孔與連線等設計規則。', 40, 37],
        ['PCB PASS 結果站', '第二台電腦呈現這塊 PCB 的檢查結果；按下按鈕，體驗從檢查到 PASS 的驗証示意。', 76, 46],
        ['PCB 電路量測台', '以示波器、探針與治具量測實體 PCB，將波形和板件上的測試點比對。', 54, 39]
      ]
    },
    lab: {
      name: '模擬實驗室', en: 'PCB SIMULATION LAB', image: 'assets/room-simulation-v8.jpg', theme: 'teal',
      intro: '模擬對象就是 PCB：從訊號與電源完整性，到板上的溫度分布。', action: '執行 PCB 模擬', result: 'PCB 訊號／電源／熱模擬完成',
      steps: ['載入 PCB 板圖與層疊', '分析 PCB 訊號與電源', '檢視 PCB 熱分布結果'],
      stations: [
        ['PCB 板件投影台', '中央呈現佈滿 IC、過孔與銅走線的 PCB，色彩顯示板件的模擬溫度分布。', 50, 53],
        ['PCB 訊號完整性', '以 PCB 走線與眼圖檢視訊號傳輸，觀察串擾、反射與訊號品質的示意。', 26, 43],
        ['PCB 電源與熱分析', '檢視 PCB 的電源分布、電流密度與熱點，所有分析都以電路板為對象。', 76, 44]
      ]
    }
  };

  class IslandRooms {
    constructor({ onClose } = {}) {
      this.onClose = onClose; this.key = null; this.timer = null; this.run = 'idle'; this.step = 0; this.activeStation = null;
      const dialog = document.createElement('dialog');
      dialog.id = 'room-dialog'; dialog.className = 'room-dialog'; dialog.setAttribute('aria-labelledby', 'room-title');
      dialog.innerHTML = `
        <article class="room-shell">
          <header class="room-header">
            <div class="room-heading"><div><p id="room-en"></p><h2 id="room-title"></h2></div></div>
            <button class="room-close" aria-label="關閉房間，返回浮空島">返回小島 <span aria-hidden="true">×</span></button>
          </header>
          <div class="room-scroll">
            <div class="room-stage" tabindex="0" aria-label="房間場景，可使用放大按鈕查看細節">
              <div class="room-scene">
                <img id="room-art" alt="" decoding="async">
                <div class="room-light" aria-hidden="true"></div>
                <svg class="room-objects" viewBox="0 0 1536 1024" aria-label="點選發光設備，進入主題"></svg>
                <div class="room-doctor" aria-hidden="true"><canvas width="194" height="300"></canvas></div>
              </div>
              <p class="room-image-status" role="status">正在準備房間…</p>
            </div>
            <div class="room-scene-tools"><span><i></i> 點選發光物件，進入主題</span><button class="room-zoom" aria-pressed="false">＋ 放大房間</button></div>
            <details class="room-topic-list"><summary>主題清單</summary><nav class="room-stations" aria-label="房間主題"></nav></details>
            <section class="room-content" hidden>
              <button class="room-back">← 返回房間</button>
              <p class="room-intro"></p>
              <div class="room-detail" aria-live="polite"><h3 tabindex="-1"></h3><p></p></div>
              <div class="room-action-row"><button class="room-action"></button><span class="room-result" role="status">準備就緒</span></div>
              <div class="room-progress" aria-hidden="true"><span></span></div>
              <p class="room-footnote">EDA／PCB 流程互動示意。這裡用來介紹工作情境，尚未執行實際板件分析。</p>
            </section>
          </div>
        </article>`;
      document.body.append(dialog); this.dialog = dialog;
      this.$('.room-close').addEventListener('click', () => this.close());
      dialog.addEventListener('click', e => { if (e.target === dialog) this.close(); });
      dialog.addEventListener('cancel', e => { e.preventDefault(); this.close(); });
      this.$('.room-zoom').addEventListener('click', () => {
        const zoomed = this.$('.room-stage').classList.toggle('is-zoomed');
        this.$('.room-zoom').setAttribute('aria-pressed', String(zoomed));
        this.$('.room-zoom').textContent = zoomed ? '－ 完整房間' : '＋ 放大房間';
      });
      this.$('.room-action').addEventListener('click', () => this.simulate());
      this.$('.room-back').addEventListener('click', () => this.showRoom(true));
      this.$('#room-art').addEventListener('load', () => this.imageStatus(''));
      this.$('#room-art').addEventListener('error', () => this.imageStatus('房間圖片未載入，請重新整理後再試。'));
    }
    $(selector) { return this.dialog.querySelector(selector); }
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
      this.$('.room-intro').textContent = room.intro;
      this.$('.room-stage').classList.remove('is-zoomed'); this.$('.room-stage').scrollTo(0, 0);
      this.$('.room-zoom').setAttribute('aria-pressed', 'false'); this.$('.room-zoom').textContent = '＋ 放大房間';
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
      const image = this.$('#room-art'); image.alt = `${room.name}：${room.intro}`; image.src = room.image;
      if (image.complete && image.naturalWidth) this.imageStatus('');
      this.dialog.showModal(); this.$('.room-scroll').scrollTop = 0; document.body.classList.add('inside-room');
      this.$('.room-close').focus({ preventScroll: true });
    }
    resetDemo() {
      clearTimeout(this.timer); this.timer = null; this.run = 'idle'; this.step = 0;
      this.dialog.dataset.run = 'idle'; this.$('.room-action').disabled = false;
      this.$('.room-action').textContent = rooms[this.key].action; this.$('.room-result').textContent = '準備就緒';
    }
    showRoom(restoreFocus = false) {
      const previous = this.activeStation; this.resetDemo(); this.activeStation = null;
      this.$('.room-content').hidden = true; this.$('.room-topic-list').open = false;
      this.dialog.querySelectorAll('[data-station]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      this.$('.room-scroll').scrollTop = 0;
      if (restoreFocus && previous !== null) this.$(`.room-object[data-station="${previous}"]`).focus({ preventScroll: true });
    }
    selectStation(index) {
      const station = rooms[this.key].stations[index];
      this.resetDemo(); this.activeStation = index; this.$('.room-content').hidden = false;
      this.$('.room-topic-list').open = false;
      this.$('.room-detail h3').textContent = station[0]; this.$('.room-detail p').textContent = station[1];
      this.dialog.querySelectorAll('[data-station]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.station) === index)));
      this.$('.room-content').scrollIntoView({ block: 'nearest' });
      this.$('.room-detail h3').focus({ preventScroll: true });
    }
    simulate() {
      if (!this.key || this.activeStation === null || this.run === 'running') return;
      this.run = 'running'; this.dialog.dataset.run = 'running'; this.$('.room-action').disabled = true; this.step = 0;
      const advance = () => {
        if (!this.key) return;
        const room = rooms[this.key];
        if (this.step < room.steps.length) {
          this.$('.room-result').textContent = `${room.steps[this.step++]}…`; this.timer = setTimeout(advance, 800);
        } else {
          this.run = 'complete'; this.dialog.dataset.run = 'complete'; this.$('.room-result').textContent = room.result;
          this.$('.room-action').disabled = false; this.$('.room-action').textContent = '再體驗一次'; this.timer = null;
        }
      };
      advance();
    }
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
