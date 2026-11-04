'use client';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Clave } from '@/components/Clave';

export function CambiarClave() {
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get('nueva') !== f.get('nueva2')) { setMsg({ error: 'Las contraseñas nuevas no coinciden.' }); return; }
    const r = await authClient.changePassword({ currentPassword: String(f.get('actual')), newPassword: String(f.get('nueva')), revokeOtherSessions: true });
    if (r.error) setMsg({ error: 'No se ha podido cambiar. Revisa la contraseña actual.' });
    else { setMsg({ ok: 'Contraseña cambiada. Hemos cerrado tus otras sesiones.' }); form.reset(); }
  }
  return (
    <form onSubmit={enviar}>
      {msg.error ? <p className="error mb-3" role="alert">{msg.error}</p> : null}
      {msg.ok ? <p className="exito mb-3" role="status">{msg.ok}</p> : null}
      <Clave id="actual" etiqueta="Contraseña actual" autoComplete="current-password" />
      <Clave id="nueva" etiqueta="Contraseña nueva" autoComplete="new-password" minimo={10} />
      <Clave id="nueva2" etiqueta="Repite la contraseña nueva" autoComplete="new-password" />
      <button className="btn btn-secundario">Cambiar contraseña</button>
    </form>
  );
}
