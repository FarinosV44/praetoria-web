'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Item = { clave: string; archivo: File; progreso: number; estado: 'subiendo' | 'ok' | 'error'; error?: string };
const ACEPTA = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

export function Subidor({ requisitoId, multiple, maxMb, titulo }: { requisitoId: string; multiple: boolean; maxMb: number; titulo: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [arrastre, setArrastre] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const actualizar = (clave: string, cambios: Partial<Item>) =>
    setItems((xs) => xs.map((x) => (x.clave === clave ? { ...x, ...cambios } : x)));

  function subir(archivo: File, clave = `${Date.now()}-${Math.random()}`) {
    if (archivo.size > maxMb * 1024 * 1024) {
      setItems((xs) => [...xs.filter((x) => x.clave !== clave), { clave, archivo, progreso: 0, estado: 'error', error: `Supera el máximo de ${maxMb} MB.` }]);
      return;
    }
    setItems((xs) => [...xs.filter((x) => x.clave !== clave), { clave, archivo, progreso: 0, estado: 'subiendo' }]);
    const fd = new FormData();
    fd.append('requisito', requisitoId);
    fd.append('archivo', archivo, archivo.name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/documentos/');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) actualizar(clave, { progreso: Math.round((e.loaded / e.total) * 100) }); };
    xhr.onload = () => {
      let r: { ok?: boolean; error?: string } = {};
      try { r = JSON.parse(xhr.responseText); } catch { /* respuesta no JSON */ }
      if (xhr.status === 200 && r.ok) { actualizar(clave, { estado: 'ok', progreso: 100 }); router.refresh(); }
      else actualizar(clave, { estado: 'error', error: r.error ?? 'No se ha podido subir. Inténtalo de nuevo.' });
    };
    xhr.onerror = () => actualizar(clave, { estado: 'error', error: 'Sin conexión. Comprueba tu red y pulsa «Reintentar».' });
    xhr.send(fd);
  }

  function elegir(lista: FileList | null) {
    if (!lista) return;
    const arr = Array.from(lista);
    (multiple ? arr : arr.slice(0, 1)).forEach((f) => subir(f));
  }

  return (
    <div
      className={`zona-subida ${arrastre ? 'activa' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setArrastre(true); }}
      onDragLeave={() => setArrastre(false)}
      onDrop={(e) => { e.preventDefault(); setArrastre(false); elegir(e.dataTransfer.files); }}
    >
      <div className="flex flex-wrap gap-2 justify-center">
        <button type="button" className="btn btn-primario" onClick={() => archivoRef.current?.click()}>Subir archivo</button>
        <button type="button" className="btn btn-secundario" onClick={() => fotoRef.current?.click()}>Hacer foto</button>
      </div>
      <input ref={archivoRef} type="file" accept={ACEPTA} multiple={multiple} className="sr-only" tabIndex={-1}
        aria-label={`Subir archivo para ${titulo}`} onChange={(e) => { elegir(e.target.files); e.target.value = ''; }} />
      <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1}
        aria-label={`Hacer una foto para ${titulo}`} onChange={(e) => { elegir(e.target.files); e.target.value = ''; }} />
      <p className="ayuda mt-2">PDF, JPG, PNG, WEBP o HEIC · máximo {maxMb} MB por archivo{multiple ? ' · puedes subir varios' : ''}. También puedes arrastrarlos aquí.</p>
      {items.length ? (
        <ul className="grid gap-2 mt-3 text-left" aria-live="polite">
          {items.map((it) => (
            <li key={it.clave} className="card" style={{ padding: 10 }}>
              <div className="fila">
                <span className="truncate max-w-[60%]">{it.archivo.name}</span>
                {it.estado === 'subiendo' ? <span className="text-sm">Subiendo… {it.progreso} %</span> : null}
                {it.estado === 'ok' ? <span className="chip chip-ok">Guardado</span> : null}
                {it.estado === 'error' ? (
                  <button type="button" className="btn-texto" onClick={() => subir(it.archivo, it.clave)}>Reintentar</button>
                ) : null}
              </div>
              {it.estado === 'subiendo' ? <div className="progreso mt-2"><span style={{ width: `${it.progreso}%` }} /></div> : null}
              {it.estado === 'error' ? <p className="error mt-2 text-sm" role="alert">{it.error}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
