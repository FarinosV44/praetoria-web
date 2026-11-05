'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { accionConfirmarSubidas, accionPrepararSubidas } from '@/app/(portal)/admin/seguros/subidas-acciones';

/**
 * Subida de archivos al almacén privado, uno a uno y con autorización de un solo uso (/api/seguros/subida).
 * El servidor valida y registra cada archivo al terminar.
 */
export function SubidaDirecta({ destino, id, tipos, tipoDefecto, anualidades, anualidadDefecto, ayuda }: {
  destino: 'poliza' | 'siniestro'; id: string; tipos: { valor: string; texto: string }[]; tipoDefecto: string;
  anualidades?: { valor: string; texto: string }[]; anualidadDefecto?: string; ayuda: string;
}) {
  const router = useRouter();
  const archivo = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState(tipoDefecto);
  const [anualidad, setAnualidad] = useState(anualidadDefecto ?? '');
  const [estado, setEstado] = useState<{ ok?: string; error?: string; progreso?: string }>({});
  const [ocupado, setOcupado] = useState(false);

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    const lista = [...(archivo.current?.files ?? [])];
    if (!lista.length) return setEstado({ error: 'Elige al menos un archivo.' });
    setOcupado(true); setEstado({ progreso: 'Preparando…' });
    try {
      const prep = await accionPrepararSubidas(destino, id, lista.map((f) => ({ nombre: f.name, bytes: f.size })));
      if (!prep.ok) throw new Error(prep.error);
      for (const [i, p] of prep.datos.entries()) {
        setEstado({ progreso: `Subiendo ${i + 1} de ${lista.length}: ${p.nombre}` });
        const r = await fetch(p.url, { method: 'PUT', body: lista[i], referrerPolicy: 'same-origin', headers: { 'content-type': lista[i]!.type || 'application/octet-stream' } });
        if (!r.ok) {
          const j = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(`No se ha podido subir «${p.nombre}»: ${j.error ?? 'comprueba la conexión e inténtalo de nuevo'}.`);
        }
      }
      setEstado({ progreso: 'Comprobando los archivos…' });
      const conf = await accionConfirmarSubidas(destino, id, prep.datos.map((p) => p.clave), { tipo, anualidadId: anualidad || null });
      if (!conf.ok) throw new Error(conf.error);
      const dup = conf.datos.filter((d) => d.duplicadoDe).map((d) => `«${d.nombre}» es idéntico a «${d.duplicadoDe}».`);
      setEstado({ ok: [`${conf.datos.length === 1 ? 'Archivo guardado' : `${conf.datos.length} archivos guardados`}.`, ...dup].join(' ') });
      if (archivo.current) archivo.current.value = '';
      router.refresh();
    } catch (err) {
      setEstado({ error: (err as Error).message });
    } finally { setOcupado(false); }
  }

  return (
    <form className="form" onSubmit={subir} aria-label="Adjuntar archivos">
      {estado.error && <div className="aviso aviso--error" role="alert">{estado.error}</div>}
      {estado.ok && <div className="aviso aviso--ok" role="status">{estado.ok}</div>}
      <div className="campo">
        <label htmlFor="archivo-directo">Archivos</label>
        <input ref={archivo} id="archivo-directo" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic" />
        <span className="ayuda">{ayuda}</span>
      </div>
      <div className="campo">
        <label htmlFor="tipo-directo">Tipo</label>
        <select id="tipo-directo" value={tipo} onChange={(e) => setTipo(e.target.value)}>{tipos.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}</select>
      </div>
      {anualidades && (
        <div className="campo">
          <label htmlFor="anualidad-directa">Anualidad a la que corresponde</label>
          <select id="anualidad-directa" value={anualidad} onChange={(e) => setAnualidad(e.target.value)}>
            <option value="">Sin anualidad concreta</option>
            {anualidades.map((a) => <option key={a.valor} value={a.valor}>{a.texto}</option>)}
          </select>
        </div>
      )}
      <div><button className="boton boton--principal" type="submit" disabled={ocupado}>{ocupado ? (estado.progreso ?? 'Subiendo…') : 'Subir'}</button></div>
      {ocupado && estado.progreso && <p className="pequeno secundario" role="status">{estado.progreso}</p>}
    </form>
  );
}
