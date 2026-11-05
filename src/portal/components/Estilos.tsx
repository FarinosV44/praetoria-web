'use client';
import { useActionState } from 'react';
import { crearEstilo, guardarEstilo, type ResultadoEstilo } from '@/app/(portal)/admin/biblioteca/estilos/acciones';
import type { Estilo } from '@/portal/lib/render';

const D: [string, string][] = [['judicial', 'Escrito judicial'], ['administrativo', 'Administrativo / TEAR'], ['convenio', 'Convenio'], ['contrato', 'Contrato'],
  ['informe', 'Informe al cliente'], ['extrajudicial', 'Extrajudicial'], ['general', 'General']];

export function CrearEstilo() {
  const [r, accion, pendiente] = useActionState<ResultadoEstilo, FormData>(crearEstilo, {});
  return (
    <form action={accion} className="grid gap-2">
      <div className="flex flex-wrap gap-2"><input name="nombre" aria-label="Nombre del estilo" placeholder="Nombre (p. ej. «Judicial civil y familia»)" className="border rounded-md p-2 flex-1 min-w-[16rem]" />
        <button className="btn btn-primario" disabled={pendiente}>Crear estilo</button></div>
      <div className="flex flex-wrap gap-3 text-sm">{D.map(([v, t], i) => <label key={v} className="flex gap-1 items-center"><input type="radio" name="destino" value={v} defaultChecked={i === 0} /> {t}</label>)}</div>
      {r.error ? <p className="error text-sm" role="alert">{r.error}</p> : null}
    </form>
  );
}

export function EditarEstilo({ id, destino, materias, e }: { id: string; destino: string; materias: string[]; e: Estilo }) {
  const [r, accion, pendiente] = useActionState<ResultadoEstilo, FormData>(guardarEstilo, {});
  const num = (name: string, label: string, v: number, step = '0.5') => (
    <label className="grid gap-1 text-sm"><span>{label}</span><input name={name} type="number" step={step} defaultValue={v} className="border rounded-md p-2 w-28" /></label>);
  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="estilo" value={id} />
      <fieldset className="grid gap-1"><legend className="etiqueta">Destino</legend>
        <div className="flex flex-wrap gap-3 text-sm">{D.map(([v, t]) => <label key={v} className="flex gap-1 items-center"><input type="radio" name="destino" value={v} defaultChecked={destino === v} /> {t}</label>)}</div></fieldset>
      <fieldset className="grid gap-1"><legend className="etiqueta">Tipografía</legend>
        <div className="flex flex-wrap gap-3 text-sm items-end">{(['Times New Roman', 'Arial', 'Courier New'] as const).map((f) => (
          <label key={f} className="flex gap-1 items-center"><input type="radio" name="fuente" value={f} defaultChecked={e.fuente === f} /> {f}</label>))}
          {num('tamano', 'Tamaño (pt)', e.tamano)}{num('interlineado', 'Interlineado', e.interlineado, '0.05')}{num('sangria', 'Sangría 1.ª línea (mm)', e.sangria)}</div></fieldset>
      <fieldset className="grid gap-1"><legend className="etiqueta">Márgenes (mm)</legend>
        <div className="flex flex-wrap gap-3">{num('m_sup', 'Superior', e.margenes.sup)}{num('m_inf', 'Inferior', e.margenes.inf)}{num('m_izq', 'Izquierdo', e.margenes.izq)}{num('m_der', 'Derecho', e.margenes.der)}</div></fieldset>
      <fieldset className="grid gap-1 text-sm"><legend className="etiqueta">Texto y títulos</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex gap-1 items-center"><input type="radio" name="alineacion" value="justificada" defaultChecked={e.alineacion === 'justificada'} /> Justificado</label>
          <label className="flex gap-1 items-center"><input type="radio" name="alineacion" value="izquierda" defaultChecked={e.alineacion === 'izquierda'} /> A la izquierda</label>
          <label className="flex gap-1 items-center"><input type="checkbox" name="t_may" value="1" defaultChecked={e.titulos.mayusculas} /> Títulos en mayúsculas</label>
          <label className="flex gap-1 items-center"><input type="checkbox" name="t_neg" value="1" defaultChecked={e.titulos.negrita} /> en negrita</label>
          <label className="flex gap-1 items-center"><input type="checkbox" name="t_cen" value="1" defaultChecked={e.titulos.centrados} /> centrados</label>
          <label className="flex gap-1 items-center"><input type="radio" name="numeracion" value="ordinal" defaultChecked={e.numeracion === 'ordinal'} /> PRIMERO.-, SEGUNDO.-</label>
          <label className="flex gap-1 items-center"><input type="radio" name="numeracion" value="arabigo" defaultChecked={e.numeracion === 'arabigo'} /> 1.-, 2.-</label>
        </div></fieldset>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="grid gap-1"><span className="etiqueta">Encabezado</span><input name="encabezado" defaultValue={e.encabezado} maxLength={300} className="border rounded-md p-2" /></label>
        <label className="grid gap-1"><span className="etiqueta">Pie (usa {'{n}'} y {'{total}'})</span><input name="pie" defaultValue={e.pie} maxLength={200} className="border rounded-md p-2" /></label>
        <label className="grid gap-1 sm:col-span-2"><span className="etiqueta">Firma y datos profesionales (texto; nunca firma escaneada)</span><textarea name="firma" defaultValue={e.firma} rows={3} maxLength={600} className="border rounded-md p-2" /></label>
        <label className="grid gap-1 sm:col-span-2"><span className="etiqueta">Estilo preferido para las materias (ids separados por comas, p. ej. familia, civil)</span><input name="materias" defaultValue={materias.join(', ')} className="border rounded-md p-2" /></label>
      </div>
      <div><button className="btn btn-primario" disabled={pendiente}>Guardar (nueva versión)</button></div>
      {r.error ? <p className="error text-sm" role="alert">{r.error}</p> : r.ok ? <p className="exito text-sm" role="status">{r.ok}</p> : null}
    </form>
  );
}
