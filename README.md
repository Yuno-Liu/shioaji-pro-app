# Shioaji Pro — 專業交易終端 Trading Terminal

**[官方網站 / Landing Page](https://sinotrade.github.io/shioaji-pro-app/)** ・
**[下載 Download](https://github.com/Sinotrade/shioaji-pro-app/releases/latest)**

A professional, fully-customizable trading terminal for Taiwan markets
(TWSE / TPEX / TAIFEX), built on the [Shioaji](https://sinotrade.github.io/)
HTTP API + SSE streaming. React 19 + TypeScript + Vite, zero backend code —
it talks directly to your local `shioaji server`.

以 Shioaji HTTP API 打造的專業交易終端：即時行情、K 線、五檔、閃電下單、
圖表點價下單、停損停利觸價單、圖表畫圖工具、
可拖拉的自訂版面。

**介面 100% 開源** — UI、行情串流、下單鏈路全部都在這個 repo，
clone 下來就能 build 出完整的 Web 版終端。桌面版外殼（Tauri）、
AI Agent 與策略回測為專屬模組，直接到 Releases 下載安裝檔即可使用。

![Shioaji Pro — futures night session](docs/shot-terminal-dark.png)

## Live Market Intelligence 即時市場情報

Shioaji 1.7.1 的即時計算指數、成分股與產業貢獻，現在整合成可自由配置的
市場脈動面板。自算指數會同時對照官方指數、更新時間差、台指近月與期現差；
成分股貢獻、產業分布和貢獻傳導可單獨或並排顯示。

![市場脈動：成分股貢獻、產業分布與貢獻傳導](docs/images/market-pulse-live.png)

盤中雷達接收上市與上櫃即時訊號，能依訊號自動連動 K 線、五檔和成交明細。
市場與訊號規則皆可細項多選，設定區可隨時收合。

| 盤中雷達 | 訊號與市場篩選 |
|---|---|
| ![盤中雷達連動 K 線、五檔與成交明細](docs/images/intraday-radar-live.png) | ![盤中雷達訊號與市場篩選](docs/images/intraday-radar-filters.png) |

## Features 功能

- **即時行情** — 單一 SSE 連線串流 tick / 五檔，自選清單成交閃動（只在真實成交時閃，試撮不閃）
- **K 線圖** — lightweight-charts，1m/5m/15m/60m/1D，即時 tick 更新當根 K 棒，
  **歷史無限回溯**（往左拖自動載入更舊 K 棒，最多三年）
  - **交易模式 / 畫圖模式**：頂端工具列武裝交易（點價買賣、停損、停利、警示），
    左側工具列負責畫圖與瀏覽，一次只有一種模式生效
  - **點價下單**：點圖表價位直接限價買賣
  - **停損 / 停利**：在圖上掛觸價單（觸價送市價單），虛線顯示、可取消
  - **委託管理**：未成交委託顯示為實線、overlay 有 CANCEL 按鈕、**拖曳委託線即改價**
  - **畫圖工具**：水平線／趨勢線／射線／延伸線／方框，TradingView 式色盤、
    線寬與虛實線、鎖定／隱藏／複製；水平線可輸入精確價位。依商品保存、
    切換週期不跑位（期貨連續月與月份合約預設共用，可關閉）
  - **Hover 同步**：十字線價位即時同步到下單面板
- **閃電下單** — 價格梯點擊即下單（左欄買/右欄賣），含安全開關；
  **⚡全開**：自選前 N 檔自動平鋪多個閃電面板（可選排版）
- **鋪單面板** — 一鍵多檔位掛單：靜態鋪單 ＋ 動態追價模式
- **五檔報價** — 量能條視覺化，點價帶入下單面板
- **成交明細** — 開啟即載入歷史 tick，時間精確到微秒
- **下單面板** — 整股/零股、ROD/IOC/FOK、期貨倉別、沖賣 daytrade_short，
  兩段式確認防誤觸
- **組合單** — 期貨/選擇權組合單（價差、跨式…），T 字報價點擊連動兩腳、
  到價監控自動送單
- **持倉 / 委託 / 帳務** — 即時損益、刪單改量、權益數與保證金、
  資產市值加總＋分布圖、零股混合單位顯示（X張+Y股）
- **排行榜** — 漲幅 / 量 / 額多條件複選 scanner（含放空篩選）、顯示類別、
  點擊即加入追蹤
- **產業全景** — 產業 treemap（面積＝成交值/貢獻可切換、色＝加權漲跌幅）、
  加權/櫃買切換；點產業下鑽主力貢獻或成交值排行＋貢獻磚牆，
  「其他成員」漲跌幅由群組加權反推
- **交易安全** — 風控 Kill Switch（單筆上限/日虧上限/一鍵鎖單）、
  Esc×2 全部刪單、括號單（成交後自動掛 OCO 停損停利）、持倉一鍵平倉/反手、
  委託改量、下單預估成本（手續費/稅/契約值）
- **快捷鍵** — B/S 切換買賣、Esc×2 全刪單、⌘K 商品搜尋跳轉（支援中文股名）
- **技術指標** — 21 種內建（主圖均線/通道/SAR/SuperTrend，副圖 MACD/RSI/KD
  等震盪指標），TradingView 式選擇器與設定視窗（色盤/線型/時框顯示/
  我的預設），副圖獨立窗格、圖上 legend 即時數值
- **自訂指標** — 面板內用 JavaScript + `ta.*` 函式庫寫自己的指標
  （`plot()`/`hline()` 宣告輸出），Web Worker 沙箱驗證（自動擋無窮迴圈）、
  自動偵測輸出線，寫完與內建指標同等待遇（設定/樣式/收藏全套）
- **大盤狀態列** — 加權指數與台指期基差常駐頂部
- **市場脈動** — 自算指數對照官方指數、時間差與期現差，成分股貢獻與
  產業到主要個股的貢獻傳導可自由組合顯示（指數成分即時串流驅動）
- **盤中雷達** — 上市／上櫃即時訊號，規則與市場細項多選，訊號出現時可自動
  連動 K 線、五檔與成交明細
- **到價警示** — 圖上點擊設警示線（只通知不下單），音效＋toast
- **分析面板** — 損益分析（權益曲線/勝率/賺賠比）、分價量表＋內外盤比、
  個股籌碼卡（融資券/借券/處置股）、選擇權 T 字報價（TXO）、
  選擇權損益圖（買方/賣方到期損益）
- **行情回放** — 重播當日歷史 tick 練盤感（1x–100x 變速）
- **委託簿熱圖** — 五檔掛單牆的時間序列視覺化
- **自選清單** — 漲跌幅排序、列備註、迷你走勢圖（可開關）、拖曳排序
- **自訂版面** — react-grid-layout 拖拉移動/縮放，面板可任意新增（多開 K 線圖）、
  每個面板可「連動自選」或「鎖定商品」、可彈出成獨立視窗（多螢幕）、
  版面可命名儲存/載入，內建多組預設版面
- **通知中心 / 診斷面板** — 委託回報時間軸、系統事件、App 版本與連線診斷
- **隱私模式** — 一鍵遮蔽帳號與金額（demo / 截圖 / 直播用）
- **音效回報** — 成交/委託/警示分音色（可關閉）
- **斷線自癒** — SSE 重連後自動重新訂閱所有商品；斷線時自動鎖定下單按鍵
- **主題** — 深色 / 純黑 / 淺色 × 紅漲綠跌(台式) / 綠漲紅跌(美式)，字級可調

| Dark | Light |
|------|-------|
| ![dark](docs/shot-terminal-dark.png) | ![light](docs/shot-terminal-light.png) |

## Desktop App 桌面版（推薦）

到 [Releases](https://github.com/Sinotrade/shioaji-pro-app/releases) 下載對應平台安裝檔
（macOS `.dmg`、Windows `.msi`、Linux `.AppImage`/`.deb`/`.rpm`）。桌面版特色：

系統需求：macOS 13.3+（Apple Silicon / Intel）、Windows 10/11 x64、Linux x86_64。

- **AI Agent** — 多供應商（Claude / Codex）agentic 對話、shioaji 技能市集、
  排程任務、操作觀察學習（桌面版專屬）
- **Codex 訂閱免手動裝 CLI** — 安裝新版 ChatGPT Desktop 並登入 ChatGPT，
  AI Agent 設定頁會偵測 App 內建 Codex runtime、檢查登入與官方 skill；
  也可繼續使用獨立安裝的 Codex CLI（舊版 ChatGPT Classic 不含 Codex）
- **策略回測** — 用 JS 寫進出場策略（與自訂指標同一套 `ta` 函式庫）、
  含手續費/證交稅/期交稅/滑價的回測引擎（訊號收盤成立、次根開盤成交，
  無未來函數）、單商品與自選清單多商品整合績效（合併權益曲線＋可排序
  商品表）、進出場標記直接畫在 K 線上（桌面版專屬）
- **內建 shioaji server**（sidecar）— 不需另外安裝 CLI
- **伺服器管理介面** — header「伺服器」選單：啟動/停止/重啟、健康狀態、
  PID/port、token 效期；API 金鑰在介面填寫（存於本機 App 資料夾）
- **模擬/正式環境切換** — 介面上切換，重啟伺服器生效
- **系統匣（Menu Bar）** — 關閉視窗縮到系統匣常駐；匣選單可叫回視窗、
  開伺服器管理、檢查更新
- **自動更新** — 啟動時靜默檢查，GitHub Releases 簽章驗證後自動更新重啟
- **多視窗 Popout** — 面板 ⧉ 彈出為原生視窗，多螢幕交易
- **單一實例** — 重複開啟自動聚焦既有視窗

> 桌面版外殼（Tauri）、AI Agent 與策略回測為專屬模組，不在本 repo ——
> 本 repo 可 build 出完整的 Web 版終端（CI 持續驗證），桌面版請直接下載安裝檔。

## Getting Started 開始使用（Web 版）

### 1. Prerequisites 前置需求

- 永豐金證券帳戶 + Shioaji API Key/Secret
  （在 [API 管理頁](https://www.sinotrade.com.tw/newweb/PythonAPIKey/) 建立）
- [Node.js](https://nodejs.org/) 20+ 與 [pnpm](https://pnpm.io/)
- Shioaji CLI：

```sh
# 推薦用 uv 安裝
uv tool install shioaji
# 或下載 standalone binary，見 https://sinotrade.github.io/
```

### 2. Configure credentials 設定金鑰

```sh
cp .env.example .env
# 編輯 .env，填入你的 SJ_API_KEY / SJ_SEC_KEY
```

> `.env` 已被 `.gitignore` 排除，**請勿** commit 你的金鑰。

### 3. Start the Shioaji server 啟動行情/交易伺服器

```sh
shioaji server start          # 預設模擬環境（紙上交易）
shioaji server check          # 確認狀態
```

預設跑在 `http://127.0.0.1:8080`，**simulation 模式**——下單不會動用真錢。
切正式環境：`shioaji server start --production`（需先完成 CA 憑證設定，
請務必先在模擬環境完整測試）。

### 4. Run the app 啟動前端

```sh
pnpm install
pnpm dev
```

開啟 [http://localhost:5173](http://localhost:5173) —— dev server 會把
`/api` 代理到 `localhost:8080`。

## Docker 一鍵快速部署 Docker Quick Start

本專案提供輕量化多階段 Dockerfile 與 Docker Compose 配置，無需在本地安裝 Node.js 或 pnpm，即可一鍵啟動整合 Nginx 反向代理與 Server-Sent Events (SSE) 行情串流的完整交易終端：

### 1. 完整啟動流程（四步驟）

#### 步驟 1：準備環境變數設定檔 `.env`
在專案根目錄建立或編輯 `.env`（可複製 `.env.example`）：
```sh
cp .env.example .env
```
填入您的永豐與玉山相關設定：
```env
# 永豐證券 Shioaji 行情金鑰（數據來源）
SJ_API_KEY=your_sinopac_api_key
SJ_SEC_KEY=your_sinopac_secret_key

# 玉山證券下單帳號（若使用玉山下單）
VITE_ESUN_ACCOUNT=88400664718
VITE_ESUN_BROKER_ID=8840

# Docker 服務設定
PORT=5173
API_TARGET=http://host.docker.internal:8080
```

#### 步驟 2：啟動本機 Shioaji 行情伺服器（負責數據來源）
```sh
# 安裝並啟動 Shioaji 服務（預設模擬模式跑在 8080 埠，供 Docker 容器連線）
pip install shioaji
shioaji server start
```

#### 步驟 3：使用 Docker 一鍵啟動交易終端
```sh
# 構建映像檔並於背景啟動容器
docker compose up -d --build
```

#### 步驟 4：開啟瀏覽器
在瀏覽器打開 **[http://localhost:5173](http://localhost:5173)**，即可進入交易終端進行看盤與下單！

---

### 2. Docker 常用管理指令速查

| 操作情境 | Docker Compose 指令 | 原生 Docker CLI 指令 |
|---|---|---|
| **構建並背景啟動** | `docker compose up -d --build` | `docker build -t shioaji-pro-app . && docker run -d --name shioaji-pro-app -p 5173:80 --add-host=host.docker.internal:host-gateway -e API_TARGET=http://host.docker.internal:8080 shioaji-pro-app` |
| **查看容器運行狀態** | `docker compose ps` | `docker ps -f name=shioaji-pro-app` |
| **查看即時日誌** | `docker compose logs -f` | `docker logs -f shioaji-pro-app` |
| **重啟終端服務** | `docker compose restart` | `docker restart shioaji-pro-app` |
| **停止並移除容器** | `docker compose down` | `docker stop shioaji-pro-app && docker rm shioaji-pro-app` |

---

### 3. 環境變數與自訂設定

可在 `.env` 檔案中自訂連線設定，或於啟動時直接指定環境變數：

| 環境變數 | 預設值 | 說明 |
|---|---|---|
| `PORT` | `5173` | 宿主機對外暴露之 Web 終端連接埠 |
| `API_TARGET` | `http://host.docker.internal:8080` | 後端 Shioaji 服務連線網址（容器內部透過 `host.docker.internal` 連線宿主機 8080 埠） |

#### 範例：自訂連接埠為 8080 或連接遠端伺服器
```sh
# 使用 Docker Compose
PORT=8080 API_TARGET=http://192.168.1.100:8080 docker compose up -d --build

# 或使用原生 Docker CLI
docker run -d --name shioaji-pro-app -p 8080:80 -e API_TARGET=http://192.168.1.100:8080 shioaji-pro-app
```

## 玉山證券 (E.SUN Securities) 下單前準備與完整設定指南

本終端已原生支援**玉山證券現貨台股下單與委託管理**（採用玉山官方 `@esun/trade` v2.2.0 Node.js SDK）。在進行實盤或模擬交易前，請依序完成以下準備與設定步驟：

### 一、事前準備與開戶
1. **開立玉山證券帳戶**：
   - 需持有玉山證券有效證券戶（可為臨櫃開立之玉山證券戶，或玉山證券富果 Fugle 帳戶）。
2. **開通電子下單權限與交易額度**：
   - 確認證券戶已啟用電子交易功能與電子密碼。
   - 依個人投資需求向營業員或線上申請足額的單日電子下單買賣額度。
   - 若欲使用**現股當沖先賣（沖賣）**功能，請務必先簽署「現股當沖風險預告書」。

### 二、申請程式交易 API 金鑰與設定 IP 白名單
1. **前往玉山程式交易平台**：
   - 瀏覽 [玉山證券程式交易 API 平台](https://www.esunsec.com.tw/trading-platforms/api-trading/) 並點擊登入。
2. **簽署同意書與申請金鑰**：
   - 線上簽署「API 服務申請同意書」開通開發者權限。
   - 建立並取得交易專用的：
     - **API Key**（金鑰公鑰）
     - **API Secret**（金鑰私鑰，請妥善保管勿外流）
3. **設定連線 IP 白名單**：
   - 於金鑰管理頁面設定允許連線的來源 IP：
     - 模擬環境：若使用本機浮動 IP 或雲端環境，可先加入本機公網 IP 或設定為 `0.0.0.0/0`（僅建議於測試環境使用）。
     - 正式環境：請務必綁定固定公網 IP 確保交易資安。

### 三、申請並匯出電腦下單憑證 (CA Certificate)
依臺灣證券交易法規，所有電子交易委託均需數位憑證進行數位簽章：
1. **申請/匯出憑證**：
   - 登入玉山證券官網「憑證中心」，申請電腦下單憑證。
   - 將憑證匯出為 **`.p12`** 或 **`.pfx`** 檔案格式。
2. **憑證保護密碼**：
   - 匯出憑證時會要求設定一組**憑證密碼**，請牢記此密碼（⚠️ 注意：憑證密碼與網銀/網路下單登入密碼不同）。
3. **安全放置憑證**：
   - 將憑證放置於本機安全目錄（例如專案目錄的 `certs/`：`./certs/your_esun_cert.p12`）。
   - 本專案已在 `.gitignore` 與 `.dockerignore` 排除 `certs/`、`*.p12`、`*.pfx`，切勿將真實憑證上傳至 Git 倉庫。

### 四、設定組態與連線參數

玉山證券交易可透過 **`config.ini`** 或 **環境變數** 完成組態配置：

#### 方式 A：使用標準 `config.ini`（推薦）
將根目錄的 `esun-config.ini.example` 複製為 `config.ini`：
```ini
[Core]
# 模擬環境 API 入口網址
Entry = https://esuntradingapi-simulation.esunsec.com.tw/api/v1
# 正式環境 API 入口網址（上線真實交易請切換為此網址）
# Entry = https://esuntradingapi.esunsec.com.tw/api/v1
Environment = SIMULATION

[Cert]
# 憑證檔案路徑 (.p12 或 .pfx)
Path = ./certs/your_esun_cert.p12

[Api]
# 玉山證券 API 金鑰
Key = your_esun_api_key
Secret = your_esun_api_secret

[User]
# 完整證券帳號 (分公司代碼 4 碼 + 帳號 7 碼，例如 96001234567)
Account = 96001234567
```

#### 方式 B：使用 `.env` 環境變數
```sh
# 前端自動帶入玉山帳號（9600 為玉山總公司，分公司代號如 96XX）
VITE_ESUN_ACCOUNT=96001234567
VITE_ESUN_BROKER_ID=9600
VITE_ESUN_USERNAME=玉山證券

# Node.js SDK 自動化參數 (免交互輸入密碼)
ESUN_CONFIG_PATH=./config.ini
ESUN_CERT_PASS=your_cert_password
ESUN_PASSWORD=your_trading_password
```

### 五、下單支援規格與交易限制

| 支援項目 | 說明與規則 |
|---|---|
| **交易市場** | 僅支援台股現貨市場（TWSE 上市 / TPEX 上櫃），**不支援** 期貨、選擇權或指數商品 |
| **整股交易** | 交易單位為「張（1,000 股）」，支援市價（MKT）與限價（LMT），委託別 ROD/IOC/FOK |
| **盤中零股** | 交易別為 `IntradayOdd`，單位為「股（1~999 股）」，僅限限價（LMT）與 ROD |
| **盤後零股** | 交易別為 `Odd`，單位為「股（1~999 股）」，僅限限價（LMT）與 ROD |
| **定價交易** | 交易別為 `Fixing`，以當日收盤定價進行撮合 |
| **現股當沖先賣** | 支援 `daytrade_short`，需先向玉山證券開通現股當沖交易資格 |
| **改單管理** | 支援委託減量（`replaceQuantity`）、改價（`replacePrice`）與全單撤銷（`cancelOrder`） |

> ⚠️ **安全警告**：
> 1. 初次使用請務必在**模擬環境 (SIMULATION)** 驗證完整連線、下單與改刪單流程。
> 2. 正式環境中送出的每一筆委託均為市場真實撮合交易，請嚴格做好資金控管與風控停損設定。

## Deploy as a Shioaji custom app 部署為內建 App

Shioaji server 可直接代管前端，build 完上傳即可：

```sh
VITE_BASE=/apps/shioaji-pro-app/ pnpm build
cd dist
ARGS=(); for f in *; do ARGS+=(-F "files=@$f"); done
curl -X POST http://localhost:8080/api/v1/apps/shioaji-pro-app "${ARGS[@]}"
```

然後開啟 `http://localhost:8080/apps/shioaji-pro-app/index.html`。
（注意：上傳的 app 存在 server 記憶體，server 重啟後需重新上傳。）

## Safety notes 安全提醒

- 預設為**模擬環境**；頂部會顯示「模擬環境」徽章，正式環境為紅色「正式環境」
- 閃電下單預設**鎖定**，需手動啟用；圖表點價下單為 one-shot 模式
- 停損/停利為**客戶端觸價單**，只在頁面開啟時監控
- 正式環境的每一筆委託都是真實交易，請自行承擔風險

## Stack

- React 19 + TypeScript + Vite 8
- [vanilla-extract](https://vanilla-extract.style/) — zero-runtime themable CSS
- [lightweight-charts](https://tradingview.github.io/lightweight-charts/) v5
- [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) v2
- Shioaji HTTP API + Server-Sent Events

## License

[GNU AGPL-3.0](LICENSE) — 介面 100% 開源，但這是強 copyleft 授權：

- **可以**自由使用、修改、學習、fork
- **商用條件**：任何基於本專案的修改或衍生作品（包括架成網路服務提供他人
  使用）都**必須以 AGPL-3.0 完整開源**
- 不願開源的商業使用，請聯繫永豐金證券洽談**商業授權**（dual licensing）

External contributions: by submitting a PR you agree to license your
contribution under AGPL-3.0 and grant the maintainers the right to
include it in dual-licensed distributions.

外部貢獻者的 CI 流程（fork PR 的 desktop CI 需維護者加 `run-desktop-ci`
label 核准）見 [CONTRIBUTING.md](CONTRIBUTING.md#外部-fork-pr-的-ci-流程).
