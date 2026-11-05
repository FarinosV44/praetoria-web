// Carga datos SINTÉTICOS de demostración (capturas, pruebas manuales). Nunca en producción.
//   DEMO_PERMITIDA=1 npm run demo:sintetica
// Todos los nombres, números e importes son inventados.
import { pool, q1 } from '../../src/seguros/lib/db';
import { crearUsuario } from '../../src/seguros/lib/datos/usuarios';
import { crearTitular } from '../../src/seguros/lib/datos/titulares';
import { crearAnualidad, crearPoliza } from '../../src/seguros/lib/datos/polizas';
import { subirDocumento } from '../../src/seguros/lib/datos/documentos';
import { hoyMadrid, sumarAnios, sumarDias, sumarMeses } from '../../src/seguros/lib/fechas';
import type { Usuario } from '../../src/seguros/lib/auth/sesiones';

if (process.env.DEMO_PERMITIDA !== '1') {
  console.error('Por seguridad, define DEMO_PERMITIDA=1 para cargar datos de demostración.');
  process.exit(1);
}
if (await q1('SELECT 1 FROM titulares LIMIT 1')) {
  console.error('La base de datos ya tiene titulares: no se cargan datos de demostración encima de datos existentes.');
  process.exit(1);
}

const email = process.env.DEMO_EMAIL ?? 'demo@ejemplo.test';
const clave = process.env.DEMO_CLAVE ?? 'demo-sintetica-2026';
const id = await crearUsuario(null, { email, nombre: 'Usuario de demostración', rol: 'admin', clave });
const u: Usuario = { id, email, nombre: 'Usuario de demostración', rol: 'admin' };
const ramo = async (c: string) => (await q1<{ id: string }>('SELECT id FROM ramos WHERE clave = $1', [c]))!.id;
const hoy = hoyMadrid();

const empA = await crearTitular(u, { tipo: 'empresa', nombre: 'Transportes Ejemplo, S.L.', nif: 'B00000000' });
const empB = await crearTitular(u, { tipo: 'empresa', nombre: 'Inversiones Ficticias, S.L.' });
const part = await crearTitular(u, { tipo: 'particular', nombre: 'Particular de ejemplo' });

const vig = (finEn: string) => ({ inicio: sumarAnios(finEn, -1), fin: finEn });
const p1 = await crearPoliza(u, { titular_id: empA, ramo_id: await ramo('transporte'), nombre: 'Mercancías flota nacional', riesgo: 'Mercancía transportada, 3 vehículos', aseguradora: 'Aseguradora Alfa (ficticia)', numero: 'DEMO-0001', ...vig(sumarDias(hoy, 18)), prima_anual: '2.480,00', periodicidad: 'trimestral', importe_recibo: '620,00', plazo_oposicion: sumarDias(hoy, -12), plazo_oposicion_fuente: 'Cond. generales, art. 22, pág. 9 (demo)', plazo_oposicion_confirmado: 'on', datos_confirmados: 'on', mediador: 'Correduría Demo', mediador_telefono: '900 000 000' });
await crearPoliza(u, { titular_id: empA, ramo_id: await ramo('coche'), nombre: 'Furgoneta de reparto', riesgo: '0000-DEM', aseguradora: 'Seguros Beta (ficticia)', numero: 'DEMO-0002', ...vig(sumarMeses(hoy, 4)), periodicidad: 'mensual', importe_recibo: '68,40', datos_confirmados: 'on', asistencia_telefono: '900 000 001' });
await crearPoliza(u, { titular_id: empA, ramo_id: await ramo('rc'), nombre: 'Responsabilidad civil general', aseguradora: 'Aseguradora Alfa (ficticia)', ...vig(sumarMeses(hoy, 7)), prima_anual: '1.150,00', periodicidad: 'anual', datos_confirmados: 'on' });
await crearPoliza(u, { titular_id: empB, ramo_id: await ramo('negocio'), nombre: 'Multirriesgo oficina', riesgo: 'Oficina en calle Inventada 1', aseguradora: 'Mutua Gamma (ficticia)', ...vig(sumarDias(hoy, 26)), prima_anual: '845,30', periodicidad: 'semestral', importe_recibo: '422,65' });
await crearPoliza(u, { titular_id: empB, ramo_id: await ramo('defensa'), nombre: 'Defensa jurídica empresa', aseguradora: 'Seguros Beta (ficticia)' });
const p6 = await crearPoliza(u, { titular_id: part, ramo_id: await ramo('hogar'), nombre: 'Vivienda habitual', riesgo: 'Piso de ejemplo', aseguradora: 'Mutua Gamma (ficticia)', ...vig(sumarMeses(hoy, 9)), prima_anual: '312,00', periodicidad: 'anual', datos_confirmados: 'on' });
await crearPoliza(u, { titular_id: part, ramo_id: await ramo('salud'), nombre: 'Salud familiar', aseguradora: 'Salud Delta (ficticia)', ...vig(sumarMeses(hoy, 2)), periodicidad: 'mensual', importe_recibo: '96,50', datos_confirmados: 'on' });
await crearPoliza(u, { titular_id: part, ramo_id: await ramo('coche'), nombre: 'Turismo personal', riesgo: '1111-DEM', aseguradora: 'Seguros Beta (ficticia)', ...vig(sumarDias(hoy, -6)), prima_anual: '415,00', periodicidad: 'anual', datos_confirmados: 'on' });

// Histórico: la póliza de hogar tiene una anualidad anterior más barata.
const [hogar] = (await pool().query('SELECT inicio FROM anualidades WHERE poliza_id = $1', [p6])).rows;
await crearAnualidad(u, p6, { inicio: sumarAnios(hogar.inicio, -1), fin: hogar.inicio, prima_anual: '289,00', periodicidad: 'anual', datos_confirmados: 'on' });
await subirDocumento(u, { polizaId: p1, tipo: 'condiciones_particulares', nombre: 'condiciones-particulares-DEMO.pdf', datos: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n') });

console.log(`Datos de demostración cargados. Acceso: ${email} / ${clave}`);
await pool().end();
