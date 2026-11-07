import Link from 'next/link';
import type { ReactNode } from 'react';
import { BotonFiltrar, FormFiltros, Selector } from './despacho-cliente';
import { Migas } from './NavDespacho';

/**
 * Piezas comunes del panel del despacho (normas en docs/portal/SISTEMA-VISUAL.md). Toda lista filtrable se lee igual:
 * cabecera · vistas rápidas · tarjeta de filtros · filtros activos · resultados · tabla · paginación.
 * El estado vive en la URL: atrás, recargar y compartir el enlace devuelven la misma lista.
 */

export function Cabecera({ titulo, entradilla, acciones, migas, seccion = 'Despacho' }: {
  titulo: ReactNode; entradilla?: ReactNode; acciones?: ReactNode; migas?: { texto: string; href?: string }[]; seccion?: string;
}) {
  return (
    <div>
      {migas ? <Migas items={migas} /> : null}
      <header className="pag-cabecera">
        <div className="min-w-0">
          {migas ? null : <p className="pag-kicker" aria-hidden="true">{seccion}</p>}
          <h1 className="titulo">{titulo}</h1>
          {entradilla ? <p className="pag-entradilla">{entradilla}</p> : null}
        </div>
        {acciones ? <div className="pag-acciones">{acciones}</div> : null}
      </header>
    </div>
  );
}

/** Indicador: todos miden y se dibujan igual. El tono añade un filete; el significado siempre va en el texto. */
export function Kpi({ etiqueta, valor, nota, href, tono }: { etiqueta: string; valor: ReactNode; nota?: string; href?: string; tono?: 'alerta' | 'aviso' }) {
  const dentro = <>
    <span className="kpi-etiqueta">{etiqueta}</span>
    <span className="kpi-valor">{valor}</span>
    {nota ? <span className="kpi-nota">{nota}</span> : null}
  </>;
  return href
    ? <Link href={href} className="kpi" data-tono={tono}>{dentro}</Link>
    : <div className="kpi" data-tono={tono}>{dentro}</div>;
}

export function RejillaKpi({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <section className="rejilla-kpi" aria-label={etiqueta}>{children}</section>;
}

/** Panel de trabajo de altura fija: una rejilla de paneles queda alineada aunque unos tengan más filas que otros. */
export function Panel({ id, titulo, n, vacio, pie, children }: { id: string; titulo: string; n?: number; vacio?: ReactNode; pie?: ReactNode; children?: ReactNode }) {
  const hayContenido = n === undefined ? !!children : n > 0;
  return (
    <section className="panel" aria-labelledby={`panel-${id}`} data-bloque={id}>
      <div className="panel-cab"><h3 id={`panel-${id}`}>{titulo}</h3>{n ? <span className="panel-n" aria-label={`${n} elementos`}>{n}</span> : null}</div>
      <div className="panel-cuerpo" tabIndex={hayContenido ? 0 : undefined} role={hayContenido ? 'group' : undefined} aria-labelledby={hayContenido ? `panel-${id}` : undefined}>
        {hayContenido ? <ul className="lista-filas">{children}</ul> : <p className="panel-vacio">{vacio}</p>}
      </div>
      {pie ? <div className="panel-pie">{pie}</div> : null}
    </section>
  );
}

export function Vistas({ etiqueta, visible, items }: { etiqueta: string; visible?: string; items: { texto: string; href: string; activo?: boolean; n?: number }[] }) {
  return (
    <nav className="vistas" aria-label={etiqueta}>
      {visible ? <span className="vistas-etiqueta">{visible}</span> : null}
      {items.map((i) => (
        <Link key={i.href + i.texto} href={i.href} scroll={false} className="vista" aria-current={i.activo ? 'page' : undefined}>
          {i.texto}{i.n !== undefined ? <span className="n">{i.n}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function FiltroTexto({ nombre, etiqueta, valor, tipo = 'search', ayuda, ancho }: { nombre: string; etiqueta: string; valor?: string; tipo?: 'search' | 'date' | 'text'; ayuda?: string; ancho?: boolean }) {
  return (
    <label className={`filtro${ancho ? ' ancho-doble' : ''}`}>
      <span className="filtro-etiqueta">{etiqueta}</span>
      <input type={tipo} name={nombre} defaultValue={valor ?? ''} placeholder={ayuda} maxLength={tipo === 'date' ? undefined : 200} />
    </label>
  );
}

export function FiltroSelector({ nombre, etiqueta, valor, opciones }: { nombre: string; etiqueta: string; valor?: string; opciones: [string, string][] }) {
  return <Selector nombre={nombre} etiqueta={etiqueta} valor={valor ?? ''} opciones={opciones} />;
}

/** Tarjeta de filtros de DeCA: campos a la vista, «Filtros avanzados» plegado, limpiar, filtrar y filtros activos quitables. */
export function Filtros({ accion, etiqueta, columnas = 4, ocultos, basicos, avanzados, nAvanzados = 0, activos = [], limpiar }: {
  accion: string; etiqueta: string; columnas?: number; ocultos?: Record<string, string | undefined>; basicos: ReactNode; avanzados?: ReactNode; nAvanzados?: number;
  activos?: { texto: string; href: string }[]; limpiar?: string;
}) {
  return (
    <div className="grid gap-3">
      {/* La clave vuelve a montar el formulario cuando la URL cambia sus valores por defecto */}
      <FormFiltros key={JSON.stringify(activos.map((a) => a.texto))} accion={accion} etiqueta={etiqueta}>
        <div className="filtros-rejilla" style={{ '--col': columnas } as React.CSSProperties}>{basicos}</div>
        {avanzados ? (
          <details className="filtros-mas" open={nAvanzados > 0}>
            <summary>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4.5h7M12.5 4.5H14M2 11.5h1.5M7 11.5h7" /><circle cx="10.8" cy="4.5" r="1.7" /><circle cx="5.2" cy="11.5" r="1.7" /></svg>
              Filtros avanzados{nAvanzados ? ` (${nAvanzados})` : ''}
              <svg className="flecha" aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6l5 5 5-5" /></svg>
            </summary>
            <div className="filtros-rejilla" style={{ '--col': columnas } as React.CSSProperties}>{avanzados}</div>
          </details>
        ) : null}
        {ocultos ? Object.entries(ocultos).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null)) : null}
        <div className="filtros-pie">
          <span>{limpiar && activos.length ? <Link href={limpiar} className="filtros-limpiar">Limpiar filtros</Link> : null}</span>
          <BotonFiltrar />
        </div>
      </FormFiltros>
      {activos.length ? (
        <ul className="filtros-activos" aria-label="Filtros activos">
          {activos.map((a) => <li key={a.texto}><Link href={a.href} className="filtro-chip" aria-label={`Quitar filtro: ${a.texto}`}>{a.texto}<span aria-hidden="true">×</span></Link></li>)}
        </ul>
      ) : null}
    </div>
  );
}

export function Resultados({ total, pagina = 1, paginas = 1, nombre, children }: { total: number; pagina?: number; paginas?: number; nombre: [string, string]; children?: ReactNode }) {
  return (
    <div className="barra-resultados">
      <p role="status"><strong>{total.toLocaleString('es-ES')}</strong> {total === 1 ? nombre[0] : nombre[1]}{paginas > 1 ? <span className="ayuda"> · página {pagina} de {paginas}</span> : null}</p>
      {children}
    </div>
  );
}

export function Paginacion({ pagina, paginas, href }: { pagina: number; paginas: number; href: (p: number) => string }) {
  if (paginas <= 1) return null;
  return (
    <nav className="paginacion" aria-label="Paginación">
      {pagina > 1 ? <Link href={href(pagina - 1)}>← Anterior</Link> : <span aria-disabled="true">← Anterior</span>}
      <span className="ayuda">Página {pagina} de {paginas}</span>
      {pagina < paginas ? <Link href={href(pagina + 1)}>Siguiente →</Link> : <span aria-disabled="true">Siguiente →</span>}
    </nav>
  );
}

export function Vacio({ titulo, children, accion }: { titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return <div className="vacio-bloque"><strong>{titulo}</strong>{children}{accion ? <div>{accion}</div> : null}</div>;
}

/** Valor textual de un filtro a partir de sus opciones, para los chips de filtros activos. */
export const textoOpcion = (opciones: [string, string][], v?: string) => opciones.find(([k]) => k === v)?.[1] ?? v ?? '';

/** Construye un enlace conservando los parámetros actuales y aplicando cambios; los vacíos se omiten. */
export function enlaceCon(base: string, actuales: Record<string, string | undefined>, cambios: Record<string, string | undefined> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...actuales, ...cambios })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}
