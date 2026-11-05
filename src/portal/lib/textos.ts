// Textos y etiquetas compartidos (cliente y servidor). Lenguaje claro, sin jerga.
export const VERSION_PRIVACIDAD = '2026-10-27';

export const estadoSolicitud: Record<string, { etiqueta: string; explicacion: string; tono: 'neutro' | 'info' | 'ok' | 'aviso' }> = {
  borrador: { etiqueta: 'Borrador', explicacion: 'Todavía no la has enviado. Puedes continuar cuando quieras.', tono: 'neutro' },
  enviada: { etiqueta: 'Recibida, pendiente de revisión', explicacion: 'La hemos recibido. Un profesional del despacho la revisará.', tono: 'info' },
  en_revision: { etiqueta: 'En revisión', explicacion: 'Un profesional del despacho está estudiando tu solicitud.', tono: 'info' },
  aceptada: { etiqueta: 'Aceptada: expediente abierto', explicacion: 'El despacho ha aceptado el encargo y ha abierto un expediente.', tono: 'ok' },
  no_aceptada: { etiqueta: 'No aceptada', explicacion: 'El despacho no puede hacerse cargo de este asunto.', tono: 'aviso' },
  archivada: { etiqueta: 'Archivada', explicacion: 'Esta solicitud está archivada.', tono: 'neutro' },
};

export const estadoRequisito: Record<string, { etiqueta: string; tono: 'neutro' | 'info' | 'ok' | 'aviso' }> = {
  pendiente: { etiqueta: 'Pendiente de aportar', tono: 'neutro' },
  recibido: { etiqueta: 'Documento recibido', tono: 'info' },
  en_revision: { etiqueta: 'En revisión', tono: 'info' },
  validado: { etiqueta: 'Documento validado', tono: 'ok' },
  subsanacion: { etiqueta: 'Necesita subsanación', tono: 'aviso' },
  no_aplicable: { etiqueta: 'No aplicable', tono: 'neutro' },
};

export const estadoDocumento: Record<string, string> = {
  pendiente: 'Pendiente de revisar',
  valido: 'Válido',
  rechazado: 'Hay que sustituirlo',
};

export function textoEvento(tipo: string, d: Record<string, unknown>): string {
  const t = typeof d.titulo === 'string' ? `«${d.titulo}»` : '';
  switch (tipo) {
    case 'solicitud_enviada': return 'Solicitud enviada al despacho';
    case 'estado_solicitud': return `Estado: ${estadoSolicitud[String(d.a)]?.etiqueta ?? d.a}`;
    case 'estado_visible': return `Nota del despacho: ${d.texto}`;
    case 'documento_solicitado': return `El despacho pide un documento: ${t}`;
    case 'requisito_actualizado': return `${t}: ${estadoRequisito[String(d.a)]?.etiqueta ?? d.a}${d.comentario ? ` — ${d.comentario}` : ''}`;
    case 'documento_aportado': return `Documento aportado en ${t} (versión ${d.version})`;
    case 'documento_revisado': return `Documento de ${t} revisado: ${estadoDocumento[String(d.a)] ?? d.a}`;
    case 'mensaje': return d.del_despacho ? 'Mensaje del despacho' : 'Mensaje del cliente';
    case 'expediente_abierto': return 'Expediente abierto';
    case 'expediente_cerrado': return 'Expediente cerrado';
    case 'expediente_reabierto': return 'Expediente reabierto';
    case 'documento_eliminado': return `Documento «${d.archivo}» enviado a la papelera${d.motivo ? ` (${d.motivo})` : ''}`;
    case 'documento_restaurado': return `Documento «${d.archivo}» restaurado de la papelera`;
    case 'documento_purgado': return `Documento «${d.archivo}» borrado definitivamente (más de 30 días en la papelera)`;
    case 'responsable_asignado': return d.nombre_responsable ? `Responsable: ${d.nombre_responsable}` : 'Responsable asignado';
    case 'asignacion': return `${d.nombre_empleado ?? 'Un profesional'} se incorpora al asunto${d.papel === 'suplente' ? ' como suplente' : ''}`;
    case 'asignacion_retirada': return `${d.nombre_empleado ?? 'Un profesional'} deja el asunto`;
    case 'tarea_encargada': return `Tarea «${d.tarea}» encargada a ${d.nombre_a ?? 'otro profesional'}`;
    case 'tarea_reasignada': return `Tarea «${d.tarea}» reasignada a ${d.nombre_a ?? 'otro profesional'}`;
    case 'tarea_reprogramada': return `«${d.tarea}» pasa del ${fecha(String(d.desde))} al ${fecha(String(d.hasta))}${d.verificacion_anulada ? ' — hay que volver a verificar el plazo' : ''}`;
    case 'plazo_verificado': return `Plazo «${d.tarea}» verificado para el ${fecha(String(d.fecha))}`;
    case 'tarea_completada': return `Tarea «${d.tarea}» hecha${d.resultado ? ` — ${d.resultado}` : ''}`;
    case 'conflictos_revisados': return 'Revisión de conflictos de intereses registrada';
    case 'documento_descargado': return 'Documento descargado';
    case 'documento_compartido': return `El despacho ha compartido un documento: «${d.archivo}»`;
    case 'documento_analizado': return 'Análisis antivirus registrado';
    default: return tipo;
  }
}

export const fecha = (d: Date | string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(d));
