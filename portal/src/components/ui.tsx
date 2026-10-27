import { estadoRequisito, estadoSolicitud } from '@/lib/textos';

export function Chip({ tono, children }: { tono: 'neutro' | 'info' | 'ok' | 'aviso'; children: React.ReactNode }) {
  return <span className={`chip chip-${tono}`}>{children}</span>;
}
export function ChipSolicitud({ estado }: { estado: string }) {
  const e = estadoSolicitud[estado] ?? { etiqueta: estado, tono: 'neutro' as const };
  return <Chip tono={e.tono}>{e.etiqueta}</Chip>;
}
export function ChipRequisito({ estado }: { estado: string }) {
  const e = estadoRequisito[estado] ?? { etiqueta: estado, tono: 'neutro' as const };
  return <Chip tono={e.tono}>{e.etiqueta}</Chip>;
}

export function AvisoEntorno() {
  const entorno = process.env.PORTAL_ENTORNO || 'desarrollo';
  if (entorno === 'produccion') return null;
  return (
    <div role="note" style={{ background: '#22262a', color: '#fff' }} className="text-center text-sm py-2 px-4">
      Entorno de {entorno === 'staging' ? 'pruebas' : 'desarrollo'}: usa solo datos y documentos ficticios.
    </div>
  );
}

export function Progreso({ hechos, total, etiqueta }: { hechos: number; total: number; etiqueta: string }) {
  const pct = total ? Math.round((hechos / total) * 100) : 0;
  return (
    <div>
      <div className="fila mb-1"><span className="text-sm font-semibold">{etiqueta}</span><span className="text-sm">{hechos} de {total}</span></div>
      <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={hechos} aria-label={etiqueta}><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export const tamano = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
