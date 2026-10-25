"""Retoque fotográfico CLÁSICO y reproducible de las fotos reales del despacho (#28).

No es edición por IA: no añade ni inventa nada. Aplica, por foto:
  1. recorte/encuadre (fracciones de la imagen original),
  2. difuminado fuerte de zonas sensibles (pantallas, documentos, personas reconocibles),
  3. balance de blancos parcial (quita dominantes amarillas/verdosas sin borrar el color real de las paredes),
  4. exposición: CLAHE suave sobre la luminancia y ligera apertura de sombras (techos muy oscuros),
  5. nitidez moderada (máscara de enfoque).
Salida: public/media/v2/<nombre>.webp (1600 px), <nombre>-800.webp y <nombre>-480.webp, y comparativas en una carpeta aparte.

Uso: python3 scripts/fotos/retocar.py [carpeta_comparativas]
"""
import sys
from pathlib import Path

import cv2
import numpy as np

RAIZ = Path(__file__).resolve().parents[2]
ORIG = RAIZ / 'public/media'
SALIDA = ORIG / 'v2'
# Originales retirados de la web por contener datos sensibles (no se publican)
PRIVADOS = RAIZ / 'fotos/originales'

# (x0, y0, x1, y1) en fracciones de la imagen original
FOTOS = {
    # Cabecera de portada: salas acristaladas. Reflejo de una persona en el cristal y papel sobre la mesa: difuminados.
    'despacho-salas-reuniones': dict(origen='despacho-salas-reuniones', recorte=(0, 0.06, 1, 0.94),
                                     difuminar=[(0.28, 0.38, 0.35, 0.52), (0.85, 0.62, 0.96, 0.72)]),
    # Transporte: SOLO la parte superior de la foto de la sala (cristales y planta abierta). Se excluyen el portátil
    # con correos, chats e importes, y la persona de la sala del fondo.
    'despacho-cristales-planta': dict(origen='despacho-sala-reunion', recorte=(0.36, 0.13, 1.0, 0.58), difuminar=[]),
    # Mercantil: planta abierta. Persona trabajando al fondo: difuminada.
    'despacho-planta-abierta': dict(origen='despacho-planta-abierta', recorte=(0, 0.12, 1, 0.92),
                                    difuminar=[(0.70, 0.42, 0.77, 0.52)]),
    # Familia: zona de atención. Persona al fondo (cocina) y pantalla de la sala del fondo: difuminadas.
    'despacho-atencion-cliente': dict(origen='despacho-atencion-cliente', recorte=(0, 0.1, 1, 0.95),
                                      difuminar=[(0.60, 0.42, 0.68, 0.58), (0.40, 0.44, 0.47, 0.50)]),
    # Laboral: zona de espera
    'despacho-zona-espera': dict(origen='despacho-zona-espera', recorte=(0, 0.1, 1, 0.94), difuminar=[]),
    # Civil: zona de mesas
    'despacho-zona-mesas': dict(origen='despacho-zona-mesas', recorte=(0, 0.08, 1, 0.92), difuminar=[]),
    # Contacto: sofá y sala del fondo. Persona al fondo: difuminada.
    'despacho-oficina-sofa': dict(origen='despacho-oficina-sofa', recorte=(0, 0.08, 1, 0.94),
                                  difuminar=[(0.50, 0.40, 0.58, 0.58)]),
    # Detalle arquitectónico (madera y cristal) para bandas y tarjetas
    'detalle-madera-cristal': dict(origen='despacho-salas-reuniones', recorte=(0.5, 0.25, 0.85, 0.62), difuminar=[]),
}


def difuminar(img, cajas):
    """Difuminado irreversible con máscara elíptica de borde suave: oculta sin dejar un parche cuadrado."""
    if not cajas:
        return img
    h, w = img.shape[:2]
    mascara = np.zeros((h, w), np.float32)
    for x0, y0, x1, y1 in cajas:
        cx, cy = int((x0 + x1) / 2 * w), int((y0 + y1) / 2 * h)
        ax, ay = max(2, int((x1 - x0) / 2 * w)), max(2, int((y1 - y0) / 2 * h))
        cv2.ellipse(mascara, (cx, cy), (ax, ay), 0, 0, 360, 1.0, -1)
    lado = max(3, int(min(h, w) * 0.02))
    mascara = cv2.GaussianBlur(mascara, (0, 0), lado)[:, :, None]
    pequena = cv2.resize(img, (max(1, w // 24), max(1, h // 24)), interpolation=cv2.INTER_AREA)
    oculto = cv2.GaussianBlur(cv2.resize(pequena, (w, h), interpolation=cv2.INTER_LINEAR), (0, 0), 8)
    return (img * (1 - mascara) + oculto * mascara).astype(np.uint8)


def balance_blancos(img, fuerza=0.5):
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    for canal in (1, 2):
        lab[:, :, canal] -= (lab[:, :, canal].mean() - 128) * fuerza
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


def exposicion(img):
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8)).apply(l)
    # abrir sombras (gamma < 1 sobre la luminancia)
    tabla = np.array([((i / 255.0) ** 0.9) * 255 for i in range(256)]).astype(np.uint8)
    l = cv2.LUT(l, tabla)
    return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)


def nitidez(img, cantidad=0.45):
    suave = cv2.GaussianBlur(img, (0, 0), 1.3)
    return cv2.addWeighted(img, 1 + cantidad, suave, -cantidad, 0)


def procesar(nombre, cfg):
    ruta = ORIG / f"{cfg['origen']}.webp"
    if not ruta.exists():
        ruta = PRIVADOS / f"{cfg['origen']}.webp"
    src = cv2.imread(str(ruta))
    h, w = src.shape[:2]
    x0, y0, x1, y1 = cfg['recorte']
    img = src[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)].copy()
    img = difuminar(img, [(  # cajas relativas a la imagen original -> al recorte
        (cx0 - x0) / (x1 - x0), (cy0 - y0) / (y1 - y0), (cx1 - x0) / (x1 - x0), (cy1 - y0) / (y1 - y0))
        for cx0, cy0, cx1, cy1 in cfg['difuminar']])
    img = nitidez(exposicion(balance_blancos(img)))
    SALIDA.mkdir(parents=True, exist_ok=True)
    for ancho, sufijo in ((1600, ''), (800, '-800'), (480, '-480')):
        esc = cv2.resize(img, (ancho, round(img.shape[0] * ancho / img.shape[1])), interpolation=cv2.INTER_AREA) if img.shape[1] > ancho else img
        cv2.imwrite(str(SALIDA / f'{nombre}{sufijo}.webp'), esc, [cv2.IMWRITE_WEBP_QUALITY, 74])
    antes = src[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    return antes, img


if __name__ == '__main__':
    comp = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    for nombre, cfg in FOTOS.items():
        antes, despues = procesar(nombre, cfg)
        print(f'{nombre}: {despues.shape[1]}x{despues.shape[0]}')
        if comp:
            comp.mkdir(parents=True, exist_ok=True)
            alto = 600
            a = cv2.resize(antes, (round(antes.shape[1] * alto / antes.shape[0]), alto))
            d = cv2.resize(despues, (a.shape[1], alto))
            sep = np.full((alto, 12, 3), 255, np.uint8)
            lienzo = np.hstack([a, sep, d])
            barra = np.full((44, lienzo.shape[1], 3), 255, np.uint8)
            cv2.putText(barra, 'Original (mismo encuadre)', (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (40, 40, 40), 2)
            cv2.putText(barra, 'Retocada', (a.shape[1] + 22, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (40, 40, 160), 2)
            cv2.imwrite(str(comp / f'{nombre}.jpg'), np.vstack([barra, lienzo]), [cv2.IMWRITE_JPEG_QUALITY, 84])
