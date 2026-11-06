// Iconos lineales propios (trazo 1,75, currentColor). Sin iconografía romana: solo pictogramas funcionales.
import type { SVGProps } from 'react';

const Svg = ({ children, ...p }: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);

export const ICONOS_RAMO: Record<string, () => React.JSX.Element> = {
  coche: () => <Svg><path d="M5 16h14v-4l-2-5H7l-2 5v4Z" /><path d="M5 12h14" /><circle cx="8" cy="16.5" r="1.5" /><circle cx="16" cy="16.5" r="1.5" /><path d="M5 16v2M19 16v2" /></Svg>,
  hogar: () => <Svg><path d="M4 11 12 4l8 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></Svg>,
  negocio: () => <Svg><path d="M4 20V9l5 3V9l5 3V5h6v15H4Z" /><path d="M8 16h1M12 16h1M16 16h1M16 9h1" /></Svg>,
  salud: () => <Svg><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></Svg>,
  vida: () => <Svg><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></Svg>,
  accidentes: () => <Svg><path d="M12 4 3 19h18L12 4Z" /><path d="M12 10v4M12 16.5v.5" /></Svg>,
  rc: () => <Svg><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></Svg>,
  transporte: () => <Svg><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.5" /><circle cx="17" cy="17.5" r="1.5" /></Svg>,
  defensa: () => <Svg><path d="M12 4v16M7 20h10" /><path d="M5 8h14" /><path d="m5 8-2.5 6h5L5 8ZM19 8l-2.5 6h5L19 8Z" /></Svg>,
  otros: () => <Svg><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></Svg>,
};

export function IconoRamo({ icono, etiqueta }: { icono: string; etiqueta?: string }) {
  const I = ICONOS_RAMO[icono] ?? ICONOS_RAMO.otros!;
  return <span className="icono-ramo" title={etiqueta}><I /></span>;
}

export const IconoPolizas = () => <Svg><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></Svg>;
export const IconoPagos = () => <Svg><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 15h4" /></Svg>;
export const IconoTitulares = () => <Svg><path d="M4 20V8l8-4 8 4v12" /><path d="M9 20v-6h6v6M4 20h16" /></Svg>;
export const IconoAjustes = () => <Svg><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></Svg>;
export const IconoMas = () => <Svg><path d="M12 5v14M5 12h14" /></Svg>;
export const IconoTelefono = () => <Svg><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></Svg>;
export const IconoDocumento = () => <Svg><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5" /></Svg>;
export const IconoSubir = () => <Svg><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></Svg>;
export const IconoSalir = () => <Svg><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></Svg>;
export const IconoAvisos = () => <Svg><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20a2 2 0 0 0 4 0" /></Svg>;
export const IconoSiniestros = () => <Svg><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M12 7.5v6M12 16.5v.5" /></Svg>;
