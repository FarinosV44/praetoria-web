import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirAdmin } from '@/seguros/lib/auth/servidor';
import { listarRamos } from '@/seguros/lib/datos/polizas';
import { Campo, Casilla, Enviar, Formulario, Selector } from '@/seguros/components/formulario';
import { IconoRamo, ICONOS_RAMO } from '@/seguros/components/iconos';
import { accionCrearRamo, accionEditarRamo } from '../acciones';

export const metadata: Metadata = { title: 'Tipos de seguro' };

const ICONOS = Object.keys(ICONOS_RAMO).map((k) => ({ valor: k, texto: k === 'rc' ? 'Responsabilidad civil' : k.charAt(0).toUpperCase() + k.slice(1) }));

export default async function Tipos() {
  await exigirAdmin();
  const ramos = await listarRamos();
  return (
    <>
      <div className="migas"><Link href="/admin/seguros/ajustes">Ajustes</Link><span aria-hidden="true">/</span><span>Tipos de seguro</span></div>
      <div className="encabezado"><div><h1>Tipos de seguro</h1><p className="secundario pequeno">Los desactivados no se ofrecen en pólizas nuevas, pero se conservan en las existentes.</p></div></div>
      <div className="dos-columnas">
        <ul className="tarjeta lista-simple">
          {ramos.map((r) => (
            <li key={r.id}>
              <Formulario accion={accionEditarRamo.bind(null, r.id)} className="" aria={`Editar ${r.nombre}`}>
                <div style={{ display: 'flex', gap: 'var(--e-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <IconoRamo icono={r.icono} />
                  <Campo nombre="nombre" etiqueta="Nombre" defecto={r.nombre} />
                  <Selector nombre="icono" etiqueta="Icono" defecto={r.icono} opciones={ICONOS} />
                  <Casilla nombre="activo" etiqueta="Activo" defecto={r.activo} />
                  <Enviar className="boton boton--peq">Guardar</Enviar>
                </div>
              </Formulario>
            </li>
          ))}
        </ul>
        <div className="tarjeta tarjeta--pad">
          <h2 style={{ marginBottom: 'var(--e-4)' }}>Añadir tipo</h2>
          <Formulario accion={accionCrearRamo} aria="Añadir tipo de seguro">
            <Campo nombre="nombre" etiqueta="Nombre" requerido />
            <Selector nombre="icono" etiqueta="Icono" defecto="otros" opciones={ICONOS} />
            <div><Enviar>Añadir</Enviar></div>
          </Formulario>
        </div>
      </div>
    </>
  );
}
