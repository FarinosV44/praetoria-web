import { Area, Campo, Radios } from '@/seguros/components/formulario';
import type { Titular } from '@/seguros/lib/datos/titulares';

export function CamposTitular({ t }: { t?: Titular }) {
  return (
    <>
      <Radios nombre="tipo" etiqueta="Tipo de titular" defecto={t?.tipo ?? 'empresa'} opciones={[{ valor: 'empresa', texto: 'Empresa' }, { valor: 'particular', texto: 'Particular' }]} />
      <div className="rejilla">
        <Campo nombre="nombre" etiqueta="Nombre o razón social" requerido defecto={t?.nombre} autoComplete="off" />
        <Campo nombre="nif" etiqueta="NIF / CIF" defecto={t?.nif} ayuda="Opcional." autoComplete="off" />
      </div>
      <Area nombre="notas" etiqueta="Notas" defecto={t?.notas} filas={2} />
      <p className="secundario pequeno">El titular agrupa las pólizas en la aplicación. El tomador, el asegurado y el beneficiario se indican en cada póliza.</p>
    </>
  );
}
