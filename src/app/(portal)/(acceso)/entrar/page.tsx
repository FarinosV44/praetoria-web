import type { Metadata } from 'next';
import Link from 'next/link';
import { FormEntrar } from './FormEntrar';

export const metadata: Metadata = { title: 'Entrar' };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ verificado?: string; activada?: string }> }) {
  const { verificado, activada } = await searchParams;
  return (
    <div className="card">
      {verificado === '1' ? <p className="exito mb-4" role="status">Correo confirmado. Entra con tu contraseña para continuar.</p> : null}
      {activada === '1' ? <p className="exito mb-4" role="status">Cuenta activada. Entra con tu correo y tu contraseña; después te pediremos activar el doble factor.</p> : null}
      <h1 className="titulo mb-2">Área de clientes</h1>
      <p className="ayuda mb-5">Entra para consultar tus solicitudes, enviar documentos y hablar con el despacho.</p>
      <FormEntrar />
      <div className="mt-6 grid gap-2 ayuda">
        <p><Link href="/recuperar/">He olvidado mi contraseña</Link></p>
        <p>¿Primera vez? <Link href="/crear-cuenta/">Crea tu cuenta</Link></p>
      </div>
    </div>
  );
}
