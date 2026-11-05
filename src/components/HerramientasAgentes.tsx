'use client';
// WebMCP: ofrece a los agentes del navegador las mismas herramientas de solo lectura que el servidor MCP.
// Sin soporte en el navegador no hace nada.
import { useEffect } from 'react';
import { herramientas } from '@/lib/agentes/herramientas';

type ModelContext = {
  registerTool: (
    tool: (typeof herramientas)[number] & { annotations: { readOnlyHint: boolean }; execute: (args: unknown) => Promise<unknown> },
    opciones: { signal: AbortSignal },
  ) => unknown;
};

async function ejecutar(name: string, args: unknown) {
  const r = await fetch('/mcp/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  const { result, error } = await r.json();
  if (error) throw new Error(error.message);
  return result;
}

export function HerramientasAgentes() {
  useEffect(() => {
    const control = new AbortController();
    // La especificación lo pone en document; las versiones anteriores de Chrome, en navigator
    const d = document as Document & { modelContext?: ModelContext };
    const n = navigator as Navigator & { modelContext?: ModelContext };
    const contextos = new Set([d.modelContext, n.modelContext].filter((c) => !!c));
    for (const contexto of contextos) {
      for (const h of herramientas) {
        // Una herramienta rechazada (política de permisos, nombre repetido) no debe afectar a la página
        Promise.resolve()
          .then(() => contexto.registerTool({ ...h, annotations: { readOnlyHint: true }, execute: (args) => ejecutar(h.name, args) }, { signal: control.signal }))
          .catch(() => {});
      }
    }
    return () => control.abort();
  }, []);
  return null;
}
