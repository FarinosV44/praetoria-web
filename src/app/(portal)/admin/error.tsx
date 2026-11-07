'use client';
import Link from 'next/link';

/** Fallo al cargar una pantalla: explica qué pasa y ofrece reintentar sin perder la navegación del panel. */
export default function ErrorDespacho({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="vacio-bloque" role="alert">
      <strong>No se ha podido cargar esta pantalla</strong>
      Puede ser un corte momentáneo. Tus datos no se han modificado.
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-primario" onClick={reset}>Reintentar</button>
        <Link href="/admin/" className="btn btn-secundario">Ir al inicio</Link>
      </div>
    </div>
  );
}
