import Link from 'next/link';

export function Marca({ destino = '/' }: { destino?: string }) {
  return (
    <Link href={destino} className="inline-flex items-center gap-3 no-underline" aria-label="Praetoria Abogados · Área de clientes">
      <img src="/logo-praetoria.png" alt="Praetoria Abogados" width={560} height={109} style={{ width: 168, height: 'auto' }} />
    </Link>
  );
}
