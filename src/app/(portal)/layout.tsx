import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/archivo';
import '@fontsource-variable/source-serif-4';
import './portal.css';

export const metadata: Metadata = {
  title: { default: 'Área de clientes · Praetoria Abogados', template: '%s · Área de clientes · Praetoria Abogados' },
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg', apple: '/iconos/apple-touch-icon.png' },
  manifest: '/admin/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Praetoria', statusBarStyle: 'default' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#22262a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>{children}</>
  );
}
