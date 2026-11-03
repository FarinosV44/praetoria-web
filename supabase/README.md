# Supabase · portal del cliente

- Proyecto: `praetoria-abogados` (organización «Praetoria», región Frankfurt `eu-central-1`). Solo datos ficticios hasta
  que se apruebe el paso a producción (ver `docs/adr/0001-portal-cliente.md`).
- `migrations/`: esquema en orden. Se aplican al proyecto con el conector de Supabase o con la CLI (`supabase db push`).
  Nunca se edita una migración ya aplicada: los cambios van en una migración nueva.
- `tests/aislamiento_portal.sql`: prueba de aislamiento entre dos clientes y el despacho. Se ejecuta en una transacción que se
  deshace y todas las filas deben salir con `ok = true`. Repetirla tras cualquier cambio de políticas.
- Ninguna clave, contraseña ni cadena de conexión va en el repositorio.
