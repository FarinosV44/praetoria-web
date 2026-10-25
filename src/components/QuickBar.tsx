'use client';

// Barra fija de contacto en móvil (#28): en las páginas laborales llama y escribe al área laboral; en el resto, a la
// atención jurídica general. Cada botón dice a qué área llama.
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { contactos, mensajes, whatsapp } from '@/lib/site';
import { Icon } from './Icon';

export function QuickBar({ rutasLaborales }: { rutasLaborales: string[] }) {
  const path = usePathname();
  const esLaboral = rutasLaborales.includes(path);
  const c = esLaboral ? contactos.laboral : contactos.general;
  const area = esLaboral ? 'Área laboral' : 'Despacho';
  const barra = useRef<HTMLElement>(null);

  // Si el elemento que recibe el foco queda (aunque sea en parte) bajo la barra fija, se desplaza lo justo.
  // El navegador no lo hace solo cuando el elemento ya era parcialmente visible.
  useEffect(() => {
    const alEnfocar = (e: FocusEvent) => {
      const bar = barra.current;
      const el = e.target as HTMLElement | null;
      if (!bar || !el || !el.getBoundingClientRect || bar.contains(el) || getComputedStyle(bar).display === 'none') return;
      const tope = bar.getBoundingClientRect().top - 8;
      const r = el.getBoundingClientRect();
      if (r.bottom > tope) window.scrollBy({ top: Math.min(r.bottom - tope, r.top - 80), behavior: 'instant' as ScrollBehavior });
    };
    document.addEventListener('focusin', alEnfocar);
    return () => document.removeEventListener('focusin', alEnfocar);
  }, []);

  return (
    <nav ref={barra} className="quickbar" aria-label="Contacto rápido" lang="es" data-canal={c.id}>
      <a href={`tel:${c.phoneIntl}`}>
        <Icon name="phone" />
        <span>
          Llamar <small>{area}</small>
        </span>
      </a>
      <a href={whatsapp(esLaboral ? mensajes.laboral : mensajes.general, c.id)}>
        <Icon name="whatsapp" />
        <span>
          WhatsApp <small>{area}</small>
        </span>
      </a>
    </nav>
  );
}
