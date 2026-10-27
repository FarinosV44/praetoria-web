'use client';
import { useState } from 'react';

export function Clave({ id, etiqueta, autoComplete, minimo }: { id: string; etiqueta: string; autoComplete: string; minimo?: number }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="flex gap-2">
        <input id={id} name={id} type={ver ? 'text' : 'password'} required minLength={minimo} maxLength={128} autoComplete={autoComplete} />
        <button type="button" className="btn btn-secundario" onClick={() => setVer(!ver)} aria-pressed={ver} aria-controls={id}>
          {ver ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {minimo ? <span className="ayuda">Mínimo {minimo} caracteres. Mejor una frase que solo tú recuerdes.</span> : null}
    </div>
  );
}
