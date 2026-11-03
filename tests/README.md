# 測試程式

從專案根目錄執行，例如 `node tests/check-star-map.mjs`，不要先切換到 `tests/`。測試會讀取 `src/`、`assets/`、`PPT/`，輸出放在 `.preview/`。

## 常用且與目前功能對應的檢查

- `check-star-coordinates.mjs`：星位、日期、較小星座與畫面邊緣。
- `check-orbital-appearance.mjs`：日月尺寸與獨立軌跡。
- `check-ppt-filenames.py`：PPT 改名、快取及入口對應。
- `check-star-map.mjs`：瀏覽器星空、手機與 4K 顯示。
- `check-cloud-evolution.mjs`：雲形變化與背景 Worker。
- `check-design-ppt-links.mjs`、`check-verification-ppt-links.mjs`、`check-lab-workshop-ppt-links.mjs`：四個房間的簡報入口與畫面。

瀏覽器檢查使用 Chrome 的 `9338` 偵錯埠，需先啟動 `node scripts/serve.mjs`，並循序執行；不要平行跑多支。Chrome 路徑目前為 Windows 預設安裝位置。

31 支直接啟動 Chrome 的檢查共用 `helpers/chrome-profile.mjs`，結束時會關閉該測試啟動的瀏覽器並移除自己的暫存設定檔，避免再次累積數十 GB 快取；截圖仍留在 `.preview/`。

目錄也保留早期版本的特定行為測試；例如早期 NPC 走動、舊版版型與各版畫面比較，可能不符合後來已更改的產品規格。整理檔案時保留這些檢查作歷史依據，不為了讓它們通過而修改目前遊戲。
