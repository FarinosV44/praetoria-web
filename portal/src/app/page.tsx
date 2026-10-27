import { redirect } from 'next/navigation';
import { usuarioActual } from '@/lib/sesion';

export default async function Raiz() {
  const u = await usuarioActual();
  redirect(!u ? '/entrar/' : u.personal ? '/despacho/' : '/inicio/');
}
