import type { Metadata } from 'next';
import { comoUsuario } from '@/lib/db';
import { requerirCliente } from '@/lib/sesion';
import { fecha } from '@/lib/textos';
import { CambiarClave } from './CambiarClave';

export const metadata: Metadata = { title: 'Mi perfil' };

export default async function Perfil() {
  const u = await requerirCliente();
  const p = await comoUsuario(u.id, async (tx) => (await tx.query('select * from portal.perfiles where user_id = $1', [u.id])).rows[0]);
  return (
    <div className="grid gap-5 max-w-2xl">
      <h1 className="titulo">Mi perfil</h1>
      <section className="card">
        <dl className="grid gap-3">
          <div><dt className="etiqueta">Nombre</dt><dd>{u.nombre}</dd></div>
          <div><dt className="etiqueta">Correo</dt><dd>{u.email}</dd></div>
          <div><dt className="etiqueta">Tipo</dt><dd>{p.tipo === 'empresa' ? `Empresa: ${p.empresa}${p.cargo ? ` (${p.cargo})` : ''}` : 'Particular'}</dd></div>
          <div><dt className="etiqueta">Teléfono</dt><dd>{p.telefono ?? '—'}</dd></div>
          <div><dt className="etiqueta">Información de privacidad aceptada</dt><dd>Versión {p.version_privacidad}, el {fecha(p.acepta_privacidad_at)}</dd></div>
        </dl>
        <p className="ayuda mt-4">Para cambiar tu nombre, tu correo o tus datos de empresa, escríbenos desde «Mensajes».</p>
      </section>
      <section className="card"><h2 className="subtitulo">Contraseña</h2><CambiarClave /></section>
      <section className="card">
        <h2 className="subtitulo">Tus derechos</h2>
        <p className="ayuda">Puedes pedir el acceso, la rectificación o la supresión de tus datos escribiendo a juanfarinos@icav.es. Algunos documentos deben conservarse durante los plazos que exige la ley; te informaremos en cada caso.</p>
      </section>
    </div>
  );
}
