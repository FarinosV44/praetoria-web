import { redirect } from 'next/navigation';
import { usuarioActual } from '@/portal/lib/sesion';

export default async function Raiz() {
  const u = await usuarioActual();
  redirect(!u ? '/entrar/' : u.personal ? '/admin/' : '/inicio/');
}
