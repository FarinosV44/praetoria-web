import { deca } from '@/lib/site';

// Recomendación de DeCA Profesional (página de transporte y artículos de transporte).
export function DecaBand({ campaign = 'recomendacion_abogado' }: { campaign?: string }) {
  return (
    <div className="deca-root">
      <aside className="deca" aria-label="Herramienta para crear el DECA">
        <div>
          <h2>¿Necesitas crear el DECA de un transporte?</h2>
          <p>
            DECA Profesional sirve para generar, compartir y conservar el Documento Electrónico de Control Administrativo. Es una
            herramienta recomendada por el despacho, que conoce el sector del transporte desde dentro. Los 3 primeros DeCA son
            gratis, sin tarjeta.
          </p>
          <p className="small muted">DECA Profesional es un servicio tecnológico independiente de los servicios jurídicos del despacho.</p>
        </div>
        <a className="btn" href={deca(campaign)} rel="noopener">
          Crear un DECA gratis
        </a>
      </aside>
    </div>
  );
}
