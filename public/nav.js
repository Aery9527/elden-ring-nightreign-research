// 頁首階層導覽：依捲動位置顯示「首頁 › 本頁 › 章節 › 小節」，每層都連到該層開頭。
(() => {
  const header = document.querySelector(".site-header");
  const crumbs = header?.querySelector(".crumbs");
  const h1 = document.querySelector("main h1");
  if (!crumbs || !h1) return;

  const home = crumbs.querySelector("a");
  const onHome = home.pathname === location.pathname || location.pathname.endsWith("/");
  const headings = [...document.querySelectorAll("main h2[id], main h3[id]")];
  const root = document.documentElement;
  let shown = "";

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

    const levels = [];
    if (!onHome) levels.push([h1.textContent, "#"]);
    for (const heading of [h2, h3]) if (heading) levels.push([heading.textContent, `#${heading.id}`]);
    const key = levels.map(([text, href]) => `${href}\n${text}`).join("\n");
    if (key === shown) return;
    shown = key;

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
    const last = crumbs.lastElementChild.querySelector("a");
    if (lostFocus) last.focus({ preventScroll: true });
    crumbs.querySelectorAll("[aria-current]").forEach((a) => a.removeAttribute("aria-current"));
    last.setAttribute("aria-current", "location");
    // 窄螢幕橫向捲動：有焦點時讓聚焦的連結可見，否則顯示最後一層
    const focused = crumbs.contains(document.activeElement) ? document.activeElement : null;
    if (focused) {
      const box = crumbs.getBoundingClientRect();
      const rect = focused.getBoundingClientRect();
      if (rect.left < box.left) crumbs.scrollLeft += rect.left - box.left;
      else if (rect.right > box.right) crumbs.scrollLeft += rect.right - box.right;
    } else {
      crumbs.scrollLeft = crumbs.scrollWidth;
    }
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }

  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  // render.js 之後才填入資料產生的標題文字，標題變動時重新產生
  new MutationObserver(() => { shown = ""; schedule(); }).observe(document.querySelector("main"), { childList: true, subtree: true, characterData: true });
  update();
})();
