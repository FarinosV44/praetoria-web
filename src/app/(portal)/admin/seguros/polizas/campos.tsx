import { Area, Campo, Casilla, Importe, Selector } from '@/seguros/components/formulario';
import { PERIODICIDADES } from '@/seguros/lib/dinero';
import type { Anualidad, Poliza, Ramo } from '@/seguros/lib/datos/polizas';
import type { Titular } from '@/seguros/lib/datos/titulares';

export function CamposPoliza({ titulares, ramos, p, titularInicial, conEstado = false }: {
  titulares: Titular[]; ramos: Ramo[]; p?: Poliza; titularInicial?: string; conEstado?: boolean;
}) {
  return (
    <>
      <fieldset>
        <legend>Póliza</legend>
        <div className="rejilla">
          <Selector
            nombre="titular_id" etiqueta="Titular" requerido vacio="Elige…"
            defecto={p?.titular_id ?? titularInicial}
            opciones={titulares.map((t) => ({ valor: t.id, texto: t.nombre, grupo: t.tipo === 'empresa' ? 'Empresas' : 'Particulares' }))}
            ayuda="Empresa o particular a cuyo nombre organizas esta póliza."
          />
          <Selector
            nombre="ramo_id" etiqueta="Tipo de seguro" requerido vacio="Elige…" defecto={p?.ramo_id}
            opciones={ramos.filter((r) => r.activo || r.id === p?.ramo_id).map((r) => ({ valor: r.id, texto: r.nombre }))}
          />
          <Campo nombre="nombre" etiqueta="Nombre de la póliza" requerido defecto={p?.nombre} placeholder="Ej.: Furgoneta de reparto, Nave de Paterna" ayuda="Cómo la reconocerás en el panel." />
          <Campo nombre="riesgo" etiqueta="Objeto asegurado" defecto={p?.riesgo} placeholder="Matrícula, dirección del inmueble, actividad…" />
          <Campo nombre="aseguradora" etiqueta="Aseguradora" requerido defecto={p?.aseguradora} autoComplete="organization" />
          <Campo nombre="numero" etiqueta="Número de póliza" defecto={p?.numero} ayuda="Déjalo vacío si aún no lo tienes." />
          {conEstado && (
            <Selector
              nombre="estado" etiqueta="Estado" defecto={p?.estado}
              opciones={[
                { valor: 'activa', texto: 'Activa' }, { valor: 'en_negociacion', texto: 'En negociación' },
                { valor: 'anulada', texto: 'Anulada' }, { valor: 'sustituida', texto: 'Sustituida por otra' },
              ]}
            />
          )}
          <Selector
            nombre="renovacion_automatica" etiqueta="¿Se renueva automáticamente?"
            defecto={p?.renovacion_automatica === true ? 'si' : p?.renovacion_automatica === false ? 'no' : ''}
            opciones={[{ valor: '', texto: 'No consta' }, { valor: 'si', texto: 'Sí, se prorroga' }, { valor: 'no', texto: 'No' }]}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>Contactos</legend>
        <div className="rejilla">
          <Campo nombre="mediador" etiqueta="Mediador o corredor" defecto={p?.mediador} />
          <Campo nombre="mediador_telefono" etiqueta="Teléfono del mediador" tipo="tel" inputMode="tel" defecto={p?.mediador_telefono} />
          <Campo nombre="mediador_email" etiqueta="Correo del mediador" tipo="email" inputMode="email" defecto={p?.mediador_email} />
          <Campo nombre="asistencia_telefono" etiqueta="Teléfono de asistencia / siniestros" tipo="tel" inputMode="tel" defecto={p?.asistencia_telefono} />
        </div>
      </fieldset>

      <details className="mas" open={!!(p?.tomador || p?.asegurado || p?.beneficiario || p?.notas || (p && p.moneda !== 'EUR'))}>
        <summary>Tomador, asegurado, beneficiario, moneda y notas</summary>
        <div className="rejilla">
          <Campo nombre="tomador" etiqueta="Tomador" defecto={p?.tomador} ayuda="Quien contrata y paga la póliza." />
          <Campo nombre="asegurado" etiqueta="Asegurado" defecto={p?.asegurado} ayuda="Persona o bien cubierto." />
          <Campo nombre="beneficiario" etiqueta="Beneficiario" defecto={p?.beneficiario} />
          <Campo nombre="moneda" etiqueta="Moneda" defecto={p?.moneda ?? 'EUR'} maxLength={3} ayuda="Código de tres letras: EUR, USD…" />
          <Area nombre="notas" etiqueta="Notas" defecto={p?.notas} className="ancho-completo" />
        </div>
      </details>
    </>
  );
}

export function CamposAnualidad({ a, titulo = 'Precio y vigencia' }: { a?: Partial<Anualidad>; titulo?: string }) {
  return (
    <fieldset>
      <legend>{titulo}</legend>
      <p className="secundario pequeno" style={{ marginTop: 'calc(-1 * var(--e-2))' }}>
        Si aún no conoces algún dato, déjalo vacío: quedará como pendiente y no se inventará.
      </p>
      <div className="rejilla-3">
        <Importe nombre="prima_anual" etiqueta="Prima anual total" defecto={a?.prima_anual?.replace('.', ',')} ayuda="Lo que cuesta el año completo, con impuestos." />
        <Selector nombre="periodicidad" etiqueta="Forma de pago" defecto={a?.periodicidad ?? ''} vacio="Pendiente" opciones={PERIODICIDADES.map((x) => ({ valor: x.valor, texto: x.texto }))} />
        <Importe nombre="importe_recibo" etiqueta="Importe de cada recibo" defecto={a?.importe_recibo?.replace('.', ',')} />
        <Campo nombre="inicio" etiqueta="Inicio (efecto)" tipo="date" defecto={a?.inicio} />
        <Campo nombre="fin" etiqueta="Vencimiento" tipo="date" defecto={a?.fin} ayuda="Fecha en que termina esta anualidad." />
        <div />
        <Campo nombre="plazo_oposicion" etiqueta="Fecha límite para oponerse a la prórroga" tipo="date" defecto={a?.plazo_oposicion} />
        <Campo nombre="plazo_oposicion_fuente" etiqueta="De dónde sale ese plazo" defecto={a?.plazo_oposicion_fuente} placeholder="Ej.: Cond. generales, art. 12, pág. 4" />
        <div className="campo" style={{ justifyContent: 'flex-end' }}>
          <Casilla nombre="plazo_oposicion_confirmado" etiqueta="Plazo comprobado en el contrato" defecto={a?.plazo_oposicion_confirmado} />
        </div>
      </div>
      <Area nombre="notas_anualidad" etiqueta="Notas de esta anualidad" defecto={a?.notas} filas={2} />
      <Casilla
        nombre="datos_confirmados" defecto={a?.datos_confirmados}
        etiqueta="He revisado estos datos con la documentación"
        ayuda="Mientras no lo marques, la póliza aparece como «Por revisar»."
      />
    </fieldset>
  );
}
