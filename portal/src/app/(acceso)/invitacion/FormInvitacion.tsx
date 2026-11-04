'use client';
import { useActionState } from 'react';
import { Clave } from '@/components/Clave';

export function FormInvitacion({ token, accion }: { token: string; accion: (s: { error?: string }, f: FormData) => Promise<{ error?: string }> }) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  return (
    <form action={enviar}>
      <input type="hidden" name="token" value={token} />
      {estado.error ? <p className="error mb-4" role="alert">{estado.error}</p> : null}
      <Clave id="clave" etiqueta="Contraseña" autoComplete="new-password" minimo={14} />
      <Clave id="clave2" etiqueta="Repite la contraseña" autoComplete="new-password" />
      <button className="btn btn-primario w-full" disabled={pendiente}>Activar mi cuenta</button>
    </form>
  );
}
