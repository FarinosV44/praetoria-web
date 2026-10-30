'use client';

// Calculadora orientativa de la indemnización por despido. Todo el cálculo ocurre en el navegador:
// no se envía ni se guarda ningún dato.
import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { calcularIndemnizacion, type ResultadoIndemnizacion, type TipoDespido } from '@/lib/indemnizacion';
import { mensajes, whatsapp } from '@/lib/site';

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const num = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
const fecha = (s: string) => {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

export function CalculadoraDespido() {
  const id = useId();
  const [resultado, setResultado] = useState<ResultadoIndemnizacion | null>(null);
  const [error, setError] = useState('');
  const [tipo, setTipo] = useState<TipoDespido>('improcedente');

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const salario = Number(String(d.get('salario') ?? '').replace(/\./g, '').replace(',', '.'));
    const r = calcularIndemnizacion({
      inicio: String(d.get('inicio') ?? ''),
      fin: String(d.get('fin') ?? ''),
      salarioAnual: salario,
      tipo,
    });
    if ('error' in r) {
      setError(r.error);
      setResultado(null);
      return;
    }
    setError('');
    setResultado(r);
  };

  return (
    <div className="calc">
      <form className="form calc__form" noValidate onSubmit={onSubmit} aria-describedby={`${id}-nota`}>
        <fieldset className="field">
          <legend>Tipo de despido</legend>
          <div className="radios">
            <label>
              <input type="radio" name="tipo" value="improcedente" checked={tipo === 'improcedente'} onChange={() => setTipo('improcedente')} />
              Improcedente (33 días por año)
            </label>
            <label>
              <input type="radio" name="tipo" value="objetivo" checked={tipo === 'objetivo'} onChange={() => setTipo('objetivo')} />
              Objetivo (20 días por año)
            </label>
          </div>
        </fieldset>
        <div className="calc__fila">
          <div className="field">
            <label htmlFor={`${id}-inicio`}>Fecha de inicio del contrato</label>
            <input id={`${id}-inicio`} name="inicio" type="date" required />
          </div>
          <div className="field">
            <label htmlFor={`${id}-fin`}>Fecha del despido</label>
            <input id={`${id}-fin`} name="fin" type="date" required />
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${id}-salario`}>Salario bruto anual, con pagas extra (€)</label>
          <input id={`${id}-salario`} name="salario" type="text" inputMode="decimal" placeholder="Por ejemplo, 24000" required />
        </div>
        <p className="small muted" id={`${id}-nota`}>
          El cálculo se hace en tu navegador: no enviamos ni guardamos ningún dato.
        </p>
        {error && (
          <p className="calc__error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--red" type="submit">
          Calcular indemnización
        </button>
      </form>

      <div className="calc__resultado" aria-live="polite">
        {resultado && (
          <>
            <p className="calc__etiqueta">Indemnización orientativa</p>
            <p className="calc__importe">{euros.format(resultado.importe)}</p>
            <p>
              {num.format(resultado.dias)} días de salario × {euros.format(resultado.salarioDiario)} de salario diario
              {resultado.topeAplicado && <> (se aplica el tope legal de {num.format(resultado.tope)} días)</>}.
            </p>
            <ul className="calc__tramos">
              {resultado.tramos.map((t) => (
                <li key={t.desde}>
                  Del {fecha(t.desde)} al {fecha(t.hasta)}: {t.meses} meses a {t.diasPorAno} días por año ={' '}
                  {num.format(t.dias)} días
                </li>
              ))}
            </ul>
            <p className="small muted">
              Es una estimación. El convenio, los complementos variables o un salario mal calculado en la carta pueden cambiar
              la cifra, y el plazo para impugnar el despido es de solo 20 días hábiles.
            </p>
            <div className="actions">
              <Link className="btn btn--red" href="/contacto/?servicio=laboral-despidos">
                Revisar mi despido con el área laboral
              </Link>
              <a className="btn" href={whatsapp(mensajes.laboral, 'laboral')}>
                WhatsApp del área laboral
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
