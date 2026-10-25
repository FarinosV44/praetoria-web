import { deca } from '@/lib/site';

// Bloque discreto de DeCA Profesional para artículos marcados con «deca» (#28).
// Logotipo oficial (copiado tal cual del repositorio de DeCA Profesional, sin recrearlo).
// Nunca en artículos sin el campo «deca»: lo decide PostPage.
export function DecaBloque({ tipo }: { tipo: 'guia' | 'herramienta' }) {
  return (
    <aside className="deca-bloque" aria-label="DeCA Profesional">
      <img src="/media/deca/deca-profesional-logo.png" alt="DeCA Profesional" width={400} height={54} loading="lazy" />
      <div>
        <p>
          {tipo === 'guia'
            ? 'Para generar, compartir y conservar el documento de control, el despacho recomienda DeCA Profesional, una herramienta pensada por y para el sector del transporte.'
            : 'Las capturas de este artículo son de DeCA Profesional, la herramienta para generar, compartir y conservar el documento de control que recomienda el despacho.'}
        </p>
        <p className="small muted">Servicio tecnológico independiente de los servicios jurídicos de Praetoria.</p>
      </div>
      <a className="btn btn--ghost" href={deca(tipo === 'guia' ? 'guia_blog' : 'articulo_producto')} rel="noopener">
        Conocer DeCA Profesional
      </a>
    </aside>
  );
}
