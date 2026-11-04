import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/archivo';
import '@fontsource-variable/source-serif-4';
import './portal.css';
import { iconosMarca } from '@/lib/metadata-web';

export const metadata: Metadata = {
  title: { default: 'Área de clientes · Praetoria Abogados', template: '%s · Área de clientes · Praetoria Abogados' },
  robots: { index: false, follow: false },
  icons: iconosMarca,
  manifest: '/admin/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Praetoria', statusBarStyle: 'default' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#22262a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>{children}</>
  );
}
