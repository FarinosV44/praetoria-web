import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { listarTitulares } from '@/seguros/lib/datos/titulares';
import { obtenerPoliza } from '@/seguros/lib/datos/polizas';
import { Enviar, Formulario } from '@/seguros/components/formulario';
import { CamposSiniestro } from '../campos';
import { accionCrearSiniestro } from '../acciones';

export const metadata: Metadata = { title: 'Nuevo siniestro' };

export default async function NuevoSiniestro({ searchParams }: { searchParams: Promise<{ poliza?: string }> }) {
  const u = await exigirUsuario();
  const { poliza } = await searchParams;
  const p = poliza ? await obtenerPoliza(u, poliza).catch(() => null) : null;
  return (
    <>
      <div className="migas"><Link href="/admin/seguros/siniestros">Siniestros</Link><span aria-hidden="true">/</span><span>Nuevo</span></div>
      <div className="encabezado"><div><h1>Nuevo siniestro</h1>{p && <p className="secundario pequeno">Póliza: {p.nombre} · {p.titular_nombre}</p>}</div></div>
      <div className="tarjeta tarjeta--pad" style={{ maxWidth: 860 }}>
        <Formulario accion={accionCrearSiniestro} aria="Nuevo siniestro">
          {p && <input type="hidden" name="poliza" value={p.id} />}
          <CamposSiniestro titulares={await listarTitulares(u)} titularInicial={p?.titular_id} />
          <div className="pie-form">
            <Link className="boton" href="/admin/seguros/siniestros">Cancelar</Link>
            <Enviar>Crear expediente</Enviar>
          </div>
        </Formulario>
      </div>
    </>
  );
}
