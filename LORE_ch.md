# LORE

## 概觀

- `艾爾登法環 - 黑夜君臨` 這款遊戲的知識與遊戲內未提及具體數值的研究紀錄

## 專案基本守則

- AI agent 文件維持雙語且內容等價 (無後綴即英文版)，例如 SKILL.md=SKILL_ch.md、AGENTS.md=AGENTS_ch.md 等等。
- AI agent 文件中維持語言對應連結：英文檔案連到英文目標，繁體中文檔案在有 _ch 目標時連到 _ch 目標。
- 網站以 Netlify 發佈，[netlify.toml](netlify.toml) 指定發佈 `public/` 目錄，不需建置指令：
  - 網站檔案 (HTML、CSS、圖片) 一律放在 `public/` 下；`public/` 以外的檔案不會出現在網站上。
  - 頁面間以相對路徑連到 `.html` 檔，不依賴 Netlify 的 pretty URL。
  - 頁面以 `fetch` 載入遊戲資料，本機預覽須透過 HTTP 伺服器 (例如 `python -m http.server -d public`)；直接開啟本機檔案 (`file://`) 無法載入資料。
  - 新增主題頁面時，同時在 [public/index.html](public/index.html) 研究索引中該主題分組的表格新增一列；新主題另立分組標題。
  - 頁面改名或併入其他頁面時，在 [netlify.toml](netlify.toml) 新增舊路徑的 301 轉址，並保留原標題 id，讓舊錨點仍可使用。

## 遊戲資料守則

- 網站只從 `public/data/` 讀取遊戲數值 (數字與規則標籤)、佔位元素產生的效果、能力值及分類名稱，以及它們的來源；產生其中部分檔案的維護輸入放在 `tools/` (見遺物資料產生)：
  - [public/data/common.json](public/data/common.json)：所有頁面共用的遊戲版本、能力值、圖示、角色、標籤與來源。
  - `public/data/relics/<category>.json`：遊戲內遺物篩選的每個大類一個檔案 (`general`、`character`、`armament`、`demerit`)，記錄該大類、其子分類及效果。
  - 每個頁面在 `<body data-load>` 列出要載入的檔案，例如 `common relics/general`。[public/render.js](public/render.js) 遇到重複的效果鍵、效果或等級的 `gameId`，或子分類鍵時以錯誤停止；嚴禁讓後載入的檔案覆蓋先載入的檔案。
- HTML 放 `data-*` 佔位元素，由 [public/render.js](public/render.js) 填入；禁止在 HTML 寫死遊戲數值，內文例子中的數值也一樣。內文敘述 (例如角色名稱) 與 `data-*` 屬性中的選取鍵 (例如等級編號) 可以留在 HTML。
- 數值狀態：
  - 一般值代表該效果 `sources` 的記載。
  - `null` 代表尚未核實，禁止當成 0 或 false。
  - `{ "conflict": [{ "value": ..., "sources": [...] }] }` 代表來源分歧；保留所有候選值，不預設採用任何一個。
  - 這些狀態適用於所有欄位，包括 `stacking.stacks` 等規則欄位；計算只在所需規則全部明確成立時執行，否則顯示阻止計算的狀態。
  - `sourcesFor` 以欄位路徑 (例如 `stacking.combine`) 對應來源，取代該欄位的效果層級 `sources`。
- 百分比以有號數字儲存 (例如 `10`、`-5`)，倍率由程式推導。
- 有 +1／+2／+3 等級的效果是一個效果加 `tiers` 陣列；每級保留遊戲內 `gameId`。名稱沒有 `+N` 後綴的等級為 `tier: 0`。各級不同的規則欄位記在各級，不記在效果上。
- 每個效果的資源增量依來源記載逐筆記錄，不以通用的每點換算推導。
- 遺物效果依遊戲內遺物篩選的分類樹歸類：每個效果都有 `subcategory`，每個大類與子分類保留遊戲參數 `gameId`。不是取自遊戲文字的分類中文名稱為本站暫譯，頁面必須註明。
- 每個效果都有 `name` (`zh` 與 `en`) 與 `icon`。`icon: null` 表示沒有符合圖片守則的遊戲內圖片，嚴禁改用其他圖片替代。
- 遺物詞條表的效果列以 `<tbody data-relic-table="<subcategory>">` 由資料產生；嚴禁在 HTML 手寫效果列。
- `detail` 記錄效果或等級的社群詳細說明：`en` 是來源原文，`zh` 是譯文。

## 遺物資料產生

- `public/data/relics/*.json` 由 [tools/import-relics.mjs](tools/import-relics.mjs) 產生 (在專案根目錄執行 `node tools/import-relics.mjs [category ...]`)；嚴禁手動編輯。修改輸入檔後重新執行：
  - [tools/relics-config.json](tools/relics-config.json)：各來源鎖定的 commit、分類樹、渡夜者欄位，圖示編號 → 圖示鍵的對應 (`null` 表示沒有相符的授權圖片)，以及遺物圖示編號 → 圖示鍵的對應。
  - [tools/relics-curated.json](tools/relics-curated.json)：人工整理的效果，以 `gameId` 對應產生的效果；其欄位覆寫產生值，腳本會列出每個被覆寫的差異。
  - [tools/relic-details-zh.json](tools/relic-details-zh.json)：各社群詳細說明的繁體中文譯文，以 `gameId` 為鍵並保存英文原文。
- 人工整理的效果、譯文、效果或遺物圖示、角色或來源引用 (`sources`、`sourcesFor`、conflict 候選) 找不到對應；兩個人工整理的效果對應相同的 `gameId`；來源欄位出現未知的列舉值；或譯文保存的英文原文與來源不同時，腳本停止且不寫檔。必須修正輸入檔，嚴禁繞過檢查。
- 更新來源時，修改設定檔中的 commit，重新執行腳本，並在提交前檢查列出的差異與需要重譯的項目。
- 翻譯詳細說明：
  - 每個數字保持相同的數字字元；嚴禁計算、四捨五入或換算單位。
  - 使用該效果的官方中文名稱與遊戲用語；沒有官方中文名稱的用語保留英文。
  - 原文的 `TODO` 等註記譯為「（原文註記：……）」；原文與效果名稱矛盾時照譯並加「（原文如此）」。嚴禁修正原文。

## 遊戲撰寫守則

- 引導外部資源時使用開新視窗，禁止本頁跳轉
- RWD 原則，支援手機、平板、桌機等多種裝置
- 提及遊戲內項目時，必須找到該遊戲內對應的圖片，圖片來源為 [Eldenpedia](https://eldenring.wiki.gg/)
  - 只採用檔案頁授權標示為遊戲素材 (`{{License|game}}`) 的圖片；社群編修圖 (例如檔名含 `Custom`) 不算遊戲內圖片。
  - 圖片下載至 `public/images/`，並在頁面的資料來源列出 wiki 檔案頁。大於 96px 的圖片可縮小為 96px，嚴禁其他修改。
  - [public/data/common.json](public/data/common.json) 的每個圖示以 `page` 記錄 wiki 檔案頁；頁面以 `<span data-icon-sources>` 列出本頁顯示圖示的檔案頁。
  - 同一種編排位置的圖片維持相同大小；圖片一律使用 `.icon` class，尺寸只在 `public/styles.css` 依位置設定，不在個別圖片上另外調整：
    - 表格內：48px (`td .icon`)。
    - 表格內效果說明的名稱清單：24px (`td .entry .icon`)。
    - 正文內：24px (`.icon`)。
    - 出現新的編排方式時，先在 `public/styles.css` 新增該位置的尺寸規則。
    - `<img>` 的 `width`/`height` 屬性與該位置的尺寸一致。
