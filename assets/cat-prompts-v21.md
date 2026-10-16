# 第 21 版：島上唯一的貓

使用內建 imagegen 製作透明 4 × 4 動作圖，保存為 `assets/island-cat-v21.png`，實際尺寸為 1254 × 1254。未使用 CLI／API。原始輸出為 `exec-20dc34cc-0487-4bbd-b4f2-701a2680a371.png`，保留於 Codex generated_images。

前三列依序為側面、正面與背面四格走路循環；最後一列是坐下、睡覺、理毛與伸懶腰。遊戲在讀圖時使用預先計算的非透明範圍定位各格腳下位置，原 PNG 保持不變。叫聲及呼嚕聲由 Web Audio 合成，沒有下載外部音檔。

遊戲只有一個 `IslandCat` 實體及一個 `location`。進屋、出屋時經過門口並淡出／淡入，再切換所在場景；房間之間必須先回到島上。位置在本次頁面使用期間持續更新，重新整理頁面才重新開始。

## 完整提示詞

Use case: stylized-concept. Asset type: transparent 4-by-4 animation sprite sheet for a small isometric browser game. Create ONE consistent adorable ginger-and-white shorthaired cat, plush miniature 3D rendered style, warm soft lighting, green eyes, white muzzle chest and paws, ginger striped back and tail, no collar or accessories. EXACT grid: square sheet, FOUR equal columns and FOUR equal rows, 16 evenly spaced full-body sprites. Each cell is exactly one cat pose. Same cat identity, size, camera elevation and lighting in all cells. ROW 1: right-facing SIDE VIEW walk cycle, four successive alternating four-legged steps. ROW 2: FRONT VIEW walk toward the viewer, four successive natural alternating steps. ROW 3: BACK VIEW walk away from the viewer, four successive natural alternating steps, clearly rear view. ROW 4 idle poses, left to right: sitting upright with tail curled; curled-up sleeping; sitting grooming one raised paw; low playful stretching with front legs extended and tail up. Maintain a fixed center in each cell and paws resting near 82 percent of cell height, all sprites entirely contained with generous transparent margins, tail never touching cell border. Gentle elevated isometric camera about 25 degrees looking down. For walk rows keep torso and head position consistent, animate legs subtly, no large jumps. Background MUST be genuine transparent alpha, including gaps between legs; no floor or ground, no baked shadows, no panels, no grid lines, no numbers, no labels, no text. High clarity fur shapes at small game size, clean silhouettes and solid intact bodies. 2048 by 2048 square sheet if possible.
