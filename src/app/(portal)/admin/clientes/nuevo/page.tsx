import type { Metadata } from 'next';
import { FormAltaCliente } from '@/portal/components/AltaCliente';
import { requerirPersonal } from '@/portal/lib/sesion';

export const metadata: Metadata = { title: 'Nuevo cliente' };

export default async function NuevoCliente() {
  await requerirPersonal();
  return (
    <div className="card max-w-xl">
      <h1 className="titulo mb-2">Nuevo cliente</h1>
      <p className="ayuda mb-5">Da de alta al cliente, abre su expediente y envíale su acceso. Él elegirá su propia contraseña con un enlace de un solo uso.</p>
      <FormAltaCliente />
    </div>
  );
}
