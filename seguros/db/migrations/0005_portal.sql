-- 0005 · Integración en el panel de superadministración de Praetoria (/admin/seguros)
-- La identidad la da el portal (better-auth + doble factor): cada persona de superadministración que entra
-- en Seguros queda vinculada a una cuenta interna por su identificador del portal. Esas cuentas no tienen
-- contraseña propia («!portal» nunca coincide con un hash scrypt), así que no se puede entrar por otra vía.
ALTER TABLE usuarios ADD COLUMN portal_user_id uuid;
CREATE UNIQUE INDEX usuarios_portal_unico ON usuarios (portal_user_id) WHERE portal_user_id IS NOT NULL;

-- Los avisos push salen por la app de Praetoria: se reutilizan los dispositivos que la persona activó en
-- «App móvil». «origen» distingue esos dispositivos sincronizados de los registrados directamente.
ALTER TABLE push_suscripciones ADD COLUMN origen text NOT NULL DEFAULT 'propia' CHECK (origen IN ('propia', 'portal'));

-- Las subidas llegan por /api/seguros/subida (mismo origen): cada autorización admite un único envío.
ALTER TABLE subidas_pendientes ADD COLUMN recibida_en timestamptz;
