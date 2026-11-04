'use client';
import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

export default function Recuperar() {
  const [hecho, setHecho] = useState(false);
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email')).trim().toLowerCase();
    await authClient.requestPasswordReset({ email, redirectTo: '/restablecer/' });
    setHecho(true); // misma respuesta exista o no la cuenta
  }
  return (
    <div className="card">
      <h1 className="titulo mb-2">Recuperar el acceso</h1>
      {hecho ? (
        <p className="exito" role="status">Si el correo corresponde a una cuenta, te hemos enviado un enlace para crear una contraseña nueva. Caduca en una hora.</p>
      ) : (
        <form onSubmit={enviar}>
          <p className="ayuda mb-5">Te enviaremos un enlace para crear una contraseña nueva.</p>
          <div className="campo">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" />
          </div>
          <button className="btn btn-primario w-full">Enviar enlace</button>
        </form>
      )}
      <p className="mt-6 ayuda"><Link href="/entrar/">Volver a entrar</Link></p>
    </div>
  );
}
