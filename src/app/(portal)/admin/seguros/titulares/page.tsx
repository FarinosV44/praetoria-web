import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { listarTitulares } from '@/seguros/lib/datos/titulares';
import { IconoMas } from '@/seguros/components/iconos';
import { accionArchivarTitular } from './acciones';

export const metadata: Metadata = { title: 'Titulares' };

export default async function Titulares({ searchParams }: { searchParams: Promise<{ archivados?: string }> }) {
  const u = await exigirUsuario();
  const { archivados } = await searchParams;
  const titulares = await listarTitulares(u, { incluirArchivados: !!archivados });
  const grupos = [
    { tipo: 'empresa', titulo: 'Empresas' },
    { tipo: 'particular', titulo: 'Particulares' },
  ] as const;
  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Titulares</h1>
          <p className="secundario pequeno">Empresas y particulares a cuyo nombre se organizan las pólizas.</p>
        </div>
        {u.rol === 'admin' && <Link className="boton boton--principal" href="/admin/seguros/titulares/nuevo"><IconoMas /> Nuevo titular</Link>}
      </div>
      {grupos.map(({ tipo, titulo }) => {
        const lista = titulares.filter((t) => t.tipo === tipo);
        return (
          <section key={tipo} className="bloque" aria-labelledby={`g-${tipo}`}>
            <div className="bloque__titulo"><h2 id={`g-${tipo}`}>{titulo}</h2></div>
            <div className="tarjeta">
              {lista.length === 0 ? <p className="secundario" style={{ padding: 'var(--e-4)' }}>Ninguno todavía.</p> : (
                <ul className="lista-simple">
                  {lista.map((t) => (
                    <li key={t.id}>
                      <div>
                        <Link href={`/admin/seguros/?titular=${t.id}`} style={{ fontWeight: 700 }}>{t.nombre}</Link>
                        <p className="linea-2">{t.nif ? `${t.nif} · ` : ''}{t.polizas} {t.polizas === '1' ? 'póliza' : 'pólizas'}{t.archivado_en ? ' · archivado' : ''}</p>
                      </div>
                      <div className="acciones">
                        <Link className="boton boton--peq" href={`/admin/seguros/polizas/nueva?titular=${t.id}`}>Añadir póliza</Link>
                        {u.rol === 'admin' && <Link className="boton boton--peq boton--sutil" href={`/admin/seguros/titulares/${t.id}`}>Editar</Link>}
                        {u.rol === 'admin' && t.archivado_en && (
                          <form action={accionArchivarTitular.bind(null, t.id, false)}><button className="boton boton--peq boton--sutil" type="submit">Recuperar</button></form>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}
      <p className="pequeno" style={{ marginTop: 'var(--e-5)' }}>
        <Link href={archivados ? '/admin/seguros/titulares' : '/admin/seguros/titulares?archivados=1'}>{archivados ? 'Ocultar archivados' : 'Ver también los archivados'}</Link>
      </p>
    </>
  );
}
