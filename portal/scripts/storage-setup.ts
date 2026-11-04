// Crea (si no existe) el bucket PRIVADO de documentos con límite de tamaño y tipos permitidos.
const url = process.env.STORAGE_URL, key = process.env.STORAGE_SERVICE_KEY, bucket = process.env.STORAGE_BUCKET || 'portal-documentos';
if (!url || !key) { console.error('Faltan STORAGE_URL o STORAGE_SERVICE_KEY'); process.exit(1); }
const h = { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' };
const max = Number(process.env.UPLOAD_MAX_MB || 20) * 1024 * 1024;
const cuerpo = { id: bucket, name: bucket, public: false, file_size_limit: max,
  allowed_mime_types: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] };
const g = await fetch(`${url}/bucket/${bucket}`, { headers: h });
if (g.ok) {
  const b = await g.json();
  if (b.public) { console.error(`El bucket ${bucket} es PÚBLICO: corrígelo antes de continuar`); process.exit(1); }
  const u = await fetch(`${url}/bucket/${bucket}`, { method: 'PUT', headers: h, body: JSON.stringify(cuerpo) });
  console.log(`bucket ${bucket} privado (actualizado: ${u.status})`);
} else {
  const r = await fetch(`${url}/bucket`, { method: 'POST', headers: h, body: JSON.stringify(cuerpo) });
  if (!r.ok) { console.error('No se pudo crear el bucket', r.status, await r.text()); process.exit(1); }
  console.log(`bucket ${bucket} creado (privado)`);
}
export {};
