// Iconos en línea (sin dependencias externas)
// Familia de iconos de línea (#28): rejilla de 24, trazo 1.75, extremos redondeados. Sin mazos ni balanzas.
// Decorativos por defecto (aria-hidden); la acción siempre lleva texto visible.
const LINEA: Record<string, string> = {
  ruta: 'M3 17h2.5a2.5 2.5 0 0 0 0-5H5a2.5 2.5 0 0 1 0-5h9 M14 7l3-3 M14 7l3 3 M17 17h4 M5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z M19 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  camion: 'M2 6h11v9H2z M13 9h4l3 3v3h-7 M6 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M17 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  maletin: 'M3 8h18v11H3z M8 8V5h8v3 M3 13h18 M11 13v2h2v-2',
  trabajo: 'M4 7h16v13H4z M9 7V4h6v3 M12 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M8 17c.6-2 2.1-3 4-3s3.4 1 4 3',
  hacienda: 'M3 10 12 4l9 6 M5 10v8 M10 10v8 M14 10v8 M19 10v8 M3 20h18',
  vivienda: 'M3 11 12 4l9 7 M5 10v10h14V10 M10 20v-5h4v5',
  familia: 'M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M16 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M3 20v-3a5 5 0 0 1 10 0 M11 20v-3a5 5 0 0 1 10 0 M12 14a2 2 0 1 0 0-4',
  arte: 'M4 4h16v16H4z M4 15l4-4 4 4 3-3 5 5 M15.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  objetivo: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 12h.01 M16 8l4-4 M17 4h3v3',
  analisis: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z M15.5 15.5 21 21 M7.5 12l2-2 1.5 1.5L14 8.5',
  estrategia: 'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M7 17h5a3 3 0 0 0 3-3v-1a3 3 0 0 1 3-3 M4 5l3 3 M7 5 4 8 M17 15l3 3 M20 15l-3 3',
  negociar: 'M3 10l4-4 4 2 3-2 7 6 M3 10l6 6 2-1 2 2 2-1 2 1 3-3 M11 8l-3 3 1.5 1.5L13 10',
  acompanar: 'M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z M8.5 12l2.5 2.5 4.5-5',
  documento: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6',
  reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2',
  euro: 'M18 7a7 7 0 1 0 0 10 M4 10h9 M4 14h9',
  edificio: 'M5 21V4h10v17 M15 9h4v12 M8 8h1 M11 8h1 M8 12h1 M11 12h1 M8 16h1 M11 16h1 M3 21h18',
  flecha: 'M5 12h14 M13 6l6 6-6 6',
  check: 'M5 12.5 10 17.5 19 7',
  correo: 'M3 5h18v14H3z M3 7l9 6 9-6',
};
export type LineIcon = keyof typeof LINEA;

/** Icono de línea de la familia de Praetoria. `label` solo si el icono transmite información por sí solo. */
export function LineIcon({ name, label, className }: { name: LineIcon; label?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ? `licon ${className}` : 'licon'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: 'false' })}
    >
      {LINEA[name]!.split(' M').map((d, i) => (
        <path key={i} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}

export type IconName = 'whatsapp' | 'phone' | 'mail' | 'pin' | 'linkedin' | 'chevron';

export function Icon({ name }: { name: IconName }) {
  switch (name) {
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.23 8.23 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06a6.7 6.7 0 0 1-3.35-2.92c-.25-.43.25-.4.72-1.34.08-.16.04-.3-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48a.92.92 0 0 0-.67.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74 1.58.68 2.2.74 2.99.62.48-.07 1.47-.6 1.68-1.18.2-.58.2-1.08.14-1.18-.06-.11-.23-.17-.48-.29Z"/></svg>
      );
    case 'phone':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>
      );
    case 'mail':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
      );
    case 'pin':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/></svg>
      );
    case 'chevron':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      );
  }
}
