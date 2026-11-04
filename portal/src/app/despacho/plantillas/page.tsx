import type { Metadata } from 'next';
import { comoUsuario } from '@/lib/db';
import { requerirPersonal } from '@/lib/sesion';
import { guardarItem, nuevoItem } from './acciones';

export const metadata: Metadata = { title: 'Plantillas documentales' };

export default async function Plantillas({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requerirPersonal();
  const q = await searchParams;
  const tipos = await comoUsuario(u.id, async (tx) => (await tx.query(`
    select t.id, t.nombre, p.id plantilla_id,
      coalesce((select json_agg(i order by i.orden) from portal.plantilla_items i where i.plantilla_id = p.id), '[]') items
    from portal.tipos_asunto t left join portal.plantillas p on p.tipo_asunto_id = t.id and p.activa order by t.orden`)).rows);
  return (
    <div className="grid gap-5">
      <h1 className="titulo">Plantillas documentales</h1>
      <p className="ayuda">Al enviar una solicitud, se crea su lista de documentos con la plantilla de su tipo. Después puedes adaptarla en cada solicitud. Los cambios aquí no alteran las listas ya creadas.</p>
      {q.ok ? <p className="exito" role="status">Plantilla guardada.</p> : null}
      {q.error ? <p className="error" role="alert">Escribe el documento y la explicación.</p> : null}
      {tipos.map((tp) => (
        <details key={tp.id} className="card">
          <summary className="subtitulo cursor-pointer">{tp.nombre} <span className="ayuda font-normal">({tp.items.filter((i: { activo: boolean }) => i.activo).length} documentos)</span></summary>
          <ul className="grid gap-3 mt-3">
            {tp.items.map((i: { id: string; titulo: string; explicacion: string; ejemplo: string | null; obligatorio: boolean; multiple: boolean; activo: boolean; orden: number }) => (
              <li key={i.id}>
                <form action={guardarItem} className="grid gap-2 p-3 rounded-md" style={{ background: i.activo ? 'var(--color-stone)' : '#f7f6f4' }}>
                  <input type="hidden" name="id" value={i.id} />
                  <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
                    <input name="titulo" defaultValue={i.titulo} maxLength={160} aria-label="Documento" className="border rounded-md p-2" />
                    <input name="orden" type="number" defaultValue={i.orden} aria-label="Orden" className="border rounded-md p-2" />
                  </div>
                  <textarea name="explicacion" defaultValue={i.explicacion} maxLength={600} rows={2} aria-label="Explicación para el cliente" className="border rounded-md p-2" />
                  <input name="ejemplo" defaultValue={i.ejemplo ?? ''} maxLength={300} placeholder="Ejemplo (opcional)" aria-label="Ejemplo" className="border rounded-md p-2" />
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex gap-2"><input type="checkbox" name="obligatorio" defaultChecked={i.obligatorio} /> Obligatorio</label>
                    <label className="flex gap-2"><input type="checkbox" name="multiple" defaultChecked={i.multiple} /> Varios archivos</label>
                    <label className="flex gap-2"><input type="checkbox" name="activo" defaultChecked={i.activo} /> Activo</label>
                    <button className="btn btn-secundario" style={{ minHeight: 34 }}>Guardar</button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
          {tp.plantilla_id ? (
            <form action={nuevoItem} className="grid gap-2 mt-4">
              <input type="hidden" name="plantilla" value={tp.plantilla_id} />
              <p className="etiqueta">Añadir documento a la plantilla</p>
              <input name="titulo" placeholder="Documento" maxLength={160} className="border rounded-md p-2" aria-label="Nuevo documento" />
              <textarea name="explicacion" placeholder="Por qué lo necesitamos" maxLength={600} rows={2} className="border rounded-md p-2" aria-label="Explicación" />
              <div className="flex gap-4 text-sm"><label className="flex gap-2"><input type="checkbox" name="obligatorio" defaultChecked /> Obligatorio</label><label className="flex gap-2"><input type="checkbox" name="multiple" /> Varios archivos</label></div>
              <button className="btn btn-secundario">Añadir</button>
            </form>
          ) : null}
        </details>
      ))}
    </div>
  );
}
