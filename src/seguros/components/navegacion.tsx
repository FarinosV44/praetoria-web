'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconoAjustes, IconoAvisos, IconoPagos, IconoPolizas, IconoSiniestros, IconoTitulares } from './iconos';

const B = '/admin/seguros';
const ENLACES = [
  { href: `${B}/`, texto: 'Pólizas', icono: IconoPolizas, activo: (p: string) => p === `${B}/` || p === B || p.startsWith(`${B}/polizas`) || p.startsWith(`${B}/renovaciones`) },
  { href: `${B}/pagos/`, texto: 'Pagos', icono: IconoPagos, activo: (p: string) => p.startsWith(`${B}/pagos`) },
  { href: `${B}/avisos/`, texto: 'Avisos', icono: IconoAvisos, activo: (p: string) => p.startsWith(`${B}/avisos`) },
  { href: `${B}/siniestros/`, texto: 'Siniestros', icono: IconoSiniestros, activo: (p: string) => p.startsWith(`${B}/siniestros`) },
  { href: `${B}/titulares/`, texto: 'Titulares', icono: IconoTitulares, activo: (p: string) => p.startsWith(`${B}/titulares`) },
  { href: `${B}/ajustes/`, texto: 'Ajustes', icono: IconoAjustes, activo: (p: string) => p.startsWith(`${B}/ajustes`) },
];

export function Navegacion({ movil = false, avisos = 0 }: { movil?: boolean; avisos?: number }) {
  const ruta = usePathname();
  return (
    <nav className={movil ? 'barra-movil' : 'nav'} aria-label={movil ? 'Seguros (móvil)' : 'Seguros'} style={movil ? ({ '--n': ENLACES.length } as React.CSSProperties) : undefined}>
      {ENLACES.map(({ href, texto, icono: I, activo }) => (
        <Link key={href} href={href} aria-current={activo(ruta) ? 'page' : undefined}>
          {movil && <I />}
          <span>
            {texto}
            {href === `${B}/avisos/` && avisos > 0 && <span className="insignia" aria-label={`${avisos} sin atender`}>{avisos}</span>}
          </span>
        </Link>
      ))}
    </nav>
  );
}
