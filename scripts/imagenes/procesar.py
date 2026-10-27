#!/usr/bin/env python3
"""Procesa las imágenes editoriales del registro (src/content/imagenes.json) — #28.

Originales privados (no se publican; Netlify solo publica out/):
  fotos/editorial/<id-unsplash>.jpg   fotografías con licencia Unsplash
  fotos/editorial/pexels-<id>.jpg     fotografías con licencia Pexels
  fotos/ia/*.png                      escenas generadas con IA (#28 §8), incluidas dos recreaciones autorizadas
  fotos/deca/*.png                    capturas reales de DeCA Profesional (repositorio farvertrans-deca, public/guia)

Salida en public/media/ed/:
  <archivo>.webp/.avif (1600 px) y -1200, -800, -480 · <archivo>-og.jpg (1200×630, para compartir)
Recorte 16:10 alrededor del punto «foco». Las capturas de DeCA se presentan sobre un fondo neutro,
sin retocar su contenido ni recrear el logotipo.

Uso: python3 scripts/imagenes/procesar.py [id ...]   (sin ids: todas las que tengan original)
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

RAIZ = Path(__file__).resolve().parents[2]
REGISTRO = RAIZ / 'src/content/imagenes.json'
SALIDA = RAIZ / 'public/media'
W, H = 1600, 1000
VARIANTES = [480, 800, 1200, 1600]
FONDO = (238, 236, 232)  # --stone
LINEA = (214, 210, 203)  # --line


def foco(img):
    x, y = (int(v.rstrip('%')) / 100 for v in img['foco'].split())
    return x, y


def recortar(im, ratio, fx, fy):
    """Recorte al ratio pedido centrado (en lo posible) en el punto focal."""
    w, h = im.size
    if w / h > ratio:
        nw = round(h * ratio)
        x0 = min(max(round(fx * w - nw / 2), 0), w - nw)
        return im.crop((x0, 0, x0 + nw, h))
    nh = round(w / ratio)
    y0 = min(max(round(fy * h - nh / 2), 0), h - nh)
    return im.crop((0, y0, w, y0 + nh))


def con_sombra(lienzo, pieza, x, y, radio):
    """Pega una captura con esquinas redondeadas, borde fino y sombra suave."""
    w, h = pieza.size
    mascara = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mascara).rounded_rectangle((0, 0, w - 1, h - 1), radio, fill=255)
    sombra = Image.new('L', lienzo.size, 0)
    ImageDraw.Draw(sombra).rounded_rectangle((x, y + 18, x + w, y + h + 18), radio, fill=70)
    sombra = sombra.filter(ImageFilter.GaussianBlur(26))
    lienzo.paste((60, 64, 70), (0, 0), sombra)
    lienzo.paste(pieza, (x, y), mascara)
    ImageDraw.Draw(lienzo).rounded_rectangle((x - 1, y - 1, x + w, y + h), radio, outline=LINEA, width=2)


def escalar(im, max_w, max_h, max_escala=1.6):
    e = min(max_w / im.width, max_h / im.height, max_escala)
    return im.resize((round(im.width * e), round(im.height * e)), Image.LANCZOS)


def composicion_deca(img):
    piezas = [Image.open(RAIZ / a).convert('RGB') for a in img['origen']['archivos']]
    lienzo = Image.new('RGB', (W, H), FONDO)
    # Degradado muy suave para dar profundidad sin decorar
    grad = Image.linear_gradient('L').resize((W, H)).point(lambda v: v * 0.10)
    lienzo.paste((255, 255, 255), (0, 0), ImageOps.flip(grad))
    tipo = img.get('composicion', 'escritorio')
    if tipo == 'movil-doble':
        a, b = (escalar(p, 420, 860) for p in piezas[:2])
        gap = 70
        x = (W - a.width - b.width - gap) // 2
        con_sombra(lienzo, a, x, (H - a.height) // 2 - 10, 34)
        con_sombra(lienzo, b, x + a.width + gap, (H - b.height) // 2 + 10, 34)
    elif tipo == 'logo':
        # Logotipo propio sobre fondo blanco: se recorta a su contenido y se centra, sin sombra
        pieza = Image.open(RAIZ / img['origen']['archivos'][0]).convert('RGBA')
        caja = pieza.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox() or pieza.getbbox()
        rgb = Image.new('RGB', pieza.size, (255, 255, 255))
        rgb.paste(pieza, mask=pieza.getchannel('A'))
        gris = ImageOps.invert(rgb.convert('L')).point(lambda v: 255 if v > 24 else 0)
        caja = gris.getbbox() or caja
        logo = escalar(rgb.crop(caja), 1080, 400, max_escala=3)
        lienzo = Image.new('RGB', (W, H), (255, 255, 255))
        lienzo.paste(logo, ((W - logo.width) // 2, (H - logo.height) // 2))
    else:
        p = escalar(piezas[0], 1300 if tipo == 'escritorio' else 760, 820)
        con_sombra(lienzo, p, (W - p.width) // 2, (H - p.height) // 2 - 8, 14)
    return lienzo


def fotografia(img):
    o = img['origen']
    nombre = f"pexels-{o['id']}" if o['tipo'] == 'pexels' else o.get('id')
    src = RAIZ / (o['original'] if o['tipo'] in ('ia', 'prensa') else f"fotos/editorial/{nombre}.jpg")
    if not src.exists():
        return None
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    fx, fy = foco(img)
    return recortar(im, W / H, fx, fy).resize((W, H), Image.LANCZOS)


def exportar(img, master):
    base = SALIDA / img['archivo']
    base.parent.mkdir(parents=True, exist_ok=True)
    for w in VARIANTES:
        sufijo = '' if w == max(VARIANTES) else f'-{w}'
        v = master if w == W else master.resize((w, round(w * H / W)), Image.LANCZOS)
        v.save(f'{base}{sufijo}.webp', 'WEBP', quality=78, method=6)
        v.save(f'{base}{sufijo}.avif', 'AVIF', quality=55, speed=4)
    fx, fy = foco(img)
    og = recortar(master, 1200 / 630, fx, fy).resize((1200, 630), Image.LANCZOS)
    og.save(f'{base}-og.jpg', 'JPEG', quality=82, optimize=True, progressive=True)


def main(ids):
    datos = json.loads(REGISTRO.read_text())
    hechas, faltan = [], []
    for img in datos['imagenes']:
        if ids and img['id'] not in ids:
            continue
        tipo = img['origen']['tipo']
        if tipo == 'praetoria':
            continue  # procesadas con scripts/fotos/retocar.py
        if tipo == 'unsplash' and not (img['origen'].get('autor') and img['origen'].get('url')):
            faltan.append(f"{img['id']}: falta autor/enlace de Unsplash")
            continue
        master = composicion_deca(img) if tipo == 'deca' else fotografia(img)
        if master is None:
            faltan.append(f"{img['id']}: falta el original")
            continue
        exportar(img, master)
        img.update(estado='publicada', ancho=W, alto=H, variantes=VARIANTES, avif=True)
        hechas.append(img['id'])
    REGISTRO.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + '\n')
    print(f'Procesadas ({len(hechas)}): {", ".join(hechas)}')
    if faltan:
        print('Pendientes:\n  ' + '\n  '.join(faltan))


if __name__ == '__main__':
    main(set(sys.argv[1:]))
