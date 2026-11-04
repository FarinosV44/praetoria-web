import { LegalPage, legalMetadata } from '@/components/LegalPage';

export const metadata = legalMetadata('politica-de-cookies');

export default function PoliticaDeCookiesPage() {
  return <LegalPage slug="politica-de-cookies" />;
}
