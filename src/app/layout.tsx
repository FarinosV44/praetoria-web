import type { ReactNode } from 'react';

// Raíz común de las dos zonas de la aplicación: la web pública, en (web), y el portal privado, en (portal).
// Cada zona carga sus propios estilos y su propia cabecera en su layout.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // El idioma del documento se ajusta en el build para los artículos en francés y árabe (scripts/postbuild.mjs)
    <html lang="es" suppressHydrationWarning>
      <body className="site-root">{children}</body>
    </html>
  );
}
