"""Extrae el contenido del export de WordPress a texto legible y guarda las imágenes."""
import base64, json, os, re, sys
from bs4 import BeautifulSoup

SRC = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(f"{OUT}/pages_txt", exist_ok=True)
os.makedirs(f"{OUT}/posts_html", exist_ok=True)
os.makedirs(f"{OUT}/media", exist_ok=True)

d = json.load(open(SRC))

# Imágenes
index = []
for m in d["media"]:
    name = os.path.basename(m["source_url"].split("?")[0])
    data = m.get("data")
    if data:
        head, b64 = data.split(",", 1)
        ext = ".png" if "png" in head else ".svg" if "svg" in head else ".gif" if "gif" in head else ".jpg"
        stem = os.path.splitext(name)[0]
        fn = stem + ext
        open(f"{OUT}/media/{fn}", "wb").write(base64.b64decode(b64))
    else:
        fn = None
    index.append({"id": m["id"], "file": fn, "orig": m["source_url"], "alt": m.get("alt_text", ""),
                  "title": m["title"]["rendered"]})
json.dump(index, open(f"{OUT}/media_index.json", "w"), ensure_ascii=False, indent=1)

BLOCK = ["h1", "h2", "h3", "h4", "p", "li", "a", "img", "summary", "label", "button"]


def outline(html):
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style", "noscript", "svg"]):
        t.decompose()
    lines, seen = [], set()
    for el in soup.find_all(BLOCK):
        if el.name == "img":
            src = el.get("src", "")
            line = f"[IMG] {os.path.basename(src)} | alt={el.get('alt','')}"
        elif el.name == "a":
            href = el.get("href", "")
            txt = el.get_text(" ", strip=True)
            if not txt or el.find(BLOCK[:-3]):
                continue
            line = f"[LINK] {txt} -> {href}"
        else:
            if el.find(["p", "li", "h1", "h2", "h3", "h4"]):
                continue
            txt = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
            if not txt:
                continue
            line = f"{el.name.upper()}: {txt}"
        if line in seen:
            continue
        seen.add(line)
        lines.append(line)
    return "\n".join(lines)


for p in d["pages"]:
    y = p.get("yoast_head_json") or {}
    meta = f"TITLE: {y.get('title','')}\nDESC: {y.get('description','')}\n\n"
    open(f"{OUT}/pages_txt/{p['slug']}.txt", "w").write(meta + outline(p["content"]["rendered"]))

for p in d["posts"]:
    open(f"{OUT}/posts_html/{p['slug'][:80]}.html", "w").write(p["content"]["rendered"])

print("ok", len(os.listdir(f"{OUT}/media")))
