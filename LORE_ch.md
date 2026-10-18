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
  - 頁面改名或併入其他頁面時，在 [netlify.toml](netlify.toml) 新增舊路徑的 301 轉址，並保留原標題 id，讓舊錨點仍可使用。已上線的章節移到其他頁面時，在 [public/nav.js](public/nav.js) 的舊錨點表 (`moved`) 把「頁名#id」導向新頁面；章節在同頁內移除或合併時，把舊 id 保留在接手內容的元素上。
  - 每個頁面載入 [public/nav.js](public/nav.js)，並使用與現有頁面相同的固定頁首 `<header class="site-header">` 標記；腳本在頁首填入階層：網站首頁、本頁 `h1` (首頁本身省略，因首頁連結已代表該頁)，以及讀者目前所在的 `h2` 與 `h3`，每層連到該層開頭。只有帶 `id` 的 `h2` 與 `h3` 會出現在階層中，因此每個章節標題必須有 `id`。
  - 全站引用的來源只在 [public/index.html](public/index.html) 研究索引的「資料來源」分組 (`#sources`) 列出一次；嚴禁在主題頁另設資料來源章，詞條表嚴禁加入來源欄。頁面開始引用新來源時，在該表新增或更新對應的列。內文中的引用連結與來源分歧候選值標示的來源名稱留在頁面上。

## 遊戲資料守則

- 網站只從 `public/data/` 讀取遊戲數值 (數字與規則標籤)、佔位元素產生的效果、能力值及分類名稱，以及它們的來源；產生其中部分檔案的維護輸入放在 `tools/` (見遺物資料產生)：
  - [public/data/common.json](public/data/common.json)：所有頁面共用的遊戲版本、能力值、圖示、角色、標籤與來源。
  - `public/data/relics/<category>.json`：遊戲內遺物篩選的每個大類一個檔案 (`general`、`character`、`armament`、`demerit`)，記錄該大類、其子分類及效果。
  - 其他遊戲主題的資料放在 `public/data/` 下以主題命名的檔案或目錄，並依遊戲本身的分組拆分，如同 `relics/` 依遊戲內遺物篩選拆分；多個主題共用的定義留在 `common.json`。
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
- 遺物詞條表的效果列以 `<tbody data-relic-table="<subcategory>">` 由資料產生；嚴禁在 HTML 手寫效果列。效果欄先列說明，再列規則行；由結構化數值 (`modifier`) 產生的數值行只在效果沒有說明時列出，因為說明已含相同數字。來源分歧的候選值一律連同來源列出。既沒有說明也沒有結構化數值的效果，依其色調顯示「未載明數值」。規則行不列取得方式 (由「種類」欄呈現) 與增益的自身可否疊加 (由色調呈現)；自身可否疊加來源分歧時仍列出各候選說法。負面效果一律為紅色，因此其規則行保留自身可否疊加的狀態。「種類」欄依 `availability` 列出「一般」及／或「深層」；固定遺物詞條 (`relics`) 列出每個遺物的圖示與名稱；分級詞條只有部分等級屬於某種類時，列出這些等級 (例如「深層：+2、+3、+4」)；取得方式尚未核實或來源分歧時顯示對應狀態。
- [public/render.js](public/render.js) 依色調顯示資料產生的說明、數值行與內文例子：負面效果大類的詞條為紅色 (`tone-debuff`)；其他詞條自身可疊加 (`stacks: true`) 為藍色 (`tone-stack`)，不可疊加 (`stacks: false`) 為綠色 (`tone-solo`)；可否疊加尚未核實或來源分歧時維持預設顏色並以粗體標示 (`tone-unverified`)。遺物詞條表中，狀態為尚未核實或來源分歧的規則標籤，以及分歧候選值的「來源分歧」標籤，也以粗體標示 (`tone-unverified`)。規則行中的等同值 (例如「等同生命力 +5」) 採用詞條的色調。說明中列為代價的片段在該說明的色調中以紅色標示。確定必伴隨負面效果 (`requiresCurse: true`) 的規則標籤為紅色。各遺物頁在視窗底部固定顯示顏色圖例 (`<aside class="tone-legend" data-legend>`)，依 [public/data/common.json](public/data/common.json) 的 `legend` 產生：每一項有 `tone` (class 後綴)、`label` 與滑鼠移上或聚焦時顯示的 `tip`；各項為「不可疊加」(綠)、「可疊加」(藍)、「負面」(紅) 與「未核實」(粗體)。嚴禁在 HTML 手動設定色調 class。
- `detail` 記錄效果或等級的社群詳細說明：`en` 是來源原文，`zh` 是譯文。數字、物品或地點與鎖定版本遊戲參數矛盾的說明，改依參數撰寫中英文，並帶有自己的 `sources`。資料集沒有說明的效果，只有在 AttachEffectParam 列能以明確的引用關係給出數值，且說明提供名稱以外的資訊時，才依參數撰寫說明；否則不寫說明。

## 遺物資料產生

- `public/data/relics/*.json` 由 [tools/import-relics.mjs](tools/import-relics.mjs) 產生 (在專案根目錄執行 `node tools/import-relics.mjs [category ...]`)；嚴禁手動編輯。修改輸入檔後重新執行：
  - [tools/relics-config.json](tools/relics-config.json)：各來源鎖定的 commit、分類樹、渡夜者欄位，圖示編號 → 圖示鍵的對應 (`null` 表示沒有相符的授權圖片)，以及遺物圖示編號 → 圖示鍵的對應。
  - [tools/relics-curated.json](tools/relics-curated.json)：人工整理的效果，以 `gameId` 對應產生的效果；其欄位覆寫產生值，腳本會列出每個被覆寫的差異。
  - [tools/relic-details-zh.json](tools/relic-details-zh.json)：各社群詳細說明的繁體中文譯文，以 `gameId` 為鍵並保存英文原文。
  - [tools/relic-stacking.json](tools/relic-stacking.json)：資料集未載明的等級之自身可否疊加，以 `gameId` 為鍵，只取自明確寫出的社群來源 (社群試算表或 Fextralife)；每筆保存 `stacks` (布林值，來源不同時為 `conflict`)、`sources`，以及 `quotes` 中引用的來源原文。腳本只填入未知的值，並在效果的 `sourcesFor["stacking.stacks"]` 列出這些來源，連同資料集已給值之等級的來源。
  - [tools/relic-details-params.json](tools/relic-details-params.json)：依遊戲參數撰寫的說明，以 `gameId` 為鍵；每筆保存社群原文 `source` (資料集沒有說明時為 `null`)、重寫的 `en` 與 `zh`、參數證據 `params`，以及可省略的 `sources` (預設 `game-params`)。同一 `gameId` 嚴禁同時出現在兩個說明檔。
  - [tools/relic-penalties.json](tools/relic-penalties.json)：增益詞條繁中說明中屬於負面代價的片段，以擁有該說明的 `gameId` 為鍵；值為完全相符的子字串陣列 (例如 `"生命力 -5"`)，寫入 `detail.penalties`。必須列出說明中的每個代價，包括各等級的數字。
- 人工整理的效果、譯文、效果或遺物圖示、角色或來源引用 (`sources`、`sourcesFor`、conflict 候選) 找不到對應；兩個人工整理的效果對應相同的 `gameId`；來源欄位出現未知的列舉值；譯文保存的英文原文或參數重寫的 `source` 與來源不同；同一 `gameId` 同時有譯文與參數重寫；參數重寫缺少 `en`、`zh` 或 `params`、`sources` 為空陣列，或找不到對應的效果；效果的規則欄位 (`availability`、`requiresCurse`、`stacking`) 同時記在效果層與等級；疊加補值找不到對應的效果、指向資料集已給值的等級、引用社群試算表與 Fextralife 以外的來源、未對每個來源附一句引用原文，或 `stacks` 不合法 (conflict 需至少兩個值不同的布林候選，且各自引用已列出的來源)；代價條目不是非空字串組成的非空陣列、找不到對應的說明、列出說明中沒有的片段，或以數字結尾的片段只對到較長數字的一部分且該位置沒有較長的已列片段；或任一說明檔、疊加檔或代價檔的鍵重複或不等於 `JSON.stringify` 2 空格縮排的標準輸出時，腳本停止且不寫檔。必須修正輸入檔，嚴禁繞過檢查。
- 更新來源時，修改設定檔中的 commit，重新執行腳本，並在提交前檢查列出的差異與需要重譯的項目。遊戲參數更新後，必須以新參數重新核對每一筆參數重寫。
- 翻譯詳細說明：
  - 每個數字保持相同的數字字元；嚴禁計算、四捨五入或換算單位。
  - 使用該效果的官方中文名稱與遊戲用語；沒有官方中文名稱的用語保留英文。
  - 原文的 `TODO` 等註記譯為「（原文註記：……）」；原文與效果名稱矛盾時照譯並加「（原文如此）」。譯文中嚴禁修正原文；與遊戲參數的矛盾改記在參數重寫檔。

## 遊戲撰寫守則

- 引導外部資源時使用開新視窗，禁止本頁跳轉
- RWD 原則，支援手機、平板、桌機等多種裝置
- 提及遊戲內項目時，必須找到該遊戲內對應的圖片，圖片來源為 [Eldenpedia](https://eldenring.wiki.gg/)
  - 只採用檔案頁授權標示為遊戲素材 (`{{License|game}}`) 的圖片；社群編修圖 (例如檔名含 `Custom`) 不算遊戲內圖片。
  - 圖片下載至 `public/images/`，由首頁的資料來源列出 wiki 檔案頁。大於 96px 的圖片可縮小為 96px，嚴禁其他修改。
  - [public/data/common.json](public/data/common.json) 的每個圖示以 `page` 記錄 wiki 檔案頁；首頁以 `<span data-icon-sources>` 列出全站圖示的檔案頁。
  - 同一種編排位置的圖片維持相同大小；圖片一律使用 `.icon` class，尺寸只在 `public/styles.css` 依位置設定，不在個別圖片上另外調整：
    - 表格內：48px (`td .icon`)。
    - 表格內的名稱清單 (效果說明、種類欄)：24px (`td .entry .icon`)。
    - 正文內：24px (`.icon`)。
    - 出現新的編排方式時，先在 `public/styles.css` 新增該位置的尺寸規則。
    - `<img>` 的 `width`/`height` 屬性與該位置的尺寸一致。
