'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { accionConfirmarSubidas, accionCrearImportacion, accionPrepararSubidas } from '@/app/(portal)/admin/seguros/subidas-acciones';

/**
 * Subir pólizas: se eligen (o se arrastran) los documentos y la IA hace el resto: identifica cada póliza, la
 * guarda organizada y busca lo que no esté en ella. Los archivos van uno a uno al almacén privado.
 */
export function Importar({ polizaId, titulares, compacto = false }: { polizaId?: string; titulares?: { id: string; nombre: string }[]; compacto?: boolean }) {
  const router = useRouter();
  const archivo = useRef<HTMLInputElement>(null);
  const [titular, setTitular] = useState('');
  const [encima, setEncima] = useState(false);
  const [estado, setEstado] = useState<{ error?: string; progreso?: string }>({});
  const [ocupado, setOcupado] = useState(false);

  async function enviar(lista: File[]) {
    if (!lista.length) return setEstado({ error: 'Elige al menos un documento.' });
    if (lista.length > 10) return setEstado({ error: 'Como máximo 10 documentos a la vez.' });
    setOcupado(true); setEstado({ progreso: 'Preparando…' });
    try {
      const imp = await accionCrearImportacion({ polizaId: polizaId ?? null, titularId: titular || null });
      if (!imp.ok) throw new Error(imp.error);
      const prep = await accionPrepararSubidas('importacion', imp.datos, lista.map((f) => ({ nombre: f.name, bytes: f.size })));
      if (!prep.ok) throw new Error(prep.error);
      for (const [i, p] of prep.datos.entries()) {
        setEstado({ progreso: `Subiendo ${i + 1} de ${lista.length}: ${p.nombre}` });
        const r = await fetch(p.url, { method: 'PUT', body: lista[i], referrerPolicy: 'same-origin', headers: { 'content-type': lista[i]!.type || 'application/octet-stream' } });
        if (!r.ok) {
          const j = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(`No se ha podido subir «${p.nombre}»: ${j.error ?? 'comprueba la conexión e inténtalo de nuevo'}.`);
        }
      }
      setEstado({ progreso: 'Enviando a la lectura automática…' });
      const conf = await accionConfirmarSubidas('importacion', imp.datos, prep.datos.map((p) => p.clave), { tipo: 'otro' });
      if (!conf.ok) throw new Error(conf.error);
      router.push(`/admin/seguros/importar/${imp.datos}/`);
    } catch (err) {
      setEstado({ error: (err as Error).message });
      setOcupado(false);
    }
  }

  return (
    <div className="importar">
      {estado.error && <div className="aviso aviso--error" role="alert" style={{ marginBottom: 'var(--e-3)' }}>{estado.error}</div>}
      <label
        className={`zona-importar${encima ? ' zona-importar--activa' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => { e.preventDefault(); setEncima(false); if (!ocupado) void enviar([...e.dataTransfer.files]); }}
      >
        <input ref={archivo} id="archivos-importar" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only"
          disabled={ocupado} onChange={() => void enviar([...(archivo.current?.files ?? [])])} aria-describedby="ayuda-importar" />
        <span className="zona-importar__titulo">{ocupado ? estado.progreso : compacto ? 'Añadir documentos a esta póliza' : 'Arrastra aquí tus pólizas o pulsa para elegirlas'}</span>
        <span id="ayuda-importar" className="zona-importar__ayuda">
          {compacto
            ? 'Condiciones, suplementos, recibos o renovaciones. La IA los lee y completa la póliza.'
            : 'PDF o fotos: condiciones particulares y generales, suplementos, recibos… Hasta 10 a la vez. La IA identifica cada póliza, guarda sus datos y busca en internet lo que falte, como el teléfono de siniestros.'}
        </span>
      </label>
      {!compacto && titulares && titulares.length > 0 && (
        <div className="campo" style={{ marginTop: 'var(--e-3)', maxWidth: 420 }}>
          <label htmlFor="titular-importar">Titular (opcional)</label>
          <select id="titular-importar" value={titular} onChange={(e) => setTitular(e.target.value)} disabled={ocupado}>
            <option value="">Lo identifica la IA en el documento</option>
            {titulares.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
