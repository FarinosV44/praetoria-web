import { LegalPage, legalMetadata } from '@/components/LegalPage';

export const metadata = legalMetadata('aviso-legal');

export default function AvisoLegalPage() {
  return <LegalPage slug="aviso-legal" />;
}
