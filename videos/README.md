# 公開影片

`A1-schematic-v03-bg.mp4` 是使用者於 2026-11-03 選定的第一支成片，原檔位於 `output/video-series/A1/`。公開副本完全相同，沒有重新編碼或修改內容。

- 入口：設計工作室，左側麵包板／主題清單的「原理圖設計」。
- 行為（V101）：在網站原有內容視窗內嵌播放 MP4，保留標題、外框與「返回房間」。使用原生播放控制及 `playsinline`，不自動跳到獨立影片頁或全螢幕。
- 影片：1920×1080，實測約 94.955 秒，11,614,603 bytes，已包含 faststart。
- SHA-256：`23be44027b830ac5b62e64414bc583fa83729768d67512a915890354638c0999`。

此片依使用者本次決定上線，長度不同於早期企劃的 2–5 分鐘；後續企劃與其他影片不在本次替換範圍內。

GitHub Pages 會發布此資料夾；`output/` 中其他版本、原始製作素材及工作檔不會因此上傳。

## V102 (2026-11-06)

Four additional selected MP4 files play inside the existing website dialog; no automatic fullscreen. Original files are copied without re-encoding.

| Entry | File | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| A2 / PCB Layout | `A2-pcb-layout-v01-bg.mp4` | 13176687 | `64a8afbd2ce8281c43cedcd28f8d2140102cb3bbdc34f2489aa1e3000a91bc36` |
| A3 / Library | `A3-library-v07-bg.mp4` | 17235565 | `52a7498e25cc9a1aea934095d608519bb204200f3b8a853ad1b133db49fb896f` |
| B1 / Schematic validation | `B1-schematic-validation-v10-bg.mp4` | 13577652 | `3390d6fff2d984a362949a6c601c089e21a618b0dedf6194b9e222452fb12b94` |
| B2 / Layout validation | `B2-layout-validation-v04-bg.mp4` | 16321889 | `9ee38becd5f38a13952df263d22920ec43ec5785e782dc902d1eaf6facdf183f` |

## V103 (2026-11-09)

B3, C1 and C3 use the existing embedded player; C2 remains an in-page PowerPoint with 32 rendered slides. Selected originals are preserved without re-encoding.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `B3-manufacturability-v02-bg.mp4` | 16364086 | `3f0006c32028f6db6444e8fd0698b39ac37a1289896f6db8d669b017f120fc1d` |
| `C1-signal-integrity-v03-bg.mp4` | 17173641 | `b6f71187b1b8245e6c07217262d1efff280d4932f617ab2167f59f456e2d2843` |
| `C3-board-thermal-v01-bg.mp4` | 16384676 | `931c7ce4100c45a2e6b2f4783a77ac15038bb85999adba15c759bd9ef38c7208` |

C2 source exceeds the GitHub 100 MB file limit. Its original is retained locally in `output/video-series/C2/` and `PPT/`; deployment uses the 32 original PowerPoint-exported slides. `PPT/rendered-only.json` pins the source SHA-256 and requires a complete matching slide cache. No original PPTX download is offered.
