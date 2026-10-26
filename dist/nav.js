// 頁首導覽：第一行階層「首頁 › 本頁 › 小節」，第二行章節列列出本頁全部章節並標示目前章節，皆依捲動位置更新。
(() => {
  // 已移到其他頁面的舊錨點：鍵為「頁名#id」，導向新位置，讓舊連結仍可使用。
  // 只列跨頁目標；同頁的舊 id 直接保留在元素上，因為同頁轉址不會重新載入，會跳過下方初始化。
  const moved = {
    "relics-general#attribute-table": "attributes.html#attribute-table",
    "relics-general#understanding": "attributes.html#understanding",
    "relics-general#sources": "index.html#sources",
    "relics-character#sources": "index.html#sources",
    "relics-armament#sources": "index.html#sources",
    "relics-demerit#sources": "index.html#sources",
    // armaments.html 已轉到武器頁；原本的魔法、禱告章節移到各自的頁面
    "weapons#sorceries": "sorceries.html#sorceries",
    "weapons#incantations": "incantations.html#incantations",
  };
  const page = location.pathname.split("/").pop().replace(/\.html$/, "");
  const target = moved[`${page}${location.hash}`];
  if (target) {
    location.replace(target);
    return;
  }

  const header = document.querySelector(".site-header");
  const crumbs = header?.querySelector(".crumbs");
  const h1 = document.querySelector("main h1");
  if (!crumbs || !h1) return;

  const home = crumbs.querySelector("a");
  const onHome = home.pathname === location.pathname || location.pathname.endsWith("/");
  // h2 寫在 HTML；h3 可能由 render.js 產生 (例如角色頁的小節)，內容變動時重新收集
  const findHeadings = () => [...document.querySelectorAll("main h2[id], main h3[id]")];
  let headings = findHeadings();
  const h2s = headings.filter((heading) => heading.tagName === "H2");
  const root = document.documentElement;
  let shown = null;

  // 章節列：列出本頁全部 h2，標示目前章節。名稱由 render.js 稍後填入，空白時先隱藏該項。
  // 窄螢幕或矮螢幕 (styles.css) 只顯示按鈕「章節：<目前章節>」，按下後在頁首下方展開直排的章節選單。
  const chapters = document.createElement("nav");
  chapters.className = "chapters";
  chapters.id = "toc"; // 接手原本正文目錄 (#toc) 的內容，舊連結仍可使用
  chapters.setAttribute("aria-label", "本頁章節");
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "chapters-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "toc-list");
  const list = document.createElement("ul");
  list.id = "toc-list";
  const links = new Map(h2s.map((heading) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${heading.id}`;
    li.append(a);
    list.append(li);
    return [heading, a];
  }));
  chapters.append(toggle, list);
  if (h2s.length) header.append(chapters);

  // 展開時把目前章節捲到選單中間；選擇章節、按 Esc 或點選單外側時收合
  function setOpen(open) {
    chapters.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    const current = list.querySelector("[aria-current]");
    if (open && current) list.scrollTop = current.offsetTop - (list.clientHeight - current.offsetHeight) / 2;
  }
  toggle.addEventListener("click", () => setOpen(!chapters.classList.contains("open")));
  list.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  chapters.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !chapters.classList.contains("open")) return;
    setOpen(false);
    toggle.focus();
  });
  document.addEventListener("click", (event) => {
    if (!chapters.contains(event.target)) setOpen(false);
  });
  // 寬度改變 (例如旋轉手機、跨過斷點) 時正文重排，選單內的捲動位置會失準，因此收合。
  // 只看寬度：手機捲動時網址列伸縮只改變高度
  let width = innerWidth;
  addEventListener("resize", () => {
    if (innerWidth === width) return;
    width = innerWidth;
    setOpen(false);
  });

  function syncNames() {
    for (const [heading, a] of links) {
      if (a.textContent !== heading.textContent) a.textContent = heading.textContent;
      a.parentElement.hidden = !heading.textContent.trim();
    }
  }

  function crumb(text, href) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = href;
    a.textContent = text;
    li.append(a);
    return li;
  }

  function update() {
    const headerHeight = header.offsetHeight;
    root.style.setProperty("--header-h", `${headerHeight}px`);
    // 捲到底時最後的章節可能到不了頁首，改以畫面內最後一個標題為準
    const atBottom = root.scrollHeight > innerHeight && innerHeight + scrollY >= root.scrollHeight - 2;
    // 標題跳轉後停在頁首下方 16px (styles.css 的 scroll-margin-top)，基準線需低於該位置
    const line = atBottom ? innerHeight : headerHeight + 24;
    let h2 = null;
    let h3 = null;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top > line) break;
      if (heading.tagName === "H2") { h2 = heading; h3 = null; } else { h3 = heading; }
    }

    // 麵包屑只到本頁與目前小節 (h3)；目前章節 (h2) 由章節列標示
    const levels = [];
    if (!onHome) levels.push([h1.textContent, "#"]);
    if (h3) levels.push([h3.textContent, `#${h3.id}`]);
    const current = links.get(h2) ?? null;
    const key = [...levels.flat(), current?.getAttribute("href")].join("\n");
    if (key === shown) return;
    shown = key;

    for (const a of links.values()) {
      if (a === current) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    }
    toggle.textContent = current ? `章節：${current.textContent}` : "本頁章節";

    // 只替換有變動的層級，保留未變節點，避免鍵盤焦點被移除
    const items = [...crumbs.children].slice(1);
    let same = 0;
    while (same < items.length && same < levels.length) {
      const a = items[same].querySelector("a");
      if (a.getAttribute("href") !== levels[same][1] || a.textContent !== levels[same][0]) break;
      same += 1;
    }
    const lostFocus = items.slice(same).some((li) => li.contains(document.activeElement));
    items.slice(same).forEach((li) => li.remove());
    crumbs.append(...levels.slice(same).map(([text, href]) => crumb(text, href)));
    const page = crumbs.children[onHome ? 0 : 1].querySelector("a");
    const last = crumbs.lastElementChild.querySelector("a");
    if (lostFocus) last.focus({ preventScroll: true });
    crumbs.querySelectorAll("[aria-current]").forEach((a) => a.removeAttribute("aria-current"));
    page.setAttribute("aria-current", "page");
    if (last !== page) last.setAttribute("aria-current", "location");
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }

  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  // render.js 之後才填入資料產生的標題文字，標題變動時同步章節名稱並重新產生。
  // 名稱填入會改變頁首高度，需立即更新 --header-h，render.js 隨後對準網址錨點時才不會用到舊高度
  new MutationObserver(() => { headings = findHeadings(); syncNames(); shown = null; update(); }).observe(document.querySelector("main"), { childList: true, subtree: true, characterData: true });
  syncNames();
  update();
})();
