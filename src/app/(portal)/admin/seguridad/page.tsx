import { Cabecera } from '@/portal/components/despacho';
import { requerirPersonal } from '@/portal/lib/sesion';
import { ActivarMfa } from './ActivarMfa';

export default async function Seguridad() {
  const u = await requerirPersonal({ sinMfa: true });
  return (
    <div className="card max-w-xl">
      <Cabecera titulo="Doble factor de autenticación" />
      {u.mfa ? (
        <p className="exito">El doble factor está activado en tu cuenta. Cada inicio de sesión te pedirá un código.</p>
      ) : (
        <>
          <p className="mb-4">Para acceder al panel del despacho es obligatorio activar un segundo factor con una aplicación de autenticación (por ejemplo, la de tu móvil).</p>
          <ActivarMfa />
        </>
      )}
    </div>
  );
}
