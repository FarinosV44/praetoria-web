import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- fuentes de la marca; next/font descargaría en el build */}
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400&display=swap"
          rel="stylesheet"
        />
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
