# 房間簡報維護

| 房間 | 維護檔名 |
| --- | --- |
| 設計工作室 | 設計_1.pptx |
| 製作工坊 | 製作_1.pptx |
| 驗証工作室 | 驗証_1.pptx |
| 模擬實驗室 | 模擬_1.pptx |

用 PowerPoint 修改或替換上述同名檔案，再將 PPT 檔同步到 GitHub 的 main 分支。GitHub Actions 會自動轉為 4K 投影片並發布；不用修改 HTML 或 JavaScript。只修改電腦裡的檔案還不會更新公開網站。

建議使用 GitHub Desktop 同步：在本機替換 PPT 後，提交變更並按 Push origin。製作簡報目前超過 GitHub 網頁單檔上傳的 25 MiB 限制，請用 GitHub Desktop 或 git push。其餘較小檔案也可以在 GitHub 的 PPT 資料夾使用「Add file → Upload files」上傳同名檔。發布進度在專案 Actions 頁查看，成功後重新整理網站。

本機預覽：關閉正在編輯的簡報後，在專案目錄執行 `powershell -ExecutionPolicy Bypass -File scripts/export-ppt.ps1`，再開啟本機網頁伺服器。此方式使用電腦已安裝的 PowerPoint。

公開網站使用 LibreOffice 自動轉檔，少數特殊字型或排版可能與 PowerPoint 有差異。投影片以靜態頁面顯示，保留文字與圖片；動畫、嵌入影片及轉場不會播放。投影片可左右翻頁、鍵盤切換或手機滑動。簡報與網站同樣公開，請只放可提供客戶閱覽的內容。
