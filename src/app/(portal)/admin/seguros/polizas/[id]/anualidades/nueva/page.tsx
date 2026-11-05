import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { listarAnualidades, obtenerPoliza } from '@/seguros/lib/datos/polizas';
import { NoEncontrado } from '@/seguros/lib/errores';
import { sumarAnios } from '@/seguros/lib/fechas';
import { Enviar, Formulario } from '@/seguros/components/formulario';
import { CamposAnualidad } from '../../../campos';
import { accionCrearAnualidad } from '../../../acciones';

export const metadata: Metadata = { title: 'Registrar renovación' };

export default async function NuevaAnualidad({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  const p = await obtenerPoliza(u, id).catch((e) => { if (e instanceof NoEncontrado) notFound(); throw e; });
  const [ultima] = await listarAnualidades(u, id);
  // Propuesta: empieza donde terminó la anterior y dura un año. Los importes no se copian: hay que confirmarlos.
  const propuesta = ultima?.fin ? { inicio: ultima.fin, fin: sumarAnios(ultima.fin, 1), periodicidad: ultima.periodicidad } : {};
  return (
    <>
      <div className="migas"><Link href="/admin/seguros/">Pólizas</Link><span aria-hidden="true">/</span><Link href={`/admin/seguros/polizas/${id}`}>{p.nombre}</Link><span aria-hidden="true">/</span><span>Renovación</span></div>
      <div className="encabezado">
        <div>
          <h1>Registrar renovación</h1>
          <p className="secundario pequeno">Se crea una anualidad nueva. La anterior y sus documentos se conservan sin cambios.</p>
        </div>
      </div>
      <div className="tarjeta tarjeta--pad">
        <Formulario accion={accionCrearAnualidad.bind(null, id)} aria="Registrar renovación">
          <CamposAnualidad a={propuesta} titulo="Nueva anualidad" />
          <div className="pie-form">
            <Link className="boton" href={`/admin/seguros/polizas/${id}?pestana=anualidades`}>Cancelar</Link>
            <Enviar>Guardar anualidad</Enviar>
          </div>
        </Formulario>
      </div>
    </>
  );
}
