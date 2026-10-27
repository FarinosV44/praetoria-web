// Capturador SMTP local para desarrollo y pruebas: guarda cada correo en .dev/correo/*.json.
// Solo escucha en 127.0.0.1. Sustituye al proveedor real de correo SOLO en local.
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', '.dev', 'correo');
mkdirSync(dir, { recursive: true });
const server = new SMTPServer({
  authOptional: true,
  disabledCommands: ['STARTTLS'],
  onData(stream, _session, cb) {
    simpleParser(stream).then((m) => {
      const to = Array.isArray(m.to) ? m.to.map((t) => t.text).join(',') : m.to?.text ?? '';
      const f = join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
      writeFileSync(f, JSON.stringify({ to, subject: m.subject, text: m.text, attachments: m.attachments.length, date: new Date().toISOString() }, null, 2));
      cb();
    }, cb);
  },
});
server.listen(2525, '127.0.0.1', () => console.log('SMTP local en 127.0.0.1:2525'));
