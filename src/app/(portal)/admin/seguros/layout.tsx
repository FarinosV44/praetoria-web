import type { Metadata } from 'next';
import { Navegacion } from '@/seguros/components/navegacion';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { segurosConfigurado } from '@/seguros/lib/db';
import { contarPendientes } from '@/seguros/lib/datos/avisos';
import { requerirGlobal } from '@/portal/lib/sesion';
import '@/seguros/seguros.css';

// Gestor de seguros dentro de la superadministración. Cada página vuelve a exigir sesión, rol
// «administrador» y doble factor en el servidor (exigirUsuario → requerirGlobal); nada se cachea.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: { default: 'Seguros', template: '%s · Seguros · Praetoria' }, robots: { index: false, follow: false } };

export default async function LayoutSeguros({ children }: { children: React.ReactNode }) {
  if (!segurosConfigurado()) {
    await requerirGlobal();
    return (
      <div className="seguros">
        <h1>Seguros</h1>
        <div className="aviso aviso--atencion" style={{ display: 'block', marginTop: 'var(--e-4)' }}>
          <p><strong>Sin configurar.</strong> Falta <code>DATABASE_URL_SEGUROS</code> en el servidor (conexión con el rol <code>seguros_app</code> al esquema <code>seguros</code>).</p>
          <p className="pequeno" style={{ marginTop: 6 }}>Ver <code>docs/portal/SEGUROS.md</code>.</p>
        </div>
      </div>
    );
  }
  const u = await exigirUsuario();
  const pendientes = await contarPendientes(u);
  return (
    <div className="seguros">
      <div className="seguros-cabecera">
        <Navegacion avisos={pendientes} />
      </div>
      {children}
      <Navegacion movil avisos={pendientes} />
    </div>
  );
}
