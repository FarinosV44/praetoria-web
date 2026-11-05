import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';

export const metadata: Metadata = { title: 'Ajustes' };

export default async function Ajustes() {
  const u = await exigirUsuario();
  return (
    <>
      <div className="encabezado"><div><h1>Ajustes</h1><p className="secundario pequeno">{u.nombre} · {u.email} · superadministración</p></div></div>

      <section className="bloque" aria-labelledby="t-gestion">
        <div className="bloque__titulo">
          <h2 id="t-gestion">Gestión</h2>
          <div className="acciones">
            <Link className="boton boton--peq" href="/admin/seguros/ajustes/estado/">Estado y avisos</Link>
            <Link className="boton boton--peq" href="/admin/seguros/ajustes/tipos/">Tipos de seguro</Link>
          </div>
        </div>
        <p className="secundario pequeno">El acceso a Seguros lo da la superadministración del despacho (rol «administrador» con doble factor). Las personas se gestionan en <Link href="/admin/equipo/">Equipo</Link>.</p>
      </section>

      <section className="bloque" aria-labelledby="t-movil">
        <div className="bloque__titulo"><h2 id="t-movil">Avisos</h2></div>
        <div className="tarjeta tarjeta--pad" style={{ maxWidth: 560 }}>
          <p className="secundario pequeno" style={{ marginBottom: 'var(--e-3)' }}>Los avisos llegan por la app de Praetoria. Comprueba los dispositivos y elige si quieres correo de respaldo.</p>
          <Link className="boton" href="/admin/seguros/avisos/dispositivo/">Avisos en el móvil</Link>
        </div>
      </section>

      <section className="bloque" aria-labelledby="t-export">
        <div className="bloque__titulo"><h2 id="t-export">Exportar</h2></div>
        <div className="tarjeta tarjeta--pad" style={{ maxWidth: 560 }}>
          <p className="secundario pequeno" style={{ marginBottom: 'var(--e-3)' }}>Pólizas y anualidades de los titulares a los que tienes acceso, en CSV para Excel. El expediente completo de cada póliza o siniestro se descarga desde su ficha.</p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- descarga de archivo, no es una página */}
          <a className="boton" href="/api/seguros/exportar/polizas/">Descargar pólizas (CSV)</a>
        </div>
      </section>

    </>
  );
}
