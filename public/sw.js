// Service worker de Praetoria. Solo gestiona notificaciones push.
// NO guarda en caché páginas, expedientes ni documentos: no hay manejador de «fetch», así que todo lo
// autenticado se pide siempre al servidor, que vuelve a comprobar sesión, rol y doble factor.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { /* contenido no JSON */ }
  // Texto siempre neutro: nada del cliente ni del asunto en la pantalla de bloqueo.
  const titulo = 'Praetoria';
  const cuerpo = 'Tienes un aviso pendiente en Praetoria.';
  const url = typeof d.url === 'string' && d.url.startsWith('/') ? d.url : '/admin/avisos/';
  event.waitUntil(self.registration.showNotification(titulo, {
    body: cuerpo,
    icon: '/iconos/icono-192.png',
    badge: '/iconos/insignia-96.png',
    tag: typeof d.tag === 'string' ? d.tag : undefined,
    data: { url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin/avisos/';
  event.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abiertas) {
      if (new URL(c.url).origin === self.location.origin) { await c.focus(); return c.navigate(url); }
    }
    return self.clients.openWindow(url);
  })());
});
