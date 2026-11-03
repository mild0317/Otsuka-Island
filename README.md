# 塚博士的浮空島

可在瀏覽器探索的浮空研究島。網站使用 HTML、CSS、JavaScript，不需安裝相依套件或執行建置。

## 快速入口

- **下一階段影片企劃**：[交接入口與 12 支影片大綱](docs/video-project/README.md)。
- **啟動本機預覽**：在此資料夾執行 `node scripts/serve.mjs`，開啟 <http://127.0.0.1:4173>。
- **手機預覽**：雙擊 [start-mobile-preview.cmd](start-mobile-preview.cmd)，手機與電腦使用同一 Wi-Fi。
- **公開網站**：<https://mild0317.github.io/Otsuka-Island/>；V101 改善進島載入，A1 影片改用網站內嵌視窗播放。

## 資料夾用途

| 路徑 | 內容 |
| --- | --- |
| `index.html`、`copyright.html` | 網站入口與版權頁 |
| `src/` | 網站 JavaScript 與 CSS |
| `assets/` | 程式仍會引用的圖片、動態素材、星表與第三方程式／授權 |
| `PPT/` | 目前網站使用的簡報、入口對應及轉檔投影片，尚未以影片取代 |
| `videos/` | 正式公開的 MP4，A1 為 `A1-schematic-v03-bg.mp4` |
| `scripts/` | 預覽伺服器、PowerPoint 轉檔與資料核對工具 |
| `tests/` | 測試程式；從專案根目錄執行 |
| `docs/video-project/` | 新影片方向的共通規格、12 個主題與工具交接 |
| `docs/usage/` | 房間內容與語庫編輯說明 |
| `docs/assets/` | 圖片生成提示詞、素材來源與製作紀錄 |
| `docs/history/` | 版本沿革與早期語庫紀錄 |
| `reference/` | 人物身份原稿、原始島圖與版型參考，不隨網站部署 |
| `archive/assets/` | 程式未引用但保留參考價值的舊版圖，不隨網站部署 |
| `output/` | 已產出的設計參考與之後影片成品 |
| `.preview/` | 可重建的當次測試截圖及暫存，不加入 Git |
| `.local-archive/` | 本機歷史測試截圖、備份及臨時工具，不加入 Git、不部署 |

## 常用檢查

請在專案根目錄執行；瀏覽器檢查前先啟動預覽伺服器，同一時間只跑一支瀏覽器測試。

```powershell
node tests/check-star-coordinates.mjs
node tests/check-orbital-appearance.mjs
python tests/check-ppt-filenames.py
python scripts/build-ppt.py --check
node tests/check-star-map.mjs
```

[測試說明](tests/README.md)包含目前推薦的檢查與歷史測試注意事項。素材整理沒有改動遊戲玩法與影片企劃；舊版圖片不因檔名較舊就直接刪除。

## 維護與沿革

- [本次工作區整理紀錄](docs/maintenance/workspace-cleanup-2026-10-30.md)
- [檔案移動對照表](docs/maintenance/cleanup-manifest-2026-10-30.json)
- [完整版本沿革](docs/history/versions.md)
- [簡報維護](PPT/README.md)
- [素材來源索引](docs/assets/README.md)

GitHub Pages 只部署 `*.html`、`.nojekyll`、`src/`、`assets/`、`PPT/`、`videos/`。`output/` 中的其他影片版本與工作檔不會自動上線。

發布時另複製 `src/` 程式與樣式到網站根路徑，供舊版 HTML 快取相容；原始碼仍只維護 `src/`。
