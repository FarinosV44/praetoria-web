import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DATABASE_URL_SEGUROS = process.env.SEGUROS_DATABASE_URL_TEST ?? 'postgres://polizas:polizas@localhost:5432/polizas_test';
process.env.SEGUROS_STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'polizas-docs-'));
process.env.MAX_UPLOAD_MB = '2';
// Correo «configurado» solo a efectos de encolar: las pruebas inyectan canales falsos y nunca conectan a SMTP.
process.env.SMTP_HOST = 'smtp.invalido.test';
process.env.SMTP_FROM = 'pruebas@ejemplo.test';
process.env.SEGUROS_STORAGE_DRIVER = 'disco';
