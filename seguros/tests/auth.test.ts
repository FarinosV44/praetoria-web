import { describe, expect, it } from 'vitest';
import { hashClave, verificarClave } from '../../src/seguros/lib/auth/clave';
import { cerrarSesion, usuarioDeToken } from '../../src/seguros/lib/auth/sesiones';
import { acceder, activarUsuario, cambiarClave, crearRecuperacion, restablecerClave } from '../../src/seguros/lib/datos/usuarios';
import { q } from '../../src/seguros/lib/db';
import { usuario } from './ayudas';

describe('autenticación (#1, #8)', () => {
  it('hash scrypt verificable y distinto en cada alta', async () => {
    const a = await hashClave('una-clave-larga-1');
    const b = await hashClave('una-clave-larga-1');
    expect(a).not.toBe(b);
    expect(await verificarClave('una-clave-larga-1', a)).toBe(true);
    expect(await verificarClave('otra', a)).toBe(false);
  });

  it('acceso, sesión y cierre', async () => {
    const u = await usuario('admin');
    const r = await acceder(u.email.toUpperCase(), 'clave-de-prueba-123', '10.0.0.1', 'vitest');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await usuarioDeToken(r.token))?.id).toBe(u.id);
    // En la base de datos no se guarda el token, solo su hash.
    expect((await q('SELECT 1 FROM sesiones WHERE id = $1', [r.token])).length).toBe(0);
    await cerrarSesion(r.token);
    expect(await usuarioDeToken(r.token)).toBeNull();
  });

  it('bloquea tras 5 intentos fallidos y no revela si la cuenta existe', async () => {
    const u = await usuario('colaborador');
    for (let i = 0; i < 5; i++) expect(await acceder(u.email, 'mala', '10.0.0.2', null)).toEqual({ ok: false, motivo: 'credenciales' });
    expect(await acceder(u.email, 'clave-de-prueba-123', '10.0.0.2', null)).toEqual({ ok: false, motivo: 'bloqueado' });
    expect(await acceder('no-existe@ejemplo.test', 'x', '10.0.0.3', null)).toEqual({ ok: false, motivo: 'credenciales' });
  });

  it('las sesiones caducadas o de usuarios desactivados no valen', async () => {
    const admin = await usuario('admin');
    const u = await usuario('colaborador');
    const r = await acceder(u.email, 'clave-de-prueba-123', '10.0.0.4', null);
    if (!r.ok) throw new Error('acceso');
    await activarUsuario(admin, u.id, false);
    expect(await usuarioDeToken(r.token)).toBeNull();
    await activarUsuario(admin, u.id, true);
    const r2 = await acceder(u.email, 'clave-de-prueba-123', '10.0.0.4', null);
    if (!r2.ok) throw new Error('acceso');
    await q(`UPDATE sesiones SET vista_en = now() - interval '15 days' WHERE usuario_id = $1`, [u.id]);
    expect(await usuarioDeToken(r2.token)).toBeNull();
  });

  it('cambiar o restablecer la contraseña cierra todas las sesiones; el enlace es de un solo uso', async () => {
    const u = await usuario('colaborador');
    const r = await acceder(u.email, 'clave-de-prueba-123', '10.0.0.5', null);
    if (!r.ok) throw new Error('acceso');
    await cambiarClave(u, 'clave-de-prueba-123', 'otra-clave-segura-456');
    expect(await usuarioDeToken(r.token)).toBeNull();
    const t = await crearRecuperacion(u.email, '10.0.0.5');
    expect(t).toBeTruthy();
    await restablecerClave(t!, 'tercera-clave-segura-789');
    await expect(restablecerClave(t!, 'cuarta-clave-segura-000')).rejects.toThrow(/Revisa/);
    expect((await acceder(u.email, 'tercera-clave-segura-789', '10.0.0.6', null)).ok).toBe(true);
    expect(await crearRecuperacion('no-existe@ejemplo.test', '10.0.0.7')).toBeNull();
  });
});
