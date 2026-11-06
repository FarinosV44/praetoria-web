export type Cita = { id: string; etiqueta: string; enlace?: string };

/** Texto con las citas [D1-p2] como enlaces a su fuente y los marcadores [PENDIENTE: …] resaltados. */
export function ConCitas({ texto, citas }: { texto: string; citas: Cita[] }) {
  const mapa = new Map(citas.map((c) => [c.id, c]));
  const partes = texto.split(/(\[(?:[NMTFPA]\d+|D\d+-p\d+)\]|\[PENDIENTE:[^\]]*\])/g);
  return (
    <p className="whitespace-pre-wrap">
      {partes.map((p, i) => {
        if (p.startsWith('[PENDIENTE:')) return <mark key={i} className="chip chip-aviso text-xs" data-pendiente>{p}</mark>;
        const c = mapa.get(p.slice(1, -1));
        if (!c) return <span key={i}>{p}</span>;
        return c.enlace ? <a key={i} href={c.enlace} target="_blank" rel="noopener" title={c.etiqueta} className="chip chip-info no-underline text-xs" data-cita={c.id}>{c.id}</a>
          : <span key={i} title={c.etiqueta} className="chip chip-neutro text-xs" data-cita={c.id}>{c.id}</span>;
      })}
    </p>
  );
}
