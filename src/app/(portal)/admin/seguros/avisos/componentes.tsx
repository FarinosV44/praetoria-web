import Link from 'next/link';
import type { AvisoLista } from '@/seguros/lib/datos/avisos';
import { diasEntre, fechaLarga, fechaMedia, hoyMadrid } from '@/seguros/lib/fechas';
import { IconoRamo } from '@/seguros/components/iconos';

export function tituloLista(a: Pick<AvisoLista, 'tipo' | 'referencia'>, hoy = hoyMadrid()) {
  const d = diasEntre(hoy, a.referencia);
  const cuando = d === 0 ? 'hoy' : d === 1 ? 'mañana' : d > 0 ? `en ${d} días` : `hace ${-d} días`;
  if (a.tipo === 'oposicion') return `Plazo para oponerse a la prórroga ${cuando}`;
  if (a.tipo === 'vencida') return `Venció ${cuando} sin renovación registrada`;
  return `Vence ${cuando}: momento de renegociar`;
}

const TEXTO_CANAL: Record<string, string> = { app: 'Aplicación', push: 'Notificación', correo: 'Correo' };
const TEXTO_ESTADO: Record<string, string> = { enviado: 'enviado', pendiente: 'pendiente', enviando: 'enviando', fallido: 'fallido', descartado: 'no necesario' };

/** Estado por canal. «Enviado» = aceptado por el proveedor; solo «leído» confirma que se abrió en la aplicación. */
export function Canales({ canales }: { canales: AvisoLista['canales'] }) {
  const vistos = new Map<string, AvisoLista['canales'][number]>();
  for (const c of canales) if (!vistos.has(c.canal)) vistos.set(c.canal, c); // el más reciente por canal
  const leido = canales.some((c) => c.leido);
  return (
    <div className="canales">
      {[...vistos.values()].filter((c) => c.canal !== 'app').map((c) => (
        <span key={c.canal} className={`estado estado--${c.estado === 'fallido' ? 'vencida' : c.estado === 'enviado' ? 'neutro' : 'proxima'}`} title={c.error ?? undefined}>
          {TEXTO_CANAL[c.canal]}: {TEXTO_ESTADO[c.estado] ?? c.estado}{c.estado === 'fallido' && c.error ? ` (${c.error.slice(0, 60)})` : ''}
        </span>
      ))}
      <span className={`estado estado--${leido ? 'vigente' : 'neutro'}`}>{leido ? 'Leído' : 'Sin leer'}</span>
    </div>
  );
}

export function ItemAviso({ a }: { a: AvisoLista }) {
  return (
    <li className="aviso-item">
      <IconoRamo icono={a.ramo_icono} />
      <div style={{ minWidth: 0 }}>
        <span className="tpoliza__titular">{a.titular}</span>
        <Link className="aviso-item__titulo" href={`/admin/seguros/avisos/${a.id}`} style={{ display: 'block' }}>{a.poliza}: {tituloLista(a)}</Link>
        <p className="linea-2">
          {a.tipo === 'oposicion' ? 'Fecha límite' : 'Vencimiento'}: {fechaLarga(a.referencia)} · {a.aseguradora}
          {a.estado === 'pospuesto' && a.pospuesto_hasta ? ` · pospuesto hasta el ${fechaMedia(a.pospuesto_hasta)}` : ''}
          {a.estado === 'en_negociacion' ? ' · en negociación' : a.estado === 'reconocido' ? ' · atendido' : a.estado === 'obsoleto' ? ' · ya no aplica' : ''}
        </p>
        <Canales canales={a.canales} />
      </div>
      <div className="acciones"><Link className="boton boton--peq" href={`/admin/seguros/avisos/${a.id}`}>Abrir</Link></div>
    </li>
  );
}
