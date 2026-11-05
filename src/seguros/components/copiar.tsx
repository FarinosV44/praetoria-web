'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function BotonCopiar({ texto, etiqueta = 'Copiar' }: { texto: string; etiqueta?: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button type="button" className="boton boton--peq" onClick={async () => {
      try { await navigator.clipboard.writeText(texto); setHecho(true); setTimeout(() => setHecho(false), 2000); } catch { /* sin permiso: el texto sigue visible para copiarlo a mano */ }
    }}>{hecho ? 'Copiado' : etiqueta}</button>
  );
}

/** Recarga la página mientras haya trabajos en curso (análisis o lectura), cada 5 segundos. */
export function Refrescar({ activo }: { activo: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [activo, router]);
  return activo ? <p className="pequeno secundario" role="status">Procesando… la página se actualizará sola.</p> : null;
}
