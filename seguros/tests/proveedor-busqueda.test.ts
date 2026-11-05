import { afterEach, describe, expect, it, vi } from 'vitest';
import { proveedorIA } from '../../src/seguros/lib/ia/proveedor';

// Búsqueda en internet con el proveedor real, simulando las respuestas de la API (sin red, datos inventados).
describe('búsqueda en internet del proveedor', () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.ANTHROPIC_API_KEY; });

  it('usa la herramienta de búsqueda, sigue tras una pausa y devuelve las fuentes realmente consultadas', async () => {
    process.env.ANTHROPIC_API_KEY = 'clave-de-prueba';
    const cuerpos: { tools: { type?: string; name: string }[]; messages: unknown[] }[] = [];
    const respuestas = [
      { model: 'm', stop_reason: 'pause_turn', content: [
        { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'aseguradora ficticia siniestros' } },
        { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url: 'https://ficticia.test/siniestros', title: 'Siniestros', encrypted_content: 'x' }] },
      ] },
      { model: 'm', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'registrar_contactos', input: { siniestros_telefono: { valor: '910000222', url: 'https://ficticia.test/siniestros' } } }] },
    ];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      cuerpos.push(JSON.parse(init.body));
      return new Response(JSON.stringify(respuestas.shift()), { status: 200 });
    }));
    const r = await proveedorIA()!.buscar!({ sistema: 's', texto: 't', herramienta: { nombre: 'registrar_contactos', descripcion: 'd', esquema: { type: 'object' } } });
    expect(cuerpos[0]!.tools.map((t) => t.type ?? t.name)).toEqual(['web_search_20250305', 'registrar_contactos']);
    expect(cuerpos[1]!.messages).toHaveLength(2); // continúa la misma conversación tras la pausa
    expect(r.fuentes).toEqual([{ url: 'https://ficticia.test/siniestros', titulo: 'Siniestros' }]);
    expect(r.datos).toMatchObject({ siniestros_telefono: { valor: '910000222' } });
  });

  it('un error de la API se informa tal cual (p. ej., búsqueda no habilitada en la organización)', async () => {
    process.env.ANTHROPIC_API_KEY = 'clave-de-prueba';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"message":"web search is not enabled"}}', { status: 400 })));
    await expect(proveedorIA()!.buscar!({ sistema: 's', texto: 't', herramienta: { nombre: 'x', descripcion: 'd', esquema: {} } })).rejects.toThrow(/400.*not enabled/);
  });
});
