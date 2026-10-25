import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Fuentes alojadas en la propia web (antes, Google Fonts): más rápidas y sin enviar datos a terceros
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/source-serif-4/opsz.css';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CookieConsent } from '@/components/CookieConsent';
import { Medicion } from '@/components/Medicion';
import { QuickBar } from '@/components/QuickBar';
import { getPosts } from '@/lib/content';
import { servicios } from '@/lib/servicios';
import { areas } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { legalServiceLd } from '@/lib/seo';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png', sizes: '48x48' },
    ],
    apple: '/apple-touch-icon.png',
  },
  alternates: { types: { 'application/rss+xml': [{ url: '/rss.xml', title: `Blog de ${site.name}` }] } },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

// Rutas donde el contacto contextual es el del área laboral (#28): el área, sus servicios y sus artículos
const rutasLaborales = [
  ...areas.filter((a) => a.id === 'laboral').map((a) => `/${a.slug}/`),
  ...servicios.filter((s) => s.area === 'laboral' && s.pagina).map((s) => s.pagina!),
  ...getPosts().filter((p) => p.category === 'laboral').map((p) => `/${p.slug}/`),
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // El idioma del documento se ajusta en el build para los artículos en francés y árabe (scripts/postbuild.mjs)
    <html lang="es" suppressHydrationWarning>
      <head>
        <JsonLd data={legalServiceLd} />
      </head>
      <body className="site-root">
        <a className="skip" href="#contenido" lang="es">
          Saltar al contenido
        </a>
        <Header />
        <main id="contenido">{children}</main>
        <Footer />
        <QuickBar rutasLaborales={rutasLaborales} />
        <CookieConsent />
        <Medicion />
      </body>
    </html>
  );
}
