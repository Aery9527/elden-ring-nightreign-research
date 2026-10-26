# LORE

## 概觀

- `艾爾登法環 - 黑夜君臨` 這款遊戲的知識與遊戲內未提及具體數值的研究紀錄

## 文件守則

- AI agent 文件必須維持雙語且內容等價 (無後綴即英文版)，例如 AGENTS.md=AGENTS_ch.md。
- AI agent 文件中的連結必須與文件語言對應：英文檔案連到英文目標，繁體中文檔案在有 _ch 目標時連到 _ch 目標。

## 網站

- `public/` 是網站原始碼，`dist/` 是發佈的建置產物：[netlify.toml](netlify.toml) 發佈 `dist/`，不設建置指令。網站原始檔 (HTML、CSS、圖片、資料) 必須放在 `public/` 下。頁面間以相對路徑連到 `.html` 檔，嚴禁依賴 Netlify 的 pretty URL。
- [tools/build-site.mjs](tools/build-site.mjs) 以 jsdom 對每個 `public/*.html` 執行 render.js，把渲染後的頁面寫到 `dist/`，`public/` 的其他檔案逐 byte 複製過去。以 `npm --prefix tools ci` 安裝依賴，`npm --prefix tools run build` 建置，`npm --prefix tools run check` 驗證。
- `dist/` 是產物，嚴禁手動編輯。每個 commit 的 `dist/` 必須等於該 commit 的 `public/`、build 腳本與鎖定依賴的建置結果，因此修改其中任何一項時，必須在同一個 commit 提交重新建置的 `dist/`。渲染錯誤或 check 回報的差異必須修正，嚴禁繞過。
- 在本機合併進 `main`，並在合併結果上通過 check 後才 push `main`。嚴禁透過主機網站上的合併發佈，因為那裡不會執行本機檢查。
- 每個 clone 必須執行一次 `git config core.hooksPath .githooks` 啟用 pre-push hook。[.githooks/pre-push](.githooks/pre-push) 在推送到 `main` 的 commit 不是目前的 HEAD、建置輸入或 `dist/` 有未 commit 的變更，或 check 失敗時拒絕推送；嚴禁繞過 (例如 `--no-verify`)。
- 本機預覽必須透過 HTTP 伺服器，不能以 `file://` 開啟：`python -m http.server -d public` 在瀏覽器以 `fetch` 渲染模板，`python -m http.server -d dist` 提供發佈的頁面。
- render.js 分為三段：載入資料、靜態渲染、瀏覽器互動。build 只執行前兩段，因此靜態渲染嚴禁依賴排版、捲動、導覽或事件。發佈的頁面 (`<html data-prerendered>`) 只執行瀏覽器互動，且只為互動載入資料。
- 新增主題頁面時，在首頁 [public/index.html](public/index.html) 該主題的表格新增一列；新主題在首頁另立一個 `h2` 章節。
- 每個已發佈的「頁名#id」必須持續可用，包括 span、表格列與 render.js 產生的元素上的 id：
  - 頁面改名或併入其他頁面時，在 [netlify.toml](netlify.toml) 新增舊路徑的 301 轉址。
  - 章節移到其他頁面時，在 [public/nav.js](public/nav.js) 的舊錨點表 (`moved`) 新增對應。
  - 章節在同頁內移除或合併時，把舊 id 保留在接手內容的元素上。
- 每個頁面在 [public/render.js](public/render.js) 之前載入 [public/nav.js](public/nav.js)，並使用共用的 `<header class="site-header">` 標記。nav.js 依頁面中帶 `id` 的 `h2` 章節與 `h3` 標題產生頁首，因此頁面必須以 `h2` 分章、每個章節標題必須有 `id`，嚴禁另寫手寫目錄。
- nav.js 預設收起每個章節：第一個子元素是 `h2`、且只有這一個直屬 `h2` 的 `section`。HTML 保留完整內容；nav.js 把 `h2` 文字包進切換按鈕，並以 `hidden="until-found"` 隱藏該 section 的其他子元素。有可收合章節的頁面，章節列開頭有「全部展開」與「全部收合」。同頁連結、網址錨點、上一頁/下一頁或頁內搜尋指到收起章節中的內容時，會展開該章節。未啟用 JavaScript 時，所有章節維持展開。
  - 章節內容必須放在該章的 `section` 內、`h2` 之後，才會一起收合。第一個章節之前的內容一律顯示。含多個直屬 `h2` 的 `section` (首頁) 不收合。
  - 瀏覽器不渲染收起章節的內容，因此瀏覽器互動嚴禁在展開前依賴該內容的尺寸或位置 (各等級能力圖表在寬度改變時重畫)。
  - nav.js 不會為列印展開章節，不支援 `hidden="until-found"` 的瀏覽器也無法搜尋收起章節的內文；需要時先按「全部展開」。
- 全站引用的來源只在首頁 [public/index.html](public/index.html) 的「資料來源」章 (`#sources`) 列出一次；頁面開始引用新來源時，在該表新增或更新對應的列。嚴禁在主題頁另設資料來源章，詞條表嚴禁加入來源欄。內文中的引用連結與來源分歧候選值標示的來源名稱留在頁面上。

## 資料

- 網站只從權威輸入 `public/data/` 讀取遊戲數值、佔位元素產生的名稱，以及這些數值的來源 (`dist/data/` 是其發佈副本)：
  - [public/data/common.json](public/data/common.json)：所有頁面共用的定義 (遊戲版本、能力值、圖示、角色、圖例、標籤、戰技分組、介面文字、來源)。
  - `public/data/relics/<category>.json`：遊戲內遺物篩選的每個大類一個檔案 (`general`、`character`、`armament`、`demerit`)。
  - `public/data/armaments/` (`weapons.json`、`spells.json`、`skills.json`) 與 `public/data/characters/nightfarers.json`。
  - 其他遊戲主題的資料放在以主題命名的檔案或目錄，並依遊戲本身的分組拆分；多個主題共用的定義留在 common.json。
- `public/` 的 HTML 模板放章節骨架與 `data-*` 佔位元素，由 render.js 填入。遊戲數值 (內文例子中的數值也一樣)、由資料產生的名稱，以及由資料產生的表格列 (遺物效果、武器、法術、戰技、角色、能力值關聯)，嚴禁手寫在 HTML。靜態的概覽、來源與說明表格、內文敘述，以及 `data-*` 屬性中的選取鍵 (例如等級編號) 可以留在 HTML。
- 每個頁面在 `<body data-load>` 列出渲染時要載入的檔案 (例如 `common relics/general`)，且必須載入佔位元素所需的每個檔案：計算遺物詞條反向關聯的頁面載入四個遺物大類檔，有 `targets` 的遺物頁載入 `armaments/weapons`、`armaments/spells` 與 `armaments/skills`，`<span data-character>` 需要 `characters/nightfarers`。嚴禁讓後載入的檔案覆蓋先載入的檔案。
- 每個引用 (來源、圖示、角色、標籤、能力值或項目 ID) 必須對應到其定義中自身擁有的鍵；嚴禁把繼承來的屬性算作對應。
- 反向關聯 (與武器、法術、戰技或能力值相符的詞條；引用某戰技的武器) 由 render.js 在渲染時計算 (結果可以出現在 `dist/` 的 HTML)，嚴禁另存於資料。
- 研究數值與規則欄位的數值狀態：
  - 一般值代表其來源的記載。
  - `null` 代表尚未核實，嚴禁當成 0 或 false。
  - `{ "conflict": [{ "value": ..., "sources": [...] }] }` 代表來源分歧；保留所有候選值，不預設採用任何一個，且一律連同來源列出候選值。
  - 計算只在所需規則全部明確成立時執行，否則顯示阻止計算的狀態。
  - `sourcesFor` 以欄位路徑 (例如 `stacking.combine`) 對應來源，取代該欄位的項目層級 `sources`。
  - 另有載明 `null` 意義的欄位維持該意義：`icon` (沒有符合圖片守則的圖片)、`chargeCost` (兩個蓄力參數皆為 0)、武器的 `passive` (武器沒有固定效果) 與武器或法術的 `name` (沒有來源提供名稱)。
- 百分比以有號數字儲存 (例如 `10`、`-5`)，倍率由程式推導。
- 每個效果的資源增量依來源記載逐筆記錄，不以通用的每點換算推導。
- 有 +1／+2／+3 等級的效果是一個效果加 `tiers` 陣列；每級保留遊戲內 `gameId`，名稱沒有 `+N` 後綴的等級為 `tier: 0`。規則欄位 (`availability`、`requiresCurse`、`stacking`、`targets`、`stats`) 各級相同時記在效果上，否則記在各級，嚴禁兩處都記。嚴禁默默捨棄或合併各級不同的值。
- 遺物效果依遊戲內遺物篩選的分類樹歸類：每個效果都有 `subcategory`，每個大類與子分類保留遊戲內 `gameId`。不是取自遊戲文字的分類中文名稱為本站暫譯，頁面必須註明。
- 每個效果都有 `name` (`zh` 與 `en`) 與 `icon`。嚴禁以其他圖片替代 `icon: null`。
- `detail` 記錄效果或等級的社群詳細說明：`en` 是經匯入腳本去除前後空白的來源原文，`zh` 是譯文。數字、物品或地點與鎖定版本遊戲參數矛盾的說明，改依參數撰寫中英文，並帶有自己的 `sources`。資料集沒有說明的效果，只有在 AttachEffectParam 列能以明確的引用關係給出數值，且說明提供名稱以外的資訊時，才依參數撰寫說明。
- 每一列武器都是獨立的項目，即使與其他列的 `sortId` 相同也不合併；嚴禁把其他列的名稱套到未具名的列。共用同一 `textId` 的戰技仍是各自獨立的項目，保留各自的 `fp` 與 `icon`。

### 標籤、加成對象與相關能力值

- 標籤用來分類遊戲物品，讓遺物效果可以比對適用對象。定義放在 common.json 的 `tags`，依維度分組 (`weaponType`、`spellType`、`spellSchool`)；每個標籤的 `param` 是它代表的遊戲參數值。武器種類名稱取自遊戲內遺物篩選的子分類名稱；法術類型與系別名稱摘自遊戲內遺物詞條名稱 (例如由「強化卡利亞劍的魔法」取「卡利亞劍」)。只有被遺物效果指定為對象的法術系別才建立標籤。
- 物品的 `tags` 為 `{ <維度>: [...] }`：空清單表示已核對且沒有已定義的標籤，`null` 表示未核實，`conflict` 保留每個候選值。
- 遺物效果的 `targets` 使用相同的維度，另有 `spell` 與 `skill`：法術 ID 與戰技 ID 的清單，以物品自身 ID 比對，不記在 `tags`。`targets` 的每個值都是清單。`targets` 列出的每個維度中，物品標籤至少有一個相同的鍵時才符合 (維度之間須全部符合，同一維度內符合其一即可)；未列出的維度不檢查。任一列出的維度確定不符時判定為不符；否則列出的維度未核實時判定為未核實，來源分歧時顯示分歧。頁面只把比對結果為符合的項目列為相符；未核實或來源分歧的比對結果不列為相符 (武器、法術與戰技頁只列出數量)；遺物詞條的相關項目清單另不列出未具名的項目。
- 遺物效果的 `stats` 依 `stats` 的順序，列出 common.json 中該效果的遊戲參數欄位會改變其數值的 `stats` 鍵；每個能力值的 `param` 列出改變它的欄位，任一欄位改變即算改變。上限 (`maxHp`、`maxFp`、`maxStamina`) 有 `base`，即同樣會改變它的基礎能力值。`stats` 只來自遊戲參數，因此沒有未核實或來源分歧的狀態。
- `targets` 與 `stats` 只記錄效果的遊戲參數欄位或已核實引用鏈明確指向的物品類別、物品與能力值。符合只表示存在該參數關聯，不表示詞條的作用方式、觸發時機，也不表示對每個列出的項目都生效。沒有 `targets` 的效果表示物品關聯尚未建模，沒有 `stats` 的效果表示能力值關聯尚未建模，不等於沒有關聯。顯示這些關聯的每個頁面必須說明它們是參數關聯 (例如「相關遺物詞條（依參數關聯）」)。

## 資料產生

- 下列檔案由腳本產生，嚴禁手動編輯：
  - `public/data/relics/*.json`：[tools/import-relics.mjs](tools/import-relics.mjs) (`node tools/import-relics.mjs [category ...]`)。
  - `public/data/armaments/*.json`：[tools/import-armaments.mjs](tools/import-armaments.mjs) (`node tools/import-armaments.mjs`)。
  - `public/data/characters/nightfarers.json`：[tools/import-characters.mjs](tools/import-characters.mjs) (`node tools/import-characters.mjs`)。
  - `dist/`：[tools/build-site.mjs](tools/build-site.mjs) (見「網站」)；執行任何匯入腳本後都要重新建置。
- 修改 `tools/` 與 `public/data/common.json` 中相關的輸入，在專案根目錄重新執行腳本，並檢查腳本印出的訊息與產生檔的 diff。import-armaments 必須在 import-relics 之前執行，因為遺物的 `targets.skill` 必須指向 `armaments/skills.json` 收錄的戰技。驗證失敗時，腳本在寫出產生檔前停止；必須修正回報的輸入，嚴禁繞過或削弱檢查。render.js 也以同樣方式驗證載入的資料。
- 三支腳本都透過 [tools/sources.mjs](tools/sources.mjs) 讀取 [tools/relics-config.json](tools/relics-config.json) 鎖定的來源，因此遺物、武器與角色來自同一份遊戲參數。更新來源時，修改設定檔中的 commit 或 revision，重新執行腳本，並在提交前檢查差異與受影響的譯文。遊戲參數更新後，必須以新參數重新核對每一筆參數重寫。
- 執行 import-armaments 或 import-characters 後，執行 `python tools/fetch-icons.py`，下載 `public/images/` 尚未有的武器、法術、戰技與角色能力圖示。

### 遺物輸入檔

- [tools/relics-config.json](tools/relics-config.json)：鎖定的來源、分類樹、渡夜者欄位、狀態圖示編號 → 圖示鍵與遺物圖示編號 → 圖示鍵的對應 (`null` 表示沒有相符的授權圖片)，以及 `heroes`。
- [tools/relics-curated.json](tools/relics-curated.json)：人工整理的效果，以 `gameId` 對應產生的效果；其欄位覆寫產生值。
- [tools/relic-details-zh.json](tools/relic-details-zh.json)：各社群詳細說明的繁體中文譯文，以 `gameId` 為鍵並保存英文原文。
- [tools/relic-details-params.json](tools/relic-details-params.json)：依遊戲參數重寫的說明，以 `gameId` 為鍵，並保存社群原文與參數證據。同一 `gameId` 嚴禁同時出現在兩個說明檔。
- [tools/relic-stacking.json](tools/relic-stacking.json)：資料集未載明的等級之自身可否疊加，只取自明確寫出的社群來源 (社群試算表或 Fextralife)，並保存引用的來源原文。
- [tools/relic-penalties.json](tools/relic-penalties.json)：增益詞條繁中說明中屬於負面代價的片段，為完全相符的子字串。必須列出說明中的每個代價，包括各等級的數字。
- 腳本依效果引用的 SpEffectParam 列推導 `targets` 與 `stats`；只有在 `tags` 中有定義的參數值會產生標籤。
- 翻譯詳細說明：
  - 每個數字保持相同的數字字元；嚴禁計算、四捨五入或換算單位。
  - 使用該效果的官方中文名稱與遊戲用語；沒有官方中文名稱的用語保留英文。
  - 原文的 `TODO` 等註記譯為「（原文註記：……）」；原文與效果名稱矛盾時照譯並加「（原文如此）」。譯文中嚴禁修正原文；與遊戲參數的矛盾改記在參數重寫檔。

### 武器、法術與戰技研究

- 武器：`EquipParamWeapon` 中 ID 為 10000 的倍數、`wepType` 有 `weaponType` 標籤、兩種語言都有名稱、`sortId` 不是 9999999，且有 `EquipParamCustomWeapon` 列 (《黑夜君臨》的武器生成參數) 指向的每一列；以及每一列搭載法術的武器，不論是否具名。只有名稱與種類不足以表示武器存在於《黑夜君臨》：本篇有、《黑夜君臨》沒有的武器仍有 `EquipParamWeapon` 列，但沒有生成列。
- 法術：武器法術槽位引用的每個 ID。`spellType` 取自 `Magic.ezStateBehaviorType`，`spellSchool` 取自 `Magic.subCategory1`/`subCategory2`。被引用但沒有 `Magic` 列的 ID 兩者皆為 `null`，嚴禁依名稱、搭載的武器或所在的本篇清單推定法術分類。`spellType` 恰有一個已知類型的法術列在魔法頁或禱告頁；類型未核實或來源分歧的法術列在武器頁的查證限制章節。
- 名稱：武器與法術名稱取自《艾爾登法環》本篇文字 (`erText`)：武器依武器 ID 取 `WeaponName`；法術只依 ID 取本篇的魔法與禱告清單，嚴禁取自 `GoodsName`，因為其 ID 會與鑰匙等道具重疊。空白、`%null%` 與 `[ERROR]` 不算名稱。頁面必須註明這些是本篇參考名稱，尚未確認與《黑夜君臨》一致。
- 武器數值 (`attack`、`scaling`、取自 `criticalAtkRate` 的 `critical`、異常狀態 `buildup`) 是原始參數。《黑夜君臨》的攻擊力另隨等級與稀有度變化，因此嚴禁呈現為遊戲內攻擊力或補正等級，頁面必須註明這些是原始參數。`passive` 只存 `attachEffectId` 引用的 `AttachEffectParam` 列的名稱，依其 `attachTextId` 查《黑夜君臨》詞條文字 (`game-text`)。沒有內容的欄只表示收錄的欄位沒有內容，不表示武器沒有其他效果。
- 武器戰技：`skill.default` 為 `swordArtsParamId`；`skill.pool` 是武器生成列引用的 `SwordArtsTableParam` 戰技池中，`chanceWeight` 大於 0 的戰技聯集。`swordArtsTableId` 為 -1 的生成列沒有戰技池，嚴禁推定為預設戰技或把預設戰技加入 `pool`。這些是參數上的關係，不證明撿到的武器帶哪個戰技或各戰技的機率，因此頁面稱之為「參數預設」與「生成池候選」，必須說明這些是參數上的關係，嚴禁把預設戰技呈現為武器的固定戰技。
- 戰技：具名武器引用的每個 `SwordArtsParam` 列。`fp` 保留原始的 `useMagicPoint_*`；嚴禁把 -1 解讀為不消耗。`group` 是唯一符合戰技 `sortGroupId` (該項目列有 `defaultWepAttr` 時也須符合) 的 `skillGroups` 項目。分組名稱取自官方的屬性與武器種類用語，以及說明開頭的「專用戰技」，只有「無屬性」為本站命名。顯示分組的頁面必須說明：分組表示參數如何排序戰技，不表示戰技的傷害屬性或可用的武器，且「無屬性」為本站命名。
- 法術消耗：`cost` 與 `chargeCost` 是尚未套用減少消耗效果的原始參數。嚴禁把 `chargeCost` 呈現為法術能否蓄力：非 0 值不足以說明蓄力施放的方式，0 不代表不消耗，兩行嚴禁相加。
- 圖示：武器、法術與戰技圖示依圖片守則取自 Eldenpedia。無法依名稱判斷圖示屬於哪一個 `SwordArtsParam` 列時 (多列共用同一 `textId`，或同一英文名稱屬於多個 `textId`)，該戰技為 `icon: null`。

### 角色研究

- 設定檔的 `heroes` 把 common.json 的每個 `characters` 鍵對應到其 `HeroParam` 與 `HeroMenuParam` ID。`HeroMenuParam` 沒有角色欄位，依 ID 順序對應，因此必須以 Eldenpedia 的評級核對此對應。
- 評級：`HeroMenuParam` 的 `*Grade` 值 0 到 4 為 S 到 D。
- 等級：錨點是從角色的 `heroStatusParamId` 開始、ID 連續的 `HeroStatusParam` 列，各列的等級為其 `totalLevel`。錨點之間的等級取前後最近錨點的線性插值並向下取整。參數沒有載明這條規則，因此這是本站計算值。
- 上限：`maxHp`、`maxFp` 與 `maxStamina` 由 `vigor`、`mind` 與 `endurance` 代入 `CalcCorrectGraph` 的 100、101 與 104 列，不做取整。參數沒有載明遊戲用哪一列，因此上限是本站計算值。
- 等級或上限的算法或參數變動時，必須與 Eldenpedia Nightreign:Attributes 頁的等級表核對結果；格子不同時保留依參數的數值。
- 冷卻時間：`HeroParam` 的 `characterAbilityCooldown`，0 表示沒有冷卻；與 Eldenpedia 不同時，以 `cooldownNote` 引用其數值。使用次數欄位不列出。
- 文字：[tools/character-text-zh.json](tools/character-text-zh.json) 的 `cn` 逐字保存 BWIKI 三語選單文字頁 (以 revision 鎖定、沒有文字 ID 的社群保存) 上的官方簡中選單文字，`en` 取英文段落同一行號的文字。
- 具體數值：[tools/character-effects.json](tools/character-effects.json) 依能力列出條目，二選一：依參數撰寫的 `{ zh, checks, note? }` (來源 `game-params`)，或社群的機制摘要 `{ zh, sources }`，引用以 revision 鎖定的 Eldenpedia 角色頁。
  - 依參數撰寫的條目所顯示的每個數字，必須以含 `display` 的檢查項與參數綁定。
  - 機制摘要只用在參數沒有該機制數字之處，且嚴禁重複官方說明。
  - 社群數字嚴禁寫進依參數撰寫的條目，只能出現在機制摘要或 `note`。與社群記載不同時，保留參數值，並在 `note` 引用社群數值。
  - 角色頁必須以來源連結標示社群機制摘要，並在保留的參數值之後，以附來源的註記列出不同的社群記載。
- 參數列：參數沒有列名稱，因此由 Smithbox 列名稱 (`smithbox-row-names`) 判定參數列屬於哪項能力。只有在列名稱指名該能力，且符合下列之一時才採用該列：該列或其引用鏈有數值與 Eldenpedia 一致；由已採用的列、或該能力的行為 (`BehaviorParam_PC` 技藝 6000000xx、絕活 7000000xx，依 `HeroParam` 順序每名角色 50 個 ID) 經參數引用到達；或沒有數字可比時，效果的種類與方向符合官方說明或 Eldenpedia 的文字描述。只是 ID 與具名列相鄰、或列名稱本身標示不確定的列不採用，嚴禁推測參數列的歸屬。
- 寫法：欄位意義依本篇參數欄位定義 (`smithbox-er-paramdef`) 的官方日文說明，用詞與 [tools/relic-details-params.json](tools/relic-details-params.json) 相同：
  - `*AttackRate` 為「傷害 ×」，五種全部為「所有來源的傷害」；`*AttackPowerRate` 為「攻擊力 ×」；`*DamageCutRate` 為「受到的…傷害 ×」，八種全部為「受到的所有傷害」；`toughnessDamageCutRate` 為「受到的削韌」；`*DefDamageRate` 為「受到的異常累積」；`changeHpRate`、`changeMpPoint`、`changeStaminaRate` 為負值時為「恢復」；`hitRadius` 與 `hitRadiusMax` 為以公尺計的「半徑」與「最大半徑」；`itemDropRate` × 100 為「觀察力」。
  - `AtkParam_Pc` 的補正值是乘在基礎值上的倍率，因此只列同一招內的比值，稱為「攻擊力補正」(`atk…Correction`)、「削韌補正」(`atkSuperArmorCorrection`) 與「精力削減補正」(`atkStamCorrection`)，嚴禁寫成傷害比。傷害值 (`atkMag` 等) 不列出。
  - 《黑夜君臨》新增、沒有官方說明的欄位不列出。
  - 按等級或深夜模式深度分段的數值表，只列首尾兩段或最高一段。

### 戰技與角色文字轉寫

- 戰技的 `name.en` 與 `caption.en` 取自本篇 `ArtsName` 與 `ArtsCaption` (`erArts`)。`name.zh` 取自本篇戰灰名稱 (`erText` 的 `ashesofwar`)：英文名稱去掉 `Ash of War: ` 前綴後與戰技英文名稱相同的戰灰，提供去掉 `戰灰：` 前綴的名稱；嚴禁以戰灰 ID 對應。戰技名稱與說明是尚未確認與《黑夜君臨》一致的本篇文字，頁面必須註明。沒有這種戰灰的戰技，以及所有 `caption.zh`，採用本站轉寫；嚴禁由英文翻譯或自行編造繁體中文名稱。
- 本站轉寫存於 [tools/skill-text-zh.json](tools/skill-text-zh.json) (以 `textId` 為鍵，`cn` 取自社群保存的 `erArtsCn`) 與 [tools/character-text-zh.json](tools/character-text-zh.json)：`cn` 逐字保存官方簡體中文，`zh` 為轉寫。轉寫規則：
  - 先依《黑夜君臨》官方繁中用語替換詞組 (例如 血量 → ＨＰ、专注值 → ＦＰ、通过 → 透過，角色文字另有 绝招 → 絕活)。
  - 其餘每個字依上下文選用繁體字形 (例如 回旋 → 迴旋，精通 仍為 精通，红发 → 紅髮)。
  - 標點依官方繁中 (“” → 「」、· → ‧)。
  - 不增刪內容，數字與換行不變。
  - 有戰灰名稱時，`zh.name` 必須與之相同。
- 《黑夜君臨》官方文字只是這些選擇的參考，不證明官方繁中等於這種轉寫，因此頁面必須稱其為本站轉寫，不是官方繁中。

## 頁面

- 武器頁 (`weapons.html`，`h1` id 為 `weapons`)：每個 `weaponType` 標籤一個 `<section data-weapon-type="<type>">`，`h2` id 為 `weapon-type-<type>`；每列 id 為 `weapon-<id>`。`#limitations` 章節的 `<tbody data-unlisted-spells>` 列出類型未核實或來源分歧的法術。
- 魔法頁與禱告頁：`<section data-spell-type="<type>">` 為類型章節 (`h2` id 為 `sorceries` 或 `incantations`)；每個 `<section data-spell-type="<type>" data-spell-school="<school>">` 為系別章節 (`h2` id 為 `spell-school-<school>`，空系別為 `<type>-no-school`)。每列 id 為 `spell-<id>`。相關詞條只出現在最上層的相符層：類型章節，其次系別章節，再其次法術列。
- 戰技頁 (`skills.html`，`h1` id 為 `skills`)：依 `skillGroups` 的順序，每個鍵一個 `<section data-skill-group="<group>">`，`h2` id 為 `skill-group-<group>`，全部放在 `<div id="skill-list">` 內；分組可包含 `<section data-skill-weapon-type="<type>">` 小節 (`h3` id 為 `skill-unique-<type>`)。每列 id 為 `skill-<id>`。除了「武器、法術與戰技研究」與「戰技與角色文字轉寫」要求的說明之外，頁面必須註明：範圍是具名武器引用的戰技，不是遊戲中全部的戰技；分組與 Eldenpedia 黑夜君臨戰技列表的異同；哪些繁中名稱是官方名稱 (取自戰灰名稱)，哪些名稱與全部說明是本站轉寫。武器頁與有 `targets` 的遺物頁說明一次部分戰技名稱為本站轉寫，並連到戰技頁。
- 角色頁 (`characters.html`，`h1` id 為 `characters`)：每個 `characters` 鍵一個 `<section data-nightfarer="<角色>">`，`h2` id 為 `character-<角色>`，放在 `#character-list[data-nightfarer-list]` 內；`#grades` 章節放 `[data-nightfarer-grades]`，`#levels` 章節放 `[data-nightfarer-levels]`。靜態渲染在 `[data-nightfarer-levels]` 為每名角色放一張等級數值表，以角色名稱為表名，外層元素的 id 為 `character-<角色>-levels`；瀏覽器以互動圖表取代這些表，圖表資料載入失敗時保留數值表。
  - 頁面必須說明：名稱與文字是本站依官方簡中選單文字的轉寫，不是官方繁中；評級是參數值；錨點之間的等級與三項上限是本站計算值 (見角色研究)，直接取自參數的數值要有可辨識的標示，上限一律不標示為直接值；數值不含遺物等改變能力值的效果。
  - 其 `#limitations` 章節必須說明：文字來源的限制、冷卻時間的來源、參數列歸屬與欄位用語的判定方式，以及沒有收錄的內容。
- 能力值頁：每個能力值列的 id 為 `stat-<stat>`，其 `<td data-stat-effects="<stat>">` 列出 `stats` 含該能力值的遺物效果；上限列另在「經由<基礎能力值名稱>」下列出 `stats` 含其 `base` 但不含該上限的效果。
- 遺物頁：效果列由 `<tbody data-relic-table="<subcategory>">` 產生。有 `targets` 的效果把相符的具名武器、法術與戰技連到其列 (`weapons.html#weapon-<id>`、法術類型所在頁的 `#spell-<id>`、`skills.html#skill-<id>`)；有 `stats` 的效果把能力值連到 `attributes.html#stat-<stat>`。
- 色調：render.js 依資料決定色調 class。負面效果為紅色 (`tone-debuff`)；其他效果自身可疊加為藍色 (`tone-stack`)，不可疊加為綠色 (`tone-solo`)，可否疊加未核實、來源分歧或各級不同時為粗體 (`tone-unverified`)。可疊加的效果另外列出不是相加、未核實或來源分歧的合成方式；負面效果保留其疊加規則。代價片段與確定必伴隨負面效果 (`requiresCurse: true`) 的標籤為紅色。各遺物頁顯示依 common.json 的 `legend` 產生的顏色圖例。嚴禁在 HTML 手動設定色調 class。

## 撰寫守則

- 引導外部資源時使用開新視窗，禁止本頁跳轉。
- 依 RWD 原則：螢幕寬度 280px 以上時，頁面 (包含頁首) 都不需橫向捲動。
  - 表格：每個表格放在 `.table-wrap` 內，在 `thead` 有一列表頭，且每列的格數與表頭相同。
  - 關係圖：以會隨螢幕換行的 HTML 方塊與文字製作，不用固定寬度的圖片。
  - 數值圖表：折線圖依容器寬度以 SVG 繪製，寬度改變時重畫；橫條圖以 HTML 元素製作，橫條寬度是所在列的百分比；每張圖表都有數值相同的表格。類別色是 [public/styles.css](public/styles.css) 的 `--series-*` 變數；修改後必須以 dataviz 技能的色票驗證工具，對 `--surface` 驗證淺色與深色的值。
- 提及遊戲內項目時，必須在 [Eldenpedia](https://eldenring.wiki.gg/) 找到該項目的遊戲內圖片：
  - 只採用檔案頁授權標示為遊戲素材 (`{{License|game}}`) 的圖片；社群編修圖 (例如檔名含 `Custom`) 不算。
  - 圖片下載至 `public/images/`。大於 96px 的圖片可縮小為 96px，嚴禁其他修改。
  - 出處：common.json 的每個圖示以 `page` 記錄檔案頁，首頁以 `<span data-icon-sources>` 列出。武器、法術、戰技與角色能力的圖示，檔案頁記在項目或角色資料中，首頁說明一次其 Eldenpedia 系列。
- 同一種編排位置的圖片必須維持相同大小。圖片一律使用 `.icon` class，尺寸只在 `public/styles.css` 依位置設定，嚴禁在個別圖片上調整：表格內 48px (`td .icon`)、表格內的名稱清單 24px (`td .entry .icon`)、正文內 24px (`.icon`)。出現新的編排方式時，先在 `public/styles.css` 新增該位置的尺寸規則。`<img>` 的 `width`/`height` 屬性與該位置的尺寸一致。
