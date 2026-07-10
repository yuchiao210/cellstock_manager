# Cell Stock Manager / 細胞凍管管理系統

*[Read this in English](README.md)*

實驗室用的細胞凍管庫存管理系統，取代容易出錯的 Excel 表格管理方式，讓每一支凍管的進出都留下完整、可追溯的紀錄。

## 為什麼做這個專案

用 Excel 管理細胞凍管庫存常見的問題：

- 沒有存取紀錄，無法追蹤是誰、什麼時候取用或放回了哪一管
- 表格內容與冷凍櫃裡的實際狀況經常不一致，容易發生「表格上還有、但槽位已經空了」的情況
- 多人共用同一份表格，覆蓋修改、版本衝突難以避免
- 找空位、找特定細胞系全靠人工翻找，效率低且容易看錯

Cell Stock Manager 用一個輕量、可自架的網頁系統取代 Excel，把每一次登錄、存取、歸還都寫入資料庫並留下操作紀錄，讓庫存資料和實驗室現場保持一致。

## 功能特色

- **查詢 / 存取**：搜尋既有細胞系並記錄取用、歸還
- **登錄新細胞系**：建立新的細胞株與凍管資訊
- **空位查詢**：快速找出冷凍櫃中可用的空槽位
- **操作記錄**：完整的存取/異動歷史，可追溯到操作者與時間
- **異常待辦**：標記並追蹤資料異常（例如紀錄與實際不符）待處理事項
- **維護模式**：管理員權限功能，用於資料維護與系統設定

## 畫面預覽

<table>
<tr>
<td><img src="screenshots/firstlogin.png" width="400"><br>首次使用：輸入操作者姓名</td>
<td><img src="screenshots/search-page.png" width="400"><br>查詢 / 存取</td>
</tr>
<tr>
<td><img src="screenshots/register-page.png" width="400"><br>登錄新細胞系</td>
<td><img src="screenshots/maintenance-mode.png" width="400"><br>維護模式：Dewar / Rack / Box 視覺化管理</td>
</tr>
</table>

## 技術架構

- 前端：純 HTML / CSS / JavaScript（無框架依賴）
- 後端：PHP + SQLite
- 部署：Docker（僅支援 Docker，本專案不提供手動安裝方式）

## 快速開始

本專案只透過 Docker 部署，資料庫、權限、PHP 擴充套件都在容器裡處理好，不需要自己設定 Web Server 或 PHP 環境。

### 方法一：Synology NAS（推薦，沒有程式背景也可以照著做）

參考 [`SYNOLOGY_DOCKER_INSTALL.zh.md`](SYNOLOGY_DOCKER_INSTALL.zh.md)，全程使用 DSM 的 **Container Manager** 圖形介面操作，不需要打指令。

### 方法二：其他平台（有基本指令經驗）

1. 複製 `.env.example` 為 `.env`，填入連接埠、管理員帳密、實驗室名稱
2. 在本專案根目錄執行：

```bash
docker compose up -d --build
```

3. 開啟 `http://<主機IP>:<CELLSTOCK_HTTP_PORT>/cell-stock-manager.html`

資料庫與備份分別存放在 `cellstock-data`、`cellstock-backups` 兩個 Docker named volume 裡，重建 image 不會遺失資料。

## 資料與備份

系統資料儲存於 SQLite 資料庫，並提供自動備份機制（詳見 `SYNOLOGY_DOCKER_INSTALL.zh.md` 中的備份說明）。正式使用前請確認備份流程符合實驗室資料保存需求。

## 授權

本專案採用 [MIT License](LICENSE) 授權。

Copyright (c) 2026 YuChiao Lin

## 作者

YuChiao Lin
