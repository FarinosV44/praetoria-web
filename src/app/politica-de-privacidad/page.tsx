import { LegalPage, legalMetadata } from '@/components/LegalPage';

export const metadata = legalMetadata('politica-de-privacidad');

export default function PoliticaDePrivacidadPage() {
  return <LegalPage slug="politica-de-privacidad" />;
}
