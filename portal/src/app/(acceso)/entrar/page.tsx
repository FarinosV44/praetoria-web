import type { Metadata } from 'next';
import Link from 'next/link';
import { FormEntrar } from './FormEntrar';

export const metadata: Metadata = { title: 'Entrar' };

export default function Entrar() {
  return (
    <div className="card">
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
