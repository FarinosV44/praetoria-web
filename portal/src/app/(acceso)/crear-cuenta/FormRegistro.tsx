'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Clave } from '@/components/Clave';
import { VERSION_PRIVACIDAD } from '@/lib/textos';

export function FormRegistro() {
  const [estado, setEstado] = useState<'inicio' | 'enviando' | 'hecho'>('inicio');
  const [error, setError] = useState('');

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError('');
    if (f.get('clave') !== f.get('clave2')) { setError('Las dos contraseñas no coinciden.'); return; }
    if (!f.get('privacidad')) { setError('Para crear la cuenta tienes que aceptar la información de privacidad.'); return; }
    setEstado('enviando');
    const r = await authClient.signUp.email({
      name: String(f.get('nombre')).trim(),
      email: String(f.get('email')).trim().toLowerCase(),
      password: String(f.get('clave')),
      privacidadVersion: VERSION_PRIVACIDAD,
      callbackURL: '/bienvenida/',
    });
    if (r.error && r.error.status !== 422 && r.error.code !== 'USER_ALREADY_EXISTS') {
      setEstado('inicio');
      setError(r.error.code === 'PASSWORD_TOO_SHORT' ? 'La contraseña es demasiado corta.'
        : r.error.status === 429 ? 'Has hecho demasiados intentos. Espera unos minutos.'
        : 'No hemos podido crear la cuenta. Revisa los datos e inténtalo de nuevo.');
      return;
    }
    // Misma respuesta exista o no el correo: no revelamos qué correos están registrados.
    setEstado('hecho');
  }

  if (estado === 'hecho') {
    return (
      <div className="exito" role="status">
        <p className="font-semibold">Revisa tu correo</p>
        <p>Si los datos son correctos, te hemos enviado un enlace para confirmar tu correo. Ábrelo para activar la cuenta. El enlace caduca en una hora.</p>
      </div>
    );
  }
  return (
    <form onSubmit={enviar} noValidate={false}>
      {error ? <p className="error mb-4" role="alert">{error}</p> : null}
      <div className="campo">
        <label htmlFor="nombre">Nombre y apellidos</label>
        <input id="nombre" name="nombre" required maxLength={120} autoComplete="name" />
      </div>
      <div className="campo">
        <label htmlFor="email">Correo electrónico</label>
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" />
      </div>
      <Clave id="clave" etiqueta="Contraseña" autoComplete="new-password" minimo={10} />
      <Clave id="clave2" etiqueta="Repite la contraseña" autoComplete="new-password" />
      <div className="card mb-4" style={{ background: 'var(--color-stone)', padding: 14 }}>
        <p className="font-semibold mb-1">Información básica sobre privacidad</p>
        <p className="ayuda">
          Responsable: PRAETORIA SL. Finalidad: gestionar tu cuenta y estudiar la solicitud que nos envíes. No cedemos tus datos
          salvo obligación legal. Puedes acceder, rectificar y suprimir tus datos, entre otros derechos.{' '}
          <a href="https://praetoriaabogados.es/politica-de-privacidad/" target="_blank" rel="noopener">Más información</a>.
        </p>
        <label className="flex gap-3 items-start mt-3">
          <input type="checkbox" name="privacidad" required className="mt-1 size-5" />
          <span>He leído la información de privacidad y acepto que se traten mis datos para estas finalidades.</span>
        </label>
      </div>
      <button className="btn btn-primario w-full" disabled={estado === 'enviando'}>
        {estado === 'enviando' ? 'Creando la cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
