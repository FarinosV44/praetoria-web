import { AVISOS_FIJOS, TIPOS, TIPO_ETIQUETA } from '@/portal/lib/agenda';

export type EventoForm = {
  id?: string; titulo?: string; tipo?: string; fecha?: string; hora?: string; todo_el_dia?: boolean; duracion_min?: number;
  repeticion?: string; repetir_hasta?: string | null; prioridad?: string; nota?: string | null; solicitud_id?: string | null;
  avisos_min?: number[]; plazo_fuente?: string | null; plazo_verificado?: boolean;
};

// Formulario de evento (servidor): sirve para crear y para editar. Funciona sin JavaScript.
export function FormEvento({ e, accion, asuntos, boton }: {
  e: EventoForm; accion: (f: FormData) => Promise<void>; asuntos: { id: string; texto: string }[]; boton: string;
}) {
  const fijos = new Set(AVISOS_FIJOS.map(([v]) => v));
  const extra = (e.avisos_min ?? []).find((m) => !fijos.has(m));
  const campo = 'control w-full';
  return (
    <form action={accion} className="grid gap-3">
      {e.id ? <input type="hidden" name="id" value={e.id} /> : null}
      <div className="campo" style={{ marginBottom: 0 }}><label htmlFor="ev-t">Qué</label>
        <input id="ev-t" name="titulo" required maxLength={200} defaultValue={e.titulo} placeholder="Vista judicial, Llamar al cliente…" /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="campo" style={{ marginBottom: 0 }}><label htmlFor="ev-tipo">Tipo</label>
          <select id="ev-tipo" name="tipo" defaultValue={e.tipo ?? 'tarea'}>{TIPOS.map((t) => <option key={t} value={t}>{TIPO_ETIQUETA[t]}</option>)}</select></div>
        <div className="campo" style={{ marginBottom: 0 }}><label htmlFor="ev-f">Fecha</label>
          <input id="ev-f" name="fecha" type="date" required defaultValue={e.fecha} /></div>
        <div className="campo" style={{ marginBottom: 0 }}><label htmlFor="ev-h">Hora (Madrid)</label>
          <input id="ev-h" name="hora" type="time" defaultValue={e.todo_el_dia ? '' : e.hora} /></div>
      </div>
      <label className="flex gap-2 items-center text-sm"><input type="checkbox" name="todo_el_dia" defaultChecked={e.todo_el_dia} /> Todo el día (los avisos cuentan desde las 9:00)</label>
      <fieldset className="grid gap-2">
        <legend className="etiqueta mb-1">Avisarme</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {AVISOS_FIJOS.map(([v, t]) => (
            <label key={v} className="flex gap-2 items-center text-sm"><input type="checkbox" name="avisos" value={v} defaultChecked={(e.avisos_min ?? (e.id ? [] : [60])).includes(v)} /> {t}</label>
          ))}
        </div>
        <div className="flex gap-2 items-center text-sm">
          <span>Otro aviso:</span>
          <input name="aviso_extra" type="number" min={1} max={999} defaultValue={extra ? (extra % 1440 === 0 ? extra / 1440 : extra % 60 === 0 ? extra / 60 : extra) : ''} className="control w-20" aria-label="Cantidad" />
          <select name="aviso_extra_unidad" defaultValue={extra ? (extra % 1440 === 0 ? 'd' : extra % 60 === 0 ? 'h' : 'min') : 'h'} className="control" aria-label="Unidad">
            <option value="min">minutos antes</option><option value="h">horas antes</option><option value="d">días antes</option>
          </select>
        </div>
      </fieldset>
      <details>
        <summary className="text-sm font-semibold cursor-pointer">Más opciones</summary>
        <div className="grid gap-3 mt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="campo" style={{ marginBottom: 0 }}><label htmlFor="ev-rep">Repetir</label>
              <select id="ev-rep" name="repeticion" defaultValue={e.repeticion ?? 'ninguna'}>
                <option value="ninguna">No se repite</option><option value="diaria">Cada día</option><option value="semanal">Cada semana</option><option value="mensual">Cada mes</option>
              </select></div>
            <div className="campo" style={{ marginBottom: 0 }}><label htmlFor="ev-hasta">Hasta</label>
              <input id="ev-hasta" name="repetir_hasta" type="date" defaultValue={e.repetir_hasta ?? ''} /></div>
            <div className="campo" style={{ marginBottom: 0 }}><label htmlFor="ev-dur">Duración (min)</label>
              <input id="ev-dur" name="duracion" type="number" min={0} max={1440} defaultValue={e.duracion_min ?? 60} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="campo" style={{ marginBottom: 0 }}><label htmlFor="ev-asunto">Expediente o solicitud</label>
              <select id="ev-asunto" name="solicitud" defaultValue={e.solicitud_id ?? ''}>
                <option value="">Ninguno (evento personal o del despacho)</option>
                {asuntos.map((a) => <option key={a.id} value={a.id}>{a.texto}</option>)}
              </select></div>
            <div className="campo" style={{ marginBottom: 0 }}><label htmlFor="ev-pri">Prioridad</label>
              <select id="ev-pri" name="prioridad" defaultValue={e.prioridad ?? 'normal'}><option value="normal">Normal</option><option value="alta">Alta</option></select></div>
          </div>
          <div className="campo" style={{ marginBottom: 0 }}><label htmlFor="ev-nota">Nota interna</label>
            <textarea id="ev-nota" name="nota" rows={2} maxLength={2000} defaultValue={e.nota ?? ''} /></div>
          <fieldset className="grid gap-2 p-3 rounded-md" style={{ background: 'var(--color-stone)' }}>
            <legend className="etiqueta">Solo para plazos</legend>
            <p className="ayuda text-sm">El sistema no calcula plazos procesales. Indica de dónde sale la fecha y márcala como verificada cuando la hayas comprobado.</p>
            <input name="plazo_fuente" maxLength={300} defaultValue={e.plazo_fuente ?? ''} placeholder="Ej.: notificación LexNET del 3/11, 20 días hábiles" className={campo} aria-label="Fuente del plazo" />
            <label className="flex gap-2 items-center text-sm"><input type="checkbox" name="verificado" defaultChecked={e.plazo_verificado} /> He verificado esta fecha</label>
          </fieldset>
        </div>
      </details>
      <button className="btn btn-primario">{boton}</button>
    </form>
  );
}
