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
  - 新增主題頁面時，同時在 `public/index.html` 的研究索引表新增一列。

## 遊戲資料守則

- 遊戲數值 (數字與規則標籤)、數值佔位元素產生的效果及能力值名稱，以及它們的來源，只記錄在 [public/data/nightreign.json](public/data/nightreign.json)。HTML 放 `data-*` 佔位元素，由 [public/render.js](public/render.js) 填入；禁止在 HTML 寫死遊戲數值，內文例子中的數值也一樣。內文敘述 (例如角色名稱) 與 `data-*` 屬性中的選取鍵 (例如等級編號) 可以留在 HTML。
- 數值狀態：
  - 一般值代表該效果 `sources` 的記載。
  - `null` 代表尚未核實，禁止當成 0 或 false。
  - `{ "conflict": [{ "value": ..., "sources": [...] }] }` 代表來源分歧；保留所有候選值，不預設採用任何一個。
  - 這些狀態適用於所有欄位，包括 `stacking.stacks` 等規則欄位；計算只在所需規則全部明確成立時執行，否則顯示阻止計算的狀態。
  - `sourcesFor` 以欄位路徑 (例如 `stacking.combine`) 對應來源，取代該欄位的效果層級 `sources`。
- 百分比以有號數字儲存 (例如 `10`、`-5`)，倍率由程式推導。
- 有 +1／+2／+3 等級的效果是一個效果加 `tiers` 陣列；每級保留遊戲內 `gameId`。
- 每個效果的資源增量依來源記載逐筆記錄，不以通用的每點換算推導。

## 遊戲撰寫守則

- 引導外部資源時使用開新視窗，禁止本頁跳轉
- RWD 原則，支援手機、平板、桌機等多種裝置
- 提及遊戲內項目時，必須找到該遊戲內對應的圖片，圖片來源為 [Eldenpedia](https://eldenring.wiki.gg/)
  - 只採用檔案頁授權標示為遊戲素材 (`{{License|game}}`) 的圖片；社群編修圖 (例如檔名含 `Custom`) 不算遊戲內圖片。
  - 圖片下載至 `public/images/`，並在頁面的資料來源列出 wiki 檔案頁。
  - 同一種編排位置的圖片維持相同大小；圖片一律使用 `.icon` class，尺寸只在 `public/styles.css` 依位置設定，不在個別圖片上另外調整：
    - 表格內：48px (`td .icon`)。
    - 正文內：24px (`.icon`)。
    - 出現新的編排方式時，先在 `public/styles.css` 新增該位置的尺寸規則。
    - `<img>` 的 `width`/`height` 屬性與該位置的尺寸一致。
