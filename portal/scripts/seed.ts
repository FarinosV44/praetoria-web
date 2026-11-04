// Solo desarrollo: crea una abogada FICTICIA para probar el panel del despacho.
import { execFileSync } from 'node:child_process';
if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL_ADMIN ?? '')) { console.error('Solo en local'); process.exit(1); }
const pw = process.env.SEED_PERSONAL_PASSWORD;
if (!pw) { console.error('Define SEED_PERSONAL_PASSWORD en .env.local'); process.exit(1); }
execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/personal-alta.ts',
  '--email=letrada.pruebas@ejemplo.test', '--nombre=Letrada de Pruebas', '--rol=abogado'],
  { stdio: 'inherit', env: { ...process.env, PERSONAL_PASSWORD: pw } });
