import type { Usuario } from '../../src/seguros/lib/auth/sesiones';
import { crearAnualidad, crearPoliza } from '../../src/seguros/lib/datos/polizas';
import { crearTitular } from '../../src/seguros/lib/datos/titulares';
import { subirDocumento } from '../../src/seguros/lib/datos/documentos';
import { crearSiniestro } from '../../src/seguros/lib/datos/siniestros';
import { crearComunicacion, crearModificacion, crearNota, actualizarDocumento, vincularDocumentoSiniestro } from '../../src/seguros/lib/datos/expediente';
import { guardarRecibo } from '../../src/seguros/lib/datos/recibos';
import { q, q1 } from '../../src/seguros/lib/db';
import { pdfSintetico } from './pdf-sintetico';
import { ramo } from './ayudas';

/**
 * Seguro antiguo SINTÉTICO (todo inventado): una póliza de oficina contratada en 2023 que se renueva cada año sin
 * póliza nueva, con su póliza original, condiciones generales, un suplemento, varios recibos, notas y un siniestro
 * con varias comunicaciones y una petición de documentación sin respuesta posterior.
 */
export async function seguroAntiguo(admin: Usuario, sufijo = String(Date.now())) {
  const titular = await crearTitular(admin, { tipo: 'empresa', nombre: `Comercial Inventada ${sufijo} S.L.` });
  const poliza = await crearPoliza(admin, {
    titular_id: titular, ramo_id: await ramo('hogar'), nombre: `Oficina calle Ficticia 1 (${sufijo})`, aseguradora: 'Mutua Inventada de Seguros',
    numero: `ANT-${sufijo}`, riesgo: 'Oficina en calle Ficticia 1', inicio: '2023-03-01', fin: '2024-03-01', prima_anual: '600,00', periodicidad: 'semestral', importe_recibo: '300,00',
  });
  const a2024 = await crearAnualidad(admin, poliza, { inicio: '2024-03-01', fin: '2025-03-01', prima_anual: '620,00', periodicidad: 'semestral', importe_recibo: '310,00' });
  await crearAnualidad(admin, poliza, { inicio: '2025-03-01', fin: '2026-03-01', prima_anual: '660,00', periodicidad: 'semestral', importe_recibo: '330,00' });
  const a2026 = await crearAnualidad(admin, poliza, { inicio: '2026-03-01', fin: '2027-03-01', prima_anual: '700,00', periodicidad: 'semestral', importe_recibo: '350,00',
    plazo_oposicion: '2027-01-29', plazo_oposicion_fuente: 'CG art. 22, pág. 1', plazo_oposicion_confirmado: 'on' });
  const a2023 = (await q1<{ id: string }>('SELECT id FROM anualidades WHERE poliza_id = $1 AND inicio = $2', [poliza, '2023-03-01']))!.id;

  const subir = async (tipo: string, nombre: string, paginas: string[], anualidadId: string | null, fecha: string | null) => {
    const r = await subirDocumento(admin, { polizaId: poliza, anualidadId, tipo, nombre, datos: pdfSintetico(paginas) });
    await actualizarDocumento(admin, poliza, r.id, { tipo, fecha_documento: fecha ?? '', descripcion: '', anualidad_id: anualidadId ?? '' });
    return r.id;
  };
  const docs = {
    original: await subir('condiciones_particulares', 'poliza-original-2023.pdf', [
      `CONDICIONES PARTICULARES (FICTICIAS)\nMutua Inventada de Seguros. Poliza ANT-${sufijo}\nTomador: Comercial Inventada S.L.\nEfecto 2023-03-01. Duracion anual prorrogable.\nContenido asegurado: 40.000 euros. Danos por agua: franquicia de 150 euros.`,
    ], a2023, '2023-02-20'),
    generales: await subir('condiciones_generales', 'condiciones-generales.pdf', [
      'CONDICIONES GENERALES (FICTICIAS)\nArticulo 9. Danos por agua: se cubren los danos por escape accidental de agua de conducciones fijas.\nArticulo 14. El asegurado debe comunicar el siniestro en el plazo de siete dias.\nArticulo 22. Las partes pueden oponerse a la prorroga con un mes de antelacion.',
    ], null, '2023-02-20'),
    suplemento: await subir('suplemento', 'suplemento-2025.pdf', [
      `SUPLEMENTO (FICTICIO) a la poliza ANT-${sufijo}\nCon efecto 2025-09-01 se amplia el contenido asegurado a 60.000 euros.`,
    ], null, '2025-08-20'),
    recibo2026: await subir('recibo', 'recibo-2026-03.pdf', ['RECIBO (FICTICIO) R-2026-1\nPeriodo 2026-03-01 a 2026-09-01. Importe 350,00 euros.'], a2026, '2026-02-15'),
    justificante2026: await subir('justificante_pago', 'cargo-banco-2026-03.pdf', ['EXTRACTO (FICTICIO)\nCargo Mutua Inventada recibo R-2026-1: 350,00 euros. Fecha valor 2026-03-02.'], a2026, '2026-03-02'),
    peticion: await subir('comunicacion', 'carta-peticion-documentacion.pdf', [
      'CARTA (FICTICIA) de Mutua Inventada, 2024-12-01\nRef. siniestro S-77. Para continuar la tramitacion necesitamos las facturas de reparacion y el informe del fontanero.',
    ], a2024, '2024-12-01'),
  };
  await crearModificacion(admin, poliza, { fecha_efecto: '2025-09-01', descripcion: 'Se amplía el contenido asegurado a 60.000 euros.', documento_id: docs.suplemento });

  // Recibos: pagos acreditados, uno devuelto y el próximo emitido.
  const r = (d: Record<string, string>) => guardarRecibo(admin, poliza, null, d);
  await r({ numero: 'R-2025-1', periodo_desde: '2025-03-01', periodo_hasta: '2025-09-01', fecha_cargo: '2025-03-01', fecha_pago: '2025-03-03', importe: '330,00', periodicidad: 'semestral', estado: 'pagado' });
  await r({ numero: 'R-2025-2', periodo_desde: '2025-09-01', periodo_hasta: '2026-03-01', fecha_cargo: '2025-09-01', fecha_pago: '2025-09-02', importe: '330,00', periodicidad: 'semestral', estado: 'pagado' });
  await r({ numero: 'R-2026-1', periodo_desde: '2026-03-01', periodo_hasta: '2026-09-01', fecha_cargo: '2026-03-01', fecha_pago: '2026-03-02', importe: '350,00', periodicidad: 'semestral', estado: 'pagado', documento_id: docs.recibo2026, justificante_id: docs.justificante2026 });
  await r({ numero: 'R-2026-2', periodo_desde: '2026-09-01', periodo_hasta: '2027-03-01', fecha_cargo: '2026-09-01', importe: '350,00', periodicidad: 'semestral', estado: 'devuelto' });

  await crearNota(admin, poliza, { fecha: '2024-12-10', texto: 'Llamé al mediador: dice que el perito vendrá la semana próxima.' });

  // Siniestro de 2024 (antes del suplemento) con varias comunicaciones.
  const siniestro = await crearSiniestro(admin, {
    titular_id: titular, titulo: 'Filtración de agua en la oficina', relato: 'Escape de agua de una tubería fija del baño que dañó el suelo y un armario.',
    fecha_hecho: '2024-11-10', fecha_conocimiento: '2024-11-10',
  }, poliza);
  await vincularDocumentoSiniestro(admin, poliza, docs.peticion, siniestro);
  const asunto = (await q1<{ id: string }>(`INSERT INTO asuntos (poliza_id, siniestro_id, tipo, titulo, creado_por) VALUES ($1,$2,'siniestro','Filtración de agua en la oficina',$3) RETURNING id`, [poliza, siniestro, admin.id]))!.id;
  await crearComunicacion(admin, poliza, { fecha: '2024-11-12', direccion: 'enviada', medio: 'correo', interlocutor: 'Mutua Inventada', asunto: 'Declaración del siniestro', resumen: 'Se declara la filtración del 10/11/2024.', asunto_id: asunto });
  await crearComunicacion(admin, poliza, { fecha: '2024-12-01', direccion: 'recibida', medio: 'carta', interlocutor: 'Mutua Inventada', asunto: 'Petición de documentación', resumen: 'Piden facturas de reparación e informe del fontanero.', documento_id: docs.peticion, asunto_id: asunto });
  await crearComunicacion(admin, poliza, { fecha: '2024-12-20', direccion: 'enviada', medio: 'correo', interlocutor: 'Mutua Inventada', asunto: 'Envío de documentación', resumen: 'Se envían las facturas; el informe del fontanero queda pendiente.', asunto_id: asunto });
  await q('UPDATE siniestro_polizas SET anualidad_id = $2 WHERE siniestro_id = $1 AND poliza_id = $3', [siniestro, a2024, poliza]);

  return { titular, poliza, siniestro, asunto, docs, anualidades: { a2023, a2024, a2026 } };
}
