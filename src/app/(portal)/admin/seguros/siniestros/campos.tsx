import { Area, Campo, Importe, Selector } from '@/seguros/components/formulario';
import type { Siniestro } from '@/seguros/lib/datos/siniestros';
import type { Titular } from '@/seguros/lib/datos/titulares';

export function CamposSiniestro({ s, titulares, titularInicial }: { s?: Siniestro; titulares?: Titular[]; titularInicial?: string }) {
  return (
    <>
      <fieldset>
        <legend>¿Qué ha pasado?</legend>
        <p className="secundario pequeno" style={{ marginTop: 'calc(-1 * var(--e-2))' }}>Cuéntalo con tus palabras y solo lo que sabes. Lo que no sepas, déjalo en blanco: el asistente te preguntará lo necesario.</p>
        {titulares && (
          <Selector nombre="titular_id" etiqueta="Titular" requerido vacio="Elige…" defecto={s?.titular_id ?? titularInicial}
            opciones={titulares.map((t) => ({ valor: t.id, texto: t.nombre, grupo: t.tipo === 'empresa' ? 'Empresas' : 'Particulares' }))} />
        )}
        <Campo nombre="titulo" etiqueta="Título breve" requerido defecto={s?.titulo} placeholder="Ej.: Golpe en la furgoneta al aparcar" />
        <Area nombre="relato" etiqueta="Relato de los hechos" requerido defecto={s?.relato} filas={7} />
        <div className="rejilla">
          <Campo nombre="fecha_hecho" etiqueta="Fecha del hecho" tipo="date" defecto={s?.fecha_hecho} ayuda="Determina qué condiciones estaban vigentes." />
          <Campo nombre="fecha_conocimiento" etiqueta="Fecha en que lo supiste" tipo="date" defecto={s?.fecha_conocimiento} />
          <Campo nombre="lugar" etiqueta="Lugar" defecto={s?.lugar} />
          <Campo nombre="riesgo_afectado" etiqueta="Bien afectado" defecto={s?.riesgo_afectado} placeholder="Vehículo, inmueble, mercancía…" />
        </div>
      </fieldset>
      <details className="mas" open={!!(s?.danos || s?.terceros || s?.importe_estimado || s?.pruebas)}>
        <summary>Daños, terceros, importe y pruebas</summary>
        <div className="rejilla">
          <Area nombre="danos" etiqueta="Daños" defecto={s?.danos} filas={3} />
          <Area nombre="terceros" etiqueta="Terceros implicados" defecto={s?.terceros} filas={3} ayuda="Personas o empresas, matrículas, aseguradoras." />
          <Importe nombre="importe_estimado" etiqueta="Importe estimado" defecto={s?.importe_estimado?.replace('.', ',')} />
          <Area nombre="pruebas" etiqueta="Pruebas disponibles" defecto={s?.pruebas} filas={2} ayuda="Fotos, parte amistoso, denuncia, testigos…" />
        </div>
      </details>
    </>
  );
}
