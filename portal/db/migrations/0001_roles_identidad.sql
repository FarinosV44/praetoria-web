-- 0001 · Roles y esquema de identidad
-- Roles sin contraseña: la contraseña se fija fuera del repositorio (scripts/migrate.ts lee
-- PORTAL_APP_PASSWORD y PORTAL_AUTH_PASSWORD del entorno). Ninguno tiene BYPASSRLS.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'portal_app') then
    create role portal_app nologin noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'portal_auth') then
    create role portal_auth nologin noinherit nobypassrls;
  end if;
end $$;

create schema if not exists identidad;
revoke all on schema identidad from public;
grant usage on schema identidad to portal_auth, portal_app;

-- Tablas de la librería de autenticación (better-auth 1.7, ids UUID), generadas con
-- getMigrations().compileMigrations() y fijadas aquí para que el esquema esté versionado.
create table identidad."user" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null, "twoFactorEnabled" boolean);
create table identidad."session" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" uuid not null references identidad."user" ("id") on delete cascade);
create table identidad."account" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "accountId" text not null, "providerId" text not null, "userId" uuid not null references identidad."user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);
create table identidad."verification" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);
create table identidad."twoFactor" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "secret" text not null, "backupCodes" text not null, "userId" uuid not null references identidad."user" ("id") on delete cascade, "verified" boolean, "failedVerificationCount" integer, "lockedUntil" timestamptz);
create table identidad."rateLimit" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);
create index "session_userId_idx" on identidad."session" ("userId");
create index "account_userId_idx" on identidad."account" ("userId");
create index "verification_identifier_idx" on identidad."verification" ("identifier");
create index "twoFactor_secret_idx" on identidad."twoFactor" ("secret");
create index "twoFactor_userId_idx" on identidad."twoFactor" ("userId");

grant select, insert, update, delete on all tables in schema identidad to portal_auth;

-- La aplicación solo puede leer columnas no secretas de "user" (nunca sesiones, cuentas ni secretos).
grant select ("id", "name", "email", "emailVerified", "createdAt", "twoFactorEnabled") on identidad."user" to portal_app;
