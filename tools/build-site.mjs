// 網站 build：以 jsdom 執行 public/render.js，把 public/ 的頁面模板預先渲染成含完整內容的靜態頁，連同其餘檔案輸出到 dist/。
//   npm --prefix tools run build   全部頁面渲染成功後，才清空 dist/ 並寫入；失敗時 dist/ 不變
//   npm --prefix tools run check   在記憶體重建，與 dist/ 逐檔逐 byte 比對，不寫檔
// 載入或渲染錯誤、check 發現差異時，印出原因並以非零狀態結束。
// 路徑一律從 repo 根目錄解析 (npm 在 tools/ 執行本檔)。

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { JSDOM, VirtualConsole } from "jsdom";
import { ROOT } from "./sources.mjs";

const PUBLIC = join(ROOT, "public");
const DIST = join(ROOT, "dist");
const RENDER_JS = readFileSync(join(PUBLIC, "render.js"), "utf8");
// <body data-load> 的檔名，例如 common、relics/general
const DATA_NAME = /^[a-z0-9-]+(\/[a-z0-9-]+)?$/;

// 目錄內全部檔案的相對路徑 (以 / 分隔)，依字典序排列
function listFiles(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .sort();
}

// jsdom 的錯誤物件來自頁面的 realm，不以 instanceof 判斷
const describe = (error) => error?.stack ?? error?.message ?? String(error);

// 每頁使用新的 jsdom：render.js 頂層的 const 不能在同一個 window 重複宣告。
// runScripts "outside-only" 只執行本程式交給它的 render.js，不執行模板內的 script (nav.js 留給瀏覽器)；
// resources 維持預設，不下載樣式、script 與圖片。jsdom 未實作的功能 (排版、捲動、導覽) 會發出 jsdomError，視為失敗。
async function renderPage(page) {
  const problems = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => problems.push(describe(error)));
  virtualConsole.on("error", (...args) => problems.push(args.map(describe).join(" ")));
  const dom = new JSDOM(readFileSync(join(PUBLIC, page), "utf8"), { runScripts: "outside-only", virtualConsole });
  const { window } = dom;
  window.prerender = {
    load(name) {
      if (!DATA_NAME.test(name)) return Promise.reject(new Error(`資料檔名稱無效：${name}`));
      return Promise.resolve(window.JSON.parse(readFileSync(join(PUBLIC, "data", `${name}.json`), "utf8")));
    },
  };
  window.eval(RENDER_JS);
  await window.prerender.result;
  if (problems.length) throw new Error(problems.join("\n"));
  delete window.prerender;
  window.document.documentElement.setAttribute("data-prerendered", "");
  const html = Buffer.from(dom.serialize(), "utf8");
  window.close();
  return html;
}

// 產物集合：public/ 的每個檔案原樣複製 (bytes，不做文字解碼)，頂層的 .html 換成渲染結果。
async function buildSite() {
  const files = new Map(listFiles(PUBLIC).map((path) => [path, readFileSync(join(PUBLIC, path))]));
  let failed = false;
  for (const page of [...files.keys()].filter((path) => !path.includes("/") && path.endsWith(".html"))) {
    try {
      files.set(page, await renderPage(page));
    } catch (error) {
      failed = true;
      console.error(`${page}：渲染失敗\n${describe(error)}`);
    }
  }
  return failed ? null : files;
}

function check(files) {
  const existing = new Set(existsSync(DIST) ? listFiles(DIST) : []);
  const missing = [...files.keys()].filter((path) => !existing.has(path));
  const extra = [...existing].filter((path) => !files.has(path));
  const changed = [...files].filter(([path, bytes]) => existing.has(path) && !readFileSync(join(DIST, path)).equals(bytes)).map(([path]) => path);
  for (const [label, paths] of [["缺少", missing], ["多出", extra], ["內容不同", changed]]) {
    for (const path of paths) console.error(`dist/${path}：${label}`);
  }
  if (missing.length || extra.length || changed.length) {
    console.error("dist/ 與 public/ 的建置結果不一致，請執行 npm --prefix tools run build 並 commit dist/。");
    return false;
  }
  console.log(`dist/ 與建置結果一致（${files.size} 個檔案）。`);
  return true;
}

function write(files) {
  rmSync(DIST, { recursive: true, force: true });
  for (const [path, bytes] of files) {
    mkdirSync(dirname(join(DIST, path)), { recursive: true });
    writeFileSync(join(DIST, path), bytes);
  }
  // 各頁大小：觀察預先渲染後的 HTML 體積
  for (const [path, bytes] of files) {
    if (!path.endsWith(".html") || path.includes("/")) continue;
    const kib = (size) => `${(size / 1024).toFixed(1)} KiB`;
    console.log(`${path.padEnd(24)} ${kib(bytes.length).padStart(12)}  gzip ${kib(gzipSync(bytes).length).padStart(10)}`);
  }
  console.log(`已寫入 dist/（${files.size} 個檔案）。`);
}

const files = await buildSite();
if (!files) process.exitCode = 1;
else if (process.argv.includes("--check")) process.exitCode = check(files) ? 0 : 1;
else write(files);
