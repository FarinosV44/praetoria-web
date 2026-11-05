import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { obtenerSiniestro } from '@/seguros/lib/datos/siniestros';
import { NoEncontrado } from '@/seguros/lib/errores';
import { Enviar, Formulario } from '@/seguros/components/formulario';
import { CamposSiniestro } from '../../campos';
import { accionEditarSiniestro } from '../../acciones';

export const metadata: Metadata = { title: 'Editar siniestro' };

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  const s = await obtenerSiniestro(u, id).catch((e) => { if (e instanceof NoEncontrado) notFound(); throw e; });
  return (
    <>
      <div className="migas"><Link href="/admin/seguros/siniestros">Siniestros</Link><span aria-hidden="true">/</span><Link href={`/admin/seguros/siniestros/${id}`}>{s.titulo}</Link><span aria-hidden="true">/</span><span>Editar</span></div>
      <div className="encabezado"><div><h1>Editar hechos</h1><p className="secundario pequeno">Los análisis anteriores se conservan; vuelve a analizar para tener en cuenta los cambios.</p></div></div>
      <div className="tarjeta tarjeta--pad" style={{ maxWidth: 860 }}>
        <Formulario accion={accionEditarSiniestro.bind(null, id)} aria="Editar siniestro">
          <CamposSiniestro s={s} />
          <div className="pie-form"><Link className="boton" href={`/admin/seguros/siniestros/${id}`}>Cancelar</Link><Enviar>Guardar</Enviar></div>
        </Formulario>
      </div>
    </>
  );
}
