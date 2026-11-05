import { q1 } from '../../src/seguros/lib/db';
import { crearUsuario } from '../../src/seguros/lib/datos/usuarios';
import type { Usuario } from '../../src/seguros/lib/auth/sesiones';
import { crearTitular } from '../../src/seguros/lib/datos/titulares';
import { crearPoliza } from '../../src/seguros/lib/datos/polizas';

// Datos SINTÉTICOS de prueba: nombres y números inventados, sin relación con personas o empresas reales.
let n = 0;
export async function usuario(rol: 'admin' | 'colaborador' = 'admin'): Promise<Usuario> {
  n++;
  const email = `prueba${n}-${Date.now()}@ejemplo.test`;
  const id = await crearUsuario(null, { email, nombre: `Prueba ${n}`, rol, clave: 'clave-de-prueba-123' });
  return { id, email, nombre: `Prueba ${n}`, rol };
}

export async function ramo(clave = 'coche') {
  return (await q1<{ id: string }>('SELECT id FROM ramos WHERE clave = $1', [clave]))!.id;
}

export const titular = (admin: Usuario, tipo: 'empresa' | 'particular', nombre: string) => crearTitular(admin, { tipo, nombre });

export async function poliza(u: Usuario, titularId: string, extra: Record<string, unknown> = {}) {
  return crearPoliza(u, {
    titular_id: titularId, ramo_id: await ramo((extra.ramo as string) ?? 'coche'), nombre: 'Vehículo sintético 0000-XXX',
    aseguradora: 'Aseguradora Ficticia S.A.', inicio: '2026-01-15', fin: '2027-01-15', prima_anual: '600,00', periodicidad: 'anual',
    ...extra,
  });
}
