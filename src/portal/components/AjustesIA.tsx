'use client';
import { useActionState, useState } from 'react';
import { comprobarModelos, guardarAjustes, type ResultadoAjustes } from '@/app/(portal)/admin/ia/acciones';
import { MODELOS_SUGERIDOS, type Modo, type Proveedor } from '@/portal/lib/ia-modelos';

type Datos = {
  proveedor: Proveedor; modo: Modo; modelos: Record<Proveedor, Record<Modo, string>>; fallback_modelo: string | null; openai_autorizado: boolean; embeddings_biblioteca: boolean;
  embeddings_expedientes: boolean; ocr_activo: boolean; revision_doble: boolean; limite_diario_usd: string | null; limite_mensual_usd: string | null; limite_hora_usuario: number;
  estilo_instrucciones: string; tarifas: Record<string, { entrada: number; salida: number }>;
};
const MODOS: [Modo, string][] = [['rapido', 'Rápido'], ['equilibrado', 'Equilibrado'], ['maximo', 'Máxima calidad']];
const Casilla = ({ n, def, t, ayuda }: { n: string; def: boolean; t: string; ayuda: string }) => (
  <label className="flex gap-2 items-start"><input type="checkbox" name={n} value="1" defaultChecked={def} className="mt-1" /><span><strong>{t}</strong><br /><span className="ayuda text-sm">{ayuda}</span></span></label>
);

function Comprobar({ proveedor, usados }: { proveedor: Proveedor; usados: string[] }) {
  const [r, setR] = useState<Awaited<ReturnType<typeof comprobarModelos>> | null>(null);
  const [c, setC] = useState(false);
  return (
    <div className="text-sm" data-comprobar={proveedor}>
      <button type="button" className="btn-texto" disabled={c} onClick={async () => { setC(true); setR(await comprobarModelos(proveedor).catch(() => ({ ok: false as const, error: 'No se ha podido comprobar.' }))); setC(false); }}>{c ? 'Comprobando…' : 'Comprobar disponibilidad real'}</button>
      {r && !r.ok ? <p className="error mt-1" role="alert">{r.error}</p> : null}
      {r?.ok ? <ul className="mt-1">{[...new Set(usados)].map((m) => <li key={m}>{r.modelos.includes(m) ? '✅' : '❌'} {m}{r.modelos.includes(m) ? '' : ' · no disponible con esta clave'}</li>)}</ul> : null}
    </div>
  );
}

function Fila({ p, pre, d, claves }: { p: Proveedor; pre: 'a' | 'o'; d: Datos; claves: { anthropic: boolean; openai: boolean } }) {
  return (
    <fieldset className="border rounded p-3 grid gap-2">
      <legend className="font-semibold px-1">{p === 'anthropic' ? 'Anthropic (Claude)' : 'OpenAI'} <span className={`chip ${claves[p] ? 'chip-ok' : 'chip-aviso'}`} data-clave={p}>{claves[p] ? 'Clave configurada en el servidor' : 'Sin clave en el servidor'}</span></legend>
      {MODOS.map(([m, t]) => <label key={m} className="grid sm:grid-cols-[10rem_1fr] gap-1 items-center text-sm">{t}<input name={`${pre}_${m}`} defaultValue={d.modelos[p]?.[m] ?? ''} required list={`modelos-${p}`} className="border rounded p-2" /></label>)}
      <datalist id={`modelos-${p}`}>{MODELOS_SUGERIDOS[p].map((x) => <option key={x} value={x} />)}</datalist>
      <Comprobar proveedor={p} usados={Object.values(d.modelos[p] ?? {})} />
    </fieldset>
  );
}

export function AjustesIA({ d, claves }: { d: Datos; claves: { anthropic: boolean; openai: boolean } }) {
  const [r, accion, pendiente] = useActionState<ResultadoAjustes, FormData>(guardarAjustes, {});
  const tarifa = Object.entries(d.tarifas ?? {})[0];
  return (
    <form action={accion} className="grid gap-4" data-ajustes-ia>
      <section className="card grid gap-3">
        <h2 className="subtitulo">Proveedor y modelos</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex gap-2 items-center">Proveedor predeterminado<select name="proveedor" defaultValue={d.proveedor}><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option></select></label>
          <label className="flex gap-2 items-center">Calidad predeterminada<select name="modo" defaultValue={d.modo}>{MODOS.map(([m, t]) => <option key={m} value={m}>{t}</option>)}</select></label>
          <label className="flex gap-2 items-center">Modelo de respaldo<input name="fallback_modelo" defaultValue={d.fallback_modelo ?? ''} list="modelos-anthropic" className="border rounded p-1" /></label>
        </div>
        <p className="ayuda text-sm">El respaldo solo se usa si falla el proveedor, y la respuesta indica siempre qué modelo la generó. El modelo concreto se confirma con «Comprobar disponibilidad real».</p>
        <Fila p="anthropic" pre="a" d={d} claves={claves} /><Fila p="openai" pre="o" d={d} claves={claves} />
        <Casilla n="revision_doble" def={d.revision_doble} t="Revisión crítica en máxima calidad" ayuda="Tras el primer borrador, una segunda pasada revisa coherencia, hechos y citas con el texto oficial del BOE. Tarda y consume aproximadamente el doble." />
      </section>
      <section className="card grid gap-3">
        <h2 className="subtitulo">Tratamiento de datos</h2>
        <p className="aviso text-sm">Cada opción envía texto a un tercero. Actívalas tras revisar el contrato de encargo de tratamiento con el proveedor y las obligaciones de secreto profesional. Anthropic procesa sin garantía de residencia en la UE (solo admite global o EE. UU.).</p>
        <Casilla n="openai_autorizado" def={d.openai_autorizado} t="Autorizar OpenAI" ayuda="Permite elegir OpenAI como proveedor. Sin esto, no se le envía nada." />
        <Casilla n="ocr_activo" def={d.ocr_activo} t="OCR de documentos escaneados (Anthropic)" ayuda="Envía a Anthropic los PDF escaneados y las imágenes para leer su texto." />
        <Casilla n="embeddings_biblioteca" def={d.embeddings_biblioteca} t="Búsqueda semántica en la biblioteca (OpenAI)" ayuda="Envía a OpenAI los modelos aprobados y anonimizados, y el texto de las consultas." />
        <Casilla n="embeddings_expedientes" def={d.embeddings_expedientes} t="Búsqueda semántica en expedientes (OpenAI)" ayuda="Envía a OpenAI el texto de los documentos de los expedientes. Sin esto, se usa la búsqueda textual, que no sale del servidor." />
      </section>
      <section className="card grid gap-3">
        <h2 className="subtitulo">Límites de consumo</h2>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <label className="grid gap-1">Límite diario (USD)<input name="diario" inputMode="decimal" defaultValue={d.limite_diario_usd ?? ''} placeholder="Sin límite" className="border rounded p-2" /></label>
          <label className="grid gap-1">Límite mensual (USD)<input name="mensual" inputMode="decimal" defaultValue={d.limite_mensual_usd ?? ''} placeholder="Sin límite" className="border rounded p-2" /></label>
          <label className="grid gap-1">Consultas por persona y hora<input name="por_hora" type="number" min={1} max={1000} defaultValue={d.limite_hora_usuario} required className="border rounded p-2" /></label>
        </div>
        <details className="text-sm"><summary>Tarifa de un modelo sin precio conocido (p. ej. OpenAI)</summary>
          <p className="ayuda my-1">Los modelos sin tarifa no suman coste estimado y no cuentan para el límite de gasto.</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="grid gap-1">Modelo<input name="tarifa_modelo" defaultValue={tarifa?.[0] ?? ''} className="border rounded p-2" /></label>
            <label className="grid gap-1">USD por millón de tokens de entrada<input name="tarifa_entrada" inputMode="decimal" defaultValue={tarifa?.[1].entrada ?? ''} className="border rounded p-2" /></label>
            <label className="grid gap-1">USD por millón de tokens de salida<input name="tarifa_salida" inputMode="decimal" defaultValue={tarifa?.[1].salida ?? ''} className="border rounded p-2" /></label>
          </div>
        </details>
      </section>
      <section className="card grid gap-2">
        <h2 className="subtitulo">Estilo del despacho</h2>
        <label className="text-sm" htmlFor="estilo">Preferencias de redacción para todos los escritos</label>
        <textarea id="estilo" name="estilo" defaultValue={d.estilo_instrucciones} rows={5} maxLength={8000} className="border rounded p-2" placeholder="Ej.: fórmula de encabezamiento habitual, tratamiento, longitud de los fundamentos…" />
        <p className="ayuda text-xs">La maquetación de Word y PDF se gestiona en Biblioteca → Estilos.</p>
      </section>
      <p className="flex gap-3 items-center"><button className="btn btn-primario" disabled={pendiente}>{pendiente ? 'Guardando…' : 'Guardar ajustes'}</button>
        {r.ok ? <span className="chip chip-ok" role="status">{r.ok}</span> : null}{r.error ? <span className="error text-sm" role="alert">{r.error}</span> : null}</p>
    </form>
  );
}
