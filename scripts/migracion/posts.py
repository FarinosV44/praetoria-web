"""Convierte los artículos del export de WordPress a Markdown para Astro."""
import html, json, re, sys
from bs4 import BeautifulSoup
from markdownify import markdownify as md

SRC, OUT = sys.argv[1], sys.argv[2]
d = json.load(open(SRC))
tags = {t["id"]: html.unescape(t["name"]) for t in d["tags"]}

# Nueva clasificación por áreas (id de WordPress -> categoría)
CAT = {}
for i in [3090, 3088, 3086, 3081, 3073, 3071, 3067, 3065, 3033, 3009, 2999, 2997, 2994, 2879, 2875, 2872,
          2805, 2803, 2779, 2745]:
    CAT[i] = "transporte"
for i in [2868, 2855, 2720]:
    CAT[i] = "hacienda"
CAT[2833] = "mercantil"
for i in [2807, 2799, 2757, 2755, 2749, 2718]:
    CAT[i] = "civil-vivienda"
CAT[2801] = "familia"
for i in [2815, 2784]:
    CAT[i] = "laboral"
for i in [2752, 2743, 2737, 2734]:
    CAT[i] = "extranjeria"
for i in [2776, 2773, 2731]:
    CAT[i] = "elegir-abogado"

# Dentro de transporte: guías legales del DECA y artículos sobre la herramienta DeCA Profesional
DECA_GUIA = {3081, 3067, 3065, 3009, 2999, 2997, 2994, 2879, 2875, 2872, 3086}
DECA_HERRAMIENTA = {3090, 3088, 3073, 3071, 3033}

LANG = {2737: "fr", 2734: "ar"}

LINK_FIX = {
    "https://praetoriaabogados.es/deca-subcontratacion-agencias-transporte/":
        "/deca-y-subcontratacion-que-debe-hacer-realmente-una-agencia-de-transporte/",
}


def clean_html(raw):
    soup = BeautifulSoup(raw, "html.parser")
    for w in soup.select(".elementor-widget-html"):
        w.decompose()  # bloque DECA duplicado: ahora lo pone la plantilla
    for t in soup(["style", "script"]):
        t.decompose()
    for a in soup.find_all("a", href=True):
        h = a["href"]
        h = LINK_FIX.get(h, h)
        if h.startswith("https://praetoriaabogados.es"):
            h = h.replace("https://praetoriaabogados.es", "") or "/"
        a["href"] = h
    for el in soup.find_all(True):
        for attr in ["class", "id", "style", "data-id", "data-element_type", "data-e-type", "data-widget_type"]:
            el.attrs.pop(attr, None)
    return str(soup)


def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)


for p in d["posts"]:
    pid = p["id"]
    title = html.unescape(p["title"]["rendered"]).strip()
    body = md(clean_html(p["content"]["rendered"]), heading_style="ATX", bullets="-", strip=["div", "span"])
    body = re.sub(r"\n{3,}", "\n\n", body).strip() + "\n"
    # Un H1 dentro del cuerpo competiría con el título del artículo
    body = re.sub(r"^# ", "## ", body, flags=re.M)
    soup = BeautifulSoup(clean_html(p["content"]["rendered"]), "html.parser")
    paras = [re.sub(r"\s+", " ", x.get_text(" ", strip=True)) for x in soup.find_all("p")]
    text = " ".join(x for x in paras if len(x) > 40)[:600]
    text = re.sub(r"👉|✔️|⚠️|📄|⚖️|✅|❌|🚗", "", text).strip()
    sentences = re.split(r"(?<=[.!?])\s+", text)
    exc = ""
    for s in sentences:
        if len(exc) + len(s) + 1 > 158:
            break
        exc = (exc + " " + s).strip()
    if not exc:
        exc = text[:155].rsplit(" ", 1)[0] + "…"
    fm = [
        "---",
        f"title: {yaml_str(title)}",
        f"description: {yaml_str(exc)}",
        f"date: {p['date'][:10]}",
        f"updated: {p['modified'][:10]}",
        f"category: {CAT[pid]}",
    ]
    if pid in DECA_GUIA:
        fm.append("deca: guia")
    if pid in DECA_HERRAMIENTA:
        fm.append("deca: herramienta")
    if pid in LANG:
        fm.append(f"lang: {LANG[pid]}")
    t = [tags[i] for i in p["tags"] if i in tags and not tags[i].lower().startswith("keyword")]
    if t:
        fm.append("tags: " + json.dumps(t, ensure_ascii=False))
    fm.append(f"wpId: {pid}")
    fm.append("---\n")
    open(f"{OUT}/{p['slug']}.md", "w").write("\n".join(fm) + "\n" + body)

missing = [p["id"] for p in d["posts"] if p["id"] not in CAT]
print("ok", len(d["posts"]), "sin categoría:", missing)
