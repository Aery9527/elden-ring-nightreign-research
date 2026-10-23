"""下載 public/data/armaments/*.json 與 public/data/characters/*.json 引用、但 public/images/ 還沒有的圖示。

用法：python tools/fetch-icons.py (在 node tools/import-armaments.mjs 或 import-characters.mjs 之後執行)
資料檔的 icon.page 是 Eldenpedia 檔案頁；匯入程式已確認其授權為 {{License|game}}。
本程式只依檔案頁取得原圖網址並下載，大於 96px 時等比例縮為 96px，不做其他修改。
"""

import io
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
API = "https://eldenring.wiki.gg/api.php"
HEADERS = {"User-Agent": "elden-ring-nightreign-research importer"}
MAX_SIZE = 96


def get(url, attempts=4):
    """伺服器暫時錯誤 (5xx) 時等待後重試；圖檔整個下載完才存檔，中斷後重新執行會略過已下載的檔案。"""
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS)) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code < 500 or attempt == attempts - 1:
                raise
            time.sleep(5 * (attempt + 1))


def image_urls(titles):
    """檔案頁標題 → 原圖網址 (每次查詢 50 個)。"""
    urls = {}
    for i in range(0, len(titles), 50):
        batch = titles[i : i + 50]
        query = urllib.parse.urlencode(
            {"action": "query", "titles": "|".join(batch), "prop": "imageinfo", "iiprop": "url", "format": "json", "formatversion": "2"}
        )
        data = json.loads(get(f"{API}?{query}"))["query"]
        normalized = {n["to"]: n["from"] for n in data.get("normalized", [])}
        for page in data["pages"]:
            if "imageinfo" not in page:
                raise SystemExit(f"Eldenpedia 沒有圖檔：{page['title']}")
            urls[normalized.get(page["title"], page["title"])] = page["imageinfo"][0]["url"]
        time.sleep(0.5)
    return urls


def icons(value):
    """資料中所有的 icon 物件 ({ src, page })，不限層級 (角色的圖示在 passive、skill、art 之下)。"""
    if isinstance(value, dict):
        icon = value.get("icon")
        if isinstance(icon, dict):
            yield icon
        for child in value.values():
            yield from icons(child)


def main():
    wanted = {}
    paths = [*sorted((PUBLIC / "data" / "armaments").glob("*.json")), *sorted((PUBLIC / "data" / "characters").glob("*.json"))]
    for path in paths:
        for icon in icons(json.loads(path.read_text(encoding="utf-8"))):
            if not (PUBLIC / icon["src"]).exists():
                title = urllib.parse.unquote(icon["page"].split("/wiki/", 1)[1])
                wanted[title] = PUBLIC / icon["src"]
    urls = image_urls(list(wanted))
    for title, target in wanted.items():
        image = Image.open(io.BytesIO(get(urls[title])))
        if max(image.size) > MAX_SIZE:
            image.thumbnail((MAX_SIZE, MAX_SIZE), Image.LANCZOS)
        image.save(target, optimize=True)
        print(f"{target.relative_to(ROOT)}：{image.size[0]}x{image.size[1]}")
        time.sleep(0.2)
    print(f"下載 {len(wanted)} 個圖示")


if __name__ == "__main__":
    main()
