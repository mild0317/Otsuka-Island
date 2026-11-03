# 來源核對與網站／工具交接

核對日期：2026-10-30（Asia/Taipei）。網頁與 README 可能更新，實際製作時記錄採用版本。本次只查閱文件，沒有驗證本機 GPU、安裝、推論或成片輸出。

## 1. 指定工具的職責

| 工具與官方來源 | 本專案採用方式 | 尚未驗證的部分 |
| --- | --- | --- |
| [OpenMontage](https://github.com/calesthio/OpenMontage) | 管理影片製作與合成；官方列有 Remotion／HyperFrames 及 FFmpeg 等流程，適合編排貼紙素材、文字、動態與音訊 | 本機能否直接運行、Windows 環境需求、具體版本如何匯入外部素材及 Qwen 適配器 |
| [Qwen-Image](https://github.com/QwenLM/Qwen-Image) | 生成工程貼紙物件與背景點綴；需保留人物身份的鏡頭使用其合適的編輯模型／參考圖能力 | 採用哪個可取得權重的模型、顯存需求、透明輸出或去背流程、角色一致性效果 |
| [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) | 中文角色配音；官方有 VoiceDesign／可復用參考聲音的路徑，可據此建立固定角色聲線 | 台灣華語自然度、術語讀音、長段一致性、實際可用模型與硬體效率 |

OpenMontage README 沒有列出 Qwen 對應項目，不能因此斷言所有程式碼都不支援，但也不能聲稱三者已原生串好。預定的穩妥路徑是「Qwen 先產出圖片與 WAV → OpenMontage 匯入及編排 → MP4」。先做短段實測再決定接法；遵守使用者指定工具，不默默換成其他製圖、配音或線上影片服務。

官方文件查閱入口：[OpenMontage 原始 README](https://raw.githubusercontent.com/calesthio/OpenMontage/main/README.md)、[Qwen-Image README](https://github.com/QwenLM/Qwen-Image#readme)、[Qwen3-TTS README](https://github.com/QwenLM/Qwen3-TTS#readme)。模型在其他主機是否發布，不等於這個工作區已安裝。實作時將程式環境、模型快取與網站原始碼分開，避免把大型權重提交到網站。

## 2. 產品能力核對

以下為範圍定位，不是口播逐字稿；實際影片不把官方銷售文案整段搬進去。

| 主題 | 可使用的產品定位 | 限制與官方來源 |
| --- | --- | --- |
| A1/A2/A3 | PADS／Xpedition 對應電子電路設計、板圖設計與元件資料流程 | 沿用使用者指定產品線，具體版本及資料庫／協作功能在製作腳本時再核對，不承諾每版具備所有功能。[Xpedition](https://www.siemens.com/en-us/products/pcb/xpedition/) |
| B1 | HyperLynx SA 用於原理圖邏輯及電氣問題檢查 | 不是所有功能與時序的完整實體驗証保證。[HyperLynx 官方產品族](https://www.siemens.com/en-us/products/pcb/hyperlynx/) |
| B2 | HyperLynx DRC 是以規則檢查板圖電氣風險的工具 | 提示項須判讀，不能取代全部模擬與量測。[HyperLynx 官方產品族](https://www.siemens.com/en-us/products/pcb/hyperlynx/) |
| B3 | Valor NPI 對應製造／組裝可行性與供應商製程條件 | 不等同產線機台程式準備，也不是只要檢查通過便保證所有良率。[Valor NPI](https://www.siemens.com/en-us/products/pcb/valor/valor-npi/) |
| C1 | HyperLynx SI 對應訊號完整性分析 | 用訊息品質與時序說明，不宣稱所有接口與所有模型都一鍵通過。[HyperLynx 官方產品族](https://www.siemens.com/en-us/products/pcb/hyperlynx/) |
| C2 | HyperLynx PI 涵蓋供電網路的 DC／AC 分析 | 分開說穩態壓降與動態供電需求，不把所有重啟都歸咎 PI。[HyperLynx PI](https://www.siemens.com/en-us/products/pcb/hyperlynx/power-integrity/) |
| C3 | PI 的電流／損耗資訊與熱分析可能形成協同流程 | 官方有 PI／Thermal co-simulation 內容及與 Flotherm XT 的案例；這不足以將所有板級與機箱 CFD 都歸於單獨 PI。指定版本、求解器與交付範圍待製作時確認，保留使用者的 PI 指定，不自行換產品。[Siemens 課程](https://training.plm.automation.siemens.com/ilt/iltdescription.cfm?pID=301056-US_____EDA__2409___1199)、[Siemens 電熱協同示例](https://www.youtube.com/watch?v=qWiV5oXncrE) |
| D1 | Valor Process Preparation 對應 PCB 組裝與測試準備 | 舊命名與目前 Process Preparation 系列有演變，功能依版型／模組。講資料交接與製程準備，不保證支援所有機台。[Siemens 舊版官方資料表](https://www.plm.automation.siemens.com/media/global/cz/Process_Preparation_tcm84-66385.pdf)、[目前 Process Preparation](https://www.siemens.com/en-us/products/tecnomatix/process-preparation-software/) |
| D2 | WISE GerbTool 對應 Gerber／鑽孔檢視、檢查、編輯與 CAM 準備 | 功能依配置；編輯輸出後仍需變更追蹤與設計來源的一致性。[WISE GerbTool](https://wssi.com/gerbtool/) |
| D3 | NX 與 Xpedition 的 ECAD／MCAD 協作 | 官方提及資料交換、3D 模型與變更預覽；不要說所有差異會自動無衝突合併。[Siemens ECAD／MCAD](https://www.siemens.com/en-us/products/pcb/digitally-integrated-and-optimized/ecad-mcad-codesign/) |

### 彼此不要混為一談

- A1「原理圖設計」是建立設計意圖；B1「原理圖驗証」是檢查是否存在邏輯／電氣矛盾。
- A2「Layout」是安排板上實體；B2「Layout 驗証」是掃描規則風險；C1/C2 是針對條件估計行為。
- B3「製造可行性」討論設計是否適合工廠能力；D2 是檢查與整理實際輸出的製板檔案；D1 是準備組裝與測試的工作資料。
- C2 主要問電送得是否穩；C3 主要問熱從哪來、往哪去，以及在指定環境下可能如何。

## 3. 現有網站入口對應（只供將來整合）

本機路徑：`E:\API\Otsuka-Island`。公開網址：<https://mild0317.github.io/Otsuka-Island/>。最後確認已發布 V99，提交 `a8cbfbad9f7116f85184c3dbeb001b3edea75c70`；整合時仍應查看當時 Git 與遠端狀態。

現有 `src/room-topics.js` 使用 `pptLinks`，實際 PPT 對應見 `PPT/decks.json`，圖片投影片由 `src/ppt-viewer.js` 呈現。替換時要建立影片對應資料，不能只把 `.pptx` 改為 `.mp4` 後繼續交給 PPT 轉檔器。

| 影片 | 現有房間 key | 現有入口 key | 預定公開檔名 |
| --- | --- | --- | --- |
| A1 | clock | clock | `A1-schematic-v01.mp4` |
| A2 | clock | clocktwo | `A2-pcb-layout-v01.mp4` |
| A3 | clock | clockthree | `A3-library-v01.mp4` |
| B1 | library | library | `B1-schematic-validation-v01.mp4` |
| B2 | library | librarytwo | `B2-layout-validation-v01.mp4` |
| B3 | library | librarythree | `B3-manufacturability-v01.mp4` |
| C1 | lab | lab | `C1-signal-integrity-v01.mp4` |
| C2 | lab | labtwo | `C2-power-integrity-v01.mp4` |
| C3 | lab | labthree | `C3-board-thermal-v01.mp4` |
| D1 | workshop | workshop | `D1-assembly-test-preparation-v01.mp4` |
| D2 | workshop | workshoptwo | `D2-cam-data-v01.mp4` |
| D3 | workshop | **目前沒有，需新增熱區及入口** | `D3-ecad-mcad-v01.mp4` |

檔名是規劃，不代表上述 MP4 已存在。D3 可提議新 key `workshopthree`，但目前尚未寫入程式。

### MP4 直接開啟的目標行為

- 使用可存取的 `.mp4` 網址作為連結，點擊後交由瀏覽器原生影片播放。連結不加 `download` 屬性，伺服器不要強制附件下載。
- 保持 `Content-Type: video/mp4`，啟用 faststart，驗證桌面及手機可實際播放、拖曳與返回浮空島。手機是否自動播放由瀏覽器決定，不把自動播放當成必要條件。
- 保留影片檔名與片名對照；不要因產品名稱或檔名更動就讓房內入口失聯。
- 不預先下載全部 12 支影片；進入房間可只預載封面與必要中繼資料。
- 現有 GitHub Pages workflow 複製 root 網頁與 `src/`、`assets/`、`PPT/`，**不會發布 `output/` 或另建的 `videos/`**。整合時需選定正式影片位置並更新部署來源，避免只有本機有檔、公開網址 404。
- 上線前查當時 hosting 檔案與容量限制。若 Git 儲存庫不適合長片，改存可直接存取 MP4 的檔案主機，同時保留本機實體交付；不能用影片平台觀看頁替代使用者要求的 MP4。

## 4. 新對話的第一步

先選一支的稿件與素材，不同時生成 12 支。A1 可作為第一支試製候選，用來確立貼紙視覺、角色聲線與字幕節奏，但這不是使用者已指定的製作順序。

此後需要確認的具體資訊包括本機 GPU／顯存與可用模型、角色聲線試音、C3 分析工具版本，以及 D3 新熱區位置。這些不妨礙現在先完成其餘白話腳本，也不應變成反覆要求使用者重述已定規格的理由。
