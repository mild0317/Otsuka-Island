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

## V105 (2026-11-24)

All 11 completed English videos are published, replacing the current video routes. C2 remains the 32-slide presentation on the left monitor; C1 stays on the central PCB. Workshop D1 and D2 now play videos, and D3 is added on the right equipment outline. Video playback remains embedded, inline, with no automatic fullscreen. Source files are copied unchanged.

| ID | File | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| A1 | `A1-schematic-v03-en.mp4` | 10175479 | `0b438d03e3b9f1e063b41b3374fd805a9f8fcfbbc67c10fd77c51d9bef13de6a` |
| A2 | `A2-pcb-layout-v01-en.mp4` | 11545786 | `69dad8831ec984baeee84c0a51b36eea60b9a58e0a06767e619e1d5bfe75f424` |
| A3 | `A3-library-v07-en.mp4` | 15014841 | `00865ae8fc1a48f7e1769cd301b1a99a80a40c3cffe24cbaaceda2029d2241ce` |
| B1 | `B1-schematic-validation-v10-en.mp4` | 11854565 | `2e917517bd52473ac72ae960a14b93260e81a01b80c48cda8749bdaa98c0ebac` |
| B2 | `B2-layout-validation-v06-en.mp4` | 14051801 | `91369f2efa44ef6e4b2f9d665c2cbf27ba8c9fea7e2a5f6df3793f94d2066fe8` |
| B3 | `B3-manufacturability-v02-en.mp4` | 14298830 | `45491c5f2ad5797d5f7ae058e0a21c61e2b1f778da5ad24a2f87e7071dea8586` |
| C1 | `C1-signal-integrity-v03-en.mp4` | 15046288 | `447cde556e9abf013b7e20b9e1d3ef12f3843902ce0a973d9f1c3a7fa2e6bdd1` |
| C3 | `C3-board-thermal-v01-en.mp4` | 14362152 | `7f9fdd27a78176d4c4f45419808779fe5013335897af33337b1a86451f76488a` |
| D1 | `D1-assembly-test-preparation-v02-en.mp4` | 13638355 | `113bbadba55976f39b2fef14ab84ffa2a66d01047d0b35fbc5e41cbabcef85e6` |
| D2 | `D2-cam-data-v03-en.mp4` | 12654370 | `db41f0bef957a05528879e657d6aa2d87e5c95d6c145f93003ce5c0008d8aa49` |
| D3 | `D3-ecad-mcad-v06-en.mp4` | 13814665 | `aeb2640cd4eee4e7c202ae2437a166bc481d271232dc2df1554f673188e7c3d6` |
