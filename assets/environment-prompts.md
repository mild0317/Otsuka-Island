# 環境素材生成記錄

使用內建 imagegen，參考原圖 `Otsuka-Island.jpg`，輸出為真實透明背景 PNG。原始 JPG 保持不變。

## assets/island-cutout.png

Use case: background-extraction. Edit target: supplied Otsuka-Island.jpg. Produce a precise isolated cutout of this EXACT floating island, TRUE TRANSPARENT background. Remove ONLY the uniform beige background and ALL fluffy WHITE CLOUDS (including clouds behind buildings, on both sides and around the bottom). Keep the original entire floating island, tower, three other buildings, trees, stairs, stone paths, waterfall, rocks, trailing vines and roots at EXACTLY the same positions, proportions, colors, perspective, lighting and details as original. Do not redesign, rearrange, or add anything. No clouds remain. Preserve entire full-height island and all protruding roots. Same tall portrait aspect ratio and original framing, transparent empty margins. This will be used as a foreground layer so separate clouds can animate BEHIND it. Invariant geometry and ground positions are critical.

## assets/cloud.png

Use case: stylized-concept. Asset type: single transparent background cloud sprite for a 2.5D floating island game. One wide fluffy white cloud cluster, soft 3D clay miniature diorama rendering, soft warm creamy white billowing rounded cotton puffs, six overlapping puff volumes, gently cool grey lavender shading on bottom and right, subtle ambient occlusion. No outline, no blue sky, no ground, no island, no rain, no face, no text. True transparent alpha background with clean soft edges. Cloud centered in wide landscape framing, plenty of transparent padding. Match the cozy photorealistic miniature toy render style of the floating island reference. Cloud has irregular organic fluffy silhouette, white lit top left and softly shaded bottom, not a flat illustration.
