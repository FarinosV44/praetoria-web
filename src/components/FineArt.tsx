import { site } from '@/lib/site';

/**
 * Praetoria Fine Art: la división de arte y patrimonio de Praetoria Abogados.
 * - Logotipo (rojo, fondo transparente): identifica la división dentro de sus páginas.
 * - Sello (blanco sobre rojo): botones, tarjetas y complementos.
 */
export const fineArt = {
  nombre: 'Praetoria Fine Art',
  descriptor: 'División de arte y patrimonio de Praetoria Abogados',
  logo: '/media/praetoria-fine-art.png',
  logoWebp: '/media/praetoria-fine-art.webp',
  sello: '/media/praetoria-fine-art-sello.png',
  selloWebp: '/media/praetoria-fine-art-sello.webp',
};

export function FineArtLogo({ className = 'fine-art-logo' }: { className?: string }) {
  return (
    <div className={className}>
      <picture>
        <source srcSet={fineArt.logoWebp} type="image/webp" />
        <img src={fineArt.logo} alt={fineArt.nombre} width={963} height={189} />
      </picture>
      <p className="fine-art-logo__descriptor">{fineArt.descriptor}</p>
    </div>
  );
}

/** Sello decorativo: el texto accesible lo pone siempre el enlace o el título que lo acompaña. */
export function FineArtSello({ className = 'fine-art-sello', lazy = true }: { className?: string; lazy?: boolean }) {
  return (
    <picture className={className}>
      <source srcSet={fineArt.selloWebp} type="image/webp" />
      <img src={fineArt.sello} alt="" width={1043} height={268} loading={lazy ? 'lazy' : undefined} />
    </picture>
  );
}

/** Datos estructurados de la división como servicio jurídico dependiente del despacho. */
export function fineArtLd(path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LegalService',
    '@id': `${site.url}${path}#praetoria-fine-art`,
    name: fineArt.nombre,
    description: 'Asesoramiento jurídico en arte y patrimonio: compraventa y cesión de obras, herencias con colecciones, atribución, procedencia, exportación y relación con museos y casas de subastas.',
    url: `${site.url}${path}`,
    logo: `${site.url}${fineArt.logo}`,
    image: `${site.url}${fineArt.sello}`,
    telephone: site.phoneIntl,
    email: site.email,
    areaServed: ['Valencia', 'España'],
    knowsAbout: ['Derecho del arte', 'Patrimonio cultural', 'Procedencia de obras de arte', 'Exportación de bienes culturales', 'Herencias con colecciones'],
    parentOrganization: { '@type': 'LegalService', name: site.name, url: site.url },
  };
}
