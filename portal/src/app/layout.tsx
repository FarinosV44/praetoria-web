import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/archivo';
import '@fontsource-variable/source-serif-4';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Área de clientes · Praetoria Abogados', template: '%s · Área de clientes · Praetoria Abogados' },
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#22262a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
