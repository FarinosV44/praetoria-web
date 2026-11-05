import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { listarTitulares } from '@/seguros/lib/datos/titulares';
import { listarImportaciones } from '@/seguros/lib/ia/importacion';
import { iaConfigurada } from '@/seguros/lib/ia/proveedor';
import { Importar } from '@/seguros/components/importar';

export const metadata: Metadata = { title: 'Subir pólizas' };

const ESTADO: Record<string, string> = { pendiente: 'En cola', procesando: 'Leyendo…', hecha: 'Hecha', error: 'Error' };

export default async function PaginaImportar() {
  const u = await exigirUsuario();
  const [titulares, recientes] = await Promise.all([listarTitulares(u), listarImportaciones(u)]);
  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Subir pólizas</h1>
          <p className="secundario pequeno">Sube los documentos y la IA guarda cada póliza con sus datos, su titular y sus coberturas. Solo guarda lo que figura en el documento, con su página y su cita; lo dudoso queda pendiente.</p>
        </div>
      </div>
      {iaConfigurada()
        ? <Importar titulares={titulares.map((t) => ({ id: t.id, nombre: t.nombre }))} />
        : <div className="aviso aviso--atencion" style={{ display: 'block' }}><p><strong>Lectura automática sin configurar.</strong> Falta <code>ANTHROPIC_API_KEY</code> en el servidor.</p></div>}
      {recientes.length > 0 && (
        <section className="tarjeta tarjeta--pad bloque" style={{ marginTop: 'var(--e-5)' }} aria-labelledby="t-recientes">
          <h2 id="t-recientes" style={{ marginBottom: 'var(--e-3)' }}>Últimas subidas</h2>
          <ul className="lista-simple">
            {recientes.map((r) => (
              <li key={r.id}><div>
                <Link href={`/admin/seguros/importar/${r.id}/`} style={{ fontWeight: 650 }}>{r.archivos.map((a) => a.nombre).join(', ').slice(0, 120)}</Link>
                <p className="linea-2">{ESTADO[r.estado] ?? r.estado} · {new Date(r.creada_en).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' })}
                  {r.resultado ? ` · ${r.resultado.polizas.filter((p) => p.accion === 'creada').length} creadas, ${r.resultado.polizas.filter((p) => p.accion === 'actualizada').length} completadas` : ''}</p>
              </div></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
