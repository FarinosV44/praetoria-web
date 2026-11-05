import { describe, expect, it } from 'vitest';
import { usuarioDePortal } from '../../src/seguros/lib/auth/usuario-portal';
import { sincronizarDispositivos, dispositivosDe } from '../../src/seguros/lib/avisos/dispositivos';
import { emitir, planificar } from '../../src/seguros/lib/avisos/motor';
import { q, q1 } from '../../src/seguros/lib/db';
import { poliza, titular, usuario } from './ayudas';

// Integración en /admin/seguros: identidad del portal y avisos por la app de Praetoria. Datos SINTÉTICOS.
const uuid = () => crypto.randomUUID();
const sub = (n: string) => ({ endpoint: `https://push.ejemplo.test/${n}`, p256dh: 'B'.repeat(87), auth: 'a'.repeat(22), dispositivo: `Móvil sintético ${n}` });

describe('identidad del portal', () => {
  it('crea una cuenta de administrador sin contraseña propia y la reutiliza', async () => {
    const id = uuid();
    const a = await usuarioDePortal({ id, email: `Super-${id}@Ejemplo.test`, nombre: 'Superadmin Sintética' });
    const b = await usuarioDePortal({ id, email: `otro-${id}@ejemplo.test`, nombre: 'Cambia el nombre' });
    expect(b.id).toBe(a.id);
    expect(a.rol).toBe('admin');
    const f = await q1<{ email: string; clave_hash: string }>('SELECT email, clave_hash FROM usuarios WHERE id = $1', [a.id]);
    expect(f!.email).toBe(`super-${id}@ejemplo.test`);
    expect(f!.clave_hash).toBe('!portal');
  });

  it('vincula una cuenta existente por correo, pero nunca la de otra persona del portal', async () => {
    const previa = await usuario('colaborador');
    const vinculada = await usuarioDePortal({ id: uuid(), email: previa.email.toUpperCase(), nombre: 'Primera' });
    expect(vinculada.id).toBe(previa.id);
    expect(vinculada.rol).toBe('admin');
    await expect(usuarioDePortal({ id: uuid(), email: previa.email, nombre: 'Segunda' })).rejects.toThrow(/vinculado a otra persona/);
  });

  it('una cuenta desactivada no entra aunque venga del portal', async () => {
    const id = uuid();
    const a = await usuarioDePortal({ id, email: `baja-${id}@ejemplo.test`, nombre: 'Baja' });
    await q('UPDATE usuarios SET activo = false WHERE id = $1', [a.id]);
    await expect(usuarioDePortal({ id, email: `baja-${id}@ejemplo.test`, nombre: 'Baja' })).rejects.toThrow(/desactivada/);
  });
});

describe('dispositivos de la app de Praetoria', () => {
  it('sincroniza altas y bajas y el planificador encola un envío por dispositivo', async () => {
    const u = await usuarioDePortal({ id: uuid(), email: `push-${uuid()}@ejemplo.test`, nombre: 'Push' });
    expect(await sincronizarDispositivos(u.id, [sub('uno'), sub('dos'), { ...sub('malo'), endpoint: 'http://inseguro.test/x' }])).toEqual({ activos: 3, desactivados: 0 });
    expect((await dispositivosDe(u.id)).map((d) => d.origen)).toEqual(['portal', 'portal']);
    // «dos» desaparece del portal: se desactiva en el gestor
    expect(await sincronizarDispositivos(u.id, [sub('uno')])).toMatchObject({ desactivados: 1 });
    expect((await dispositivosDe(u.id)).map((d) => d.agente)).toEqual(['Móvil sintético uno']);

    const t = await titular(u, 'empresa', 'Empresa Sintética Push Portal');
    const pol = await poliza(u, t, { inicio: '2026-03-01', fin: '2027-03-01' });
    await planificar('2027-02-01');
    await emitir(new Date('2027-02-01T10:00:00Z'));
    const envios = await q<{ canal: string; endpoint: string | null }>(
      `SELECT e.canal, s.endpoint FROM envios e JOIN avisos a ON a.id = e.aviso_id LEFT JOIN push_suscripciones s ON s.id = e.suscripcion_id
        WHERE e.usuario_id = $1 AND a.poliza_id = $2`, [u.id, pol]);
    expect(envios.filter((e) => e.canal === 'push').map((e) => e.endpoint)).toEqual(['https://push.ejemplo.test/uno']);
  });
});
