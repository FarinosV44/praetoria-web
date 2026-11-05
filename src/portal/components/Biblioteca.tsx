'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { aprobar, cambiarEstado, guardarFicha, nuevaMateria, nuevoProcedimiento, type ResultadoBib } from '@/app/(portal)/admin/biblioteca/acciones';

type Subida = { clave: string; nombre: string; estado: 'subiendo' | 'ok' | 'error'; error?: string; modelo?: string; avisos?: string[] };

/** Arrastrar, pegar o elegir escritos. Sin «modelo»: cada archivo crea un modelo; con «modelo»: añade una versión. */
export function SubirBiblioteca({ modelo }: { modelo?: string }) {
  const router = useRouter();
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [encima, setEncima] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const texto = useRef<HTMLTextAreaElement>(null);

  async function enviar(fd: FormData, nombre: string) {
    const clave = `${Date.now()}-${Math.random()}`;
    setSubidas((s) => [...s, { clave, nombre, estado: 'subiendo' }]);
    if (modelo) fd.append('modelo', modelo);
    let r: { ok?: boolean; error?: string; modelo?: string; avisos?: string[] } = {};
    try { r = await (await fetch('/api/biblioteca/', { method: 'POST', body: fd })).json(); } catch { r = { error: 'Sin conexión.' }; }
    setSubidas((s) => s.map((x) => (x.clave === clave ? (r.ok ? { ...x, estado: 'ok', modelo: r.modelo, avisos: r.avisos } : { ...x, estado: 'error', error: r.error ?? 'No se ha podido guardar.' }) : x)));
    if (r.ok) router.refresh();
  }
  const archivos = (fs: FileList | File[]) => Array.from(fs).forEach((f) => { const fd = new FormData(); fd.append('archivo', f, f.name); void enviar(fd, f.name); });

  useEffect(() => {
    const sobre = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); setEncima(true); } };
    const fuera = (e: DragEvent) => { if (!e.relatedTarget) setEncima(false); };
    const soltar = (e: DragEvent) => { if (!e.dataTransfer?.files.length) return; e.preventDefault(); setEncima(false); archivos(e.dataTransfer.files); };
    window.addEventListener('dragover', sobre); window.addEventListener('dragleave', fuera); window.addEventListener('drop', soltar);
    return () => { window.removeEventListener('dragover', sobre); window.removeEventListener('dragleave', fuera); window.removeEventListener('drop', soltar); };
  });

  return (
    <div className={`card grid gap-2 ${encima ? 'ring-2' : ''}`} data-subir-biblioteca>
      <p className="font-semibold">{modelo ? 'Nueva versión de este modelo' : 'Añadir escritos del despacho'}</p>
      <p className="ayuda text-sm">Arrastra aquí PDF o Word (puedes soltar varios a la vez), elige archivos o pega el texto. Se guardan como <strong>privados y pendientes de revisión</strong>; el original no se modifica.</p>
      <div className="flex flex-wrap gap-2 items-start">
        <button type="button" className="btn btn-secundario" onClick={() => archivo.current?.click()}>📎 Elegir archivos</button>
        <input ref={archivo} type="file" multiple accept=".pdf,.docx,application/pdf" className="sr-only" aria-label="Archivos para la biblioteca"
          onChange={(e) => { archivos(e.target.files ?? []); e.target.value = ''; }} />
        <label htmlFor="bib-texto" className="sr-only">Texto del escrito</label>
        <textarea id="bib-texto" ref={texto} rows={2} placeholder="…o pega aquí el texto del escrito" className="border rounded-md p-2 flex-1 min-w-[14rem]" />
        <button type="button" className="btn btn-primario" onClick={() => {
          const t = texto.current?.value.trim() ?? '';
          if (t.length < 20) return;
          const fd = new FormData(); fd.append('texto', t); void enviar(fd, 'Texto pegado');
          if (texto.current) texto.current.value = '';
        }}>Guardar texto</button>
      </div>
      {subidas.length ? (
        <ul className="grid gap-1 text-sm" aria-live="polite">
          {subidas.map((s) => (
            <li key={s.clave} data-subida-bib={s.nombre}>
              📄 {s.nombre} · {s.estado === 'subiendo' ? 'guardando…' : s.estado === 'error' ? <span className="error">{s.error}</span>
                : <>guardado {s.modelo && !modelo ? <a href={`/admin/biblioteca/${s.modelo}/`}>· revisar clasificación</a> : null}
                  {s.avisos?.length ? <span className="chip chip-aviso ml-2">{s.avisos.length} aviso{s.avisos.length > 1 ? 's' : ''} de datos identificables</span> : null}</>}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type Ficha = { id: string; titulo: string; materia: string | null; procedimiento: string | null; tipo: string | null; variante: string | null; clase: string;
  etiquetas: string[]; organo: string | null; posicion: string | null; fecha: string | null };

/** Clasificación sin formularios eternos: chips para materia y clase, nombre del procedimiento con sugerencias. */
export function FichaModelo({ m, materias, clases, editable }: { m: Ficha; materias: { id: string; nombre: string }[]; clases: Record<string, { t: string; ayuda: string }>; editable: boolean }) {
  const [r, accion, pendiente] = useActionState<ResultadoBib, FormData>(guardarFicha, {});
  const [materia, setMateria] = useState(m.materia ?? '');
  return (
    <form action={accion} className="grid gap-3" aria-label="Clasificación del modelo">
      <input type="hidden" name="modelo" value={m.id} /><input type="hidden" name="materia" value={materia} />
      <label className="grid gap-1"><span className="etiqueta">Título</span><input name="titulo" defaultValue={m.titulo} disabled={!editable} required minLength={3} maxLength={200} className="border rounded-md p-2" /></label>
      <fieldset className="grid gap-1" disabled={!editable}><legend className="etiqueta">Materia</legend>
        <div className="flex flex-wrap gap-2">{materias.map((x) => (
          <button key={x.id} type="button" aria-pressed={materia === x.id} onClick={() => setMateria(x.id)} className={`chip ${materia === x.id ? 'chip-info' : 'chip-neutro'}`} style={{ border: 0, cursor: 'pointer' }}>{x.nombre}</button>
        ))}</div>
      </fieldset>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="grid gap-1"><span className="etiqueta">Procedimiento</span><input name="procedimiento" list={`procs-${materia}`} defaultValue={m.procedimiento ?? ''} disabled={!editable} placeholder="Escribe para ver sugerencias" className="border rounded-md p-2" /></label>
        <label className="grid gap-1"><span className="etiqueta">Variante</span><input name="variante" defaultValue={m.variante ?? ''} disabled={!editable} placeholder="p. ej. «mutuo acuerdo con hijos menores»" className="border rounded-md p-2" /></label>
        <label className="grid gap-1"><span className="etiqueta">Tipo de escrito</span><input name="tipo" defaultValue={m.tipo ?? ''} disabled={!editable} className="border rounded-md p-2" /></label>
        <label className="grid gap-1"><span className="etiqueta">Etiquetas (separadas por comas)</span><input name="etiquetas" defaultValue={m.etiquetas.join(', ')} disabled={!editable} className="border rounded-md p-2" /></label>
        <label className="grid gap-1"><span className="etiqueta">Órgano</span><input name="organo" defaultValue={m.organo ?? ''} disabled={!editable} className="border rounded-md p-2" /></label>
        <label className="grid gap-1"><span className="etiqueta">Fecha de la normativa aplicada</span><input name="fecha" type="date" defaultValue={m.fecha ?? ''} disabled={!editable} className="border rounded-md p-2" /></label>
      </div>
      <fieldset className="grid gap-1" disabled={!editable}><legend className="etiqueta">Posición</legend>
        <div className="flex flex-wrap gap-3 text-sm">{[['', 'Sin indicar'], ['actor', 'Actor'], ['demandado', 'Demandado'], ['recurrente', 'Recurrente'], ['neutral', 'Neutral']].map(([v, t]) => (
          <label key={v} className="flex gap-1 items-center"><input type="radio" name="posicion" value={v} defaultChecked={(m.posicion ?? '') === v} /> {t}</label>))}</div>
      </fieldset>
      <fieldset className="grid gap-1" disabled={!editable}><legend className="etiqueta">Clase</legend>
        <div className="grid gap-1 text-sm">{Object.entries(clases).map(([v, c]) => (
          <label key={v} className="flex gap-2 items-start"><input type="radio" name="clase" value={v} defaultChecked={m.clase === v} /> <span><strong>{c.t}</strong> · <span className="ayuda">{c.ayuda}</span></span></label>))}</div>
      </fieldset>
      {editable ? <div><button className="btn btn-primario" disabled={pendiente}>Guardar clasificación</button></div> : <p className="ayuda text-sm">Solo su autor (mientras no está aprobado) o la superadministración pueden cambiarlo.</p>}
      {r.error ? <p className="error text-sm" role="alert">{r.error}</p> : r.ok ? <p className="exito text-sm" role="status">{r.ok}</p> : null}
    </form>
  );
}

export function EstadoModelo({ modelo, estado, autor, global, clase }: { modelo: string; estado: string; autor: boolean; global: boolean; clase: string }) {
  const [r, accion, pendiente] = useActionState<ResultadoBib, FormData>(cambiarEstado, {});
  const [ra, accionA, pendienteA] = useActionState<ResultadoBib, FormData>(aprobar, {});
  const boton = (e: string, t: string) => (
    <form action={accion} className="inline"><input type="hidden" name="modelo" value={modelo} /><input type="hidden" name="estado" value={e} />
      <button className="btn btn-secundario" style={{ minHeight: 36 }} disabled={pendiente}>{t}</button></form>
  );
  return (
    <div className="grid gap-2" aria-label="Estado del modelo">
      <div className="flex flex-wrap gap-2">
        {estado === 'pendiente' && (autor || global) ? boton('revision', 'Enviar a revisión') : null}
        {estado !== 'obsoleto' && global ? boton('obsoleto', 'Marcar obsoleto (no usar)') : null}
        {estado === 'obsoleto' && global ? boton('revision', 'Recuperar (a revisión)') : null}
      </div>
      {global && estado !== 'aprobado' && estado !== 'obsoleto' ? (
        clase === 'caso_privado' ? <p className="ayuda text-sm">Un escrito de caso privado no se comparte. Para usarlo como modelo, anonimízalo, súbelo como nueva versión y cámbialo a «Histórico anonimizado» o «Modelo maestro».</p> : (
          <form action={accionA} className="grid gap-1 text-sm">
            <input type="hidden" name="modelo" value={modelo} />
            <label className="flex gap-2 items-start"><input type="checkbox" name="anonimizado" value="1" required />
              <span>He revisado la última versión: no quedan datos identificables de clientes ni de terceros (directos o indirectos), tampoco en las propiedades del archivo.</span></label>
            <div><button className="btn btn-primario" style={{ minHeight: 36 }} disabled={pendienteA}>Aprobar para la biblioteca</button></div>
          </form>)
      ) : null}
      {r.error || ra.error ? <p className="error text-sm" role="alert">{r.error ?? ra.error}</p> : r.ok || ra.ok ? <p className="exito text-sm" role="status">{r.ok ?? ra.ok}</p> : null}
    </div>
  );
}

export function NuevoProcedimiento({ materias }: { materias: { id: string; nombre: string }[] }) {
  const [r, accion, pendiente] = useActionState<ResultadoBib, FormData>(nuevoProcedimiento, {});
  const [materia, setMateria] = useState(materias[0]?.id ?? '');
  return (
    <form action={accion} className="grid gap-2">
      <input type="hidden" name="materia" value={materia} />
      <div className="flex flex-wrap gap-2">{materias.map((x) => (
        <button key={x.id} type="button" aria-pressed={materia === x.id} onClick={() => setMateria(x.id)} className={`chip ${materia === x.id ? 'chip-info' : 'chip-neutro'}`} style={{ border: 0, cursor: 'pointer' }}>{x.nombre}</button>))}</div>
      <div className="flex gap-2"><input name="nombre" aria-label="Nombre del procedimiento" placeholder="Nombre del procedimiento" className="border rounded-md p-2 flex-1" />
        <button className="btn btn-primario" disabled={pendiente}>Añadir</button></div>
      {r.error ? <p className="error text-sm" role="alert">{r.error}</p> : r.ok ? <p className="exito text-sm" role="status">{r.ok}</p> : null}
    </form>
  );
}

export function NuevaMateria() {
  const [r, accion, pendiente] = useActionState<ResultadoBib, FormData>(nuevaMateria, {});
  return (
    <form action={accion} className="flex gap-2 items-center">
      <input name="nombre" aria-label="Nueva materia" placeholder="Nueva materia" className="border rounded-md p-2" />
      <button className="btn btn-secundario" disabled={pendiente}>Añadir materia</button>
      {r.error ? <span className="error text-sm" role="alert">{r.error}</span> : r.ok ? <span className="exito text-sm" role="status">{r.ok}</span> : null}
    </form>
  );
}
