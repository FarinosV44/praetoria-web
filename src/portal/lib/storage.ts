import 'server-only';
import { StorageClient } from '@supabase/storage-js';
import { env } from './env';

// Supabase Storage con la clave de servicio, que SOLO existe en el servidor. El bucket es privado:
// nunca se generan URL públicas; las descargas pasan por /api/documentos/[id] tras comprobar permisos.
let cliente: StorageClient | undefined;
function s() {
  cliente ??= new StorageClient(env.storageUrl, { apikey: env.storageKey, Authorization: `Bearer ${env.storageKey}` });
  return cliente.from(env.storageBucket);
}

export async function guardarObjeto(clave: string, datos: Uint8Array, mime: string) {
  const { error } = await s().upload(clave, datos, { contentType: mime, upsert: false, cacheControl: 'no-store' });
  if (error) throw new Error(`Almacenamiento: ${error.message}`);
}

export async function leerObjeto(clave: string): Promise<Blob> {
  const { data, error } = await s().download(clave);
  if (error || !data) throw new Error(`Almacenamiento: ${error?.message ?? 'sin datos'}`);
  return data;
}

export async function borrarObjetoHuerfano(clave: string) {
  await s().remove([clave]).catch(() => {});
}
