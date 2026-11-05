import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirAdmin } from '@/seguros/lib/auth/servidor';
import { obtenerTitular } from '@/seguros/lib/datos/titulares';
import { NoEncontrado } from '@/seguros/lib/errores';
import { Enviar, Formulario } from '@/seguros/components/formulario';
import { CamposTitular } from '../campos';
import { accionArchivarTitular, accionEditarTitular } from '../acciones';

export const metadata: Metadata = { title: 'Editar titular' };

export default async function EditarTitular({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirAdmin();
  const t = await obtenerTitular(u, id).catch((e) => { if (e instanceof NoEncontrado) notFound(); throw e; });
  return (
    <>
      <div className="migas"><Link href="/admin/seguros/titulares">Titulares</Link><span aria-hidden="true">/</span><span>{t.nombre}</span></div>
      <div className="encabezado"><h1>Editar titular</h1></div>
      <div className="tarjeta tarjeta--pad" style={{ maxWidth: 760 }}>
        <Formulario accion={accionEditarTitular.bind(null, id)} aria="Editar titular">
          <CamposTitular t={t} />
          <div className="pie-form">
            <Link className="boton" href="/admin/seguros/titulares">Cancelar</Link>
            <Enviar>Guardar cambios</Enviar>
          </div>
        </Formulario>
      </div>
      {!t.archivado_en && (
        <div className="tarjeta tarjeta--pad" style={{ maxWidth: 760, marginTop: 'var(--e-5)' }}>
          <h2>Archivar titular</h2>
          <p className="secundario pequeno" style={{ margin: 'var(--e-2) 0 var(--e-4)' }}>Desaparece de los selectores. Sus pólizas, documentos e histórico se conservan.</p>
          <form action={accionArchivarTitular.bind(null, id, true)}><button className="boton boton--peligro" type="submit">Archivar</button></form>
        </div>
      )}
    </>
  );
}
