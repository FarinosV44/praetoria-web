'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Item = { id: string; grupo: string; texto: string; detalle?: string; href?: string; externo?: boolean; accion?: () => void };
type Resultados = {
  asuntos: { id: string; titulo: string; cliente: string; ref: string }[]; clientes: { id: string; name: string; email: string }[];
  documentos: { id: string; nombre_original: string; solicitud_id: string; cliente: string }[]; escritos: { id: string; titulo: string; solicitud_id: string }[];
  actuaciones: { id: string; solicitud_id: string; texto: string }[];
};
const ATAJOS: Record<string, string> = { i: '/admin/', e: '/admin/expedientes/', c: '/admin/clientes/', a: '/admin/agenda/', b: '/admin/biblioteca/', n: '/admin/ia/nuevo/', p: '/admin/ia/' };

/** Paleta de comandos (Ctrl+K) y atajos «g + letra». La búsqueda pasa por el servidor, bajo RLS. */
export function PaletaComandos({ esGlobal, conBiblioteca, conIA }: { esGlobal: boolean; conBiblioteca: boolean; conIA: boolean }) {
  const router = useRouter();
  const ruta = usePathname();
  const [abierta, setAbierta] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Resultados | null>(null);
  const [activo, setActivo] = useState(0);
  const [cargando, setCargando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const previo = useRef<HTMLElement | null>(null);
  const asunto = ruta.match(/^\/admin\/expedientes\/([0-9a-f-]{36})/)?.[1] ?? null;

  const cerrar = useCallback(() => { setAbierta(false); setQ(''); setRes(null); setActivo(0); previo.current?.focus?.(); }, []);
  const abrir = useCallback(() => { previo.current = document.activeElement as HTMLElement; setAbierta(true); }, []);

  useEffect(() => {
    let g = false, t: ReturnType<typeof setTimeout> | undefined;
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (abierta) cerrar(); else abrir(); return; }
      const el = e.target as HTMLElement;
      if (abierta || el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (g) { g = false; const d = ATAJOS[e.key.toLowerCase()]; if (d) { e.preventDefault(); router.push(d); } return; }
      if (e.key === 'g') { g = true; clearTimeout(t); t = setTimeout(() => { g = false; }, 900); }
      else if (e.key === '/') { e.preventDefault(); abrir(); }
    };
    const pedir = () => abrir();
    window.addEventListener('keydown', tecla);
    window.addEventListener('abrir-paleta', pedir);
    return () => { window.removeEventListener('keydown', tecla); window.removeEventListener('abrir-paleta', pedir); clearTimeout(t); };
  }, [abierta, abrir, cerrar, router]);

  useEffect(() => { if (abierta) entrada.current?.focus(); }, [abierta]);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) return;
    const corte = new AbortController();
    const espera = setTimeout(() => {
      fetch(`/api/admin/buscar/?q=${encodeURIComponent(t)}`, { signal: corte.signal, cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
        .then((j: Resultados | null) => { setRes(j); setActivo(0); setCargando(false); }).catch(() => {});
    }, 180);
    return () => { clearTimeout(espera); corte.abort(); };
  }, [q]);

  const items = useMemo<Item[]>(() => {
    const contexto: Item[] = asunto ? [
      ...(conIA ? [{ id: 'c-ia', grupo: 'En este expediente', texto: 'Preguntar a la IA sobre este expediente', accion: () => window.dispatchEvent(new Event('abrir-panel-ia')) },
        { id: 'c-red', grupo: 'En este expediente', texto: 'Redactar un escrito', href: `/admin/expedientes/${asunto}/asistente/?modo=redactar` }] : []),
      { id: 'c-doc', grupo: 'En este expediente', texto: 'Ver documentación', href: `/admin/expedientes/${asunto}/?vista=documentos` },
      { id: 'c-pla', grupo: 'En este expediente', texto: 'Ver plazos y tareas', href: `/admin/expedientes/${asunto}/?vista=plazos` },
    ] : [];
    const ir = (id: string, texto: string, href: string, detalle?: string): Item => ({ id, grupo: 'Ir a', texto, href, detalle });
    const nav: Item[] = [
      ir('n-i', 'Inicio', '/admin/', 'g i'), ir('n-e', 'Expedientes', '/admin/expedientes/', 'g e'), ir('n-c', 'Clientes', '/admin/clientes/', 'g c'), ir('n-a', 'Agenda', '/admin/agenda/', 'g a'),
      ...(conBiblioteca ? [ir('n-b', 'Biblioteca jurídica', '/admin/biblioteca/', 'g b')] : []),
      ...(conIA ? [ir('n-p', 'Copiloto jurídico', '/admin/ia/', 'g p'), ir('n-n', 'Nuevo escrito', '/admin/ia/nuevo/', 'g n')] : []),
      ...(esGlobal ? [ir('n-j', 'Ajustes de IA', '/admin/ia/ajustes/')] : []),
      { id: 'n-nc', grupo: 'Acciones', texto: 'Nuevo cliente', href: '/admin/clientes/nuevo/' },
    ];
    const t = q.trim().toLowerCase();
    const base = [...contexto, ...nav].filter((i) => !t || i.texto.toLowerCase().includes(t));
    if (!res || t.length < 2) return base;
    return [
      ...res.asuntos.map((a) => ({ id: `a-${a.id}`, grupo: 'Expedientes', texto: `${a.cliente} · ${a.titulo}`, detalle: a.ref, href: `/admin/expedientes/${a.id}/` })),
      ...res.clientes.map((c) => ({ id: `u-${c.id}`, grupo: 'Clientes', texto: c.name, detalle: c.email, href: `/admin/clientes/${c.id}/` })),
      ...res.documentos.map((d) => ({ id: `d-${d.id}`, grupo: 'Documentos', texto: d.nombre_original, detalle: d.cliente, href: `/admin/expedientes/${d.solicitud_id}/?vista=documentos` })),
      ...res.escritos.map((e) => ({ id: `e-${e.id}`, grupo: 'Escritos', texto: e.titulo, href: `/admin/expedientes/${e.solicitud_id}/escritos/${e.id}/` })),
      ...res.actuaciones.map((n) => ({ id: `n-${n.id}`, grupo: 'Actuaciones', texto: n.texto, href: `/admin/expedientes/${n.solicitud_id}/` })),
      ...base,
    ];
  }, [asunto, conIA, conBiblioteca, esGlobal, q, res]);

  const ejecutar = (i: Item | undefined) => {
    if (!i) return;
    cerrar();
    if (i.accion) i.accion(); else if (i.href) router.push(i.href);
  };
  if (!abierta) return null;
  let grupo = '';
  return (
    <div className="paleta-fondo" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className="paleta" role="dialog" aria-modal="true" aria-label="Buscar y navegar">
        <input ref={entrada} value={q} onChange={(e) => { setQ(e.target.value); setCargando(e.target.value.trim().length >= 2); setActivo(0); }} placeholder="Busca clientes, expedientes, documentos, escritos… o una acción"
          role="combobox" aria-expanded="true" aria-controls="paleta-lista" aria-activedescendant={items[activo] ? `pal-${items[activo]!.id}` : undefined} aria-label="Buscar"
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((a) => Math.min(a + 1, items.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); ejecutar(items[activo]); }
          }} />
        <ul id="paleta-lista" role="listbox" aria-label="Resultados">
          {items.map((i, n) => {
            const cab = i.grupo !== grupo ? i.grupo : null;
            grupo = i.grupo;
            return (
              <li key={i.id} id={`pal-${i.id}`} role="option" aria-selected={n === activo} data-activo={n === activo || undefined}
                onMouseEnter={() => setActivo(n)} onClick={() => ejecutar(i)}>
                {cab ? <span className="paleta-grupo">{cab}</span> : null}
                <span className="paleta-fila"><span className="truncate">{i.texto}</span>{i.detalle ? <span className="ayuda text-xs shrink-0">{i.detalle}</span> : null}</span>
              </li>
            );
          })}
          {!items.length ? <li className="ayuda text-sm p-3">{cargando ? 'Buscando…' : 'Sin resultados.'}</li> : null}
        </ul>
        <p className="paleta-pie"><span><kbd>↑</kbd> <kbd>↓</kbd> moverse</span><span><kbd>Intro</kbd> abrir</span><span><kbd>Esc</kbd> cerrar</span>{cargando ? <span>Buscando…</span> : null}</p>
      </div>
    </div>
  );
}
