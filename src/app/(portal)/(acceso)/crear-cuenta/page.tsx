import type { Metadata } from 'next';
import Link from 'next/link';
import { FormRegistro } from './FormRegistro';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default function CrearCuenta() {
  return (
    <div className="card">
      <h1 className="titulo mb-2">Crea tu cuenta</h1>
      <p className="ayuda mb-5">
        Con tu cuenta podrás contarnos tu caso, enviarnos la documentación y seguir el estado de tu solicitud.
        Crear una cuenta no supone que el despacho acepte el encargo: lo revisaremos y te responderemos.
      </p>
      <FormRegistro />
      <p className="mt-6 ayuda">¿Ya tienes cuenta? <Link href="/entrar/">Entra aquí</Link></p>
    </div>
  );
}
