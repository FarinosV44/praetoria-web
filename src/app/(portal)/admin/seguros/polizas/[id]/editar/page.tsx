import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { listarTitulares } from '@/seguros/lib/datos/titulares';
import { listarRamos, obtenerPoliza } from '@/seguros/lib/datos/polizas';
import { NoEncontrado } from '@/seguros/lib/errores';
import { Enviar, Formulario } from '@/seguros/components/formulario';
import { CamposPoliza } from '../../campos';
import { accionArchivarPoliza, accionEditarPoliza } from '../../acciones';

export const metadata: Metadata = { title: 'Editar póliza' };

export default async function EditarPoliza({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  const p = await obtenerPoliza(u, id).catch((e) => { if (e instanceof NoEncontrado) notFound(); throw e; });
  const [titulares, ramos] = await Promise.all([listarTitulares(u), listarRamos()]);
  return (
    <>
      <div className="migas"><Link href="/admin/seguros/">Pólizas</Link><span aria-hidden="true">/</span><Link href={`/admin/seguros/polizas/${id}`}>{p.nombre}</Link><span aria-hidden="true">/</span><span>Editar</span></div>
      <div className="encabezado"><h1>Editar póliza</h1></div>
      <div className="tarjeta tarjeta--pad">
        <Formulario accion={accionEditarPoliza.bind(null, id)} aria="Editar póliza">
          <CamposPoliza titulares={titulares} ramos={ramos} p={p} conEstado />
          <p className="secundario pequeno">Los importes y las fechas se editan en cada anualidad, para conservar el histórico.</p>
          <div className="pie-form">
            <Link className="boton" href={`/admin/seguros/polizas/${id}`}>Cancelar</Link>
            <Enviar>Guardar cambios</Enviar>
          </div>
        </Formulario>
      </div>
      <div className="tarjeta tarjeta--pad" style={{ marginTop: 'var(--e-5)' }}>
        <h2>{p.archivada_en ? 'Póliza archivada' : 'Archivar póliza'}</h2>
        <p className="secundario pequeno" style={{ margin: 'var(--e-2) 0 var(--e-4)' }}>
          {p.archivada_en
            ? 'No aparece en el panel ni cuenta en los totales. Su histórico y documentos se conservan.'
            : 'Deja de aparecer en el panel y en los totales, pero se conservan su histórico y sus documentos. Puedes recuperarla cuando quieras.'}
        </p>
        <form action={accionArchivarPoliza.bind(null, id, !p.archivada_en)}>
          <button className={`boton ${p.archivada_en ? '' : 'boton--peligro'}`} type="submit">{p.archivada_en ? 'Recuperar póliza' : 'Archivar póliza'}</button>
        </form>
      </div>
    </>
  );
}
