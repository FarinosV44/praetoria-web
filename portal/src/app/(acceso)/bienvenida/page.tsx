import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { usuarioActual } from '@/lib/sesion';
import { crearPerfil } from './acciones';
import { FormPerfil } from './FormPerfil';

export const metadata: Metadata = { title: 'Bienvenida' };

export default async function Bienvenida() {
  const u = await usuarioActual();
  if (!u) redirect('/entrar/');
  if (u.personal) redirect('/despacho/');
  if (u.tienePerfil) redirect('/inicio/');
  return (
    <div className="card">
      <p className="exito mb-4" role="status">Correo confirmado. Tu cuenta ya está activa.</p>
      <h1 className="titulo mb-2">Hola, {u.nombre.split(' ')[0]}</h1>
      <p className="ayuda mb-5">Solo un dato más para empezar. El resto te lo pediremos cuando haga falta.</p>
      <FormPerfil accion={crearPerfil} />
    </div>
  );
}
