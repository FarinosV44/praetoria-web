# Cómo entrar en el panel del despacho (superadministrador)

Dirección: `https://praetoriaabogados.es/admin/` cuando se apruebe el cambio; mientras tanto, `/admin/` en el sitio de pruebas `*.hostingersite.com`. Todo lo que hay en pruebas es ficticio.

## 1. Alta de tu cuenta (una sola vez)
1. El administrador técnico genera una **invitación de un solo uso, válida 72 horas**:
   `npm run personal:invitar -- --email=juanjo@farvertrans.com --nombre="Juan José Farinós Ibáñez" --rol=administrador`
   (en Supabase solo se guarda el resumen SHA-256 del enlace; el enlace en claro se entrega una vez, por canal privado).
2. Abre el enlace, elige una contraseña de **al menos 14 caracteres** y pulsa «Activar mi cuenta».
3. Entra con tu correo y tu contraseña. La primera vez el sistema te lleva a **Seguridad**: confirma la contraseña,
   escanea el código QR con una app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password…),
   guarda los códigos de recuperación y escribe el código de seis cifras. Desde ese momento, cada acceso pide el código.

## 2. Clientes y expedientes
- **Clientes**: lista de todas las personas registradas. Pulsa un nombre para abrir su **ficha**: sus datos, todos sus
  asuntos (solicitudes y expedientes) con su estado, y todos sus documentos agrupados por carpeta.
- **Bandeja**: solicitudes nuevas, en revisión, documentos por validar, documentación que falta, subsanaciones y
  expedientes abiertos. Pulsa la referencia (SOL-… o EXP-…) para entrar en el asunto.

## 3. Documentos
- En la ficha o en el asunto, pulsa el **nombre del archivo** para verlo en el navegador (PDF e imágenes) o
  **Descargar** para guardarlo. Cada apertura queda registrada en el historial.
- **Validar documento** o **Pedir subsanación** (con el motivo que verá el cliente). Las versiones anteriores nunca se borran.
- **Carpetas**: en cada documento solicitado, escribe la carpeta y pulsa «Mover» (por ejemplo «Prueba», «Escritos y
  actuaciones», «Economía»).
- **Pedir un documento más**: al final de la documentación del asunto; elige carpeta, si es obligatorio y si admite varios
  archivos. El cliente recibe un aviso neutro por correo.

## 4. Agenda y avisos
- **Agenda → Nuevo evento**: qué, tipo, fecha y hora (Madrid) y cuándo avisarte (a la hora, 15 min, 1 h, 24 h, 1 semana u
  otro). En «Más opciones»: repetición, expediente, prioridad y, para plazos, la fuente y la casilla «He verificado esta
  fecha» (el sistema no calcula plazos).
- **Avisos**: bandeja con los avisos recibidos; posponer 1 h o 1 día, o marcar la tarea como completada.

## 5. App en el iPhone y notificaciones
1. Abre la dirección del portal en **Safari** → botón Compartir → **Añadir a pantalla de inicio** → Añadir.
2. Abre **Praetoria** desde el icono, entra (contraseña + código) y ve a **App móvil**.
3. Pulsa **Activar avisos en este dispositivo** y acepta el permiso. Pulsa **Enviar aviso de prueba**.
4. En la pantalla de bloqueo solo aparece «Tienes un aviso pendiente en Praetoria»; el detalle se ve dentro, tras entrar.
Requiere iOS 16.4 o posterior y que la app esté añadida a la pantalla de inicio (requisito de Apple).
