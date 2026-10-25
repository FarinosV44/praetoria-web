'use client';

// Medición de embudos (#9), montada una vez en el layout. Sin consentimiento no envía nada (ver src/lib/medicion.ts).
// - service_view: al ver una página de área o de servicio.
// - cta_click: clic en un enlace al formulario (/contacto/…), con el servicio o el área del enlace.
// - whatsapp_click y phone_click: microconversiones separadas, con destino general o laboral (#28). Un clic NO es una consulta ni un cliente.
// También anota la ruta anterior (origen de la consulta) y la atribución de la visita, esta solo con consentimiento.
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { areas, laboral } from '@/lib/site';
import { indiceServicios, servicioPorId } from '@/lib/servicios-indice';
import { anotarRuta, registrarAtribucion } from '@/lib/atribucion';
import { EVENTO_CONSENTIMIENTO } from '@/lib/consentimiento';
import { medir } from '@/lib/medicion';

/** Zona de la página donde está el enlace (para comparar CTA), sin textos del usuario */
const ZONAS: [string, string][] = [
  ['.site-header', 'cabecera'],
  ['.quickbar', 'barra_movil'],
  ['.page-head', 'cabecera_pagina'],
  ['.journey', 'recorrido'],
  ['.service', 'lista_servicios'],
  ['.post-aside', 'lateral_articulo'],
  ['.cta', 'banda_final'],
  ['.quiz, .triage, .result', 'cuestionario'],
  ['footer', 'pie'],
];
const zona = (el: Element) => ZONAS.find(([sel]) => el.closest(sel))?.[1] ?? 'contenido';

export function vistaDePagina(path: string) {
  const area = areas.find((a) => path === `/${a.slug}/`);
  if (area) return { tipo_pagina: 'area', area: area.id };
  const sv = indiceServicios.find((s) => s.pagina === path);
  if (sv) return { tipo_pagina: 'servicio', area: sv.area, servicio: sv.id };
  return null;
}

export function Medicion() {
  const path = usePathname();

  useEffect(() => {
    anotarRuta(path);
    registrarAtribucion(new URL(location.href));
    const vista = vistaDePagina(path);
    if (vista) medir('service_view', { ...vista, landing: path });
  }, [path]);

  useEffect(() => {
    const alAceptar = () => registrarAtribucion(new URL(location.href));
    window.addEventListener(EVENTO_CONSENTIMIENTO, alAceptar);
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      const landing = location.pathname;
      const ubicacion = zona(a);
      if (href.startsWith('/contacto/')) {
        const q = new URL(href, location.origin).searchParams;
        const sv = servicioPorId(q.get('servicio') ?? '');
        medir('cta_click', { destino: 'formulario', servicio: sv?.id, area: sv?.area ?? q.get('area') ?? undefined, landing, ubicacion });
      } else if (href.startsWith('https://wa.me/')) {
        medir('whatsapp_click', { destino: href.includes(laboral.phoneIntl.slice(1)) ? 'laboral' : 'general', landing, ubicacion });
      } else if (href.startsWith('tel:')) {
        medir('phone_click', { destino: href.includes(laboral.phoneIntl.slice(1)) ? 'laboral' : 'general', landing, ubicacion });
      }
    };
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener(EVENTO_CONSENTIMIENTO, alAceptar);
    };
  }, []);

  return null;
}
