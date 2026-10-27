'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Clave } from '@/components/Clave';

export function FormEntrar() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(''); setAviso(''); setEnviando(true);
    const r = await authClient.signIn.email({
      email: String(f.get('email')).trim().toLowerCase(),
      password: String(f.get('clave')),
      callbackURL: '/',
    });
    setEnviando(false);
    if (r.error) {
      if (r.error.status === 403) setAviso('Antes de entrar tienes que confirmar tu correo. Te hemos enviado un enlace nuevo.');
      else if (r.error.status === 429) setError('Demasiados intentos. Espera unos minutos antes de volver a probar.');
      else setError('El correo o la contraseña no son correctos.');
      return;
    }
    if ((r.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) return; // lo gestiona el plugin
    window.location.href = '/';
  }

  return (
    <form onSubmit={enviar}>
      {error ? <p className="error mb-4" role="alert">{error}</p> : null}
      {aviso ? <p className="nota mb-4" role="status">{aviso}</p> : null}
      <div className="campo">
        <label htmlFor="email">Correo electrónico</label>
        <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" />
      </div>
      <Clave id="clave" etiqueta="Contraseña" autoComplete="current-password" />
      <button className="btn btn-primario w-full" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}
