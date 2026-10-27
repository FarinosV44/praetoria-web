import type { Metadata } from 'next';
import Link from 'next/link';
import { ChipSolicitud, Progreso } from '@/components/ui';
import { comoUsuario } from '@/lib/db';
import { misSolicitudes, type ResumenSolicitud } from '@/lib/datos';
import { requerirCliente } from '@/lib/sesion';
import { estadoSolicitud } from '@/lib/textos';

export const metadata: Metadata = { title: 'Mi inicio' };

function siguientePaso(s: ResumenSolicitud): { texto: string; href: string; boton: string } | null {
  if (s.estado === 'borrador') return { texto: 'Tu solicitud está a medias. Termínala y envíala cuando quieras.', href: `/solicitudes/${s.id}/editar/?paso=${s.paso}`, boton: 'Continuar la solicitud' };
  if (['no_aceptada', 'archivada'].includes(s.estado)) return null;
  if (s.subsanar > 0) return { texto: `Hay ${s.subsanar === 1 ? 'un documento' : `${s.subsanar} documentos`} que debes volver a enviar.`, href: `/solicitudes/${s.id}/#documentacion`, boton: 'Ver qué falta' };
  if (s.pendientes_oblig > 0) return { texto: `Nos faltan ${s.pendientes_oblig === 1 ? 'un documento' : `${s.pendientes_oblig} documentos`} para estudiar tu asunto.`, href: `/solicitudes/${s.id}/#documentacion`, boton: 'Subir documentación' };
  return null;
}

export default async function Inicio() {
  const u = await requerirCliente();
  const sols = await comoUsuario(u.id, (tx) => misSolicitudes(tx, u.id));
  const activas = sols.filter((s) => !['no_aceptada', 'archivada'].includes(s.estado));
  const pasos = activas.map((s) => ({ s, p: siguientePaso(s) })).filter((x) => x.p);

  return (
    <div className="grid gap-6">
      <h1 className="titulo">Hola, {u.nombre.split(' ')[0]}</h1>

      <section className="card" aria-labelledby="t-hacer">
        <h2 id="t-hacer" className="subtitulo">Qué tienes que hacer ahora</h2>
        {sols.length === 0 ? (
          <div className="grid gap-3">
            <p>Cuéntanos qué necesitas. Te llevará unos minutos y podrás guardar y seguir más tarde.</p>
            <p><Link className="btn btn-primario" href="/solicitudes/nueva/">Iniciar una solicitud</Link></p>
          </div>
        ) : pasos.length === 0 ? (
          <p>No tienes nada pendiente. Te avisaremos por correo cuando haya novedades.</p>
        ) : (
          <ul className="lista">
            {pasos.map(({ s, p }) => (
              <li key={s.id} className="fila">
                <span><strong>{s.tipo_nombre ?? 'Solicitud'}</strong> · {p!.texto}</span>
                <Link className="btn btn-primario" href={p!.href}>{p!.boton}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activas.length > 0 ? (
        <section aria-labelledby="t-estado">
          <h2 id="t-estado" className="subtitulo">Cómo está tu asunto</h2>
          <ul className="lista">
            {activas.map((s) => (
              <li key={s.id} className="card">
                <div className="fila mb-2">
                  <Link href={s.expediente_id ? `/expedientes/${s.expediente_id}/` : `/solicitudes/${s.id}/`} className="font-semibold">
                    {s.expediente_titulo ?? s.tipo_nombre ?? 'Solicitud sin tipo'}
                  </Link>
                  <ChipSolicitud estado={s.estado} />
                </div>
                <p className="ayuda mb-3">{s.expediente_ref ?? s.referencia} · {estadoSolicitud[s.estado]?.explicacion}</p>
                {s.estado_visible ? <p className="nota mb-3"><strong>Nota del despacho:</strong> {s.estado_visible}</p> : null}
                {s.estado !== 'borrador' && s.total > 0 ? (
                  <>
                    <Progreso hechos={s.aportados} total={s.total} etiqueta="Documentación aportada" />
                    <p className="ayuda mt-2">Indica los documentos que has enviado, no cómo va tu asunto.</p>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card" aria-labelledby="t-necesita">
        <h2 id="t-necesita" className="subtitulo">Qué necesita Praetoria de ti</h2>
        {activas.some((s) => s.pendientes_oblig > 0) ? (
          <p>Hay documentación pendiente. <Link href="/documentacion/">Ver la lista completa</Link>.</p>
        ) : (
          <p>Ahora mismo no te pedimos nada más.</p>
        )}
        <p className="mt-3"><Link href="/solicitudes/nueva/">Iniciar otra solicitud</Link></p>
      </section>
    </div>
  );
}
