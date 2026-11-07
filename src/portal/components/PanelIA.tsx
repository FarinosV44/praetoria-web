'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChatVivo, type OpcionesIA } from './ChatVivo';
import { ConCitas, type Cita } from './ConCitas';

type Turno = { texto: string; citas: Cita[]; limites: string[]; modelo: string };

/** Panel lateral del asistente: consultar el expediente sin salir de la pantalla. La conversación queda guardada en el asunto. */
export function PanelIA({ solicitud, opciones }: { solicitud: string; opciones: OpcionesIA }) {
  const [abierto, setAbierto] = useState(false);
  const [hilo, setHilo] = useState<string | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  useEffect(() => {
    const abrir = () => setAbierto(true);
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('abrir-panel-ia', abrir);
    window.addEventListener('keydown', tecla);
    return () => { window.removeEventListener('abrir-panel-ia', abrir); window.removeEventListener('keydown', tecla); };
  }, []);
  return (
    <>
      <button type="button" className="btn-texto font-semibold" onClick={() => setAbierto(true)} data-abrir-panel-ia>Preguntar a la IA</button>
      {abierto ? (
        <aside className="panel-lateral" aria-label="Asistente del expediente" data-panel-ia>
          <div className="fila mb-2">
            <h2 className="font-semibold">Asistente del expediente</h2>
            <span className="flex gap-3 items-center text-sm">
              <Link href={`/admin/expedientes/${solicitud}/asistente/${hilo ? `?hilo=${hilo}` : ''}`}>Ampliar</Link>
              <button type="button" className="btn-texto" onClick={() => setAbierto(false)} aria-label="Cerrar el asistente">Cerrar</button>
            </span>
          </div>
          <ol className="cronologia flex-1 overflow-y-auto" aria-live="polite">
            {turnos.length === 0 ? <li className="evento-linea">Solo usa lo que consta en este expediente y la biblioteca aprobada, con citas a cada fuente.</li> : null}
            {turnos.map((t, i) => (
              <li key={i} className="burbuja burbuja-documento" data-ia="asistente">
                <p className="meta">Asistente · {t.modelo} (borrador, revísalo)</p>
                <ConCitas texto={t.texto} citas={t.citas} />
                {t.limites.length ? <ul className="text-xs mt-1">{t.limites.map((l, n) => <li key={n}>⚠️ {l}</li>)}</ul> : null}
              </li>
            ))}
          </ol>
          <ChatVivo compacto solicitud={solicitud} hilo={hilo} opciones={opciones} alTerminar={({ hilo: h, resultado }) => {
            setHilo(h);
            if (resultado) setTurnos((l) => [...l, { texto: resultado.texto, citas: resultado.citas, limites: resultado.limites, modelo: resultado.modelo }]);
          }} />
        </aside>
      ) : null}
    </>
  );
}
