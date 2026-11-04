import type { MetadataRoute } from 'next';

// Aplicación instalable (PWA): «Añadir a pantalla de inicio» en iPhone, instalar en Android y escritorio.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Praetoria Abogados',
    short_name: 'Praetoria',
    description: 'Área privada de Praetoria Abogados: despacho y clientes.',
    lang: 'es-ES',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#eeece8',
    theme_color: '#22262a',
    icons: [
      { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/iconos/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
