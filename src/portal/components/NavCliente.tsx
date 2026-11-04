'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const enlaces = [
  ['/inicio/', 'Mi inicio'],
  ['/solicitudes/', 'Mis solicitudes'],
  ['/expedientes/', 'Mis expedientes'],
  ['/documentacion/', 'Documentación pendiente'],
  ['/documentos/', 'Mis documentos'],
  ['/mensajes/', 'Mensajes'],
  ['/perfil/', 'Mi perfil'],
] as const;

export function NavCliente({ pendientes }: { pendientes: number }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Área de clientes" className="overflow-x-auto" style={{ borderTop: '1px solid var(--color-line)' }}>
      <ul className="wrap flex gap-1 py-2 min-w-max">
        {enlaces.map(([href, texto]) => {
          const activo = ruta.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={activo ? 'page' : undefined}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md no-underline text-sm font-semibold"
                style={activo ? { background: 'var(--color-ink)', color: '#fff' } : undefined}>
                {texto}
                {href === '/documentacion/' && pendientes > 0 ? <span className="chip chip-aviso" style={{ padding: '0 7px' }}>{pendientes}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
