"""Imagen para redes sociales (Open Graph) de Praetoria (#28): foto real retocada del despacho, logo y lema.
Sin retratos y sin El Puig. Uso: python3 scripts/og/generar-og.py  ->  public/media/og-praetoria.jpg (1200x630)
"""
from io import BytesIO
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parents[2]
WOFF2 = RAIZ / 'node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2'


def fuente(peso, ancho, tam):
    f = TTFont(str(WOFF2))
    f.flavor = None
    inst = instantiateVariableFont(f, {'wght': peso, 'wdth': ancho})
    buf = BytesIO()
    inst.save(buf)
    buf.seek(0)
    return ImageFont.truetype(buf, tam)


W, H = 1200, 630
img = Image.new('RGB', (W, H), (34, 38, 42))
foto = Image.open(RAIZ / 'public/media/v2/despacho-salas-reuniones.webp').convert('RGB')
fw = 620
foto = foto.resize((fw, round(foto.height * fw / foto.width)))
foto = foto.crop((0, (foto.height - H) // 2, fw, (foto.height - H) // 2 + H)) if foto.height >= H else foto.resize((fw, H))
img.paste(foto, (W - fw, 0))
# degradado de la banda grafito sobre la foto
grad = Image.new('L', (fw, 1))
for x in range(fw):
    grad.putpixel((x, 0), max(0, 255 - int(255 * x / (fw * 0.6))))
grad = grad.resize((fw, H))
img.paste(Image.new('RGB', (fw, H), (34, 38, 42)), (W - fw, 0), grad)

d = ImageDraw.Draw(img)
d.rectangle((64, 92, 128, 100), fill=(179, 36, 42))
lema = fuente(800, 72, 76)
d.text((64, 124), 'Tus objetivos.', font=lema, fill=(255, 255, 255))
d.text((64, 204), 'Nuestra estrategia', font=lema, fill=(240, 201, 201))
d.text((64, 284), 'jurídica.', font=lema, fill=(240, 201, 201))
sub = fuente(600, 100, 30)
d.text((64, 392), 'Abogados en Valencia para empresas y particulares', font=sub, fill=(217, 220, 223))

# banda blanca inferior con el logotipo
d.rectangle((0, H - 120, W, H), fill=(255, 255, 255))
d.rectangle((0, H - 124, W, H - 120), fill=(179, 36, 42))
logo = Image.open(RAIZ / 'public/media/logo-praetoria-sin-fondo.png').convert('RGBA')
lw = 300
logo = logo.resize((lw, round(logo.height * lw / logo.width)))
img.paste(logo, (64, H - 60 - logo.height // 2), logo)
pie = fuente(500, 100, 24)
texto = 'praetoriaabogados.es'
ancho = d.textlength(texto, font=pie)
d.text((W - 64 - ancho, H - 74), texto, font=pie, fill=(94, 101, 108))

img.save(RAIZ / 'public/media/og-praetoria.jpg', quality=86, optimize=True)
print('og-praetoria.jpg', img.size)
