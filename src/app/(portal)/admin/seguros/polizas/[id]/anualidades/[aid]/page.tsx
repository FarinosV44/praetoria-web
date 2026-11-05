import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { listarAnualidades, obtenerPoliza } from '@/seguros/lib/datos/polizas';
import { NoEncontrado } from '@/seguros/lib/errores';
import { fechaMedia } from '@/seguros/lib/fechas';
import { Enviar, Formulario } from '@/seguros/components/formulario';
import { CamposAnualidad } from '../../../campos';
import { accionAnularAnualidad, accionEditarAnualidad } from '../../../acciones';

export const metadata: Metadata = { title: 'Corregir anualidad' };

export default async function EditarAnualidad({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const { id, aid } = await params;
  const u = await exigirUsuario();
  const p = await obtenerPoliza(u, id).catch((e) => { if (e instanceof NoEncontrado) notFound(); throw e; });
  const anualidades = await listarAnualidades(u, id);
  const a = anualidades.find((x) => x.id === aid);
  if (!a) notFound();
  const periodo = a.inicio || a.fin ? `${fechaMedia(a.inicio) || '¿?'} – ${fechaMedia(a.fin) || '¿?'}` : 'fechas pendientes';
  return (
    <>
      <div className="migas"><Link href="/admin/seguros/">Pólizas</Link><span aria-hidden="true">/</span><Link href={`/admin/seguros/polizas/${id}`}>{p.nombre}</Link><span aria-hidden="true">/</span><span>Anualidad</span></div>
      <div className="encabezado">
        <div>
          <h1>Corregir anualidad</h1>
          <p className="secundario pequeno">{periodo}. Para una renovación, registra una anualidad nueva en lugar de modificar esta. Los cambios de fechas e importes quedan registrados.</p>
        </div>
      </div>
      <div className="tarjeta tarjeta--pad">
        <Formulario accion={accionEditarAnualidad.bind(null, aid)} aria="Corregir anualidad">
          <CamposAnualidad a={a} titulo="Datos de la anualidad" />
          <div className="pie-form">
            <Link className="boton" href={`/admin/seguros/polizas/${id}?pestana=anualidades`}>Cancelar</Link>
            <Enviar>Guardar cambios</Enviar>
          </div>
        </Formulario>
      </div>
      {anualidades.length > 1 && (
        <div className="tarjeta tarjeta--pad" style={{ marginTop: 'var(--e-5)' }}>
          <h2>Anular anualidad</h2>
          <p className="secundario pequeno" style={{ margin: 'var(--e-2) 0 var(--e-4)' }}>Solo si se registró por error. Deja de contar en el panel; queda en el registro interno.</p>
          <Formulario accion={accionAnularAnualidad.bind(null, aid)} className="" aria="Anular anualidad">
            <button className="boton boton--peligro" type="submit">Anular esta anualidad</button>
          </Formulario>
        </div>
      )}
    </>
  );
}
