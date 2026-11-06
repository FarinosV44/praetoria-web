// Solo para la pila local: crea el seguro antiguo SINTÉTICO de las pruebas con una conversación y un escrito de ejemplo
// para revisar la interfaz. Nunca se ejecuta en producción.
import { pool, q, q1 } from '../../src/seguros/lib/db';
import { seguroAntiguo } from '../tests/escenario';
import { crearConversacion, guardarEscritoIA } from '../../src/seguros/lib/ia/expediente';

if (process.env.NODE_ENV === 'production') throw new Error('Solo en local');
const u = (await q1<{ id: string; email: string; nombre: string; rol: 'admin' }>(`SELECT id, email, nombre, rol FROM usuarios WHERE email = $1`, [process.argv[2] ?? 'superadmin@ejemplo.test']))!;
const e = await seguroAntiguo(u, `DEMO${Date.now() % 10000}`);
const conv = await crearConversacion(u, e.poliza, e.asunto, 'Estado del siniestro');
await q(`INSERT INTO mensajes (conversacion_id, rol, texto, creado_por) VALUES ($1,'usuario','¿En qué estado está el siniestro?',$2)`, [conv, u.id]);
const escrito = await guardarEscritoIA(u.id, e.poliza, e.asunto, conv, { tipo: 'reclamacion_falta_respuesta', titulo: 'Reclamación por falta de respuesta', destinatario: 'Mutua Inventada de Seguros',
  texto: 'Comercial Inventada DEMO S.L.\n\nA la atención de Mutua Inventada de Seguros\nPóliza ANT-DEMO · Siniestro de 10/11/2024\n\nEl 20/12/2024 remitimos las facturas que nos solicitaron por carta de 1/12/2024. No consta respuesta.\n\nSolicitamos que nos informen del estado de la tramitación.\n\nAtentamente.', citas: [] }, pool());
await q(`INSERT INTO mensajes (conversacion_id, rol, texto, citas, escrito_id, creado_por) VALUES ($1,'asistente',$2,$3,$4,$5)`, [conv,
  'Consta la declaración (12/11/2024, correo), la petición de facturas e informe del fontanero (carta de 1/12/2024, D6) y el envío de las facturas (20/12/2024). No consta respuesta posterior. Según nota propia (sin acreditar) el perito iba a venir.',
  JSON.stringify([{ ref: 'D6', documento_id: e.docs.peticion, documento: 'carta-peticion-documentacion.pdf', pagina: 1, fecha: '2024-12-01', cita: 'necesitamos las facturas de reparacion y el informe del fontanero', verificada: true }]), escrito, u.id]);
console.log(JSON.stringify({ poliza: e.poliza, conv, escrito }));
process.exit(0);
