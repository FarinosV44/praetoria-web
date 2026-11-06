import { Marca } from '@/portal/components/Marca';
import { NavDespacho } from '@/portal/components/NavDespacho';
import { PaletaComandos } from '@/portal/components/PaletaComandos';
import { Salir } from '@/portal/components/Salir';
import { AvisoEntorno } from '@/portal/components/ui';
import { env } from '@/portal/lib/env';
import { requerirPersonal } from '@/portal/lib/sesion';
import { comoUsuario } from '@/portal/lib/db';

export const dynamic = 'force-dynamic';

export default async function DespachoLayout({ children }: { children: React.ReactNode }) {
  const u = await requerirPersonal({ sinMfa: true });
  const avisos = u.mfa || !process.env.STAFF_MFA_REQUIRED || process.env.STAFF_MFA_REQUIRED === 'false'
    ? await comoUsuario(u.id, async (tx) => (await tx.query('select count(*)::int n from portal.avisos_internos where user_id = $1 and leido_at is null', [u.id])).rows[0].n as number)
    : 0;
  const rol = u.personal!.rol, esGlobal = rol === 'administrador', conBiblioteca = rol !== 'facturacion', conIA = !!env.iaClave && conBiblioteca;
  const grupos = [
    { titulo: 'Trabajo', enlaces: [
      { href: '/admin/', texto: 'Inicio' }, { href: '/admin/expedientes/', texto: 'Expedientes' }, { href: '/admin/clientes/', texto: 'Clientes' },
      { href: '/admin/agenda/', texto: 'Agenda' }, { href: '/admin/avisos/', texto: 'Avisos', n: avisos },
    ] },
    ...(conBiblioteca ? [{ titulo: 'Inteligencia jurídica', enlaces: [
      ...(conIA ? [{ href: '/admin/ia/', texto: 'Copiloto' }, { href: '/admin/ia/nuevo/', texto: 'Nuevo escrito' }] : []),
      { href: '/admin/biblioteca/', texto: 'Biblioteca' },
    ] }] : []),
    { titulo: 'Gestión', enlaces: [
      { href: '/admin/plantillas/', texto: 'Plantillas' },
      ...(esGlobal ? [{ href: '/admin/seguros/', texto: 'Seguros' }, { href: '/admin/equipo/', texto: 'Equipo' }, { href: '/admin/ia/ajustes/', texto: 'Ajustes de IA' }] : []),
      { href: '/admin/app/', texto: 'App móvil' }, { href: '/admin/seguridad/', texto: 'Seguridad' },
    ] },
  ];
  return (
    <div className="shell">
      <a href="#contenido" className="saltar">Saltar al contenido</a>
      <AvisoEntorno />
      <header className="shell-cabecera">
        <div className="flex items-center gap-3"><Marca destino="/admin/" /><span className="chip chip-neutro">Despacho</span></div>
        <div className="flex items-center gap-3"><span className="ayuda hidden sm:inline">{u.personal!.nombre}</span><Salir /></div>
      </header>
      <div className="shell-cuerpo">
        <NavDespacho grupos={grupos} />
        <main id="contenido" className="shell-contenido">{children}</main>
      </div>
      <PaletaComandos esGlobal={esGlobal} conBiblioteca={conBiblioteca} conIA={conIA} />
    </div>
  );
}
