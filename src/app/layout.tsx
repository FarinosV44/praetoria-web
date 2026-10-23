import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Fuentes alojadas en la propia web (antes, Google Fonts): más rápidas y sin enviar datos a terceros
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/source-serif-4/opsz.css';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CookieConsent } from '@/components/CookieConsent';
import { Icon } from '@/components/Icon';
import { JsonLd } from '@/components/JsonLd';
import { legalServiceLd } from '@/lib/seo';
import { site, whatsapp } from '@/lib/site';

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
        <nav className="quickbar" aria-label="Contacto rápido" lang="es">
          <a href={`tel:${site.phoneIntl}`}>
            <Icon name="phone" /> Llamar
          </a>
          <a href={whatsapp()}>
            <Icon name="whatsapp" /> WhatsApp
          </a>
        </nav>
        <CookieConsent />
      </body>
    </html>
  );
}
