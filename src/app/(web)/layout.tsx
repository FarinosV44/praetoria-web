import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Fuentes alojadas en la propia web (antes, Google Fonts): más rápidas y sin enviar datos a terceros
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/source-serif-4/opsz.css';
import './web.css';
import { MarcoWeb } from '@/components/MarcoWeb';
import { metadataWeb } from '@/lib/metadata-web';

export const metadata: Metadata = metadataWeb;
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function WebLayout({ children }: { children: ReactNode }) {
  return <MarcoWeb>{children}</MarcoWeb>;
}
