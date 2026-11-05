import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { ESTADOS_SINIESTRO, listarSiniestros } from '@/seguros/lib/datos/siniestros';
import { fechaMedia } from '@/seguros/lib/fechas';
import { IconoMas } from '@/seguros/components/iconos';

export const metadata: Metadata = { title: 'Siniestros' };

const claseEstado = (e: string) => (e === 'aceptado' || e === 'cerrado' ? 'vigente' : e === 'rechazado' ? 'vencida' : e === 'borrador' ? 'neutro' : 'proxima');

export default async function Siniestros() {
  const u = await exigirUsuario();
  const lista = await listarSiniestros(u);
  return (
    <>
      <div className="encabezado">
        <div><h1>Siniestros</h1><p className="secundario pequeno">Expedientes con su póliza vigente en la fecha del hecho, análisis y comunicaciones.</p></div>
        <Link className="boton boton--principal" href="/admin/seguros/siniestros/nuevo"><IconoMas /> Nuevo siniestro</Link>
      </div>
      <div className="tarjeta">
        {lista.length === 0 ? (
          <div className="vacio"><h2>Sin siniestros</h2><p>Cuando ocurra algo, descríbelo aquí: te ayudamos a ver qué cubre la póliza y a redactar la comunicación.</p></div>
        ) : (
          <ul className="lista-simple">
            {lista.map((s) => (
              <li key={s.id}>
                <div style={{ minWidth: 0 }}>
                  <span className="tpoliza__titular">{s.titular}</span>
                  <Link href={`/admin/seguros/siniestros/${s.id}`} style={{ fontWeight: 700, display: 'block' }}>{s.titulo}</Link>
                  <p className="linea-2">{s.fecha_hecho ? fechaMedia(s.fecha_hecho) : 'Fecha pendiente'}{s.polizas.length ? ` · ${s.polizas.join(', ')}` : ' · sin póliza asociada'}</p>
                </div>
                <span className={`estado estado--${claseEstado(s.estado)}`}>{ESTADOS_SINIESTRO[s.estado]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
