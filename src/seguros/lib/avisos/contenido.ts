import { q1, type Db, pool } from '../db';
import { costeAnual, deCentimos, formatoImporte } from '../dinero';
import { diasEntre, fechaLarga, hoyMadrid } from '../fechas';

export type DatosAviso = {
  id: string; tipo: string; fecha: string; referencia: string; poliza_id: string; titular_id: string;
  titular: string; poliza: string; ramo: string; aseguradora: string; moneda: string; fin: string | null;
  prima_anual: string | null; importe_recibo: string | null; periodicidad: string | null;
  plazo_oposicion: string | null; plazo_oposicion_confirmado: boolean; plazo_oposicion_fuente: string | null;
};

export const datosAviso = (avisoId: string, db: Db = pool()) =>
  q1<DatosAviso>(
    `SELECT v.id, v.tipo, v.fecha, v.referencia, v.poliza_id, v.titular_id, t.nombre AS titular, p.nombre AS poliza, r.nombre AS ramo,
            p.aseguradora, p.moneda, a.fin, a.prima_anual, a.importe_recibo, a.periodicidad, a.plazo_oposicion,
            a.plazo_oposicion_confirmado, a.plazo_oposicion_fuente
       FROM avisos v JOIN polizas p ON p.id = v.poliza_id JOIN titulares t ON t.id = v.titular_id
       JOIN ramos r ON r.id = p.ramo_id JOIN anualidades a ON a.id = v.anualidad_id WHERE v.id = $1`, [avisoId], db,
  );

/** Titular breve del aviso (lo que se ve en el centro de avisos y en el correo). */
export function tituloAviso(d: DatosAviso, hoy = hoyMadrid()) {
  const dias = diasEntre(hoy, d.referencia);
  const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : dias > 0 ? `en ${dias} días` : `hace ${-dias} días`;
  switch (d.tipo) {
    case 'oposicion': return `Plazo para oponerse a la prórroga: ${fechaLarga(d.referencia)} (${cuando})`;
    case 'vencida': return `Venció el ${fechaLarga(d.referencia)} sin renovación registrada`;
    default: return `Vence el ${fechaLarga(d.referencia)} (${cuando}): momento de renegociar`;
  }
}

export function importeTexto(d: DatosAviso) {
  const c = costeAnual(d);
  return c ? `${formatoImporte(deCentimos(c.centimos), d.moneda)} al año${c.tipo === 'estimado' ? ' (estimado)' : ''}` : 'importe pendiente';
}

/** Texto de la notificación push. Por defecto discreto: no muestra titular, importe ni aseguradora en la pantalla bloqueada. */
export function textoPush(d: DatosAviso, detallado: boolean) {
  if (!detallado) {
    return {
      title: 'PRAETORIA',
      body: d.tipo === 'oposicion' ? 'Se acerca un plazo para oponerse a una renovación.' : d.tipo === 'vencida' ? 'Hay una póliza vencida sin renovación registrada.' : 'Tienes una póliza que vence pronto.',
    };
  }
  return { title: `${d.poliza} · ${d.titular}`, body: `${tituloAviso(d)}. ${d.aseguradora}, ${importeTexto(d)}.` };
}

export function textoCorreo(d: DatosAviso, url: string) {
  const lineas = [
    tituloAviso(d),
    '',
    `Titular: ${d.titular}`,
    `Póliza: ${d.poliza} (${d.ramo})`,
    `Aseguradora: ${d.aseguradora}`,
    `Importe: ${importeTexto(d)}`,
    `Vencimiento: ${d.fin ? fechaLarga(d.fin) : 'pendiente'}`,
  ];
  if (d.plazo_oposicion) {
    lineas.push(d.plazo_oposicion_confirmado
      ? `Fecha límite para oponerse a la prórroga: ${fechaLarga(d.plazo_oposicion)} (fuente: ${d.plazo_oposicion_fuente})`
      : `Fecha límite para oponerse (sin comprobar en el contrato): ${fechaLarga(d.plazo_oposicion)}`);
  }
  lineas.push('', `Abrir y renegociar: ${url}`, '', '— PRAETORIA gestor de seguros');
  return { asunto: `${d.tipo === 'oposicion' ? 'Plazo de oposición' : d.tipo === 'vencida' ? 'Póliza vencida' : 'Renovación próxima'}: ${d.poliza}`, texto: lineas.join('\n') };
}
