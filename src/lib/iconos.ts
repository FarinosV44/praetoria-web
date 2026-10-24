// Icono y objetivo de cada área (#28). Un solo sitio para portada, áreas, servicios y contacto.
import type { LineIcon } from '@/components/Icon';
import type { AreaRef } from './site';

export const iconoArea: Record<AreaRef['id'], LineIcon> = {
  transporte: 'camion',
  mercantil: 'maletin',
  hacienda: 'hacienda',
  laboral: 'trabajo',
  civil: 'vivienda',
  familia: 'familia',
  arte: 'arte',
};

/** Qué suele querer conseguir quien llega a cada área: orienta el mensaje, no promete el resultado */
export const objetivoArea: Record<AreaRef['id'], string> = {
  transporte: 'Cobrar lo que te deben y proteger tu operativa',
  mercantil: 'Dar seguridad a tus decisiones de empresa',
  hacienda: 'Responder a tiempo y con criterio a la Administración',
  laboral: 'Defender tus derechos y tus ingresos',
  civil: 'Resolver el conflicto y proteger tu patrimonio',
  familia: 'Acordar con seguridad o defender lo que importa',
  arte: 'Proteger el valor y la historia de tu patrimonio',
};

/** Método común (#28): primero el objetivo, después la estrategia */
export const metodo: { icono: LineIcon; titulo: string; texto: string }[] = [
  { icono: 'objetivo', titulo: 'Entendemos tu objetivo', texto: 'Qué quieres conseguir, qué está en juego y qué plazos condicionan la decisión.' },
  { icono: 'analisis', titulo: 'Analizamos opciones, riesgos y costes', texto: 'Tu posición, las vías posibles y lo que cuesta cada una, con documentos y fechas sobre la mesa.' },
  { icono: 'negociar', titulo: 'Diseñamos la estrategia y negociamos', texto: 'Elegimos contigo el camino. Negociamos cuando conviene y preparamos la vía judicial cuando hace falta.' },
  { icono: 'acompanar', titulo: 'Actuamos y te acompañamos', texto: 'Ejecutamos lo acordado y te informamos en cada paso, hasta cerrar el asunto.' },
];
