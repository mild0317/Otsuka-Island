# 第 18 版：移除工坊前小展示桌

依使用者指定，移除整張小木桌、PCB、桌腳與投影，恢復連續石板廣場並保留前景欄杆。使用內建 `image_gen.imagegen` 編修 `assets/island-detail-workshop-v14.jpg`，未使用 CLI／API。輸出實際為 1254 × 1254，另存 JPEG quality 95 為 `assets/workshop-terrace-clean-v18.jpg`。遊戲只合成世界座標 x=680..792、y=1015..1120 的局部範圍，其餘工坊沿用原高細節貼圖。

原始輸出：`exec-3c0f37d7-eac2-477d-ba8b-54f561633ad7.png`，保留於 Codex generated_images。

## 完整提示詞

Use case: precise-object-edit. Edit target: supplied square isometric floating-island PCB workshop tile. Remove ONLY the SMALL standalone wooden display table with green PCB on it on the FOREGROUND stone terrace, in the lower-left quadrant, just behind the curved black metal railing. Remove the entire little table, its tabletop, every leg, green circuit board and its cast shadow. Restore continuous pale gray-beige rectangular stone paving there, matching the surrounding perspective, grout, stone texture and warm light. This part of the terrace must be completely empty paving. Do NOT remove or change either of the TWO LARGE PCB WORKBENCHES INSIDE THE BUILDING. Preserve the foreground curved black metal railing, every railing upright, the left stone bridge/post, ivy, all large furniture, wood floor, monitors, roof, windows, wire reels, glass-dome tip and every other object exactly unchanged. Registered texture invariants: preserve exact square framing, camera, perspective, all object positions and edges. No reframing or zoom. Sharp miniature 3D style and original high detail. Same dimensions/aspect as input. No new furniture, no bird, no person, no lettering or white outline.
