'use client';
import { useActionState, useState } from 'react';

export function FormPerfil({ accion }: { accion: (s: unknown, f: FormData) => Promise<{ error?: string }> }) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const [tipo, setTipo] = useState('particular');
  return (
    <form action={enviar}>
      {estado?.error ? <p className="error mb-4" role="alert">{estado.error}</p> : null}
      <fieldset className="campo">
        <legend className="etiqueta mb-2">¿Quién necesita asesoramiento?</legend>
        <label className="card flex gap-3 items-center" style={{ padding: 14 }}>
          <input type="radio" name="tipo" value="particular" checked={tipo === 'particular'} onChange={() => setTipo('particular')} className="size-5" />
          <span><strong>Yo, como particular</strong></span>
        </label>
        <label className="card flex gap-3 items-center" style={{ padding: 14 }}>
          <input type="radio" name="tipo" value="empresa" checked={tipo === 'empresa'} onChange={() => setTipo('empresa')} className="size-5" />
          <span><strong>Una empresa</strong> que represento</span>
        </label>
      </fieldset>
      {tipo === 'empresa' ? (
        <>
          <div className="campo"><label htmlFor="empresa">Nombre de la empresa</label><input id="empresa" name="empresa" maxLength={200} required autoComplete="organization" /></div>
          <div className="campo"><label htmlFor="cargo">Tu cargo (opcional)</label><input id="cargo" name="cargo" maxLength={120} autoComplete="organization-title" /></div>
        </>
      ) : null}
      <div className="campo">
        <label htmlFor="telefono">Teléfono (opcional)</label>
        <input id="telefono" name="telefono" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} />
        <span className="ayuda">Solo lo usaremos si prefieres que te llamemos.</span>
      </div>
      <button className="btn btn-primario w-full" disabled={pendiente}>Continuar</button>
    </form>
  );
}
