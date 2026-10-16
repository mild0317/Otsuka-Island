# 房內人物工作動作 v23

使用內建 image_gen，未使用 API／CLI。九張正式素材皆為 1536 × 1024 透明 PNG，每張一列三格。透明 alpha 原樣保留，沒有以程式重畫臉或拼接身體。原始八視圖保留在工作區。

## 正式素材

原稿資料夾：`C:/Users/34610/.codex/generated_images/01a13e37-efbe-7913-97f9-3a095a6fb9bc/`。選定結果複製進 `assets/`，原稿保留。

| 專案檔案 | 生成原稿 |
| --- | --- |
| `npc-princess-seats-v23.png` | `exec-ceb08ab3-3737-4842-91b8-3013bd78fce6.png` |
| `npc-princess-gestures-v23.png` | `exec-7bfc2209-ae59-481e-8712-a2d6f1abf198.png` |
| `npc-princess-views-v23.png` | `exec-c1e8dc8b-ff0d-43da-bef2-2a4554028eca.png` |
| `npc-anthony-seats-v23.png` | `exec-e4b376ba-9993-4c4f-836d-406087c0a301.png` |
| `npc-anthony-gestures-v23.png` | `exec-0473b03d-bfa2-4903-997a-d3a9168c6f71.png` |
| `npc-anthony-views-v23.png` | `exec-9647ac1b-9728-447f-8cf0-3f321088afbe.png` |
| `npc-hank-seats-v23.png` | `exec-f3505aad-8638-4da1-bc5c-e49468e3c247.png` |
| `npc-hank-gestures-v23.png` | `exec-b0149c99-f3e2-4fe5-b6b7-c3774fc1094d.png` |
| `npc-hank-views-v23.png` | `exec-53f802a1-c970-4f27-967b-766ef53c135f.png` |

## 小公主與安東尼的製作提示詞規格

Use case: identity-preserve. Asset type: high-detail transparent character pose strip for an isometric EDA room game displayed in 4K. Use the original eight-view character sheet as the authoritative identity reference. Preserve the exact stylized 3D cartoon face, oversized expressive head, hair, eyes, glasses if present, body proportions and clothing. Three equal cells in one horizontal row, full head-to-shoes in every cell, generous transparent margins, no limb crossing a cell boundary. Consistent head size and shoe baseline. No labels, background, furniture or cast shadows. A seated person must naturally be shorter than the standing person, not enlarged to fill the cell.

小公主使用 `小公主_3D_八視圖.png`：保留長棕髮、黑色上衣、白色百褶裙、橘色掛繩識別證及黑靴，工作朝左上方。安東尼使用 `安東尼_3D_八視圖.png`：保留短黑髮、深色眼鏡、細條紋淺色襯衫、深色長褲與黑鞋，工作朝右上方。

三張的動作要求：

1. **seats** — Left: sitting on an invisible chair, knees bent, hands typing forward; middle: halfway rising from that chair, knees partly bent; right: fully standing, hands forward at workstation height. Same facing, identity, head size and foot baseline. Do not draw the chair or desk.
2. **gestures** — Left: scratching the head thoughtfully; middle: arms folded thinking; right: hands cradling an unseen small PCB/tablet at lower chest, gaze down at the hands. Full standing bodies, no prop drawn.
3. **views** — Left: front three-quarter neutral standing; middle: rear three-quarter neutral standing; right: side profile neutral standing, arms relaxed down. Preserve face and clothes. No walking trail or duplicate limbs.

## Hank 身份修正完整提示詞

三次皆使用 `Hank_3D_八視圖.png` 為 reference 1，`npc-hank-work-v22.png` 為 reference 2，`transparent_background: true`。初次未保留卡通身份的三張變體已淘汰，未加入網站。v22 圖僅參考服裝，臉型與頭身比例以原八視圖為準。

共用前綴：

```text
Identity-preserving EDIT of Hank from reference 1 (the authoritative original cartoon eight-view sheet). Preserve EXACT original stylized 3D CARTOON identity: same oversized expressive head, large brown eyes behind dark rectangular glasses, rounded cheeks and nose, broad friendly cartoon smile, swept black hair, short cartoon body proportions. Do NOT turn him into a photoreal adult or normal small-headed realistic man. Reference 2 is CLOTHING ONLY: white knee-length lab coat over pale blue shirt, dark trousers and black shoes; do not use its head proportions. Output a transparent PNG sprite strip, landscape 1536x1024, THREE equally spaced full-body characters in ONE ROW, generous alpha margins, each completely contained in its own one-third cell, no labels or backgrounds or shadows or furniture. Same original cartoon person and same head size across all three. Shoe baseline same across cells; seated character is naturally shorter, not rescaled to standing height. Warm polished 3D game render matching reference 1.
```

seats 後綴：

```text
Left: sitting on an invisible chair, knees bent, shoes on floor, facing upper-left in rear/side three-quarter, hands naturally reaching forward typing. Middle: halfway rising from that chair, knees partly bent, same facing. Right: standing fully upright same facing, hands forward at workstation height. No chair or desk is drawn. Keep the original cartoon face visible enough in side view to establish identity.
```

gestures 後綴：

```text
All standing, facing upper-left in three-quarter SIDE view (not full back), same cartoon face visible. Left: scratching the side of his head thoughtfully with one hand. Middle: arms folded across chest thinking. Right: both hands close together cradling an unseen small PCB at lower chest, eyes looking at hands; NO prop drawn.
```

views 後綴：

```text
All standing neutral arms relaxed down. Left: front three-quarter facing slightly right, original recognizable friendly cartoon face. Middle: rear three-quarter facing upper-right. Right: right-facing profile. Same big cartoon head and short cartoon body proportions as reference 1.
```

## 動畫與設定

`npc-renderer.js` 記錄透明界線與腳底錨點。坐姿依同張第三格站姿尺寸換算，避免坐下時頭變大。人物使用共享頂點的完整貼圖網格，先分別繪製，再做姿勢與轉向過渡，不切開博士服。站立、半起身、坐姿依序銜接。

`npc-routines.js` 保存工作站、椅面位移、鍵盤接觸點、任務權重與時間範圍。`npc-life.js` 保存同一次開頁中持續的任務、位置、唯一物品狀態與避讓。PCB、零件盤、平板及紀錄板為 Canvas 繪製的可移動道具。
