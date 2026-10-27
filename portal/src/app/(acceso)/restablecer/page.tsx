'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Clave } from '@/components/Clave';

function Formulario() {
  const token = useSearchParams().get('token') ?? '';
  const [estado, setEstado] = useState<'inicio' | 'hecho'>('inicio');
  const [error, setError] = useState('');
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('clave') !== f.get('clave2')) { setError('Las dos contraseñas no coinciden.'); return; }
    const r = await authClient.resetPassword({ newPassword: String(f.get('clave')), token });
    if (r.error) { setError('El enlace no es válido o ha caducado. Pide uno nuevo.'); return; }
    setEstado('hecho');
  }
  if (!token) return <p className="error">El enlace no es válido. <Link href="/recuperar/">Pide uno nuevo</Link>.</p>;
  if (estado === 'hecho') return <p className="exito" role="status">Contraseña cambiada. Por seguridad, hemos cerrado tus otras sesiones. <Link href="/entrar/">Entra ahora</Link>.</p>;
  return (
    <form onSubmit={enviar}>
      {error ? <p className="error mb-4" role="alert">{error}</p> : null}
      <Clave id="clave" etiqueta="Contraseña nueva" autoComplete="new-password" minimo={10} />
      <Clave id="clave2" etiqueta="Repite la contraseña" autoComplete="new-password" />
      <button className="btn btn-primario w-full">Guardar contraseña</button>
    </form>
  );
}

export default function Restablecer() {
  return (
    <div className="card">
      <h1 className="titulo mb-4">Crea una contraseña nueva</h1>
      <Suspense><Formulario /></Suspense>
    </div>
  );
}
