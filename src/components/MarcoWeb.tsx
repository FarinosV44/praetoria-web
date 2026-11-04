import type { ReactNode } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CookieConsent } from '@/components/CookieConsent';
import { Medicion } from '@/components/Medicion';
import { QuickBar } from '@/components/QuickBar';
import { JsonLd } from '@/components/JsonLd';
import { getPosts } from '@/lib/content';
import { servicios } from '@/lib/servicios';
import { areas } from '@/lib/site';
import { legalServiceLd } from '@/lib/seo';

// Rutas donde el contacto contextual es el del área laboral (#28): el área, sus servicios y sus artículos
const rutasLaborales = [
  ...areas.filter((a) => a.id === 'laboral').map((a) => `/${a.slug}/`),
  ...servicios.filter((s) => s.area === 'laboral' && s.pagina).map((s) => s.pagina!),
  ...getPosts().filter((p) => p.category === 'laboral').map((p) => `/${p.slug}/`),
];

/** Cabecera, pie y elementos comunes de la web pública. Lo usan su layout y la página 404. */
export function MarcoWeb({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd data={legalServiceLd} />
      <a className="skip" href="#contenido" lang="es">
        Saltar al contenido
      </a>
      <Header />
      <main id="contenido">{children}</main>
      <Footer />
      <QuickBar rutasLaborales={rutasLaborales} />
      <CookieConsent />
      <Medicion />
    </>
  );
}
