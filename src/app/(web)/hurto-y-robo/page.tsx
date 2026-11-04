import { metaServicio } from '@/lib/seo-servicio';
import { servicioPorId } from '@/lib/servicios';
import { ServicePage } from '@/components/ServicePage';

const servicio = servicioPorId('penal-hurto-robo')!;

export const metadata = metaServicio(servicio);

export default function Page() {
  return <ServicePage servicio={servicio} />;
}
