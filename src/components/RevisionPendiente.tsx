// Aviso de revisión jurídica pendiente (#32). Solo en la previsualización (build no indexable):
// en producción no se muestra, y la puerta `node scripts/servicios/matriz.mjs --produccion` impide llegar ahí sin revisar.
export function RevisionPendiente({ indexable = true }: { indexable?: boolean }) {
  if (process.env.SITE_INDEXABLE === 'true') return null;
  return (
    <div className="revision-pendiente" role="note">
      <div className="wrap">
        <strong>Pendiente de revisión jurídica.</strong> Texto redactado a partir de las normas citadas; el despacho debe validarlo antes de publicarlo.
        {!indexable && ' Hasta entonces, la página no se indexa ni figura en el sitemap.'} Este aviso solo aparece en la previsualización.
      </div>
    </div>
  );
}
