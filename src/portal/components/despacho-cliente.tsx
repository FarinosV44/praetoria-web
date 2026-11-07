'use client';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useFormStatus } from 'react-dom';

const plegar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const UMBRAL_BUSQUEDA = 6;

/**
 * Selector de los filtros (mismo patrón que DeCA): combobox con lista flotante, flechas, Inicio/Fin, Intro, Escape
 * y buscador propio en listas largas. La lista va en un portal para que ningún contenedor la recorte. El valor viaja
 * en un input oculto, así que el formulario GET y el botón atrás funcionan como con un select nativo.
 */
export function Selector({ nombre, etiqueta, valor = '', opciones }: { nombre: string; etiqueta: string; valor?: string; opciones: [string, string][] }) {
  const uid = useId();
  const [v, setV] = useState(valor);
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const [activo, setActivo] = useState(0);
  const [pos, setPos] = useState<{ arriba: boolean; top: number; left: number; ancho: number; max: number } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const buscar = useRef<HTMLInputElement>(null);
  const conBusqueda = opciones.length > UMBRAL_BUSQUEDA;
  const lista = useMemo(() => { const c = plegar(q); return c ? opciones.filter(([, t]) => plegar(t).includes(c)) : opciones; }, [opciones, q]);
  const elegida = opciones.find(([k]) => k === v) ?? opciones[0];

  const colocar = () => {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const natural = Math.min(264, lista.length * 40 + 12) + (conBusqueda ? 46 : 0);
    const abajo = window.innerHeight - r.bottom - 14, encima = r.top - 14;
    const arriba = abajo < natural && encima > abajo;
    setPos({ arriba, top: arriba ? r.top - 6 : r.bottom + 6, left: Math.min(r.left, window.innerWidth - Math.max(r.width, 220) - 8), ancho: Math.max(r.width, 220), max: Math.max(120, Math.min(264, (arriba ? encima : abajo) - (conBusqueda ? 46 : 0))) });
  };
  useLayoutEffect(() => {
    if (!abierto) return;
    colocar();
    window.addEventListener('resize', colocar);
    window.addEventListener('scroll', colocar, true);
    return () => { window.removeEventListener('resize', colocar); window.removeEventListener('scroll', colocar, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, lista.length]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { const t = e.target as Node; if (!menu.current?.contains(t) && !boton.current?.contains(t)) cerrar(false); };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);
  const colocado = !!pos;
  useEffect(() => { if (abierto && colocado && conBusqueda) buscar.current?.focus({ preventScroll: true }); }, [abierto, colocado, conBusqueda]);
  useEffect(() => { if (abierto) document.getElementById(`${uid}-o-${activo}`)?.scrollIntoView({ block: 'nearest' }); }, [activo, abierto, uid]);

  function abrir() { setQ(''); setActivo(Math.max(0, opciones.findIndex(([k]) => k === v))); setAbierto(true); }
  function cerrar(devolverFoco: boolean) { setAbierto(false); setPos(null); setQ(''); if (devolverFoco) boton.current?.focus(); }
  function elegir(o?: [string, string]) { if (o) { setV(o[0]); cerrar(true); } }
  function tecla(e: KeyboardEvent) {
    if (!abierto) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir(); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => Math.min(lista.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActivo(0); }
    else if (e.key === 'End') { e.preventDefault(); setActivo(lista.length - 1); }
    else if (e.key === 'Enter' || (e.key === ' ' && !conBusqueda)) { e.preventDefault(); elegir(lista[activo]); }
    else if (e.key === 'Escape') { e.preventDefault(); cerrar(true); }
    else if (e.key === 'Tab') cerrar(false);
  }
  const idActivo = abierto && lista[activo] ? `${uid}-o-${activo}` : undefined;

  return (
    <div className="filtro">
      <span id={`${uid}-e`} className="filtro-etiqueta" onClick={() => boton.current?.focus()}>{etiqueta}</span>
      <input type="hidden" name={nombre} value={v} />
      <button ref={boton} id={`${uid}-b`} type="button" role="combobox" className="selector-boton" aria-haspopup="listbox" aria-expanded={abierto} aria-controls={abierto ? `${uid}-l` : undefined}
        aria-labelledby={`${uid}-e ${uid}-b`} aria-activedescendant={conBusqueda ? undefined : idActivo} onClick={() => (abierto ? cerrar(false) : abrir())} onKeyDown={tecla}>
        <span>{elegida?.[1]}</span>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20"><path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {abierto && pos ? createPortal(
        <div ref={menu} className="selector-menu" style={{ left: pos.left, width: pos.ancho, ...(pos.arriba ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}>
          {conBusqueda ? <input ref={buscar} type="text" role="searchbox" aria-label={`Buscar en ${etiqueta}`} aria-controls={`${uid}-l`} aria-activedescendant={idActivo} placeholder="Buscar…" value={q}
            onChange={(e) => { setQ(e.target.value); setActivo(0); }} onKeyDown={tecla} /> : null}
          <ul id={`${uid}-l`} role="listbox" aria-labelledby={`${uid}-e`} style={{ maxHeight: pos.max }}>
            {lista.length === 0 ? <li className="sin-resultados">Sin resultados</li> : null}
            {lista.map((o, i) => (
              <li key={o[0] || '_todos'} id={`${uid}-o-${i}`} role="option" aria-selected={o[0] === v} data-activo={i === activo ? '' : undefined} onPointerMove={() => setActivo(i)} onClick={() => elegir(o)}>
                <span>{o[1]}</span>
                {o[0] === v ? <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20"><path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
              </li>
            ))}
          </ul>
        </div>, document.body) : null}
    </div>
  );
}

/** Formulario GET que no ensucia la URL con parámetros vacíos. */
export function FormFiltros({ accion, etiqueta, children }: { accion: string; etiqueta: string; children: ReactNode }) {
  const [enviando, setEnviando] = useState(false);
  function enviar(e: FormEvent<HTMLFormElement>) {
    const vacios = [...e.currentTarget.elements].filter((x): x is HTMLInputElement => x instanceof HTMLInputElement && !!x.name && !x.value);
    vacios.forEach((x) => { x.disabled = true; });
    setEnviando(true);
    // Si la navegación no llega a producirse, el formulario no se queda bloqueado.
    setTimeout(() => { vacios.forEach((x) => { x.disabled = false; }); setEnviando(false); }, 4000);
  }
  return (
    <form action={accion} method="get" role="search" aria-label={etiqueta} className="filtros-tarjeta" onSubmit={enviar} data-enviando={enviando ? '' : undefined}>
      {children}
    </form>
  );
}

export function BotonFiltrar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-filtrar" aria-busy={pending}>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3 3" strokeLinecap="round" /></svg>
      Filtrar
    </button>
  );
}

type Resultados = {
  asuntos: { id: string; titulo: string; cliente: string; ref: string }[]; clientes: { id: string; name: string; email: string }[];
  documentos: { id: string; nombre_original: string; solicitud_id: string; cliente: string }[]; escritos: { id: string; titulo: string; solicitud_id: string }[];
  actuaciones: { id: string; solicitud_id: string; texto: string }[];
};

/** Buscador siempre visible de la cabecera, con resultados al escribir. Usa la misma búsqueda que la paleta, bajo RLS. */
export function BuscadorGlobal() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Resultados | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const caja = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const c = q.trim();
    if (c.length < 2) return;
    const control = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/buscar/?q=${encodeURIComponent(c)}`, { signal: control.signal });
        if (r.ok) { setRes(await r.json()); setAbierto(true); setActivo(-1); }
      } catch { /* una búsqueda cancelada o caída deja la caja como estaba; Intro abre la página de resultados */ }
    }, 220);
    return () => { clearTimeout(t); control.abort(); };
  }, [q]);
  useEffect(() => {
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  const filas = res && q.trim().length >= 2 ? [
    ...res.asuntos.map((a) => ({ k: `a${a.id}`, href: `/admin/expedientes/${a.id}/`, texto: `${a.cliente} · ${a.titulo}`, tipo: 'Expediente' })),
    ...res.clientes.map((c) => ({ k: `c${c.id}`, href: `/admin/clientes/${c.id}/`, texto: c.name, tipo: 'Cliente' })),
    ...res.documentos.map((d) => ({ k: `d${d.id}`, href: `/admin/expedientes/${d.solicitud_id}/?vista=documentos`, texto: d.nombre_original, tipo: 'Documento' })),
    ...res.escritos.map((w) => ({ k: `w${w.id}`, href: `/admin/expedientes/${w.solicitud_id}/escritos/${w.id}/`, texto: w.titulo, tipo: 'Escrito' })),
    ...res.actuaciones.map((n) => ({ k: `n${n.id}`, href: `/admin/expedientes/${n.solicitud_id}/`, texto: n.texto, tipo: 'Actuación' })),
  ].slice(0, 12) : [];

  function tecla(e: KeyboardEvent) {
    if (e.key === 'Escape') { setAbierto(false); return; }
    if (!abierto || !filas.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => Math.min(filas.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(-1, i - 1)); }
    if (e.key === 'Enter' && activo >= 0) { e.preventDefault(); window.location.assign(filas[activo]!.href); }
  }

  return (
    <form ref={caja} action="/admin/buscar/" role="search" className="buscador-global" aria-label="Buscar en el despacho">
      <input name="q" type="search" value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)} onFocus={() => { if (filas.length) setAbierto(true); }} onKeyDown={tecla}
        placeholder="Buscar expediente, cliente, NIF, documento…" aria-label="Buscar expediente, cliente, NIF o documento" />
      <kbd aria-hidden="true">Ctrl K</kbd>
      {abierto && res && q.trim().length >= 2 ? (
        <ul className="buscador-resultados">
          {filas.map((f, i) => <li key={f.k} data-activo={i === activo ? '' : undefined}><a href={f.href}><span className="truncate">{f.texto}</span><span className="tipo">{f.tipo}</span></a></li>)}
          {filas.length === 0 ? <li className="pie">Sin resultados para «{q.trim()}».</li> : <li className="pie">Intro para ver todos los resultados</li>}
        </ul>
      ) : null}
    </form>
  );
}

/**
 * Indicador de navegación entre pantallas. Es deliberadamente una barra y no un loading.tsx: este activa el streaming
 * y una ficha sin permiso respondería 200 en lugar de 404.
 */
export function BarraCarga() {
  const ruta = usePathname();
  const [activa, setActiva] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setActiva(false), [ruta]);
  useEffect(() => {
    const clic = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target || a.hasAttribute('download') || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      const u = new URL(a.href, location.href);
      if (u.origin === location.origin && u.pathname !== location.pathname && u.pathname.startsWith('/admin/')) setActiva(true);
    };
    document.addEventListener('click', clic);
    return () => document.removeEventListener('click', clic);
  }, []);
  useEffect(() => { if (!activa) return; const t = setTimeout(() => setActiva(false), 15000); return () => clearTimeout(t); }, [activa]);
  return activa ? <div className="barra-carga" aria-hidden="true" /> : null;
}
