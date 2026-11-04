import type { Metadata } from 'next';
import { site } from '@/lib/site';

// Iconos de la marca, comunes a la web y al portal (originales y generador en scripts/marca).
// Solo se anuncia el monograma como favicon: el nombre completo no se lee en una pestaña ni en Google.
// ?v= obliga a navegadores y CDN a pedir el icono de nuevo: súbelo solo si cambia el diseño.
export const iconosMarca: Metadata['icons'] = {
  icon: [
    { url: '/favicon.ico?v=2', sizes: '16x16 32x32 48x48' },
    { url: '/favicon.svg?v=2', type: 'image/svg+xml' },
    { url: '/favicon.png?v=2', type: 'image/png', sizes: '48x48' },
  ],
  apple: '/apple-touch-icon.png?v=2',
};

export const metadataWeb: Metadata = {
  metadataBase: new URL(site.url),
  icons: iconosMarca,
  alternates: { types: { 'application/rss+xml': [{ url: '/rss.xml', title: `Blog de ${site.name}` }] } },
};
