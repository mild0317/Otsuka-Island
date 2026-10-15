# 第 07 版房間素材

使用內建 `image_gen.imagegen` 產生。每張獨立呼叫一次，以 `Otsuka-Island.jpg` 作為參考；未使用 API／CLI。原始生成圖保留在 Codex generated_images，專案另存 JPEG quality 94 供手機載入。

## 輸出檔案

- `assets/verification-island-v7.jpg`：937 × 1678，島上第三棟家具的來源圖。僅將第三棟室內多邊形合成回原始高解析度島圖，原圖檔不變。
- `assets/room-design-v7.jpg`：1536 × 1024，設計工作室。
- `assets/room-workshop-v7.jpg`：1536 × 1024，製作工坊。
- `assets/room-verification-v7.jpg`：1536 × 1024，驗証工作室。
- `assets/room-simulation-v7.jpg`：1536 × 1024，模擬實驗室。

## 島上第三棟修改提示詞

Use case: precise-object-edit. Edit target: the supplied entire floating island illustration. Change ONLY the interior furnishings of the THIRD building, the small red brick house with a pitched brown roof and tall arched amber windows on the LEFT MIDDLE tier (previously a library). Keep the entire island composition and ALL architecture, roof, tall arched windows, doors, exterior brick walls, balconies, stairs, plants, clouds and every other building unchanged, identical position and perspective, same tall image aspect ratio. Replace the bookshelves and reading desks visible inside this third building with a professional cozy electronics VALIDATION STUDIO: exactly TWO computer workstations on wooden benches, modern black displays showing luminous green PCB printed circuit board traces and a legible green 'PASS' result; a small oscilloscope, green circuit boards and probe test fixture, tidy cables. Keep warm wooden floor, warm wall lighting, clay miniature detailed 3D isometric diorama style of original. No people. Do not change the fourth glass dome or any water. Output at same aspect ratio, high detail. Exact required text on screens: 'PASS'. No other labels or captions. Preserve exterior silhouette precisely. The interior change must be very visible.

生成圖中較小的螢幕字樣以 Canvas 的 PCB 及 PASS 畫面覆蓋，確保文字清晰。

## 四張室內圖共同前綴

Use case: stylized-concept. Create one NEW high quality game interior background, using supplied island as STYLE AND BUILDING reference only. Cozy tactile miniature 3D clay and wood diorama, exquisite detailed small objects, soft warm natural daylight, clean perspective, high-end stylized game render. Landscape 3:2 composition. Show a spacious entire SINGLE room in a cutaway isometric view with open front, floor fully visible, walls at back and sides, close enough to appreciate objects. Room fills image, light warm cream backdrop, no UI, no borders, no collage, no people or characters, no watermarks. Leave the front-center floor clear for the blue-haired doctor character to stand. Architecture must visibly match the corresponding house in the reference. No excessive writing.

## 設計工作室後綴

Corresponds to TOPMOST red brick CLOCK TOWER. Design studio in clocktower: red brick and cream walls, steep timber rafters, tall rectangular warm wooden framed windows, large architect drafting table on left with crisp blue circuit and mechanical blueprints, brass ruler and compass, rolls of plans, pinboard of schematics. A big round analog clock and exposed brass clock gears high on rear wall. A smaller wood desk with one CAD monitor on the right. Color mood ink blue, warm oak, brass and terracotta. Different layout than all other rooms: main central sloped drafting table, plans cabinet, circular brass mechanism, vintage clockmaker design workshop.

## 製作工坊後綴

Corresponds to SECOND building, wide open red brick manufacturing WORKSHOP with a very high exposed pitched brown timber truss roof and arched windows. U-shaped wooden workbenches along rear and side walls filled with components, two elegant white articulated industrial robot arms on separate central worktables, spools of copper wire, soldering station, orderly component drawers, handtools on wall. One small CNC fabrication machine and a 3D printer to right. Work-in-progress small green printed circuit boards on benches. Color mood amber oak, orange copper, cream robot enamel. Floor clear in front. It must feel like the exact island's manufacturing house expanded inside, NOT an office or library.

## 驗証工作室後綴

Corresponds to THIRD LEFT SIDE red-brick house with a SINGLE sloping brown gable roof and especially TALL NARROW ARCHED amber wood framed windows. Electronics validation studio, brick and cream walls, warmly lit wood plank floor, exactly TWO computer workstations with contemporary black wide displays on wooden benches in an L arrangement, each display clearly visible facing camera. Left screen shows a luminous green detailed PCB schematic with traces and pads, right screen shows a green PCB layout and large correctly spelled 'PASS'. On desks green physical PCBs, oscilloscope, probe fixture and multimeter, tidy cables. Replace former library idea completely with quality engineering validation lab, a few technical binders but NO tall bookcases. Color mood deep forest green and warm wood, mint monitor light. Two arched windows, an arched timber entry at the left, low brick open-front parapet.

## 模擬實驗室後綴

Corresponds to FOURTH LOWEST glass DOMED building. Simulation laboratory inside a circular greenhouse-like futuristic GLASS DOME, pale mint green steel ribs curving upward, expansive curved glass walls and a small finial visible above. Outside windows softly blurred sky clouds and leaves. Curved workstation desks arranged around perimeter, several wide monitors with colorful engineering simulation contour fields, finite element meshes and waveform plots. Central circular projection table showing a delicate cyan wireframe electronic assembly digital twin, server racks low to the sides, stools, warm pale wood and cream circular floor with soft green accents. Rich turquoise glass highlights. Distinct circular architecture, NO brick gable, no plants as main activity, focus on simulation engineering.
