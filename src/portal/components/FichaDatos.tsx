'use client';
import { useActionState } from 'react';
import { guardarFicha, type ResultadoAlta } from '@/app/(portal)/admin/clientes/acciones';

type V = Record<'telefono' | 'nif' | 'empresa' | 'direccion' | 'codigo_postal' | 'localidad' | 'provincia', string | null>;
const CAMPOS: [keyof V, string][] = [['nif', 'NIF/CIF'], ['telefono', 'Teléfono'], ['empresa', 'Empresa'], ['direccion', 'Dirección'],
  ['codigo_postal', 'Código postal'], ['localidad', 'Localidad'], ['provincia', 'Provincia']];

export function FichaDatos({ cliente, v }: { cliente: string; v: V }) {
  const [estado, accion, pendiente] = useActionState<ResultadoAlta, FormData>(guardarFicha, {});
  return (
    <form action={accion} className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="cliente" value={cliente} />
      {CAMPOS.map(([k, t]) => (
        <label key={k} className="grid gap-1 text-sm"><span className="etiqueta">{t}</span>
          <input name={k} defaultValue={v[k] ?? ''} maxLength={200} className="border rounded-md p-2" /></label>
      ))}
      <div className="sm:col-span-2 flex gap-3 items-center">
        <button className="btn btn-secundario" disabled={pendiente}>Guardar datos</button>
        {estado.cliente && !estado.error ? <span className="exito text-sm" role="status">Datos guardados.</span> : null}
        {estado.error ? <span className="error text-sm" role="alert">{estado.error}</span> : null}
      </div>
    </form>
  );
}
