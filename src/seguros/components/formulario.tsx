'use client';

import { createContext, useActionState, useContext, useId, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { EstadoForm } from '@/seguros/lib/acciones';

type Ctx = { estado: EstadoForm };
const Contexto = createContext<Ctx>({ estado: null });

export function Formulario({
  accion, children, className = 'form', encType, aria,
}: {
  accion: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  children: ReactNode; className?: string; encType?: 'multipart/form-data'; aria?: string;
}) {
  const [estado, formAction] = useActionState(accion, null);
  return (
    <Contexto.Provider value={{ estado }}>
      {/* La clave fuerza a recuperar los valores enviados cuando la acción devuelve errores. */}
      <form key={estado?.n ?? 0} action={formAction} className={className} encType={encType} aria-label={aria} noValidate>
        {estado?.error && (
          <div className="aviso aviso--error" role="alert">
            <IconoAlerta /> <span>{estado.error}</span>
          </div>
        )}
        {estado?.ok && (
          <div className="aviso aviso--ok" role="status">
            <span>{estado.ok}</span>
          </div>
        )}
        {children}
      </form>
    </Contexto.Provider>
  );
}

export function useEstadoForm() {
  return useContext(Contexto).estado;
}

function IconoAlerta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></svg>
  );
}

type Base = { nombre: string; etiqueta: string; ayuda?: ReactNode; defecto?: string | null; requerido?: boolean; className?: string };

function useCampo(nombre: string, defecto?: string | null) {
  const estado = useEstadoForm();
  const id = useId();
  const error = estado?.campos?.[nombre];
  const valor = estado?.valores && nombre in estado.valores ? estado.valores[nombre] : defecto ?? '';
  return { id, error, valor };
}

function Envoltura({ id, etiqueta, ayuda, error, requerido, className, children }: { id: string; etiqueta: string; ayuda?: ReactNode; error?: string; requerido?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={`campo ${className ?? ''}`}>
      <label htmlFor={id} data-requerido={requerido ? '' : undefined}>{etiqueta}</label>
      {children}
      {ayuda && <span className="ayuda" id={`${id}-ayuda`}>{ayuda}</span>}
      {error && <span className="error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}

const describedBy = (id: string, ayuda?: ReactNode, error?: string) =>
  [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

export function Campo({ nombre, etiqueta, ayuda, defecto, requerido, className, tipo = 'text', ...resto }: Base & { tipo?: string; placeholder?: string; autoComplete?: string; inputMode?: 'decimal' | 'email' | 'tel' | 'text' | 'numeric'; maxLength?: number; autoFocus?: boolean }) {
  const { id, error, valor } = useCampo(nombre, defecto);
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={requerido} className={className}>
      <input id={id} name={nombre} type={tipo} defaultValue={valor} required={requerido} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, ayuda, error)} {...resto} />
    </Envoltura>
  );
}

export function Importe(props: Base) {
  return <Campo {...props} inputMode="decimal" placeholder="0,00" autoComplete="off" />;
}

export function Area({ nombre, etiqueta, ayuda, defecto, requerido, className, filas = 3 }: Base & { filas?: number }) {
  const { id, error, valor } = useCampo(nombre, defecto);
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={requerido} className={className}>
      <textarea id={id} name={nombre} defaultValue={valor} rows={filas} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, ayuda, error)} />
    </Envoltura>
  );
}

export function Selector({ nombre, etiqueta, ayuda, defecto, requerido, className, opciones, vacio }: Base & { opciones: { valor: string; texto: string; grupo?: string }[]; vacio?: string }) {
  const { id, error, valor } = useCampo(nombre, defecto);
  const grupos = [...new Set(opciones.map((o) => o.grupo ?? ''))];
  const render = (os: typeof opciones) => os.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>);
  return (
    <Envoltura id={id} etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={requerido} className={className}>
      <select id={id} name={nombre} defaultValue={valor} required={requerido} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, ayuda, error)}>
        {vacio !== undefined && <option value="">{vacio}</option>}
        {grupos.length > 1
          ? grupos.map((g) => <optgroup key={g} label={g}>{render(opciones.filter((o) => (o.grupo ?? '') === g))}</optgroup>)
          : render(opciones)}
      </select>
    </Envoltura>
  );
}

export function Casilla({ nombre, etiqueta, ayuda, defecto }: { nombre: string; etiqueta: ReactNode; ayuda?: ReactNode; defecto?: boolean }) {
  const estado = useEstadoForm();
  const id = useId();
  const marcado = estado?.valores ? estado.valores[nombre] === 'on' : !!defecto;
  const error = estado?.campos?.[nombre];
  return (
    <div className="campo">
      <label className="casilla" htmlFor={id}>
        <input type="checkbox" id={id} name={nombre} defaultChecked={marcado} />
        <span>{etiqueta}{ayuda && <span className="ayuda" style={{ display: 'block' }}>{ayuda}</span>}</span>
      </label>
      {error && <span className="error">{error}</span>}
    </div>
  );
}

export function Radios({ nombre, etiqueta, opciones, defecto }: { nombre: string; etiqueta: string; opciones: { valor: string; texto: ReactNode }[]; defecto?: string }) {
  const estado = useEstadoForm();
  const valor = estado?.valores?.[nombre] ?? defecto;
  const error = estado?.campos?.[nombre];
  return (
    <fieldset className="campo">
      <legend className="etiqueta" style={{ fontSize: 'var(--texto-s)', fontWeight: 500, marginBottom: 6 }}>{etiqueta}</legend>
      <div className="radios">
        {opciones.map((o) => (
          <label key={o.valor}><input type="radio" name={nombre} value={o.valor} defaultChecked={valor === o.valor} /> {o.texto}</label>
        ))}
      </div>
      {error && <span className="error">{error}</span>}
    </fieldset>
  );
}

export function Enviar({ children, className = 'boton boton--principal', pendiente = 'Guardando…', nombre, valor }: { children: ReactNode; className?: string; pendiente?: string; nombre?: string; valor?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending} name={nombre} value={valor}>
      {pending ? pendiente : children}
    </button>
  );
}

export function CampoArchivo({ nombre, etiqueta, ayuda, accept, multiple }: { nombre: string; etiqueta: string; ayuda?: ReactNode; accept?: string; multiple?: boolean }) {
  const estado = useEstadoForm();
  const id = useId();
  const error = estado?.campos?.[nombre];
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input id={id} name={nombre} type="file" accept={accept} multiple={multiple} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, ayuda, error)} capture={undefined} />
      {ayuda && <span className="ayuda" id={`${id}-ayuda`}>{ayuda}</span>}
      {error && <span className="error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}
