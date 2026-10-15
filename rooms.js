(() => {
  'use strict';
  const rooms = {
    clock: {
      name: '設計工作室', en: 'DESIGN STUDIO', number: '01', image: 'assets/room-design-v7.jpg', theme: 'blue',
      intro: '在鐘樓下，把第一個靈感畫成可以實現的藍圖。', action: '展開設計流程', result: '設計藍圖已就緒',
      stations: [
        ['藍圖繪製桌', '從草圖、尺寸到電路配置，將想法整理成完整設計。', 38, 55],
        ['CAD 設計站', '檢視零件、電路與組裝關係，讓每個細節彼此吻合。', 80, 53],
        ['鐘樓機構', '齒輪與鐘面延續外面的鐘樓，提醒我們為每個好點子留一點時間。', 64, 20]
      ]
    },
    workshop: {
      name: '製作工坊', en: 'FABRICATION WORKSHOP', number: '02', image: 'assets/room-workshop-v7.jpg', theme: 'copper',
      intro: '木樑與紅磚之間，讓藍圖成為可以拿在手上的原型。', action: '啟動製作示意', result: '原型組裝完成',
      stations: [
        ['機械手臂工作台', '兩座工作台分工完成零件取放與原型組裝。', 45, 58],
        ['加工與列印區', '以小型加工設備與 3D 列印，探索零件的形狀與配合。', 76, 49],
        ['電子裝配台', '整理元件、焊接電路，再把製作完成的板件交給驗証工作室。', 25, 43]
      ]
    },
    library: {
      name: '驗証工作室', en: 'VALIDATION STUDIO', number: '03', image: 'assets/room-verification-v7.jpg', theme: 'green',
      intro: '拱窗灑下的光，照亮電路上的每一條連線與每一次確認。', action: '執行 PCB 驗証', result: 'PASS · 驗証完成',
      stations: [
        ['PCB 電路工作站', '第一台電腦檢視 PCB 線路、焊盤與元件配置。', 40, 37],
        ['PASS 驗証工作站', '第二台電腦顯示電路檢查結果；按下按鈕，體驗一次驗証流程。', 76, 46],
        ['電路量測台', '示波器、探針與測試治具，將畫面上的電路對照實際板件。', 54, 39]
      ]
    },
    lab: {
      name: '模擬實驗室', en: 'SIMULATION LAB', number: '04', image: 'assets/room-simulation-v7.jpg', theme: 'teal',
      intro: '在玻璃圓頂裡，先讓可能性發生，再帶著答案回到現實。', action: '執行模擬示意', result: '模擬運算完成',
      stations: [
        ['數位分身投影台', '中央的線框模型，呈現設計在虛擬空間裡的樣貌。', 50, 53],
        ['工程模擬控制台', '以網格、波形與色彩分布，觀察不同設定下的變化。', 26, 43],
        ['運算與資料區', '沿著圓頂排列的工作站，讓每次模擬都有可以回顧的記錄。', 76, 44]
      ]
    }
  };

  class IslandRooms {
    constructor({ onClose } = {}) {
      this.onClose = onClose; this.key = null; this.timer = null; this.run = 'idle';
      const dialog = document.createElement('dialog');
      dialog.id = 'room-dialog'; dialog.className = 'room-dialog';
      dialog.setAttribute('aria-labelledby', 'room-title');
      dialog.innerHTML = `
        <article class="room-shell">
          <header class="room-header">
            <div class="room-heading"><span class="room-number"></span><div><p id="room-en"></p><h2 id="room-title"></h2></div></div>
            <button class="room-close" aria-label="離開房間，返回浮空島">返回小島 <span aria-hidden="true">×</span></button>
          </header>
          <div class="room-scroll">
            <div class="room-stage" tabindex="0" aria-label="房間場景，可使用放大按鈕查看細節">
              <div class="room-scene">
                <img id="room-art" alt="" decoding="async">
                <div class="room-light" aria-hidden="true"></div>
                <div class="room-hotspots"></div>
                <div class="room-doctor" aria-hidden="true"><canvas width="194" height="300"></canvas></div>
              </div>
              <p class="room-image-status" role="status">正在打開房間…</p>
            </div>
            <div class="room-scene-tools"><span><i></i> 塚博士和你一起探索</span><button class="room-zoom" aria-pressed="false">＋ 放大房間</button></div>
            <section class="room-content">
              <p class="room-intro"></p>
              <div class="room-stations" aria-label="探索房間設備"></div>
              <div class="room-detail" aria-live="polite"><strong></strong><p></p></div>
              <div class="room-action-row"><button class="room-action"></button><span class="room-result" role="status">準備就緒</span></div>
              <div class="room-progress" aria-hidden="true"><span></span></div>
              <p class="room-footnote">房間設備與操作為互動展示。點選編號，看看博士的介紹。</p>
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
      this.key = key; this.run = 'idle'; this.dialog.dataset.theme = room.theme;
      this.dialog.dataset.run = 'idle'; this.$('.room-action').disabled = false;
      this.$('.room-number').textContent = room.number; this.$('#room-en').textContent = room.en;
      this.$('#room-title').textContent = room.name; this.$('.room-intro').textContent = room.intro;
      this.$('.room-action').textContent = room.action; this.$('.room-result').textContent = '準備就緒';
      this.$('.room-stage').classList.remove('is-zoomed'); this.$('.room-stage').scrollTo(0, 0);
      this.$('.room-zoom').setAttribute('aria-pressed', 'false'); this.$('.room-zoom').textContent = '＋ 放大房間';
      this.$('.room-stations').replaceChildren(); this.$('.room-hotspots').replaceChildren();
      room.stations.forEach(([name,,x,y], i) => {
        for (const selector of ['.room-stations', '.room-hotspots']) {
          const button = document.createElement('button'); button.type = 'button'; button.dataset.station = i;
          button.setAttribute('aria-label', `探索${name}`); button.setAttribute('aria-pressed', 'false');
          if (selector === '.room-hotspots') { button.textContent = i+1; button.style.left = `${x}%`; button.style.top = `${y}%`; }
          else { const number = document.createElement('span'); number.textContent = `0${i+1}`; button.append(number, document.createTextNode(name)); }
          button.addEventListener('click', () => this.selectStation(i)); this.$(selector).append(button);
        }
      });
      this.selectStation(0); this.imageStatus('正在打開房間…');
      const image = this.$('#room-art'); image.alt = `${room.name}：${room.intro}`; image.src = room.image;
      if (image.complete && image.naturalWidth) this.imageStatus('');
      this.dialog.showModal(); this.$('.room-scroll').scrollTop = 0; document.body.classList.add('inside-room');
      this.$('.room-close').focus({ preventScroll: true });
    }
    selectStation(index) {
      const station = rooms[this.key].stations[index];
      this.$('.room-detail strong').textContent = station[0]; this.$('.room-detail p').textContent = station[1];
      this.dialog.querySelectorAll('[data-station]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.station) === index)));
    }
    simulate() {
      if (!this.key || this.run === 'running') return;
      this.run = 'running'; this.dialog.dataset.run = 'running'; this.$('.room-action').disabled = true;
      this.$('.room-result').textContent = this.key === 'library' ? '線路檢查 → 量測比對 → 結果確認…' : '博士正在操作設備…';
      this.timer = setTimeout(() => {
        if (!this.key) return;
        this.run = 'complete'; this.dialog.dataset.run = 'complete';
        this.$('.room-result').textContent = rooms[this.key].result;
        this.$('.room-action').disabled = false; this.$('.room-action').textContent = '再體驗一次';
        this.timer = null;
      }, 2400);
    }
    setMotion(enabled) { this.dialog.classList.toggle('room-paused', !enabled); }
    close() {
      if (!this.key) return;
      const key = this.key; clearTimeout(this.timer); this.timer = null; this.key = null; this.run = 'idle';
      this.dialog.close(); document.body.classList.remove('inside-room'); this.onClose?.(key);
    }
    snapshot() { return { key: this.key, open: this.dialog.open, run: this.run, imageReady: this.$('#room-art').complete && this.$('#room-art').naturalWidth > 0 }; }
  }
  window.IslandRooms = IslandRooms;
})();
