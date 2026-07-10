# Cell Stock Manager：Synology NAS Docker 安裝教學

*[Read this in English](SYNOLOGY_DOCKER_INSTALL.md)*

這份教學寫給沒有程式背景的生科研究者。目標是把 Cell Stock Manager 安裝在 Synology NAS 上，讓實驗室成員用瀏覽器開啟一個網址，就能查詢、登錄、取出、存入細胞凍管。

本教學使用 Synology DSM 7 的 **Container Manager**。如果你的 NAS 還在 DSM 6，套件名稱可能叫 **Docker**，畫面會不太一樣，建議先升級 DSM 或請熟悉 NAS 的同事協助。

---

## 0. 你會得到什麼

安裝完成後，實驗室內網使用者可以用類似下面的網址開啟系統：

```text
http://你的NAS-IP:8080/cell-stock-manager.html
```

例如：

```text
http://192.168.1.50:8080/cell-stock-manager.html
```

資料會儲存在 NAS 的 Docker volume 裡，不會因為關掉網頁或重開 NAS 就消失。

---

## 1. 安裝前準備

請先準備：

1. 一台 Synology NAS，DSM 7 以上。
2. 你可以登入 DSM 管理介面。
3. 你的 DSM 帳號有管理員權限。
4. 已取得專案檔案：到 <https://github.com/yuchiao210/cellstock_manager> 點 **Code → Download ZIP**（解壓縮），或用 `git clone` 下載。
5. 知道 NAS 的 IP 位址，例如 `192.168.1.50`。

如果不知道 NAS IP：

1. 在瀏覽器登入 DSM。
2. 打開「控制台」。
3. 找「網路」或「網路介面」。
4. 查看目前 LAN 的 IP 位址。

---

## 2. 安裝 Container Manager

1. 登入 DSM。
2. 打開「套件中心」。
3. 搜尋 `Container Manager`。
4. 按「安裝」。
5. 安裝完成後，主選單會出現 **Container Manager**。

如果你找不到 Container Manager：

- 你的 NAS 型號可能不支援 Docker。
- 或 DSM 版本太舊。
- 或套件中心來源尚未更新。

---

## 3. 建立專案資料夾

建議把 Docker 專案放在 NAS 的 `docker` 共享資料夾裡。

1. 打開 DSM 的「File Station」。
2. 看左側是否有 `docker` 共享資料夾。
3. 如果沒有：
   - 打開「控制台」。
   - 進入「共用資料夾」。
   - 新增共用資料夾，名稱填 `docker`。
4. 在 `docker` 裡建立一個資料夾：

```text
cellstock
```

最後路徑大約會是：

```text
/volume1/docker/cellstock
```

實際 volume 編號可能是 `/volume2`，依你的 NAS 而定，畫面上看到即可。

---

## 4. 上傳專案檔案

先取得專案檔案：到 <https://github.com/yuchiao210/cellstock_manager> 點 **Code → Download ZIP** 並解壓縮，或用 `git clone` 下載。

請把專案最上層的所有內容上傳到剛剛建立的 NAS 資料夾：

```text
docker/cellstock
```

上傳完成後，資料夾內容應該看起來像這樣：

```text
cellstock/
├── .env.example
├── Dockerfile
├── README.md
├── docker-compose.yml
├── app/
└── docker/
```

請注意：`docker-compose.yml` 必須直接放在 `cellstock` 資料夾裡，不要多包一層資料夾。從 GitHub 下載的 ZIP 通常會解壓成像 `cellstock_manager-main/` 的子資料夾；若是這樣，請把裡面的內容往上移，讓 `docker-compose.yml` 直接位於 `cellstock` 底下。

錯誤範例：

```text
docker/cellstock/cellstock_manager-main/docker-compose.yml
```

正確範例：

```text
docker/cellstock/docker-compose.yml
```

---

## 5. 建立 `.env` 設定檔

`.env` 是這個系統的基本設定檔，裡面會放網頁連接埠、管理員帳號、管理員密碼、實驗室名稱。

### 方法 A：用 File Station 複製檔案

1. 在 File Station 進入 `docker/cellstock`。
2. 找到 `.env.example`。
3. 複製一份。
4. 把複製出來的檔案重新命名成：

```text
.env
```

如果 File Station 不容易建立開頭是 `.` 的檔名，可以先在自己的電腦建立 `.env` 檔，再上傳到 NAS。

### `.env` 內容

請把 `.env` 編輯成類似下面：

```env
CELLSTOCK_HTTP_PORT=8080
CELLSTOCK_ADMIN_USERNAME=admin
CELLSTOCK_ADMIN_PASSWORD=請改成你自己的強密碼
CELLSTOCK_LAB_NAME=你的實驗室名稱
CELLSTOCK_DEFAULT_LANG=en
```

範例：

```env
CELLSTOCK_HTTP_PORT=8080
CELLSTOCK_ADMIN_USERNAME=admin
CELLSTOCK_ADMIN_PASSWORD=FCTlab-CellStock-2026
CELLSTOCK_LAB_NAME=FCT Lab
CELLSTOCK_DEFAULT_LANG=zh
```

### 每一行是什麼意思

| 設定 | 說明 | 建議 |
|---|---|---|
| `CELLSTOCK_HTTP_PORT` | 網頁使用的連接埠 | 通常用 `8080` |
| `CELLSTOCK_ADMIN_USERNAME` | 維護模式管理員帳號 | 可先用 `admin` |
| `CELLSTOCK_ADMIN_PASSWORD` | 維護模式管理員密碼 | 一定要改掉 |
| `CELLSTOCK_LAB_NAME` | 頁面上方顯示的實驗室名稱 | 填你的 lab 名稱 |
| `CELLSTOCK_DEFAULT_LANG` | 首次進入時的預設介面語言（`en` 或 `zh`） | 未填則預設 `en`；日後可在維護模式修改 |

密碼建議：

- 至少 10 個字元。
- 包含英文和數字。
- 不要使用 `admin`、`password`、`12345678`。
- 不要把正式密碼貼在公開文件或群組聊天。

---

## 6. 用 Container Manager 建立專案

1. 打開 DSM 的 **Container Manager**。
2. 點左側「專案」。
3. 按「建立」。
4. 專案名稱填：

```text
cellstock
```

5. 路徑選擇剛剛的資料夾：

```text
/volume1/docker/cellstock
```

6. Container Manager 應該會自動找到：

```text
docker-compose.yml
```

7. 如果畫面有「來源」或「Compose 檔案」選項，請選剛剛資料夾內的 `docker-compose.yml`。
8. 按「下一步」。
9. 若畫面顯示 `.env` 相關設定，確認它有讀到 `.env`。
10. 按「完成」或「建立」。

第一次建立時，NAS 會開始建置 image，可能需要幾分鐘。這是正常的。

---

## 7. 確認容器已啟動

1. 在 Container Manager 左側點「容器」。
2. 找到：

```text
cellstock-manager
```

3. 狀態應該是「執行中」或 `running`。

如果看到「已停止」或一直重啟：

1. 點進 `cellstock-manager`。
2. 找「日誌」或 `Log`。
3. 看是否有錯誤訊息。

最常見原因是 `.env` 沒有設定密碼：

```text
CELLSTOCK_ADMIN_PASSWORD
```

如果日誌看到類似：

```text
CELLSTOCK_ADMIN_PASSWORD is required
```

請回到 `.env` 補上密碼，然後重新啟動專案。

---

## 8. 開啟 Cell Stock Manager

在同一個實驗室網路中的電腦，打開瀏覽器，輸入：

```text
http://你的NAS-IP:8080/cell-stock-manager.html
```

例如：

```text
http://192.168.1.50:8080/cell-stock-manager.html
```

如果你在 `.env` 把 `CELLSTOCK_HTTP_PORT` 改成其他數字，例如 `8090`，網址也要跟著改：

```text
http://192.168.1.50:8090/cell-stock-manager.html
```

---

## 9. 第一次使用

第一次開啟系統時，畫面會要求輸入操作者姓名。

### 中文使用者

輸入中文全名，例如：

```text
王小明
```

中文模式規則：至少 2 個中文字。

### 英文使用者

姓名視窗右上角有 `EN` 按鈕，可以先切換成英文。

英文模式規則：

- 至少 2 個英文字母。
- 可使用空格、`.`、`'`、`-`。

可接受範例：

```text
Yu
Anne-Marie
O'Neil
Y C
```

---

## 10. 進入維護模式

維護模式用來修改庫存資料、處理異常回報、改管理員密碼。

1. 開啟 Cell Stock Manager。
2. 點上方「維護模式」。
3. 輸入 `.env` 裡設定的帳號密碼：

```text
CELLSTOCK_ADMIN_USERNAME
CELLSTOCK_ADMIN_PASSWORD
```

4. 登入後，建議立刻點右上角「變更密碼」。

請記得：`.env` 裡的密碼主要是第一次初始化用。之後如果你在網頁裡改了管理員密碼，系統會使用資料庫裡的新密碼。

---

## 11. 檢查安裝狀態

可以開啟：

```text
http://你的NAS-IP:8080/setup.php
```

這個頁面會檢查：

- PHP 是否正常。
- SQLite 資料庫是否正常。
- 資料庫是否可寫入。
- 備份資料夾是否可寫入。

正式使用後，建議不要讓非管理者知道 `setup.php` 的網址。

---

## 12. 資料保存在哪裡

這個 Docker 安裝方式會用 Docker volume 保存資料。

| 資料 | 位置 |
|---|---|
| SQLite 資料庫 | Docker volume：`cellstock-data` |
| 自動備份 | Docker volume：`cellstock-backups` |

你不需要手動管理 SQLite。一般使用者只需要定期備份即可。

---

## 13. 手動備份資料庫

最簡單的備份方式是使用 Container Manager 的終端機。

1. 打開 Container Manager。
2. 點「容器」。
3. 點 `cellstock-manager`。
4. 找「終端機」或 `Terminal`。
5. 建立一個終端機工作階段。
6. 輸入：

```sh
cp /data/cellstock.sqlite /var/www/html/backups/cellstock-manual-$(date +%Y%m%d-%H%M%S).sqlite
```

備份檔會放到備份 volume 裡。

如果你不熟悉終端機，建議請會管理 NAS 的同事協助設定定期備份。

---

## 14. 更新程式

更新前請先備份資料庫。

更新流程：

1. 停止 Container Manager 裡的 `cellstock` 專案。
2. 用新版檔案覆蓋 `docker/cellstock` 裡的程式檔。
3. 確認 `.env` 沒有被覆蓋。
4. 回到 Container Manager。
5. 重新建置或重新啟動專案。

資料庫存在 Docker volume 裡，正常情況下不會因為重新建置 image 而消失。

但仍然建議更新前先備份。

---

## 15. 匯入既有資料庫

這一節適用於：你手上已經有一個 `cellstock.sqlite` 檔案（例如原本手動安裝版本累積的正式資料，或是一份備份），想把它放進 Docker 版本裡繼續使用，而不是從空白資料庫重新開始。

⚠️ 開始之前務必先備份這個既有的 `.sqlite` 檔案，操作有出入時才能還原。

1. 確認 Container Manager 裡的 `cellstock` 專案是**執行中**的狀態。
2. 開啟 DSM 的「**終端機和 SNMP**」，確認 SSH 服務已啟用（控制台 → 終端機和 SNMP）。
3. 在自己電腦開終端機（Mac 用「終端機」App），SSH 連進 NAS：

```bash
ssh 你的DSM帳號@NAS-IP
```

4. 把既有的資料庫檔案複製進正在執行的容器：

```bash
docker cp /你的既有資料庫路徑/cellstock.sqlite cellstock-manager:/data/cellstock.sqlite
```

例如既有檔案放在 `/volume1/web/cellstock/db/cellstock.sqlite`：

```bash
docker cp /volume1/web/cellstock/db/cellstock.sqlite cellstock-manager:/data/cellstock.sqlite
```

如果你在 `docker-compose.yml` 裡把 `container_name` 改成別的名字，指令裡的 `cellstock-manager` 也要跟著改。

5. 修正檔案權限，讓容器內的 web server 使用者可以讀寫：

```bash
docker exec cellstock-manager chown www-data:www-data /data/cellstock.sqlite
```

6. 重新啟動容器套用：

```bash
docker restart cellstock-manager
```

7. 開啟 `http://NAS-IP:8080/cell-stock-manager.html` 確認畫面顯示的是匯入進去的既有資料，而不是空白資料庫。

匯入完成後，之後這個 volume 裡的資料庫就是「正式資料庫」了，往後更新程式（見上一節）不會再動到它。

---

## 16. 常見問題

### Q1. 網址打不開

請檢查：

1. NAS IP 是否正確。
2. `.env` 的 `CELLSTOCK_HTTP_PORT` 是否是 `8080`。
3. Container Manager 裡 `cellstock-manager` 是否正在執行。
4. 你的電腦是否和 NAS 在同一個網路。

---

### Q2. Container 一直停止

請看 Container Manager 的日誌。

常見原因：

- `.env` 沒有建立。
- `.env` 沒有設定 `CELLSTOCK_ADMIN_PASSWORD`。
- `docker-compose.yml` 不在正確資料夾。
- 檔案多包了一層資料夾。

---

### Q3. 忘記管理員密碼

如果只是忘記網頁裡改過的管理員密碼，請先不要刪資料庫。

建議處理方式：

1. 找負責維護系統的人。
2. 先備份資料庫。
3. 再用 SQLite 工具或維護腳本重設管理員帳號。

不要直接刪除 Docker volume，否則庫存資料會一起消失。

---

### Q4. 資料會不會因為重開 NAS 消失

正常不會。

資料存在 Docker volume 裡，不是在瀏覽器裡。

但如果你手動刪除 Docker volume，例如 `cellstock-data`，資料就會消失。因此不熟悉 Docker 的使用者不要刪 volume。

---

### Q5. 可以讓外網使用嗎

不建議直接開放到外網。

建議只在實驗室內網使用。如果真的需要外網使用，請請資訊人員協助設定：

- HTTPS
- VPN
- DSM 防火牆
- 反向代理
- 存取權限限制

---

## 17. 日常維護建議

1. 管理員密碼只給需要維護庫存的人。
2. 每週或每月備份一次資料庫。
3. 更新程式前一定先備份。
4. 不要刪除 Docker volume。
5. 不要把 `.env` 傳到公開地方。
6. 若多人共用，請要求每個人輸入自己的真實姓名，方便追蹤操作紀錄。

---

## 18. 給實驗室管理者的簡短 SOP

每次安裝或更新時，照這個順序：

1. 確認 `docker/cellstock` 裡有 `docker-compose.yml`。
2. 確認 `.env` 存在，而且密碼已改過。
3. 用 Container Manager 建立或重建 `cellstock` 專案。
4. 確認 `cellstock-manager` 是執行中。
5. 開啟 `http://NAS-IP:8080/cell-stock-manager.html`。
6. 用管理員帳號登入維護模式。
7. 建立或確認第一筆測試資料。
8. 備份資料庫。

---

## 19. 最重要的安全提醒

請記住三件事：

1. 不要使用預設密碼。
2. 不要刪除 Docker volume。
3. 更新或調整前先備份資料庫。

