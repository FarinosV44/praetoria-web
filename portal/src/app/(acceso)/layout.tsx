import { Marca } from '@/components/Marca';

export default function AccesoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="wrap py-5"><Marca /></header>
      <main className="wrap flex-1 pb-12" id="contenido">
        <div className="mx-auto max-w-[460px]">{children}</div>
      </main>
      <footer className="wrap py-6 ayuda text-center">
        Praetoria Abogados · Área privada de clientes ·{' '}
        <a href="https://praetoriaabogados.es/politica-de-privacidad/">Privacidad</a>
      </footer>
    </div>
  );
}
