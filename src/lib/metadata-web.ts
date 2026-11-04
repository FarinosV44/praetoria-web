import type { Metadata } from 'next';
import { site } from '@/lib/site';

export const metadataWeb: Metadata = {
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
