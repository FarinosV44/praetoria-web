'use client';
import { useEffect, useState } from 'react';

function claveBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Estado = 'cargando' | 'sin-soporte' | 'ios-instalar' | 'denegado' | 'inactivo' | 'activo';

export function ActivarNotificaciones({ clavePublica }: { clavePublica: string }) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const instalada = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (ios && !instalada) return setEstado('ios-instalar');
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setEstado('sin-soporte');
      if (Notification.permission === 'denied') return setEstado('denegado');
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/admin/' });
      const sub = await reg.pushManager.getSubscription();
      setEstado(sub && Notification.permission === 'granted' ? 'activo' : 'inactivo');
    })().catch(() => setEstado('sin-soporte'));
  }, []);

  // El permiso SOLO se pide tras pulsar el botón (requisito de Apple y buena práctica).
  async function activar() {
    setMsg('');
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') { setEstado(permiso === 'denied' ? 'denegado' : 'inactivo'); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveBytes(clavePublica) });
    const r = await fetch('/api/push/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
    if (!r.ok) { setMsg('No se ha podido registrar este dispositivo. Vuelve a entrar e inténtalo de nuevo.'); return; }
    setEstado('activo');
    setMsg('Avisos activados en este dispositivo.');
    window.location.reload();
  }

  async function desactivar() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push/', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setEstado('inactivo');
    window.location.reload();
  }

  async function probar() {
    setMsg('Enviando…');
    const r = await fetch('/api/push/prueba/', { method: 'POST' });
    const d = r.ok ? await r.json() : null;
    setMsg(d ? `Aviso de prueba enviado a ${d.entregados} de ${d.dispositivos} dispositivos. Debería llegarte en unos segundos.` : 'No se ha podido enviar la prueba.');
  }

  return (
    <div className="grid gap-3">
      {estado === 'ios-instalar' ? (
        <div className="nota">
          <p className="font-semibold mb-1">En iPhone, primero instala la app</p>
          <ol className="list-decimal pl-5 grid gap-1">
            <li>Abre esta página en <strong>Safari</strong>.</li>
            <li>Pulsa el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</li>
            <li>Elige <strong>Añadir a pantalla de inicio</strong> y confirma con «Añadir».</li>
            <li>Abre <strong>Praetoria</strong> desde el icono nuevo, entra y vuelve a esta pantalla para activar los avisos.</li>
          </ol>
          <p className="ayuda mt-2">Apple solo permite notificaciones web en apps añadidas a la pantalla de inicio (iOS 16.4 o posterior).</p>
        </div>
      ) : null}
      {estado === 'sin-soporte' ? <p className="nota">Este navegador no admite notificaciones push. Los avisos seguirán apareciendo en «Avisos» dentro de la app.</p> : null}
      {estado === 'denegado' ? <p className="error">Las notificaciones están bloqueadas para Praetoria. Actívalas en los ajustes del teléfono (Ajustes → Notificaciones → Praetoria) y vuelve aquí.</p> : null}
      {estado === 'inactivo' ? <button className="btn btn-primario" onClick={activar}>Activar avisos en este dispositivo</button> : null}
      {estado === 'activo' ? (
        <div className="flex flex-wrap gap-2">
          <span className="chip chip-ok">Avisos activos en este dispositivo</span>
          <button className="btn btn-secundario" onClick={probar}>Enviar aviso de prueba</button>
          <button className="btn btn-secundario" onClick={desactivar}>Desactivar en este dispositivo</button>
        </div>
      ) : null}
      {msg ? <p role="status" className="ayuda">{msg}</p> : null}
    </div>
  );
}
