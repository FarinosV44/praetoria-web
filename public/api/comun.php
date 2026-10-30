<?php
// Recepción de formularios en Hostinger (sin Netlify): validación en servidor, antispam y aviso por correo.
// Lo usan public/api/consulta.php y public/api/llamada.php. Las reglas son las mismas que las del navegador
// (src/lib/consulta.ts y src/lib/llamada.ts); las listas y los contactos llegan de catalogo.php, generado desde ellos.
//
// Entrega:
//  - Producción: correo a la dirección del despacho (site.email), con «Responder a» el correo de quien consulta.
//    Por la API de Resend si hay clave en la configuración privada (configuracion()); si no, con mail() de Hostinger.
//    Además se guarda una copia en una carpeta fuera de la web (../consultas-web/ junto a public_html),
//    por si un correo no llegara.
//  - Pruebas: si existe la variable PRAETORIA_ENTREGA_URL, se envía allí en lugar de por correo
//    (scripts/qa/serve.mjs la usa para el registro de las pruebas en navegador).
if (!defined('PRAETORIA_FORMULARIOS')) { http_response_code(404); exit; }

date_default_timezone_set('Europe/Madrid');
const REMITENTE_LOCAL = 'info'; // info@<dominio>: buzón real del despacho en Hostinger (un remitente inexistente no se entrega)

function catalogo(): array {
  static $c = null;
  return $c ??= require __DIR__ . '/catalogo.php';
}

/** Respuesta HTTP. En la línea de órdenes (pruebas) devuelve un sobre JSON con estado, cabeceras y cuerpo. */
function responder(int $estado, array $cabeceras, string $cuerpo): never {
  if (PHP_SAPI === 'cli') {
    echo json_encode(['status' => $estado, 'headers' => $cabeceras, 'body' => $cuerpo], JSON_UNESCAPED_UNICODE);
    exit;
  }
  http_response_code($estado);
  foreach ($cabeceras as $k => $v) header("$k: $v");
  echo $cuerpo;
  exit;
}

function json_resp(int $estado, array $datos): never {
  responder($estado, ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store'], json_encode($datos, JSON_UNESCAPED_UNICODE));
}

function a_gracias(): never {
  responder(303, ['Location' => '/gracias/', 'Cache-Control' => 'no-store'], '');
}

function esc(string $s): string {
  return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function pagina(int $estado, string $titulo, string $cuerpo): never {
  $tel = esc(catalogo()['despacho']['telefono']);
  responder($estado, ['Content-Type' => 'text/html; charset=utf-8', 'Cache-Control' => 'no-store'],
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1">'
    . '<title>' . esc($titulo) . '</title><body style="font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem"><h1>' . esc($titulo) . '</h1>'
    . $cuerpo . '<p><a href="javascript:history.back()">Volver al formulario</a> (los datos siguen escritos) o llámanos al ' . $tel . '.</p></body></html>');
}

/** Lee la petición: método, si es JSON y los campos. Responde directamente si no es válida. */
function leer_peticion(int $max_bytes): array {
  $metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  if ($metodo !== 'POST') json_resp(405, ['ok' => false, 'error' => 'metodo']);
  if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $max_bytes) json_resp(413, ['ok' => false, 'error' => 'tamano']);
  $raw = (string) file_get_contents(PHP_SAPI === 'cli' ? 'php://stdin' : 'php://input', false, null, 0, $max_bytes + 1);
  if (strlen($raw) > $max_bytes) json_resp(413, ['ok' => false, 'error' => 'tamano']);
  $es_json = str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'application/json');
  if ($es_json) {
    $campos = json_decode($raw, true);
  } else {
    parse_str($raw, $campos);
  }
  if (!is_array($campos)) json_resp(400, ['ok' => false, 'error' => 'formato']);
  return [$es_json, $campos];
}

/** Quita caracteres de control (salvo saltos de línea y tabuladores) y espacios sobrantes. */
function limpia($v): string {
  if (is_array($v) || is_object($v)) return '';
  if (is_bool($v)) return $v ? 'true' : '';
  return trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string) $v) ?? '');
}

function largo(string $s): int {
  // Igual que String.length en el navegador (unidades UTF-16)
  return intdiv(strlen(mb_convert_encoding($s, 'UTF-16LE', 'UTF-8')), 2);
}

function campo_ruta($v): string {
  $s = explode('#', explode('?', limpia($v))[0])[0];
  return preg_match('~^/[a-z0-9\-/._%]{0,199}$~i', $s) ? $s : '';
}

function campo_utm($v): string {
  $s = strtolower(limpia($v));
  return preg_match('/^[a-z0-9_\-.]{1,60}$/', $s) ? $s : '';
}

function telefono_valido(string $v): bool {
  return (bool) preg_match('/^\+?\d{9,15}$/', preg_replace('/[\s().-]/', '', $v));
}

function email_valido(string $v): bool {
  return (bool) preg_match('/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/u', $v);
}

function fecha_valida(string $v, bool $futura): bool {
  if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $v, $m) || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) return false;
  $t = gmmktime(0, 0, 0, (int) $m[2], (int) $m[3], (int) $m[1]);
  return $v >= '2000-01-01' && $t <= time() + ($futura ? 731 : 1) * 86400;
}

function privacidad_aceptada($v): bool {
  return $v === true || $v === 'on' || $v === 'true';
}

function id_valido(string $id): bool {
  return (bool) preg_match('/^[a-zA-Z0-9-]{8,64}$/', $id);
}

function nuevo_id(): string {
  $b = random_bytes(16);
  $b[6] = chr(ord($b[6]) & 0x0f | 0x40);
  $b[8] = chr(ord($b[8]) & 0x3f | 0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

/** Campo trampa relleno o envío demasiado rápido (o con marca de tiempo imposible). Sin JavaScript solo cuenta la trampa. */
function parece_automatico(array $raw, bool $es_json): bool {
  if (limpia($raw['empresa-web'] ?? '') !== '') return true;
  if (!$es_json) return false;
  $t = $raw['t'] ?? null;
  if (!is_numeric($t)) return true;
  $transcurrido = microtime(true) * 1000 - (float) $t;
  return $transcurrido < catalogo()['tiempoMinimoMs'] || $transcurrido > 86400000;
}

function responsable(string $area): string {
  $c = catalogo();
  return $area === 'laboral'
    ? "{$c['laboral']['nombre']} ({$c['laboral']['telefono']})"
    : "{$c['despacho']['abogado']} ({$c['despacho']['telefono']})";
}

/** Valida una consulta del formulario de contacto. Mismas reglas que validarConsulta (src/lib/consulta.ts). */
function validar_consulta(array $raw): array {
  $c = catalogo();
  $L = $c['limites'];
  $d = [];
  foreach (['nombre', 'email', 'telefono', 'area', 'mensaje', 'preferencia', 'id', 'servicio', 'papel', 'incidencia', 'importe', 'fecha', 'representa', 'problema', 'situacion', 'cuestionario', 'organismo', 'documento', 'detalle'] as $k) {
    $d[$k] = limpia($raw[$k] ?? '');
  }
  $d['privacidad'] = privacidad_aceptada($raw['privacidad'] ?? null);
  $d['origen'] = campo_ruta($raw['origen'] ?? '');
  $d['landing'] = campo_ruta($raw['landing'] ?? '');
  foreach (['utm_source', 'utm_medium', 'utm_campaign'] as $k) $d[$k] = campo_utm($raw[$k] ?? '');

  // Los datos de un área solo tienen sentido en ella: en otra se descartan
  if ($d['area'] !== 'transporte') $d['papel'] = $d['incidencia'] = $d['importe'] = '';
  if ($d['area'] !== 'laboral') $d['representa'] = $d['problema'] = $d['situacion'] = '';
  if (!in_array($d['area'], $c['areasConCuestionario'], true)) $d['cuestionario'] = '';
  if ($d['area'] !== 'hacienda') $d['organismo'] = $d['documento'] = '';
  if (!in_array($d['area'], $c['areasConFecha'], true)) $d['fecha'] = '';

  $e = [];
  $max = function (string $k) use (&$e, $d, $L) {
    if (largo($d[$k]) > $L[$k]) $e[$k] = "Máximo {$L[$k]} caracteres.";
  };
  if (largo($d['nombre']) < 2) $e['nombre'] = 'Escribe tu nombre.';
  $max('nombre');
  if (!isset($c['areas'][$d['area']])) $e['area'] = 'Elige el área de tu consulta (o «No sé qué área corresponde»).';
  if (largo($d['mensaje']) < $L['mensajeMin']) $e['mensaje'] = "Cuéntanos un poco más (mínimo {$L['mensajeMin']} caracteres).";
  $max('mensaje');
  if (!isset($c['preferencias'][$d['preferencia']])) $e['preferencia'] = 'Elige cómo prefieres que te contactemos.';
  if ($d['email'] !== '' && !email_valido($d['email'])) $e['email'] = 'Revisa el correo: no parece una dirección válida.';
  if ($d['preferencia'] === 'correo' && $d['email'] === '') $e['email'] = 'Para responderte por correo necesitamos tu correo electrónico.';
  $max('email');
  if (($d['preferencia'] === 'llamada' || $d['preferencia'] === 'whatsapp') && $d['telefono'] === '') {
    $e['telefono'] = 'Para ' . ($d['preferencia'] === 'llamada' ? 'llamarte' : 'escribirte por WhatsApp') . ' necesitamos tu teléfono.';
  } elseif ($d['telefono'] !== '' && !telefono_valido($d['telefono'])) {
    $e['telefono'] = 'Revisa el teléfono: debe tener entre 9 y 15 cifras.';
  }
  $max('telefono');
  if (!$d['privacidad']) $e['privacidad'] = 'Necesitamos que aceptes la política de privacidad para responderte.';
  if (!id_valido($d['id'])) $e['id'] = 'Identificador de envío no válido.';
  $sv = $d['servicio'] !== '' ? ($c['servicios'][$d['servicio']] ?? null) : null;
  if ($d['servicio'] !== '') {
    if (!$sv) $e['servicio'] = 'El servicio indicado no existe.';
    elseif ($sv['area'] !== $d['area']) $e['servicio'] = 'El servicio elegido no corresponde al área de la consulta.';
  }
  $lista = 'Elige una opción de la lista.';
  if ($d['papel'] !== '' && !isset($c['papeles'][$d['papel']])) $e['papel'] = $lista;
  if ($d['incidencia'] !== '' && !isset($c['incidencias'][$d['incidencia']])) $e['incidencia'] = $lista;
  if ($d['importe'] !== '' && !isset($c['importes'][$d['importe']])) $e['importe'] = $lista;
  if ($d['area'] === 'laboral' && !isset($c['representa'][$d['representa']])) $e['representa'] = 'Indica si eres la persona trabajadora o consultas por una empresa u otra persona.';
  if (largo($d['cuestionario']) > $L['cuestionario']) $e['cuestionario'] = 'El resumen del cuestionario es demasiado largo.';
  if ($d['area'] === 'hacienda' && !isset($c['organismos'][$d['organismo']])) $e['organismo'] = 'Indica quién envía la notificación (o «No lo sé»).';
  if ($d['documento'] !== '' && !isset($c['documentos'][$d['documento']])) $e['documento'] = $lista;
  if ($d['detalle'] !== '') {
    $opciones = $sv['opciones'] ?? [];
    if (!$opciones) $d['detalle'] = '';
    elseif (!in_array($d['detalle'], $opciones, true)) $e['detalle'] = 'Elige una de las opciones.';
  }
  if ($d['problema'] !== '' && !isset($c['problemas'][$d['problema']])) $e['problema'] = $lista;
  if ($d['situacion'] !== '' && !isset($c['situaciones'][$d['situacion']])) $e['situacion'] = $lista;
  $futura = in_array($d['area'], $c['areasFechaFutura'], true);
  if ($d['fecha'] !== '' && !fecha_valida($d['fecha'], $futura)) {
    $e['fecha'] = $futura ? 'Revisa la fecha: debe ser una fecha real.' : 'Revisa la fecha: debe ser una fecha real y no posterior a hoy.';
  }
  return $e ? [false, $e] : [true, $d];
}

/** Valida una solicitud de llamada. Mismas reglas que validarLlamada (src/lib/llamada.ts). */
function validar_llamada(array $raw): array {
  $c = catalogo();
  $L = $c['limitesLlamada'];
  $d = [];
  foreach (['id', 'nombre', 'telefono', 'area', 'servicio', 'motivo', 'fecha', 'localidad', 'seguro', 'franja', 'descripcion'] as $k) {
    $d[$k] = limpia($raw[$k] ?? '');
  }
  if ($d['seguro'] === '') $d['seguro'] = 'libre';
  $d['privacidad'] = privacidad_aceptada($raw['privacidad'] ?? null);
  $d['origen'] = campo_ruta($raw['origen'] ?? '');

  $e = [];
  $max = function (string $k) use (&$e, $d, $L) {
    if (largo($d[$k]) > $L[$k]) $e[$k] = "Máximo {$L[$k]} caracteres.";
  };
  if (largo($d['nombre']) < 2) $e['nombre'] = 'Escribe tu nombre.';
  $max('nombre');
  if ($d['telefono'] === '') $e['telefono'] = 'Necesitamos un teléfono para llamarte.';
  elseif (!telefono_valido($d['telefono'])) $e['telefono'] = 'Revisa el teléfono: debe tener entre 9 y 15 cifras.';
  $max('telefono');
  if (!isset($c['areas'][$d['area']])) $e['area'] = 'Elige el área (o «No sé qué área corresponde»).';
  if ($d['servicio'] !== '') {
    $sv = $c['servicios'][$d['servicio']] ?? null;
    if (!$sv || $sv['area'] !== $d['area']) $d['servicio'] = ''; // nunca bloquea una petición urgente
  }
  if (!isset($c['motivos'][$d['motivo']])) $e['motivo'] = 'Elige el motivo más parecido.';
  if ($d['fecha'] !== '' && !fecha_valida($d['fecha'], true)) $e['fecha'] = 'Revisa la fecha: debe ser una fecha real.';
  $max('localidad');
  if (!isset($c['seguro'][$d['seguro']])) $e['seguro'] = 'Elige una opción de la lista.';
  $max('franja');
  $max('descripcion');
  if (!$d['privacidad']) $e['privacidad'] = 'Necesitamos que aceptes la política de privacidad para llamarte.';
  if (!id_valido($d['id'])) $e['id'] = 'Identificador de envío no válido.';
  return $e ? [false, $e] : [true, $d];
}

/** Rótulos legibles para el correo. */
const ROTULOS = [
  'prioridad' => 'Prioridad', 'nombre' => 'Nombre', 'telefono' => 'Teléfono', 'email' => 'Correo', 'preferencia' => 'Prefiere contacto por',
  'area' => 'Área', 'servicio' => 'Asunto', 'detalle' => 'Detalle', 'motivo' => 'Motivo', 'fecha' => 'Fecha relevante',
  'localidad' => 'Localidad', 'seguro' => 'Contacto seguro', 'franja' => 'Franja para llamar',
  'papel' => 'Papel en el transporte', 'incidencia' => 'Incidencia', 'importe' => 'Importe',
  'representa' => 'Quién consulta', 'problema' => 'Problema laboral', 'situacion' => 'Situación',
  'organismo' => 'Organismo', 'documento' => 'Documento', 'responsable' => 'Responsable',
  'mensaje' => 'Mensaje', 'descripcion' => 'Descripción', 'cuestionario' => 'Resumen del cuestionario',
  'origen' => 'Página de origen', 'landing' => 'Primera página de la visita',
  'utm_source' => 'utm_source', 'utm_medium' => 'utm_medium', 'utm_campaign' => 'utm_campaign', 'id' => 'Referencia',
];

function cuerpo_correo(array $datos): string {
  $lineas = [];
  foreach (ROTULOS as $k => $rotulo) {
    $v = (string) ($datos[$k] ?? '');
    if ($v === '') continue;
    $lineas[] = str_contains($v, "\n") ? "$rotulo:\n$v\n" : "$rotulo: $v";
  }
  $lineas[] = '';
  $lineas[] = 'Recibido desde el formulario de ' . catalogo()['despacho']['dominio'] . ' el ' . date('d/m/Y H:i') . '.';
  return implode("\n", $lineas);
}

function sin_saltos(string $s): string {
  return trim(preg_replace('/[\r\n]+/', ' ', $s));
}

/** Guarda una copia fuera de la carpeta pública. Nunca bloquea el envío. */
function guardar_copia(string $tipo, array $datos): void {
  if (PHP_SAPI === 'cli' || getenv('PRAETORIA_ENTREGA_URL')) return;
  $raiz = dirname(rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? __DIR__ . '/..'), '/'));
  $dir = $raiz . '/consultas-web';
  if (!is_dir($dir) && !@mkdir($dir, 0700, true)) return;
  @file_put_contents($dir . '/' . date('Y-m') . '.jsonl', json_encode(['tipo' => $tipo, 'recibida' => date('c')] + $datos, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}

/**
 * Entrega la consulta: por correo en producción o al registro de pruebas si PRAETORIA_ENTREGA_URL existe.
 * Devuelve true solo si se ha aceptado la entrega.
 */
function entregar(string $formulario, string $asunto, array $datos, string $responder_a = ''): bool {
  $prueba = getenv('PRAETORIA_ENTREGA_URL');
  if ($prueba) {
    $ch = curl_init($prueba);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query(['form-name' => $formulario] + $datos), CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    curl_exec($ch);
    $codigo = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return $codigo === 200;
  }
  $c = catalogo();
  $remitente = REMITENTE_LOCAL . '@' . $c['despacho']['dominio'];
  $de = 'Web ' . $c['despacho']['nombre'];
  $responder = ($responder_a !== '' && filter_var($responder_a, FILTER_VALIDATE_EMAIL)) ? $responder_a : '';

  // Con clave de Resend (configuración privada fuera de la web), se envía por su API: el dominio está
  // autenticado (SPF y DKIM) y el correo llega. Si Resend falla, se intenta con mail() como respaldo.
  $clave = configuracion()['resend_api_key'] ?? '';
  if ($clave !== '' && enviar_resend($clave, "$de <$remitente>", $c['despacho']['email'], sin_saltos($asunto), cuerpo_correo($datos), $responder, $formulario)) return true;

  $cabeceras = [
    'From' => mb_encode_mimeheader($de, 'UTF-8') . " <$remitente>",
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'Content-Transfer-Encoding' => '8bit',
    'X-Formulario' => $formulario,
  ];
  if ($responder !== '') $cabeceras['Reply-To'] = $responder;
  return mail($c['despacho']['email'], mb_encode_mimeheader(sin_saltos($asunto), 'UTF-8'), cuerpo_correo($datos), $cabeceras, '-f' . $remitente);
}

/**
 * Configuración privada: un archivo PHP fuera de la carpeta pública, que no está en el repositorio
 * (el repositorio es público). En Hostinger: junto a public_html, en praetoria-config.php:
 *   <?php return ['resend_api_key' => 're_...'];
 * PRAETORIA_CONFIG permite indicar otra ruta (pruebas).
 */
function configuracion(): array {
  static $conf = null;
  if ($conf !== null) return $conf;
  $ruta = getenv('PRAETORIA_CONFIG') ?: dirname(rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? __DIR__ . '/..'), '/')) . '/praetoria-config.php';
  $leida = is_file($ruta) ? (include $ruta) : [];
  return $conf = is_array($leida) ? $leida : [];
}

/** Envío por la API de Resend (https://resend.com/docs/api-reference/emails/send-email). true si la acepta. */
function enviar_resend(string $clave, string $de, string $para, string $asunto, string $texto, string $responder, string $formulario): bool {
  $cuerpo = ['from' => $de, 'to' => [$para], 'subject' => $asunto, 'text' => $texto, 'tags' => [['name' => 'formulario', 'value' => str_replace('-', '_', $formulario)]]];
  if ($responder !== '') $cuerpo['reply_to'] = $responder;
  $ch = curl_init(getenv('PRAETORIA_RESEND_URL') ?: 'https://api.resend.com/emails');
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $clave, 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($cuerpo, JSON_UNESCAPED_UNICODE),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
  ]);
  $respuesta = curl_exec($ch);
  $codigo = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);
  if ($codigo >= 200 && $codigo < 300) return true;
  error_log("formularios: Resend respondió $codigo " . substr((string) $respuesta, 0, 300));
  return false;
}
