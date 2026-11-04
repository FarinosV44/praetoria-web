// App instalable (PWA) del panel: «Añadir a pantalla de inicio» en iPhone e instalar en Android y escritorio.
// Es una ruta y no src/app/manifest.ts porque este se enlazaría también desde la web pública.
export const dynamic = 'force-static';

const manifiesto = {
  id: '/admin/',
  name: 'Praetoria Abogados',
  short_name: 'Praetoria',
  description: 'Área privada de Praetoria Abogados.',
  lang: 'es-ES',
  start_url: '/admin/',
  scope: '/admin/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#eeece8',
  theme_color: '#22262a',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/iconos/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

export function GET() {
  return new Response(JSON.stringify(manifiesto), { headers: { 'Content-Type': 'application/manifest+json' } });
}
