import proporcion from './marca-proporcion.json';

/** Logotipo horizontal (public/seguros/logo.svg, generado en FarinosV44/POLIZAS-SEGURO con `npm run marca`). */
export function Logo({ alto = 34, tono = 'claro', className }: { alto?: number; tono?: 'claro' | 'oscuro'; className?: string }) {
  return (
    <img
      src={tono === 'oscuro' ? '/seguros/logo-oscuro.svg' : '/seguros/logo.svg'}
      alt="PRAETORIA gestor de seguros"
      width={Math.round(alto * proporcion.logo)}
      height={alto}
      className={className}
    />
  );
}
