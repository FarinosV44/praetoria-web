import { Marca } from '@/components/Marca';
import { NavCliente } from '@/components/NavCliente';
import { Salir } from '@/components/Salir';
import { AvisoEntorno } from '@/components/ui';
import { comoUsuario } from '@/lib/db';
import { requerirCliente } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const u = await requerirCliente();
  const pendientes = await comoUsuario(u.id, async (tx) => (await tx.query(
    `select count(*)::int n from portal.requisitos r join portal.solicitudes s on s.id = r.solicitud_id
     where r.estado in ('pendiente', 'subsanacion') and s.estado in ('enviada', 'en_revision', 'aceptada')`)).rows[0].n as number);
  return (
    <div className="min-h-dvh flex flex-col">
      <AvisoEntorno />
      <header style={{ background: '#fff' }}>
        <div className="wrap fila py-3">
          <Marca destino="/inicio/" />
          <div className="flex items-center gap-3"><span className="ayuda hidden sm:inline">{u.nombre}</span><Salir /></div>
        </div>
        <NavCliente pendientes={pendientes} />
      </header>
      <main id="contenido" className="wrap flex-1 py-6">{children}</main>
      <footer className="wrap py-6 ayuda text-center">
        ¿Necesitas ayuda? Escríbenos desde «Mensajes» o llama al 607 527 719. · <a href="https://praetoriaabogados.es/politica-de-privacidad/">Privacidad</a>
      </footer>
    </div>
  );
}
