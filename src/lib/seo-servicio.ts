// Metadatos de la página propia de un servicio: noindex si aún no es indexable (#32) y marca de revisión pendiente.
import { buildMetadata, ogDe } from './seo';
import type { Servicio } from './servicios';

export const metaServicio = (s: Servicio) =>
  buildMetadata({
    title: s.seo!.title,
    description: s.seo!.description,
    path: s.pagina!,
    image: ogDe(s.imagen),
    noindex: s.indexable === false,
    revisionPendiente: s.revision === 'pendiente',
  });
