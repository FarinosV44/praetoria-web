'use client';
import { useState } from 'react';
import QRCode from 'qrcode';
import { authClient } from '@/lib/auth-client';
import { Clave } from '@/components/Clave';

export function ActivarMfa() {
  const [datos, setDatos] = useState<{ uri: string; qr: string; codigos: string[] } | null>(null);
  const [error, setError] = useState('');
  async function paso1(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('');
    const r = await authClient.twoFactor.enable({ password: String(new FormData(e.currentTarget).get('clave')) });
    if (r.error || !r.data || !('totpURI' in r.data)) { setError('Contraseña incorrecta.'); return; }
    setDatos({ uri: r.data.totpURI, qr: await QRCode.toDataURL(r.data.totpURI), codigos: r.data.backupCodes });
  }
  async function paso2(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('');
    const code = String(new FormData(e.currentTarget).get('codigo')).replace(/\s/g, '');
    const r = await authClient.twoFactor.verifyTotp({ code });
    if (r.error) { setError('El código no es correcto. Comprueba la hora del móvil y vuelve a probar.'); return; }
    window.location.href = '/despacho/';
  }
  if (!datos) return (
    <form onSubmit={paso1}>
      {error ? <p className="error mb-3" role="alert">{error}</p> : null}
      <Clave id="clave" etiqueta="Confirma tu contraseña" autoComplete="current-password" />
      <button className="btn btn-primario">Continuar</button>
    </form>
  );
  const secreto = new URL(datos.uri).searchParams.get('secret') ?? '';
  return (
    <form onSubmit={paso2}>
      {error ? <p className="error mb-3" role="alert">{error}</p> : null}
      <p className="mb-2">1. Escanea este código con tu aplicación de autenticación:</p>
      <img src={datos.qr} alt="Código QR para la aplicación de autenticación" width={200} height={200} className="mb-2" />
      <p className="ayuda mb-4">O escribe la clave a mano: <code data-secreto={secreto}>{secreto}</code></p>
      <p className="mb-2">2. Guarda estos códigos de recuperación en un lugar seguro (cada uno sirve una vez):</p>
      <ul className="grid grid-cols-2 gap-1 mb-4 font-mono text-sm">{datos.codigos.map((c) => <li key={c}>{c}</li>)}</ul>
      <div className="campo">
        <label htmlFor="codigo">3. Escribe el código de seis cifras que muestra la aplicación</label>
        <input id="codigo" name="codigo" inputMode="numeric" autoComplete="one-time-code" required />
      </div>
      <button className="btn btn-primario">Activar</button>
    </form>
  );
}
