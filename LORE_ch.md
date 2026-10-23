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
  - 新增主題頁面時，同時在首頁 [public/index.html](public/index.html) 該主題的表格新增一列；新主題在首頁另立一個 `h2` 章節。
  - 頁面改名或併入其他頁面時，在 [netlify.toml](netlify.toml) 新增舊路徑的 301 轉址，並保留原標題 id，讓舊錨點仍可使用。已上線的章節移到其他頁面時，在 [public/nav.js](public/nav.js) 的舊錨點表 (`moved`) 把「頁名#id」導向新頁面；章節在同頁內移除或合併時，把舊 id 保留在接手內容的元素上。
  - 每個頁面在 [public/render.js](public/render.js) 之前載入 [public/nav.js](public/nav.js)，讓頁首在渲染內容對準網址錨點前就已存在，並使用與現有頁面相同的固定頁首 `<header class="site-header">` 標記。頁首是全站的導覽：讀者在任何章節都能看到本頁全部章節並直接跳過去，不必回到頁面頂端，因此嚴禁在頁面另寫手寫目錄。腳本依頁面本身產生頁首的兩行：
    - 階層列：網站首頁、本頁 `h1` (首頁本身省略，因首頁連結已代表該頁)，以及讀者目前所在的 `h3`，每層連到該層開頭。
    - 章節列：依文件順序列出本頁全部 `h2`，名稱取自渲染後的標題文字；目前章節以 `aria-current="location"` 標示，位於第一個 `h2` 之前的導言時不標示任何章節。寬螢幕時章節列換行，全部章節保持可見；寬度 640px 以下或高度 500px 以下 (橫向手機) 為單行，可橫向捲動並顯示捲軸，焦點不在章節列內時自動把目前章節捲到可見位置。
    - 每個頁面以 `h2` 分章，章節列因此列出該頁的大項目。只有帶 `id` 的 `h2` 與 `h3` 會出現在頁首，因此每個章節標題必須有 `id`。
  - 全站引用的來源只在首頁 [public/index.html](public/index.html) 的「資料來源」章 (`#sources`) 列出一次；嚴禁在主題頁另設資料來源章，詞條表嚴禁加入來源欄。頁面開始引用新來源時，在該表新增或更新對應的列。內文中的引用連結與來源分歧候選值標示的來源名稱留在頁面上。

## 遊戲資料守則

- 網站只從 `public/data/` 讀取遊戲數值 (數字與規則標籤)、佔位元素產生的效果、能力值及分類名稱，以及它們的來源；產生其中部分檔案的維護輸入放在 `tools/` (見遺物資料產生)：
  - [public/data/common.json](public/data/common.json)：所有頁面共用的遊戲版本、能力值 (`stats`)、圖示、角色、標籤 (`tags`)、介面文字 (`labels`) 與來源。
  - `public/data/relics/<category>.json`：遊戲內遺物篩選的每個大類一個檔案 (`general`、`character`、`armament`、`demerit`)，記錄該大類、其子分類及效果。
  - `public/data/armaments/weapons.json` 與 `public/data/armaments/spells.json`：以遊戲內 ID (`EquipParamWeapon` 的列，或武器槽位引用的法術 ID) 為鍵的武器與法術，各有 `name` (`zh` 與 `en`，沒有來源提供名稱時為 `null`)、`icon`、`tags` 與來源。武器另保留 `sortId`；搭載法術的武器以 `spells` 記錄各槽位 (`R1`、`R2`) 的法術 ID。具名武器另保留原始參數值 (見武器與法術資料產生)：`attack` (`physical`、`magic`、`fire`、`lightning`、`holy`)、`scaling` (鍵為 `stats` 的 `strength`、`dexterity`、`intelligence`、`faith`、`arcane`)、`critical`、`passive` (`zh` 與 `en`，或 `null`) 與 `buildup` (異常狀態鍵對應累積值，沒有時為 `{}`)。有 `Magic` 列的法術另保留原始消耗參數：`cost` (`fp`、`stamina`) 與 `chargeCost` (`fp`、`stamina`，或 `null`)。每一列武器都是獨立的項目，即使與其他列的 `sortId` 相同也不合併；嚴禁把其他列的名稱套到未具名的列。
  - 其他遊戲主題的資料放在 `public/data/` 下以主題命名的檔案或目錄，並依遊戲本身的分組拆分，如同 `relics/` 依遊戲內遺物篩選拆分；多個主題共用的定義留在 `common.json`。
  - 每個頁面在 `<body data-load>` 列出要載入的檔案，例如 `common relics/general`。[public/render.js](public/render.js) 會區分遺物大類檔 (`category`)、武器檔 (`weapons`) 與法術檔 (`spells`)，其他檔案以錯誤停止；遇到重複的效果鍵、效果或等級的 `gameId`、子分類鍵、武器 ID 或法術 ID (各種類分別檢查)，物品標籤或效果 `targets` 的鍵未在 `tags` 定義，效果 `stats` 的鍵或能力值的 `base` 未在 `stats` 定義，以及有載入法術檔時武器搭載的法術或 `targets.spell` 的 ID 不存在，皆以錯誤停止；嚴禁讓後載入的檔案覆蓋先載入的檔案。
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
- 標籤 (tags) 用來分類遊戲物品，讓遺物效果可以比對適用對象。定義放在 [public/data/common.json](public/data/common.json) 的 `tags`，依維度分組 (`weaponType`、`spellType`、`spellSchool`)；每個標籤為 `{ "name": { "zh", "en" }, "param": <值> }`，`param` 是該標籤代表的遊戲參數值 (`EquipParamWeapon.wepType`、`Magic.ezStateBehaviorType`、`Magic.subCategory1`/`subCategory2`)。武器種類名稱取自遊戲內遺物篩選的子分類名稱；法術類型與系別名稱摘自遊戲內遺物詞條名稱 (例如由「強化卡利亞劍的魔法」取「卡利亞劍」)。只有被遺物效果指定為對象的法術系別才建立標籤。
  - 物品的 `tags` 為 `{ <維度>: [...] }`：標籤鍵的清單，空清單表示已核對且沒有已定義的標籤；`null` 表示未核實；`conflict` 保留每個候選值。
  - 遺物效果的 `targets` 使用相同的維度，例如 `{ "spellType": ["sorcery"], "spellSchool": ["carian-sword"] }`，另有 `spell`：指定個別法術的法術 ID 清單；法術以自身 ID 比對 `spell`，因此 `spell` 不在 `tags` 定義，也不記在法術的 `tags`。`targets` 列出的每個維度中，物品標籤至少有一個相同的鍵時才符合 (維度之間須全部符合，同一維度內符合其一即可)；效果未列出的維度不檢查。任一列出的維度確定不符時判定為不符；否則列出的維度未核實時判定為未核實，來源分歧時顯示分歧。
  - `targets` 記錄效果的遊戲參數欄位或已核實引用鏈明確指向的物品類別或物品 (見遺物資料產生)。符合只表示存在該參數關聯；作用方式、觸發條件與限制見詞條本身。沒有 `targets` 的效果表示尚未建模，不等於沒有關聯。
- 遺物效果的 `stats` 依 `stats` 的順序，列出 [public/data/common.json](public/data/common.json) 中該效果的遊戲參數欄位會改變其數值的 `stats` 鍵 (見遺物資料產生)。每個能力值的 `param` 將參數表 (`SpEffectParam`、`HeroStatusParam`) 對應到改變它的欄位所組成的非空清單，其中任一欄位改變即算改變；`poise` 對應 `toughnessDamageCutRate`，即受到削韌的倍率。`attackPower` 合併五種攻擊倍率 (`physicsAttackRate`、`magicAttackRate`、`fireAttackRate`、`thunderAttackRate`、`darkAttackRate`)，`damageNegation` 合併八種減傷倍率 (`slash`、`blow`、`thrust`、`neutral`、`magic`、`fire`、`thunder`、`dark` 加 `DamageCutRate`)，`ailmentResistance` 合併七種抵抗力 (`change` 加 `Poison`、`Disease`、`Blood`、`Freeze`、`Sleep`、`Madness`、`Curse` 加 `ResistPoint`)。上限 (`maxHp`、`maxFp`、`maxStamina`) 有 `base`，即同樣會改變它的基礎能力值 (`vigor`、`mind`、`endurance`)。與 `targets` 相同，符合只表示存在該參數關聯，沒有 `stats` 的效果表示尚未建模，且 `stats` 屬於規則欄位。`stats` 只來自遊戲參數，因此沒有未核實或來源分歧的狀態：不是清單時 [public/render.js](public/render.js) 以錯誤停止。
- 遺物效果依遊戲內遺物篩選的分類樹歸類：每個效果都有 `subcategory`，每個大類與子分類保留遊戲參數 `gameId`。不是取自遊戲文字的分類中文名稱為本站暫譯，頁面必須註明。
- 每個效果都有 `name` (`zh` 與 `en`) 與 `icon`。`icon: null` 表示沒有符合圖片守則的遊戲內圖片，嚴禁改用其他圖片替代。
- 武器頁 (`weapons.html`)、魔法頁 (`sorceries.html`) 與禱告頁 (`incantations.html`) 的章節名稱、章首詞條與表格列由資料產生；HTML 只放章節骨架，嚴禁手寫名稱與表格列：
  - 武器頁：每個 `weaponType` 標籤一個 `<section data-weapon-type="<type>">`，`h2` 的 id 為 `weapon-type-<type>`；不是每個標籤恰有一章時頁面以錯誤停止。章內表格依 `sortId` 列出該種類的具名武器，欄位為「基礎攻擊」與「能力補正」(非 0 的值每項一行，以攻擊屬性標籤與能力值名稱命名) 與「特殊效果」(`critical` 不是 1 時先列「致命補正 <值>」，多數武器為 1；接著 `passive` 名稱；接著每個 `buildup` 項目一行「命中累積<異常狀態> <值>」)；沒有內容的欄顯示「—」，只表示收錄的欄位沒有內容，不表示武器沒有其他效果。這些數值只來自遊戲參數，沒有未核實或來源分歧的狀態：缺鍵、多鍵或不是數字時頁面以錯誤停止。頁面註明這些是原始參數值，不是遊戲內顯示值。每列 id 為 `weapon-<id>`，是遺物頁「相關武器與法術」連結的目標。`h1` 保留 id `weapons`；`#limitations` 章節的 `<tbody data-unlisted-spells>` 列出類型未核實或來源分歧的每個被引用法術，含類型、系別、搭載法器與「相關遺物詞條」欄。這些法術不依名稱或搭載的法器分類。
  - 魔法頁與禱告頁：`<section data-spell-type="<type>">` 為類型章節 (`h2` id 為 `sorceries` 或 `incantations`)，只列 `targets` 僅以該類型即相符的詞條。每個 `<section data-spell-type="<type>" data-spell-school="<school>">` 為系別章節 (`h2` id 為 `spell-school-<school>`)；系別為空字串者是「無已定義系別」章節 (`h2` id 為 `<type>-no-school`)。系別章節依 ID 列出該類型中 `spellSchool` 恰為該系別的法術 (空字串對應 `[]`)，欄位為「FP 消耗」與「耐力消耗」(`cost` 的值；`chargeCost` 不是 `null` 時第二行為「蓄力參數 <值>」) 及「搭載法器」；每列 id 為 `spell-<id>`。這兩頁的法術 `cost` 不是兩個數字，或 `chargeCost` 既不是 `null` 也不是兩個數字時，頁面以錯誤停止。該類型的每個法術不是恰好出現在一章時頁面以錯誤停止。`spellType` 恰為魔法或禱告其中之一的法術在該頁，其餘在武器頁；`spellType` 清單不是恰好一個鍵時頁面以錯誤停止。
  - 相關詞條依上述比對規則分層列出，同一詞條只出現在最上層的相符層：類型章節，其次系別章節 (略過只以類型即相符的詞條)，再其次法術列的法術名稱下方 (略過在系別章節也相符的詞條，即剩下 `spell` 加成對象)。武器章節列出與其 `weaponType` 相符的詞條。章節與列顯示「相關遺物詞條（依參數關聯）」後接詞條連結；比對結果為未核實或來源分歧的詞條只以粗體列出數量；沒有相符詞條的章節顯示「本次建模範圍內無符合詞條」，沒有專屬詞條的法術列不顯示。由頁面計算 (頁面載入四個遺物大類檔與兩個武器法術檔)，資料不另存反向清單。符合只表示存在參數關聯，不表示詞條對章內每一項都生效。「搭載法器」欄列出具名法器與搭載該法術的槽位 (`R1`、`R2`)，未具名的法器依槽位只列出不同武器 ID 的數量。記在各級的 `targets` 尚未支援顯示：頁面以錯誤停止，不合併各級結果。
  - 原本合併的 `armaments.html` 在 [netlify.toml](netlify.toml) 轉到 `weapons.html`，瀏覽器保留錨點。在武器頁上，[public/nav.js](public/nav.js) 把 `#sorceries`、`#incantations` 轉到新頁面，[public/render.js](public/render.js) 把本頁沒有的 `#spell-<id>` 轉到該法術類型所在的頁面，因此舊錨點仍可使用。已移除的落葉格鬥術與丹恩流踢擊術在查證限制的收錄規則項目中，以名稱保留 `weapon-<id>` id。
- 能力值頁每個能力值列的「相關遺物詞條」欄 (`<td data-stat-effects="<stat>">`) 列出 `stats` 含該能力值的遺物效果，各自連到詞條列；上限列接著在「經由<基礎能力值名稱>」下列出 `stats` 含其 `base` 但不含該上限的效果。由頁面計算 (頁面載入四個遺物大類檔)，資料不另存反向清單。記在各級的 `stats` 尚未支援顯示：頁面以錯誤停止。每個能力值列的 id 為 `stat-<stat>`，是遺物頁「相關能力值」連結的目標。
- 遺物詞條表的效果列以 `<tbody data-relic-table="<subcategory>">` 由資料產生；嚴禁在 HTML 手寫效果列。效果欄先列說明，再列規則行；由結構化數值 (`modifier`) 產生的數值行只在效果沒有說明時列出，因為說明已含相同數字。來源分歧的候選值一律連同來源列出。既沒有說明也沒有結構化數值的效果，依其色調顯示「未載明數值」。規則行不列取得方式 (由「種類」欄呈現) 與增益的自身可否疊加 (由色調呈現)；藍色也代表多份數值相加，因此增益的合成方式只在不是 `add` 時列出，不同等級是否同時生效只在不是 `true` 時列出；自身可否疊加來源分歧時仍列出各候選說法。負面效果一律為紅色，因此其規則行保留自身可否疊加的狀態。「種類」欄依 `availability` 列出「一般」及／或「深層」；固定遺物詞條 (`relics`) 列出每個遺物的圖示與名稱；分級詞條出現在兩種以上的種類時，每一行都列出該種類的等級 (例如「一般：+1、+2、+3」與「深層：+3」)，只出現在一種時只寫種類 (例如「一般」)；取得方式尚未核實或來源分歧時顯示對應狀態。有 `targets` 的效果，效果欄接著顯示「相關武器與法術」：依上述比對規則，列出標籤與 `targets` 比對結果為符合的具名武器 (依 `sortId`) 與具名法術 (依 ID)，各附圖示與名稱並連到該項目的列 (`weapons.html#weapon-<id>`，或依上述規則在法術類型所在頁的 `#spell-<id>`)。比對結果為未核實或來源分歧的項目與未具名的項目不列出；沒有可列項目時不顯示此行。不是清單的值或記在各級的 `targets`，頁面以錯誤停止。有 `targets` 的遺物頁載入 `armaments/weapons` 與 `armaments/spells`，缺少任一檔時以錯誤停止，並註明名稱為本篇參考名稱。效果欄最後一行只在效果有 `stats` 時出現：「相關能力值」後依 `stats` 順序列出各能力值的圖示與名稱，各自連到能力值頁的該列 (`attributes.html#stat-<stat>`)；只列 `stats` 中的鍵，不依 `base` 補列上限；記在各級的 `stats` 使頁面以錯誤停止。
- [public/render.js](public/render.js) 依色調顯示資料產生的說明、數值行與內文例子：負面效果大類的詞條為紅色 (`tone-debuff`)；其他詞條自身可疊加 (`stacks: true`) 為藍色 (`tone-stack`)，不可疊加 (`stacks: false`) 為綠色 (`tone-solo`)；可否疊加尚未核實或來源分歧時維持預設顏色並以粗體標示 (`tone-unverified`)。遺物詞條表中，狀態為尚未核實或來源分歧的規則標籤，以及分歧候選值的「來源分歧」標籤，也以粗體標示 (`tone-unverified`)。規則行中的等同值 (例如「等同生命力 +5」) 採用詞條的色調。說明中列為代價的片段在該說明的色調中以紅色標示。確定必伴隨負面效果 (`requiresCurse: true`) 的規則標籤為紅色。各遺物頁在視窗底部固定顯示顏色圖例 (`<aside class="tone-legend" data-legend>`)，依 [public/data/common.json](public/data/common.json) 的 `legend` 產生：每一項有 `tone` (class 後綴)、`label` 與滑鼠移上或聚焦時顯示的 `tip`；各項為「不可疊加」(綠)、「可疊加」(藍)、「負面」(紅) 與「未核實」(粗體)。嚴禁在 HTML 手動設定色調 class。
- 效果的每一級說明結尾都有相同的括號附註時 (例如「（不適用於隱士、復仇者、執行者）」)，頁面從每一級移除該附註，改在各級之後以「各等級：<附註>」列一次；資料保留完整原文。
- `detail` 記錄效果或等級的社群詳細說明：`en` 是來源原文，`zh` 是譯文。數字、物品或地點與鎖定版本遊戲參數矛盾的說明，改依參數撰寫中英文，並帶有自己的 `sources`。資料集沒有說明的效果，只有在 AttachEffectParam 列能以明確的引用關係給出數值，且說明提供名稱以外的資訊時，才依參數撰寫說明；否則不寫說明。

## 遺物資料產生

- `public/data/relics/*.json` 由 [tools/import-relics.mjs](tools/import-relics.mjs) 產生 (在專案根目錄執行 `node tools/import-relics.mjs [category ...]`)；嚴禁手動編輯。修改輸入檔後重新執行：
  - [tools/relics-config.json](tools/relics-config.json)：各來源鎖定的 commit、分類樹、渡夜者欄位，圖示編號 → 圖示鍵的對應 (`null` 表示沒有相符的授權圖片)，以及遺物圖示編號 → 圖示鍵的對應。
  - [tools/relics-curated.json](tools/relics-curated.json)：人工整理的效果，以 `gameId` 對應產生的效果；其欄位覆寫產生值，腳本會列出每個被覆寫的差異。
  - [tools/relic-details-zh.json](tools/relic-details-zh.json)：各社群詳細說明的繁體中文譯文，以 `gameId` 為鍵並保存英文原文。
  - [tools/relic-stacking.json](tools/relic-stacking.json)：資料集未載明的等級之自身可否疊加，以 `gameId` 為鍵，只取自明確寫出的社群來源 (社群試算表或 Fextralife)；每筆保存 `stacks` (布林值，來源不同時為 `conflict`)、`sources`，以及 `quotes` 中引用的來源原文。腳本只填入未知的值，並在效果的 `sourcesFor["stacking.stacks"]` 列出這些來源，連同資料集已給值之等級的來源。
  - [tools/relic-details-params.json](tools/relic-details-params.json)：依遊戲參數撰寫的說明，以 `gameId` 為鍵；每筆保存社群原文 `source` (資料集沒有說明時為 `null`)、重寫的 `en` 與 `zh`、參數證據 `params`，以及可省略的 `sources` (預設 `game-params`)。同一 `gameId` 嚴禁同時出現在兩個說明檔。
  - [tools/relic-penalties.json](tools/relic-penalties.json)：增益詞條繁中說明中屬於負面代價的片段，以擁有該說明的 `gameId` 為鍵；值為完全相符的子字串陣列 (例如 `"生命力 -5"`)，寫入 `detail.penalties`。必須列出說明中的每個代價，包括各等級的數字。
- 人工整理的效果、譯文、效果或遺物圖示、角色或來源引用 (`sources`、`sourcesFor`、conflict 候選) 找不到對應；兩個人工整理的效果對應相同的 `gameId`；來源欄位出現未知的列舉值；譯文保存的英文原文或參數重寫的 `source` 與來源不同；同一 `gameId` 同時有譯文與參數重寫；參數重寫缺少 `en`、`zh` 或 `params`、`sources` 為空陣列，或找不到對應的效果；效果的規則欄位 (`availability`、`requiresCurse`、`stacking`、`targets`、`stats`) 同時記在效果層與等級；效果產生多組不同的 `targets` 條件，或 `startMagicId` 不是任何武器槽位引用的法術；疊加補值找不到對應的效果、指向資料集已給值的等級、引用社群試算表與 Fextralife 以外的來源、未對每個來源附一句引用原文，或 `stacks` 不合法 (conflict 需至少兩個值不同的布林候選，且各自引用已列出的來源)；代價條目不是非空字串組成的非空陣列、找不到對應的說明、列出說明中沒有的片段，或以數字結尾的片段只對到較長數字的一部分且該位置沒有較長的已列片段；或任一說明檔、疊加檔或代價檔的鍵重複或不等於 `JSON.stringify` 2 空格縮排的標準輸出時，腳本停止且不寫檔。必須修正輸入檔，嚴禁繞過檢查。
- 腳本依效果的 `passiveSpEffectId_1`–`_3` 所指的 SpEffectParam 列，以及這些列透過 `analyzeSelfLevel1_effectId`–`3_effectId` 引用的列產生 `targets`：`triggerOnWepType`、`wepTypeTriggerCount` 大於 0 時的 `wepTypeTrigger` (裝備數量條件) 與 `weaponTypeDiscovery` 產生 `weaponType`；`magicSubCategoryChange1` 為已定義系別，且 `magParamChange` (魔法) 與 `miracleParamChange` (禱告) 只有一個為 1 時，產生 `spellType` 與 `spellSchool`；只有其中一個旗標、三個 `magicSubCategoryChange` 皆為 0 且沒有武器種類時，產生 `spellType`；`magicConsumptionRate` 或 `miracleConsumptionRate` 不是 1 時，產生 `sorcery` 或 `incantation`；`startMagicId` 產生 `spell`，該法術必須是某個武器槽位引用的法術。只有在 `tags` 中有定義的參數值會產生標籤，其他效果不產生 `targets`。重複出現的相同條件只保留一次。`targets` 屬於規則欄位：各級相同時記在效果層，否則記在各級；來源記為 `sourcesFor.targets: ["game-params"]`。效果產生多組不同的條件時腳本停止。
- 腳本從效果的 `passiveSpEffectId_1`–`_3` 與 `permanentSpEffectId` 出發，經 `replaceSpEffectId`、`cycleOccurrenceSpEffectId`、`atkOccurrenceSpEffectId`、`accumuOverFireId`、`accumuUnderFireId` 與 `analyzeSelfLevel1_effectId`–`3_effectId` 找到的 SpEffectParam 列產生 `stats`。找到的列中，能力值的任一 `SpEffectParam` 欄位不等於中性值 (已對應的欄位中，欄位名以 `Rate` 結尾者為 1，其餘為 0)，或從找到的列的 `heroStatusModifier` X 起連號的 X、X+1… 列 (人物詞條的各等級節點) 中，任一列的 `HeroStatusParam` 欄位不是 0，即算改變該能力值。沒有改變任何能力值的效果不產生 `stats`。`param` 的值不是非空清單、已對應的欄位不在參數表標頭，或找到的列中已對應欄位的值不是數字時，腳本停止且不寫檔。`stats` 各級相同時記在效果層，否則記在各級；來源記為 `sourcesFor.stats: ["game-params"]`。
- 更新來源時，修改設定檔中的 commit，重新執行腳本，並在提交前檢查列出的差異與需要重譯的項目。遊戲參數更新後，必須以新參數重新核對每一筆參數重寫。
- 翻譯詳細說明：
  - 每個數字保持相同的數字字元；嚴禁計算、四捨五入或換算單位。
  - 使用該效果的官方中文名稱與遊戲用語；沒有官方中文名稱的用語保留英文。
  - 原文的 `TODO` 等註記譯為「（原文註記：……）」；原文與效果名稱矛盾時照譯並加「（原文如此）」。譯文中嚴禁修正原文；與遊戲參數的矛盾改記在參數重寫檔。

## 武器與法術資料產生

- `public/data/armaments/*.json` 由 [tools/import-armaments.mjs](tools/import-armaments.mjs) 產生 (`node tools/import-armaments.mjs`，在專案根目錄執行)；嚴禁手動編輯。兩支匯入腳本都透過 [tools/sources.mjs](tools/sources.mjs) 讀取 [tools/relics-config.json](tools/relics-config.json) 鎖定的來源，遺物、武器與法術一律來自同一份遊戲參數。
  - 武器：`EquipParamWeapon` 中 ID 為 10000 的倍數、`wepType` 有 `weaponType` 標籤、有名稱、`sortId` 不是 9999999，且有 `EquipParamCustomWeapon` 列以 `targetWeaponId` 指向 (《黑夜君臨》的武器生成參數，含武器等級與附加效果表) 的每一列；以及每一列搭載法術 (`equippedSpell_R1`/`equippedSpell_R2`) 的武器，不論是否具名。本篇有、《黑夜君臨》沒有的武器 (例如落葉格鬥術、丹恩流踢擊術) 仍有 `EquipParamWeapon` 列，但沒有 `EquipParamCustomWeapon` 列，因此只有名稱與種類不足以表示武器存在於遊戲中。
  - 法術：武器法術槽位引用的每個 ID。`spellType` 取自 `Magic.ezStateBehaviorType`，`spellSchool` 取自 `Magic.subCategory1`/`subCategory2`，只保留有定義標籤的值 (沒有時為 `[]`)。被引用但沒有 `Magic` 列的 ID 兩者皆為 `null`，嚴禁依名稱、搭載的武器或所在的本篇清單推定分類。
  - 名稱：遊戲參數沒有名稱，也沒有可用的黑夜君臨武器、法術文字，因此名稱取自鎖定為 `erText` 的《艾爾登法環》本篇文字 (soarqin/ERTools)：武器依武器 ID 取 `WeaponName`；法術只依 ID 取本篇的魔法與禱告清單，嚴禁取自 `GoodsName`，因為其 ID 會與鑰匙等道具重疊。空白、`%null%` 與 `[ERROR]` 開頭的文字不算名稱。兩種語言都沒有名稱的項目 `name` 為 `null`。名稱記錄 `sourcesFor.name: ["er-base-text"]`，頁面必須註明這些是本篇參考名稱，尚未確認與黑夜君臨一致。
  - 武器數值，只收具名武器：`attack` 取自 `attackBasePhysics`、`attackBaseMagic`、`attackBaseFire`、`attackBaseThunder`、`attackBaseDark`；`scaling` 取自 `correctStrength`、`correctAgility`、`correctMagic`、`correctFaith`、`correctLuck`；`critical` 取自 `criticalAtkRate` (不是 `throwAtkRate`)。這些是原始參數：《黑夜君臨》的攻擊力另隨等級與稀有度變化，計算方式尚未核實，因此嚴禁呈現為遊戲內攻擊力或補正等級。`passive` 是 `attachEffectId` 引用的 `AttachEffectParam` 列的名稱，依其 `attachTextId` 查《黑夜君臨》詞條文字 (`game-text`)；只存名稱，其效果的數值與作用條件 (經 `passiveSpEffectId_1`–`3`、`onHitSpEffect`、`permanentSpEffectId`) 尚未收錄。`buildup` 只取 `spEffectBehaviorId0`–`2` 引用的 `SpEffectParam` 列中的異常狀態累積欄位 (`poizonAttackPower`、`diseaseAttackPower`、`bloodAttackPower`、`freezeAttackPower`、`sleepAttackPower`、`madnessAttackPower`、`curseAttackPower`，依序為 `poison`、`rot`、`blood`、`frost`、`sleep`、`madness`、`deathBlight`)，略過 0；這些列的其他欄位不收錄。戰技、盾的減傷率與 `heroID` 不收錄。
  - 法術消耗，只收有 `Magic` 列的法術：`cost` 取自 `mp` 與 `stamina`；`chargeCost` 取自 `mp_charge` 與 `stamina_charge`，兩者皆為 0 時為 `null`。這些是尚未套用減少消耗效果的原始參數。頁面照原值列出 `chargeCost`，嚴禁呈現為法術能否蓄力：非 0 值不足以說明蓄力施放的方式，0 不代表不消耗，兩行也不可相加。持續施放的消耗 `consumeLoopMP_forMenu` 不收錄。
  - 圖示：腳本在 Eldenpedia 尋找 `File:ER SB Icon <weapon|shield|Spell> <去除冒號的英文名稱>.png` (三種盾牌用 `shield`)，只有檔案存在且檔案頁標示 `{{License|game}}` 時才設定 `icon: { "src", "page" }`，否則為 `icon: null`。查詢結果快取在 `tools/.cache/eldenpedia/files.json`。之後執行 `python tools/fetch-icons.py`，下載資料引用但 `public/images/` 尚未有的圖示，並縮為 96px。
- 名稱只有單一語言、搭載的法術未收錄、搭載法術的武器 `wepType` 沒有標籤、法術的 `ezStateBehaviorType` 沒有標籤、武器數值或法術消耗不是數字、武器引用不存在的 `SpEffectParam` 或 `AttachEffectParam` 列、固定效果沒有兩種語言的名稱、同一武器的兩個命中效果累積同一種異常狀態、兩個圖示檔名相同，或引用的來源不在 common.json 時，腳本停止且不寫出資料檔。

## 遊戲撰寫守則

- 引導外部資源時使用開新視窗，禁止本頁跳轉
- RWD 原則，支援手機、平板、桌機等多種裝置
  - 表格：螢幕寬度 900px 以下時，所有表格逐列直排，不需橫向捲動。每列一塊，第一格為標題；其他格各占一行依序往下排，旁邊以小字顯示欄名。更寬的螢幕與列印維持表格。頁面渲染完成後，[public/render.js](public/render.js) 把每個欄位的表頭文字寫入該欄各格的 `data-label` (第一欄除外)，並設定 `table`、`rowgroup`、`row`、`columnheader`、`cell` 角色，保留表格語意；表頭列只在視覺上隱藏。每個表格必須在 `thead` 有一列表頭，且每列的格數必須與表頭相同，否則頁面以錯誤停止。
- 提及遊戲內項目時，必須找到該遊戲內對應的圖片，圖片來源為 [Eldenpedia](https://eldenring.wiki.gg/)
  - 只採用檔案頁授權標示為遊戲素材 (`{{License|game}}`) 的圖片；社群編修圖 (例如檔名含 `Custom`) 不算遊戲內圖片。
  - 圖片下載至 `public/images/`，由首頁的資料來源列出 wiki 檔案頁。大於 96px 的圖片可縮小為 96px，嚴禁其他修改。
  - [public/data/common.json](public/data/common.json) 的每個圖示以 `page` 記錄 wiki 檔案頁；武器與法術的圖示改記在 `public/data/armaments/` 各項目的 `icon` (見武器與法術資料產生)。首頁以 `<span data-icon-sources>` 列出 common.json 中每個圖示的檔案頁，並說明一次武器與法術圖示取自 Eldenpedia 的 ER SB Icon 系列，各檔案頁記錄在項目資料中。
  - 同一種編排位置的圖片維持相同大小；圖片一律使用 `.icon` class，尺寸只在 `public/styles.css` 依位置設定，不在個別圖片上另外調整：
    - 表格內：48px (`td .icon`)。
    - 表格內的名稱清單 (效果說明、種類欄)：24px (`td .entry .icon`)。
    - 正文內：24px (`.icon`)。
    - 出現新的編排方式時，先在 `public/styles.css` 新增該位置的尺寸規則。
    - `<img>` 的 `width`/`height` 屬性與該位置的尺寸一致。
