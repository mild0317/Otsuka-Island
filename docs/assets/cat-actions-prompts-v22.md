# 貓的動作素材 v22

使用內建 image_gen，以 `island-cat-v21.png` 保留原貓外觀，新增正式素材 `assets/cat-actions-v22.png`。輸出 PNG 透明通道保留，原稿未改動。

原稿：`C:/Users/34610/.codex/generated_images/01a13e37-efbe-7913-97f9-3a095a6fb9bc/exec-165c098d-7cc9-446d-a1aa-5883a907dca8.png`。

透過 alpha ≥ 48 的連通區取得每隻完整貓的範圍，沒有按固定格線切斷尾巴、手腳或耳朵：

| 姿勢 | x,y,width,height |
| --- | --- |
| 奔跑伸展 | 30,83,519,348 |
| 奔跑收腿 | 580,86,411,360 |
| 起跳 | 1031,83,492,341 |
| 清醒趴著 | 37,614,501,292 |
| 後腳抓耳 | 598,523,400,393 |
| 攀爬 | 1102,471,424,479 |

新素材與原本的走路、坐下、理毛、伸懶腰、蜷睡共用同一隻貓；位移、跳躍弧線、蹲身、落地與姿勢轉換由程式連續計算。

## 完整提示詞

Use case: identity-preserve. Reference: the same adorable orange-and-white tabby kitten in the input sprite sheet, green eyes, pink nose, white muzzle chest and paws, orange striped fur, fluffy orange tail with white tip. Create a transparent GAME SPRITE SHEET of this SAME SINGLE CAT in SIX poses, in a strict 3-column by 2-row equal cell grid. Same body size and warm polished miniature 3D cartoon rendering. Every cell has exactly one COMPLETE cat with generous transparent gaps, no body crossing cells. Row 1 left: side view facing RIGHT, galloping run extended body, front and back legs reaching opposite directions. Row 1 middle: same side-right running cat in compact gathered gallop phase, legs tucked naturally. Row 1 right: same side-right cat leaping, forepaws stretched forward, hind legs back, tail for balance. Row 2 left: cat lying on belly with both forepaws forward, head upright, eyes OPEN alert, clearly resting awake rather than sleeping. Row 2 middle: sitting cat SCRATCHING ITS EAR WITH A RAISED HIND PAW, head tilted slightly, forepaws on ground, visible scratching foot and ear contact, eyes relaxed. Row 2 right: cat climbing toward upper-right, front paws raised and gripping an unseen vertical ledge, hind paws braced, viewed from side/back with intact natural anatomy. No duplicated limbs or extra tails. Keep exact original cat identity. Genuine transparent alpha background, no floor, no contact shadows, no scenery, no furniture, no labels, no letters, no grid lines. Landscape sheet with six separate poses only.
