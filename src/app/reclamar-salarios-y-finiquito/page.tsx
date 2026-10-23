import { buildMetadata } from '@/lib/seo';
import { servicioPorId } from '@/lib/servicios';
import { ServicePage } from '@/components/ServicePage';

const servicio = servicioPorId('laboral-cantidades')!;

export const metadata = buildMetadata({
  title: servicio.seo!.title,
  description: servicio.seo!.description,
  path: servicio.pagina!,
});

export default function CantidadesPage() {
  return <ServicePage servicio={servicio} />;
}
