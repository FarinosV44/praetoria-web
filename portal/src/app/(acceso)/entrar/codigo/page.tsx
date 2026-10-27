'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

export default function CodigoDobleFactor() {
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get('codigo')).replace(/\s/g, '');
    setEnviando(true); setError('');
    const r = await authClient.twoFactor.verifyTotp({ code });
    setEnviando(false);
    if (r.error) { setError(r.error.status === 429 ? 'Demasiados intentos. Espera unos minutos.' : 'El código no es correcto o ha caducado.'); return; }
    window.location.href = '/despacho/';
  }
  return (
    <div className="card">
      <h1 className="titulo mb-2">Código de verificación</h1>
      <p className="ayuda mb-5">Escribe el código de seis cifras de tu aplicación de autenticación.</p>
      <form onSubmit={enviar}>
        {error ? <p className="error mb-4" role="alert">{error}</p> : null}
        <div className="campo">
          <label htmlFor="codigo">Código</label>
          <input id="codigo" name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required />
        </div>
        <button className="btn btn-primario w-full" disabled={enviando}>Verificar</button>
      </form>
    </div>
  );
}
