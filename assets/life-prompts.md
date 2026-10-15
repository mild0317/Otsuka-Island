# 室內與小鳥素材生成記錄

使用內建 imagegen；原始 JPG 保持不變。島嶼繪製使用原始 1536 × 2752 圖片的 RGB 細節，搭配既有去背遮罩。

## assets/sparrow-states.png

Use case: stylized-concept. Asset: transparent small sparrow bird animation sprite sheet for a 3D clay miniature floating island game.
Exactly EIGHT sprites, perfectly regular FOUR columns by TWO rows of equal SQUARE cells. Transparent background. NO text, no grid lines, no ground, no shadows, no branches.
All frames show the SAME cute small natural sparrow, warm brown-grey crown/back and wings, cream belly, small dark eyes, tiny yellowish beak, short dark feet, facing RIGHT in a side / slight three-quarter view. Soft physically shaded 3D toy rendering to match the reference floating island. Not a cartoon outlined icon. Not a penguin. Small elegant rounded sparrow proportions.
Top row, left to right: (0) flying wings fully UP, (1) flying wings horizontal at mid stroke, (2) flying wings fully DOWN, (3) gliding with wings stretched slightly back. Bottom row: (4) standing perched neutral with both feet planted, (5) standing looking back slightly, (6) standing with head lowered pecking, (7) standing alert preparing to launch.
CRITICAL: identical body size and body center position in every cell, no scaling between frames. The standing feet baseline is at 75 percent of cell height. Flight body is at the same center as standing body, all wing tips completely contained with padding. Keep clean soft true alpha edges. Upper row is one coherent wingbeat cycle; lower row is subtle perch poses. The sprite sheet is a wide 2:1 canvas.

## assets/workshop-clean.png

Use case: precise-object-edit. Edit target: Otsuka-Island.jpg.
Make a clean background plate for animation: REMOVE ONLY the TWO small white/grey robotic manipulator arms mounted on the TWO foreground wooden worktables inside the red-brick open workshop on the middle RIGHT of the island. Keep their black or grey circular bolted BASES on the tables. Fill in the removed upper arm links, elbows and grippers with the wooden table surfaces, dark floor, electronics or walls actually behind them. Keep the third tiny robot or all other equipment as-is.
Strict invariants: entire island image composition, exact framing, all buildings, trees, water, static white waterfall foam, stairs, paths, roof geometry, furniture, screens, cables, shadows and colors MUST stay aligned and unchanged. Do not repaint the whole scene. Only remove those two foreground robot upper arm mechanisms so new animated arms can be drawn over their bases without a duplicate static arm underneath. Preserve the beige opaque background and all existing clouds. Same tall aspect ratio, full image un-cropped, no text.
