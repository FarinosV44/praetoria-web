'use client';
import { useActionState } from 'react';
import { Clave } from '@/portal/components/Clave';

export function FormInvitacion({ token, accion, cliente }: { token: string; cliente: boolean; accion: (s: { error?: string }, f: FormData) => Promise<{ error?: string }> }) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  return (
    <form action={enviar}>
      <input type="hidden" name="token" value={token} />
      {estado.error ? <p className="error mb-4" role="alert">{estado.error}</p> : null}
      <Clave id="clave" etiqueta="Contraseña" autoComplete="new-password" minimo={cliente ? 10 : 14} />
      <Clave id="clave2" etiqueta="Repite la contraseña" autoComplete="new-password" />
      {cliente ? (
        <div className="card mb-4" style={{ background: 'var(--color-stone)', padding: 14 }}>
          <p className="ayuda">Responsable: PRAETORIA SL. Finalidad: prestarte el servicio jurídico encargado y gestionar tu acceso. No cedemos tus datos salvo
            obligación legal. Puedes ejercer tus derechos escribiendo al despacho.{' '}
            <a href="https://praetoriaabogados.es/politica-de-privacidad/" target="_blank" rel="noopener">Más información</a>.</p>
          <label className="flex gap-3 items-start mt-3"><input type="checkbox" name="privacidad" required className="mt-1 size-5" />
            <span>He leído la información de privacidad.</span></label>
        </div>
      ) : null}
      <button className="btn btn-primario w-full" disabled={pendiente}>Activar mi cuenta</button>
    </form>
  );
}
