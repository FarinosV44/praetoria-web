'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { crearCliente, reenviarInvitacion, type ResultadoAlta } from '@/app/(portal)/admin/clientes/acciones';

function EnlaceUnaVez({ enlace, correo }: { enlace: string; correo?: ResultadoAlta['correo'] }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="nota grid gap-2" role="status">
      {correo === 'enviado' ? <p>Hemos enviado al cliente un correo con su enlace de activación (válido 7 días, un solo uso).</p> : null}
      {correo === 'fallido' ? <p><strong>No se pudo enviar el correo.</strong> Entrégale el enlace por un canal privado.</p> : null}
      <p className="text-sm">Enlace de activación (se muestra solo ahora; no lo pegues en grupos ni lo guardes):</p>
      <div className="flex gap-2">
        <input readOnly value={enlace} className="border rounded-md p-2 flex-1 min-w-0 text-xs" aria-label="Enlace de activación" data-enlace-activacion />
        <button type="button" className="btn btn-secundario" style={{ minHeight: 36 }}
          onClick={async () => { await navigator.clipboard.writeText(enlace).catch(() => {}); setCopiado(true); }}>{copiado ? 'Copiado' : 'Copiar'}</button>
      </div>
      <p className="ayuda text-xs">El cliente elige su propia contraseña. Nunca le envíes una contraseña.</p>
    </div>
  );
}

export function FormAltaCliente() {
  const [estado, accion, pendiente] = useActionState<ResultadoAlta, FormData>(crearCliente, {});
  const [tipo, setTipo] = useState('particular');
  if (estado.cliente) {
    return (
      <div className="grid gap-3">
        <p className="exito" role="status">Cliente dado de alta.</p>
        {estado.enlace ? <EnlaceUnaVez enlace={estado.enlace} correo={estado.correo} /> : null}
        <p className="flex gap-3 flex-wrap">
          {estado.expediente ? <Link className="btn btn-primario" href={`/admin/expedientes/${estado.expediente}/`}>Abrir el expediente</Link> : null}
          <Link className="btn btn-secundario" href={`/admin/clientes/${estado.cliente}/`}>Ver su ficha</Link>
        </p>
      </div>
    );
  }
  return (
    <form action={accion} className="grid gap-1">
      {estado.error ? <p className="error mb-3" role="alert">{estado.error}{estado.existente ? <> <a href={`/admin/expedientes/nuevo/?cliente=${estado.existente}`} className="font-semibold">Abrir un expediente para este cliente</a> · <a href={`/admin/clientes/${estado.existente}/`}>Ver su ficha</a></> : null}</p> : null}
      <div className="campo"><label htmlFor="ac-nombre">Nombre y apellidos</label><input id="ac-nombre" name="nombre" required maxLength={120} autoComplete="off" /></div>
      <div className="campo"><label htmlFor="ac-email">Correo electrónico del cliente</label><input id="ac-email" name="email" type="email" required maxLength={254} autoComplete="off" /></div>
      <fieldset className="flex gap-4 mb-3">
        <legend className="sr-only">Tipo de cliente</legend>
        <label className="flex gap-2 items-center"><input type="radio" name="tipo" value="particular" checked={tipo === 'particular'} onChange={() => setTipo('particular')} /> Particular</label>
        <label className="flex gap-2 items-center"><input type="radio" name="tipo" value="empresa" checked={tipo === 'empresa'} onChange={() => setTipo('empresa')} /> Empresa</label>
      </fieldset>
      {tipo === 'empresa' ? <div className="campo"><label htmlFor="ac-empresa">Empresa</label><input id="ac-empresa" name="empresa" maxLength={200} /></div> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="campo"><label htmlFor="ac-tel">Teléfono (opcional)</label><input id="ac-tel" name="telefono" type="tel" maxLength={20} /></div>
        <div className="campo"><label htmlFor="ac-nif">NIF/CIF (opcional)</label><input id="ac-nif" name="nif" maxLength={12} /></div>
      </div>
      <div className="campo"><label htmlFor="ac-asunto">Abrir expediente (opcional)</label>
        <input id="ac-asunto" name="asunto" maxLength={200} placeholder="Por ejemplo: Despido de octubre 2026" /></div>
      <label className="flex gap-2 items-center mb-4"><input type="checkbox" name="invitar" defaultChecked /> Enviarle ahora su invitación de acceso (elegirá su propia contraseña)</label>
      <button className="btn btn-primario" disabled={pendiente}>{pendiente ? 'Guardando…' : 'Dar de alta'}</button>
    </form>
  );
}

export function Reinvitar({ cliente }: { cliente: string }) {
  const [estado, accion, pendiente] = useActionState<ResultadoAlta, FormData>(reenviarInvitacion, {});
  if (estado.enlace) return <EnlaceUnaVez enlace={estado.enlace} correo={estado.correo} />;
  return (
    <form action={accion} className="flex flex-wrap gap-2 items-center">
      <input type="hidden" name="cliente" value={cliente} />
      <button className="btn btn-secundario" style={{ minHeight: 38 }} disabled={pendiente}>Enviar invitación de acceso</button>
      <button className="btn-texto" name="enviar" value="no" disabled={pendiente}>Solo generar el enlace</button>
      {estado.error ? <span className="error text-sm" role="alert">{estado.error}</span> : null}
    </form>
  );
}
