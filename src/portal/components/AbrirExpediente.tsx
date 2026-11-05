'use client';
import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { abrirExpediente, type ResultadoAbrir } from '@/app/(portal)/admin/clientes/acciones';

type Cliente = { id: string; nombre: string; email: string; empresa: string | null };
type Opcion = { id: string; nombre: string };

/** Abrir un expediente para un cliente ya existente: cliente (fijo o buscado), título, tipo de asunto y responsable. */
export function AbrirExpediente({ clientes, cliente, tipos, equipo, yo }: { clientes?: Cliente[]; cliente?: string; tipos: Opcion[]; equipo: Opcion[]; yo: string }) {
  const [r, accion, pendiente] = useActionState<ResultadoAbrir, FormData>(abrirExpediente, {});
  const [filtro, setFiltro] = useState('');
  const [elegido, setElegido] = useState(cliente ?? '');
  const lista = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return (clientes ?? []).filter((c) => !f || `${c.nombre} ${c.email} ${c.empresa ?? ''}`.toLowerCase().includes(f)).slice(0, 50);
  }, [clientes, filtro]);
  return (
    <form action={accion} className="grid gap-3" data-abrir-expediente>
      {clientes ? (
        <fieldset className="grid gap-2">
          <legend className="etiqueta">Cliente</legend>
          <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Busca por nombre, correo o empresa" aria-label="Buscar cliente" className="border rounded-md p-2" />
          <ul className="grid gap-1 max-h-64 overflow-auto border rounded-md p-2" role="radiogroup" aria-label="Clientes">
            {lista.length === 0 ? <li className="ayuda text-sm">No hay clientes que coincidan. <Link href="/admin/clientes/nuevo/">Dar de alta uno nuevo</Link></li> : null}
            {lista.map((c) => (
              <li key={c.id}>
                <label className="flex gap-2 items-center text-sm">
                  <input type="radio" name="cliente" value={c.id} checked={elegido === c.id} onChange={() => setElegido(c.id)} />
                  <span><strong>{c.nombre}</strong>{c.empresa ? ` · ${c.empresa}` : ''} <span className="ayuda">{c.email}</span></span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : <input type="hidden" name="cliente" value={cliente} />}
      <label className="grid gap-1">Título del asunto
        <input name="titulo" required minLength={3} maxLength={200} placeholder="Ej.: Reclamación de cantidad frente a…" className="border rounded-md p-2" />
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1 text-sm">Tipo de asunto (opcional)
          <select name="tipo" defaultValue="" className="border rounded-md p-2">
            <option value="">Sin tipo</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Responsable
          <select name="responsable" defaultValue={yo} className="border rounded-md p-2">
            {equipo.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.id === yo ? ' (yo)' : ''}</option>)}
          </select>
        </label>
      </div>
      <p className="flex gap-3 items-center">
        <button className="btn btn-primario" disabled={pendiente || (!!clientes && !elegido)}>{pendiente ? 'Abriendo…' : 'Abrir expediente'}</button>
        <span className="ayuda text-xs">El expediente es interno; el cliente solo verá lo que compartas con él.</span>
      </p>
      {r.error ? <p className="error text-sm" role="alert">{r.error}</p> : null}
    </form>
  );
}
