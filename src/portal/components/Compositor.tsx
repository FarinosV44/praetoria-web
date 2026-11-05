'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { guardarEntrada, type Resultado } from '@/app/(portal)/admin/expedientes/acciones';
import { Redactor, type EscritoHilo } from './Redactor';

type Subida = { clave: string; nombre: string; progreso: number; estado: 'subiendo' | 'ok' | 'error'; error?: string; archivo: File; origen: string };
type Modo = 'nota' | 'cliente' | 'tarea' | 'escrito';
// «Redacta/prepara una demanda…» escrito como nota: se sugiere pasar al redactor con IA (#94), nunca se hace solo.
const PIDE_ESCRITO = /^\s*(?:redact|prepar|haz|hazme|elabor|escrib)\w*\b[\s\S]{0,80}\b(?:demanda|recurso|escrito|contestaci|alegaci|oposici|querella|denuncia|requerimiento|burofax|reclamaci|papeleta|convenio|personaci)/i;
const ACEPTA = 'application/pdf,image/*,.heic,.heif,.docx';

const manana = () => {
  const d = new Date(Date.now() + 86400e3);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(d);
};

// Compositor siempre visible del expediente (#78): escribir, pegar, arrastrar y adjuntar sin cambiar de pantalla.
// Por defecto todo es una NOTA INTERNA; enviar al cliente exige confirmarlo con un segundo clic.
export function Compositor({ solicitudId, maxMb, ia = false, escritos = [], abrirEscrito = null }: {
  solicitudId: string; maxMb: number; ia?: boolean; escritos?: EscritoHilo[]; abrirEscrito?: string | null;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>(ia && abrirEscrito ? 'escrito' : 'nota');
  const [sugerirIA, setSugerirIA] = useState(false);
  const [inicialIA, setInicialIA] = useState('');
  const [fuente, setFuente] = useState<'nota' | 'texto_aportado' | 'llamada'>('nota');
  const [confirmar, setConfirmar] = useState(false);
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  // Tras guardar: limpiar el texto y volver al modo seguro (dentro de la propia acción, sin efectos en cascada).
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(async (prev, f) => {
    const r = await guardarEntrada(prev, f);
    if (r.ok) {
      if (textoRef.current) textoRef.current.value = '';
      setModo('nota'); setFuente('nota'); setConfirmar(false);
      router.refresh();
    }
    return r;
  }, {});
  const formRef = useRef<HTMLFormElement>(null);
  const textoRef = useRef<HTMLTextAreaElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  const actualizar = (clave: string, c: Partial<Subida>) => setSubidas((xs) => xs.map((x) => (x.clave === clave ? { ...x, ...c } : x)));

  function subir(archivo: File, origen = 'archivo', clave = `${Date.now()}-${Math.random()}`) {
    if (archivo.size > maxMb * 1024 * 1024) {
      setSubidas((xs) => [...xs.filter((x) => x.clave !== clave), { clave, nombre: archivo.name, progreso: 0, estado: 'error', error: `Supera ${maxMb} MB`, archivo, origen }]);
      return;
    }
    setSubidas((xs) => [...xs.filter((x) => x.clave !== clave), { clave, nombre: archivo.name, progreso: 0, estado: 'subiendo', archivo, origen }]);
    const fd = new FormData();
    fd.append('solicitud', solicitudId);
    fd.append('origen', origen);
    fd.append('archivo', archivo, archivo.name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/documentos/');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) actualizar(clave, { progreso: Math.round((e.loaded / e.total) * 100) }); };
    xhr.onload = () => {
      let r: { ok?: boolean; error?: string; ref?: string } = {};
      try { r = JSON.parse(xhr.responseText); } catch { /* respuesta no JSON (p. ej. un proxy intermedio) */ }
      const porEstado = xhr.status === 413 ? 'El archivo es demasiado grande para el servidor.' : xhr.status === 401 ? 'Tu sesión ha caducado. Vuelve a entrar.'
        : xhr.status >= 500 ? 'El servidor no ha podido guardarlo. No se ha guardado nada; inténtalo de nuevo.' : `No se ha podido subir (error ${xhr.status}).`;
      const error = `${r.error ?? porEstado}${r.ref ? ` · ref. ${r.ref}` : ''}`;
      if (xhr.status === 200 && r.ok) { actualizar(clave, { estado: 'ok', progreso: 100 }); router.refresh(); }
      else actualizar(clave, { estado: 'error', error });
    };
    xhr.onerror = () => actualizar(clave, { estado: 'error', error: 'Sin conexión. Pulsa «Reintentar».' });
    xhr.send(fd);
  }

  // Arrastrar y soltar en cualquier parte de la página del expediente.
  useEffect(() => {
    const sobre = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); setArrastrando(true); } };
    const fuera = (e: DragEvent) => { if (!e.relatedTarget) setArrastrando(false); };
    const soltar = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault(); setArrastrando(false);
      Array.from(e.dataTransfer.files).forEach((f) => subir(f));
    };
    window.addEventListener('dragover', sobre); window.addEventListener('dragleave', fuera); window.addEventListener('drop', soltar);
    return () => { window.removeEventListener('dragover', sobre); window.removeEventListener('dragleave', fuera); window.removeEventListener('drop', soltar); };
  });

  // Pegar: los archivos o capturas se suben; un texto largo se propone como «texto aportado».
  function alPegar(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const archivos = Array.from(e.clipboardData.files);
    if (archivos.length) {
      e.preventDefault();
      archivos.forEach((f, i) => subir(f.name && f.name !== 'image.png' ? f : new File([f], `captura-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}${i ? `-${i}` : ''}.png`, { type: f.type }), 'portapapeles'));
      return;
    }
    const t = e.clipboardData.getData('text');
    if (t.length > 400 && !textoRef.current?.value && modo === 'nota') setFuente('texto_aportado');
  }

  function alTeclear(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); formRef.current?.requestSubmit(); }
  }

  const chip = (m: Modo, t: string) => (
    <button type="button" onClick={() => { setModo(m); setConfirmar(false); }} aria-pressed={modo === m}
      className={`chip ${modo === m ? (m === 'cliente' ? 'chip-aviso' : 'chip-info') : 'chip-neutro'}`} style={{ cursor: 'pointer', border: 0 }}>{t}</button>
  );

  return (
    <div className="compositor" id="compositor">
      {arrastrando ? <div className="soltar-aqui" aria-hidden>Suelta los archivos para guardarlos en el expediente</div> : null}
      {subidas.length ? (
        <ul className="grid gap-1 mb-2 text-sm" aria-live="polite">
          {subidas.map((s) => (
            <li key={s.clave} className="fila" data-subida={s.nombre}>
              <span className="truncate max-w-[60%]">📎 {s.nombre}</span>
              {s.estado === 'subiendo' ? <span>{s.progreso} %</span> : null}
              {s.estado === 'ok' ? <span className="chip chip-ok">Guardado (privado)</span> : null}
              {s.estado === 'error' ? <span className="flex gap-2 items-center"><span className="text-[var(--color-red-dark)]">{s.error}</span>
                <button type="button" className="btn-texto" onClick={() => subir(s.archivo, s.origen, s.clave)}>Reintentar</button></span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <form ref={formRef} action={accion} className="grid gap-2">
        <input type="hidden" name="solicitud" value={solicitudId} />
        <input type="hidden" name="modo" value={modo} />
        <input type="hidden" name="fuente" value={fuente} />
        <input type="hidden" name="confirmado" value={confirmar ? '1' : ''} />
        <div className="flex flex-wrap gap-2 items-center">
          {chip('nota', 'Nota interna')}
          {chip('cliente', 'Mensaje al cliente')}
          {chip('tarea', 'Tarea o plazo')}
          {ia ? chip('escrito', '✍️ Preparar escrito con IA') : null}
          {modo === 'nota' ? (
            <span className="flex gap-1 text-xs ml-auto">
              {([['nota', 'Nota'], ['texto_aportado', 'Texto pegado'], ['llamada', 'Llamada']] as const).map(([v, t]) => (
                <button key={v} type="button" onClick={() => setFuente(v)} aria-pressed={fuente === v} className="btn-texto"
                  style={{ color: fuente === v ? 'var(--color-ink)' : 'var(--color-muted)', textDecoration: fuente === v ? 'underline' : 'none' }}>{t}</button>
              ))}
            </span>
          ) : null}
        </div>
        {modo === 'tarea' ? (
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <label className="sr-only" htmlFor="tarea-fecha">Fecha</label>
            <input id="tarea-fecha" name="fecha" type="date" defaultValue={manana()} className="border rounded-md p-2" required />
            <label className="sr-only" htmlFor="tarea-hora">Hora</label>
            <input id="tarea-hora" name="hora" type="time" className="border rounded-md p-2" aria-label="Hora (opcional)" />
            <input name="para" list="personal-equipo" aria-label="Para (opcional)" placeholder="Para: yo" className="border rounded-md p-2 w-36" />
            <input name="origen" list="documentos-expediente" aria-label="Origen (documento o notificación, opcional)" placeholder="Origen: documento o notificación" className="border rounded-md p-2 w-56" />
            <label className="flex gap-1 items-center"><input type="checkbox" name="plazo" value="1" /> Es un plazo (pendiente de verificar)</label>
          </div>
        ) : null}
        {modo === 'escrito' ? (
          <Redactor key={`${abrirEscrito ?? ''}-${inicialIA}`} solicitud={solicitudId} hilo={null} escrito={null} inicial={inicialIA} escritos={escritos} enExpediente
            inicialSobre={abrirEscrito} />
        ) : (
        <div className="caja-compositor">
          <label htmlFor="compositor-texto" className="sr-only">Escribe en el expediente</label>
          <textarea id="compositor-texto" ref={textoRef} name="texto" rows={3} maxLength={20000} onPaste={alPegar} onKeyDown={alTeclear}
            onInput={(e) => setSugerirIA(ia && modo === 'nota' && PIDE_ESCRITO.test(e.currentTarget.value))}
            placeholder={modo === 'cliente' ? 'Mensaje que verá el cliente…' : modo === 'tarea' ? 'Qué hay que hacer (p. ej., Preparar escrito de alegaciones)' : 'Escribe una nota, pega un texto o una captura, o arrastra documentos aquí…'} />
          <div className="fila">
            <span className="flex gap-2 items-center">
              <button type="button" className="btn btn-secundario" style={{ minHeight: 38 }} onClick={() => archivoRef.current?.click()}>📎 Adjuntar</button>
              <input ref={archivoRef} type="file" multiple accept={ACEPTA} className="sr-only" tabIndex={-1} aria-label="Adjuntar archivos al expediente"
                onChange={(e) => { Array.from(e.target.files ?? []).forEach((f) => subir(f)); e.target.value = ''; }} />
              <span className="ayuda text-xs hidden sm:inline">Ctrl+Intro para guardar · los archivos quedan privados hasta compartirlos</span>
            </span>
            {modo === 'cliente' && !confirmar ? (
              <button key="preparar" type="button" className="btn btn-primario" style={{ minHeight: 38 }} onClick={() => setConfirmar(true)}>Enviar al cliente…</button>
            ) : (
              <button key="enviar" className="btn btn-primario" style={{ minHeight: 38 }} disabled={pendiente}>
                {modo === 'cliente' ? 'Confirmar: lo verá el cliente' : modo === 'tarea' ? 'Crear tarea' : 'Guardar'}
              </button>
            )}
          </div>
        </div>
        )}
        {sugerirIA && modo === 'nota' ? (
          <p className="aviso text-sm flex flex-wrap gap-2 items-center" data-sugerir-ia>
            ¿Quieres que lo prepare el redactor con los modelos aprobados de la biblioteca?
            <button type="button" className="btn btn-secundario" style={{ minHeight: 32 }} onClick={() => {
              setInicialIA(textoRef.current?.value ?? ''); setSugerirIA(false); setModo('escrito');
            }}>✍️ Preparar escrito con IA</button>
            <span className="ayuda text-xs">o pulsa Guardar para dejarlo como nota.</span>
          </p>
        ) : null}
        {estado.error ? <p className="error text-sm" role="alert">{estado.error}</p> : null}
        {estado.ok ? <p className="exito text-sm" role="status">{estado.ok}</p> : null}
      </form>
    </div>
  );
}
