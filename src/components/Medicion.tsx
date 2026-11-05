'use client';

// Medición de embudos (#9), montada una vez en el layout. Sin consentimiento no envía nada (ver src/lib/medicion.ts).
// - service_view: al ver una página de área o de servicio.
// - cta_click: clic en un enlace al formulario (/contacto/…), con el servicio o el área del enlace.
// - whatsapp_click y phone_click: microconversiones separadas, con destino general o laboral (#28). Un clic NO es una consulta ni un cliente.
// - page_context: tipo de cada página vista (y categoría, en los artículos). scroll_depth: 25, 50, 75 y 100 % de la página.
// - outbound_click: dominio de un enlace externo. tool_start: primer uso de un cuestionario o de la calculadora, nunca sus respuestas.
// También anota la ruta anterior (origen de la consulta) y la atribución de la visita, esta solo con consentimiento.
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { areas, laboral } from '@/lib/site';
import { indiceServicios, servicioPorId } from '@/lib/servicios-indice';
import { anotarRuta, registrarAtribucion } from '@/lib/atribucion';
import { EVENTO_CONSENTIMIENTO } from '@/lib/consentimiento';
import { medir, profundidadesNuevas, tipoDePagina } from '@/lib/medicion';

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

const HERRAMIENTAS: [string, string][] = [
  ['.quiz', 'cuestionario_divorcio'],
  ['.triage', 'triaje_hacienda'],
  ['.calc', 'calculadora_despido'],
];

/** Lo que se mide al ver una página: su tipo siempre y, en áreas y servicios, también service_view. */
function medirVista(path: string) {
  const vista = vistaDePagina(path);
  if (vista) {
    medir('service_view', { ...vista, landing: path });
    medir('page_context', { ...vista, landing: path });
    return;
  }
  const categoria = document.querySelector<HTMLElement>('article[data-categoria]')?.dataset.categoria;
  medir('page_context', { tipo_pagina: categoria ? 'articulo' : tipoDePagina(path), categoria, landing: path });
}

export function Medicion() {
  const path = usePathname();

  useEffect(() => {
    anotarRuta(path);
    registrarAtribucion(new URL(location.href));
    medirVista(path);

    const vistas = new Set<number>();
    const herramientas = new Set<string>();
    const alDesplazar = () => {
      const recorrido = document.documentElement.scrollHeight - window.innerHeight;
      if (recorrido <= 0) return;
      for (const p of profundidadesNuevas(((window.scrollY + 1) / recorrido) * 100, vistas)) {
        medir('scroll_depth', { profundidad: String(p), landing: path });
      }
    };
    // Solo qué herramienta se usa: el valor de los campos y las respuestas no se leen
    const alUsar = (e: Event) => {
      const objetivo = e.target as Element | null;
      const herramienta = HERRAMIENTAS.find(([sel]) => objetivo?.closest?.(sel))?.[1];
      if (!herramienta || herramientas.has(herramienta)) return;
      herramientas.add(herramienta);
      medir('tool_start', { herramienta, landing: path });
    };
    window.addEventListener('scroll', alDesplazar, { passive: true });
    document.addEventListener('click', alUsar);
    return () => {
      window.removeEventListener('scroll', alDesplazar);
      document.removeEventListener('click', alUsar);
    };
  }, [path]);

  useEffect(() => {
    const alAceptar = (e: Event) => {
      registrarAtribucion(new URL(location.href));
      // La página en la que se acepta también cuenta: sin esto se perdería la primera de cada visita
      if ((e as CustomEvent).detail === 'granted') medirVista(location.pathname);
    };
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
        medir('whatsapp_click', { destino: href.includes(laboral.whatsappIntl.slice(1)) ? 'laboral' : 'general', landing, ubicacion });
      } else if (href.startsWith('tel:')) {
        // Un único número (centralita): el destino lo indica el canal del enlace, no el número.
        const canal = (a.closest('[data-canal]') as HTMLElement | null)?.dataset.canal;
        medir('phone_click', { destino: canal === 'laboral' || /laboral/i.test(a.textContent ?? '') ? 'laboral' : 'general', landing, ubicacion });
      } else if (/^https?:\/\//.test(href)) {
        // Solo el dominio: la dirección completa podría llevar parámetros
        const dominio = new URL(href).hostname;
        if (dominio !== location.hostname) medir('outbound_click', { destino: dominio, landing, ubicacion });
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
