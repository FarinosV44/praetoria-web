import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Usuario } from '../../src/seguros/lib/auth/sesiones';
import { confirmarSubidas, prepararSubidas, recibirSubida } from '../../src/seguros/lib/datos/subidas';
import { documentoParaDescarga, listarDocumentos } from '../../src/seguros/lib/datos/documentos';
import { almacen } from '../../src/seguros/lib/almacen';
import { fijarAccesos } from '../../src/seguros/lib/datos/usuarios';
import { poliza, titular, usuario } from './ayudas';

// Simula Supabase Storage en memoria: comprueba que solo se usa la API privada con la clave secreta.
const objetos = new Map<string, Buffer>();
const URL = 'https://proyecto-sintetico.supabase.co';
const firmas = new Set<string>();
const falsoFetch = vi.fn(async (entrada: string | URL | Request, init?: RequestInit) => {
  const u = new globalThis.URL(String(entrada));
  const h = new Headers(init?.headers);
  const ruta = u.pathname.replace('/storage/v1/', '');
  if (ruta.startsWith('object/upload/sign/') && init?.method === 'POST') {
    if (h.get('apikey') !== 'sb_secret_prueba') return new Response('', { status: 403 });
    const clave = ruta.replace('object/upload/sign/', '');
    const token = Math.random().toString(36).slice(2);
    firmas.add(`${clave}?${token}`);
    return Response.json({ url: `/object/upload/sign/${clave}?token=${token}` });
  }
  if (ruta.startsWith('object/upload/sign/') && init?.method === 'PUT') {
    const clave = ruta.replace('object/upload/sign/', '');
    if (!firmas.delete(`${clave}?${u.searchParams.get('token')}`)) return new Response('', { status: 403 });
    objetos.set(clave, Buffer.from(await new Response(init.body as BodyInit).arrayBuffer()));
    return new Response('{}');
  }
  if (h.get('apikey') !== 'sb_secret_prueba') return new Response('', { status: 403 });
  if (ruta.startsWith('object/authenticated/')) {
    const o = objetos.get(ruta.replace('object/authenticated/', ''));
    return o ? new Response(new Uint8Array(o), { headers: { 'content-length': String(o.length) } }) : new Response('', { status: 404 });
  }
  if (init?.method === 'DELETE') {
    for (const p of JSON.parse(String(init.body)).prefixes) objetos.delete(`${ruta.replace('object/', '')}/${p}`);
    return new Response('[]');
  }
  if (init?.method === 'POST' && ruta.startsWith('object/')) {
    objetos.set(ruta.replace('object/', ''), Buffer.from(init.body as Uint8Array));
    return new Response('{}');
  }
  return new Response('', { status: 400 });
});

describe('subida por partes al almacén privado de Supabase', () => {
  let admin: Usuario, ajeno: Usuario, pol: string;
  beforeAll(async () => {
    Object.assign(process.env, { SEGUROS_STORAGE_DRIVER: 'supabase', SUPABASE_URL: URL, SUPABASE_SECRET_KEY: 'sb_secret_prueba', SUPABASE_BUCKET: 'seguros-documentos' });
    vi.stubGlobal('fetch', falsoFetch);
    admin = await usuario('admin');
    ajeno = await usuario('colaborador');
    const t = await titular(admin, 'empresa', 'Empresa Sintética Subida Directa');
    pol = await poliza(admin, t);
    await fijarAccesos(admin, ajeno.id, []);
  });
  afterAll(() => { process.env.SEGUROS_STORAGE_DRIVER = 'disco'; vi.unstubAllGlobals(); });

  it('autoriza, sube, valida y registra; el original se lee con la clave secreta', async () => {
    const pdf = Buffer.from('%PDF-1.4\n% póliza sintética subida directa\n%%EOF\n');
    const [p] = await prepararSubidas(admin, 'poliza', pol, [{ nombre: 'cp-directa.pdf', bytes: pdf.length }]);
    // El navegador envía el archivo al propio portal (mismo origen), nunca directamente al almacén
    expect(p!.url).toBe(`/api/seguros/subida/?clave=${encodeURIComponent(p!.clave)}`);
    await recibirSubida(admin, p!.clave, pdf, 'application/pdf');
    expect(objetos.has(`seguros-documentos/${p!.clave}`)).toBe(true);
    // La autorización es de un solo uso y personal
    await expect(recibirSubida(admin, p!.clave, pdf, 'application/pdf')).rejects.toThrow(/No se ha encontrado/);
    const [r] = await confirmarSubidas(admin, 'poliza', pol, [p!.clave], { tipo: 'condiciones_particulares' });
    const d = await documentoParaDescarga(admin, r!.id);
    expect((await almacen().leerBuffer(d.clave_almacen)).equals(pdf)).toBe(true);
    // No se puede confirmar dos veces la misma clave
    await expect(confirmarSubidas(admin, 'poliza', pol, [p!.clave], { tipo: 'otro' })).rejects.toThrow(/Revisa/);
  });

  it('archivo falso: no se registra y se borra del almacén', async () => {
    const malo = Buffer.from('MZ ejecutable disfrazado de PDF');
    const [p] = await prepararSubidas(admin, 'poliza', pol, [{ nombre: 'falso.pdf', bytes: malo.length }]);
    await recibirSubida(admin, p!.clave, malo, 'application/pdf');
    await expect(confirmarSubidas(admin, 'poliza', pol, [p!.clave], { tipo: 'otro' })).rejects.toThrow(/Revisa/);
    expect(objetos.has(`seguros-documentos/${p!.clave}`)).toBe(false);
    expect((await listarDocumentos(admin, pol)).map((x) => x.nombre_original)).not.toContain('falso.pdf');
  });

  it('sin permiso no se autoriza ni se puede confirmar una clave ajena', async () => {
    await expect(prepararSubidas(ajeno, 'poliza', pol, [{ nombre: 'x.pdf', bytes: 10 }])).rejects.toThrow(/No se ha encontrado/);
    const [p] = await prepararSubidas(admin, 'poliza', pol, [{ nombre: 'y.pdf', bytes: 10 }]);
    await expect(recibirSubida(ajeno, p!.clave, Buffer.from('%PDF-1.4'), 'application/pdf')).rejects.toThrow(/No se ha encontrado/);
    await expect(recibirSubida(admin, p!.clave, Buffer.alloc(0), 'application/pdf')).rejects.toThrow(/Revisa/);
    await expect(confirmarSubidas(ajeno, 'poliza', pol, [p!.clave], { tipo: 'otro' })).rejects.toThrow(/No se ha encontrado/);
    await expect(prepararSubidas(admin, 'poliza', pol, [{ nombre: 'grande.pdf', bytes: 999 * 1024 * 1024 }])).rejects.toThrow(/Revisa/);
  });
});
