import type { Situacion } from '@/seguros/lib/datos/panel';
import { textoDias } from '@/seguros/lib/fechas';

const TEXTO: Record<Situacion, string> = {
  vigente: 'Vigente',
  proxima: 'Vence pronto',
  vencida: 'Vencida',
  sin_fecha: 'Sin fecha confirmada',
  negociacion: 'En negociación',
  anulada: 'Anulada',
  sustituida: 'Sustituida',
};

export function Estado({ situacion }: { situacion: Situacion }) {
  return <span className={`estado estado--${situacion}`}>{TEXTO[situacion]}</span>;
}

export function Revisar() {
  return <span className="estado estado--revisar" title="Datos pendientes de revisar por una persona">Por revisar</span>;
}

export function Dias({ dias }: { dias: number | null }) {
  if (dias === null) return null;
  return <span className="linea-2">{textoDias(dias)}</span>;
}
