'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { guardarPaso, type EstadoForm } from '../../acciones';

type S = { id: string; referencia: string; tipo_asunto_id: string | null; tipo_nombre: string | null; descripcion: string; fechas: string;
  localidad: string; contraparte: string; urgencia: string; contacto_preferido: string };
const titulos = ['Tipo de asunto', 'Qué ha pasado', 'Otros datos', 'Revisar y enviar'];

export function Asistente({ paso, maxPaso, s, tipos, docs }: { paso: number; maxPaso: number; s: S;
  tipos: { id: string; nombre: string; descripcion: string }[]; docs: { titulo: string; explicacion: string; obligatorio: boolean }[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoForm, FormData>(guardarPaso, {});
  return (
    <div className="max-w-2xl grid gap-4">
      <div>
        <p className="ayuda">Solicitud {s.referencia} · Paso {paso} de 4</p>
        <h1 className="titulo">{titulos[paso - 1]}</h1>
        <ol className="flex gap-2 mt-3" aria-label="Pasos">
          {titulos.map((t, i) => (
            <li key={t} className="flex-1">
              {i + 1 <= maxPaso && i + 1 !== paso ? (
                <Link href={`?paso=${i + 1}`} className="block h-2 rounded-full" style={{ background: 'var(--color-ink-2)' }} aria-label={`Ir al paso ${i + 1}: ${t}`} />
              ) : (
                <span className="block h-2 rounded-full" style={{ background: i + 1 <= paso ? 'var(--color-red)' : 'var(--color-stone-2)' }} aria-current={i + 1 === paso ? 'step' : undefined}>
                  <span className="sr-only">{t}</span>
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
      <form action={accion} className="card">
        <input type="hidden" name="id" value={s.id} />
        <input type="hidden" name="paso" value={paso} />
        {estado.error ? <p className="error mb-4" role="alert">{estado.error}</p> : null}

        {paso === 1 ? (
          <fieldset>
            <legend className="mb-3">¿Con qué necesitas ayuda? Elige lo que más se parezca; no hace falta que sepas el nombre técnico.</legend>
            <div className="grid gap-2">
              {tipos.map((t) => (
                <label key={t.id} className="card flex gap-3 items-start" style={{ padding: 14, margin: 0 }}>
                  <input type="radio" name="tipo_asunto_id" value={t.id} defaultChecked={s.tipo_asunto_id === t.id} required className="mt-1 size-5" />
                  <span><strong>{t.nombre}</strong><br /><span className="ayuda">{t.descripcion}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {paso === 2 ? (
          <>
            <div className="campo">
              <label htmlFor="descripcion">Cuéntanos qué ha pasado</label>
              <textarea id="descripcion" name="descripcion" defaultValue={s.descripcion} maxLength={4000} rows={7} />
              <span className="ayuda">Con tus palabras. No incluyas datos de salud ni números de documentos de identidad: si los necesitamos, te los pediremos por aquí.</span>
            </div>
            <div className="campo">
              <label htmlFor="fechas">Fechas importantes (aproximadas)</label>
              <input id="fechas" name="fechas" defaultValue={s.fechas} maxLength={300} placeholder="Por ejemplo: me entregaron la carta el 20 de octubre" />
            </div>
            <div className="campo">
              <label htmlFor="localidad">Localidad</label>
              <input id="localidad" name="localidad" defaultValue={s.localidad} maxLength={120} autoComplete="address-level2" />
            </div>
          </>
        ) : null}

        {paso === 3 ? (
          <>
            <div className="campo">
              <label htmlFor="contraparte">¿Quién es la otra parte? (empresa o persona)</label>
              <input id="contraparte" name="contraparte" defaultValue={s.contraparte} maxLength={300} />
              <span className="ayuda">Lo necesitamos para comprobar que no representamos ya a la otra parte (conflicto de intereses).</span>
            </div>
            <fieldset className="campo">
              <legend className="etiqueta">¿Es urgente?</legend>
              <label className="flex gap-2 items-center"><input type="radio" name="urgencia" value="normal" defaultChecked={s.urgencia !== 'urgente'} className="size-5" /> No especialmente</label>
              <label className="flex gap-2 items-center"><input type="radio" name="urgencia" value="urgente" defaultChecked={s.urgencia === 'urgente'} className="size-5" /> Sí, hay un plazo cercano</label>
            </fieldset>
            <fieldset className="campo">
              <legend className="etiqueta">¿Cómo prefieres que contactemos contigo?</legend>
              {[['portal', 'Por mensajes en esta área'], ['correo', 'Por correo electrónico'], ['telefono', 'Por teléfono']].map(([v, t]) => (
                <label key={v} className="flex gap-2 items-center"><input type="radio" name="contacto_preferido" value={v} defaultChecked={s.contacto_preferido === v} className="size-5" /> {t}</label>
              ))}
            </fieldset>
          </>
        ) : null}

        {paso === 4 ? (
          <>
            <dl className="grid gap-3 mb-5">
              <div><dt className="etiqueta">Tipo de asunto</dt><dd>{s.tipo_nombre} <Link href="?paso=1">Cambiar</Link></dd></div>
              <div><dt className="etiqueta">Qué ha pasado</dt><dd className="whitespace-pre-wrap">{s.descripcion || '—'} <Link href="?paso=2">Cambiar</Link></dd></div>
              <div><dt className="etiqueta">Otra parte</dt><dd>{s.contraparte || '—'} <Link href="?paso=3">Cambiar</Link></dd></div>
            </dl>
            {docs.length ? (
              <div className="mb-5">
                <h2 className="subtitulo">Documentación que te pediremos</h2>
                <p className="ayuda mb-2">Cuando envíes la solicitud podrás subirla desde el móvil o el ordenador. El abogado puede ajustar la lista a tu caso.</p>
                <ul className="list-disc pl-5 grid gap-1">
                  {docs.map((d) => <li key={d.titulo}><strong>{d.titulo}</strong>{d.obligatorio ? '' : ' (si lo tienes)'}: <span className="ayuda">{d.explicacion}</span></li>)}
                </ul>
              </div>
            ) : null}
            <p className="nota mb-4">Enviar la solicitud no supone que Praetoria acepte el encargo. La revisaremos y te diremos si podemos ayudarte.</p>
            <label className="flex gap-3 items-start mb-4">
              <input type="checkbox" name="confirmo" className="mt-1 size-5" />
              <span>Confirmo que la información es correcta.</span>
            </label>
          </>
        ) : null}

        <div className="flex flex-wrap gap-3 mt-2">
          <button className="btn btn-primario" disabled={pendiente}>{paso === 4 ? 'Enviar solicitud' : 'Guardar y continuar'}</button>
          <button className="btn btn-secundario" name="salir" value="1" formNoValidate disabled={pendiente}>Guardar borrador y salir</button>
        </div>
      </form>
    </div>
  );
}
