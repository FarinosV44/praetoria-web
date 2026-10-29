<?php
// Recepción de consultas del formulario de contacto: POST /api/consulta (reescrito a este archivo en .htaccess)
// 1. Acepta JSON (envío desde la página) o formulario clásico (sin JavaScript).
// 2. Valida en servidor con las mismas reglas que el navegador (src/lib/consulta.ts).
// 3. Descarta envíos automáticos (campo trampa o envío en menos de 3 s) sin avisar al bot.
// 4. Envía el aviso por correo al despacho (comun.php). Laboral lleva en el asunto que lo atiende Lucía López.
// 5. Solo responde éxito si el correo se ha aceptado para su envío. Si falla, 502: el navegador ofrece reintentar.
// No acepta adjuntos.
define('PRAETORIA_FORMULARIOS', true);
require __DIR__ . '/comun.php';

[$es_json, $campos] = leer_peticion(12000);
if (parece_automatico($campos, $es_json)) $es_json ? json_resp(200, ['ok' => true]) : a_gracias();
if (!$es_json && empty($campos['id'])) $campos['id'] = nuevo_id();

[$ok, $r] = validar_consulta($campos);
if (!$ok) {
  if ($es_json) json_resp(422, ['ok' => false, 'error' => 'validacion', 'errores' => $r]);
  $items = implode('', array_map(fn ($e) => '<li>' . esc($e) . '</li>', $r));
  pagina(422, 'Revisa tu consulta', "<p>No la hemos enviado todavía:</p><ul>$items</ul>");
}

$c = catalogo();
$sv = $r['servicio'] !== '' ? $c['servicios'][$r['servicio']] : null;
$datos = [
  'id' => $r['id'],
  'nombre' => $r['nombre'],
  'email' => $r['email'],
  'telefono' => $r['telefono'],
  'area' => $c['areas'][$r['area']],
  'servicio' => $sv['nombre'] ?? '',
  'papel' => $c['papeles'][$r['papel']] ?? '',
  'incidencia' => $c['incidencias'][$r['incidencia']] ?? '',
  'importe' => $c['importes'][$r['importe']] ?? '',
  'fecha' => $r['fecha'],
  'representa' => $c['representa'][$r['representa']] ?? '',
  'problema' => $c['problemas'][$r['problema']] ?? '',
  'situacion' => $c['situaciones'][$r['situacion']] ?? '',
  'cuestionario' => $r['cuestionario'],
  'organismo' => $c['organismos'][$r['organismo']] ?? '',
  'documento' => $c['documentos'][$r['documento']] ?? '',
  'origen' => $r['origen'],
  'landing' => $r['landing'],
  'utm_source' => $r['utm_source'],
  'utm_medium' => $r['utm_medium'],
  'utm_campaign' => $r['utm_campaign'],
  'detalle' => $r['detalle'] !== '' ? trim(($sv['pregunta'] ?? '') . ' ' . $r['detalle']) : '',
  'responsable' => responsable($r['area']),
  'preferencia' => $c['preferencias'][$r['preferencia']],
  'mensaje' => $r['mensaje'],
  'privacidad' => 'aceptada',
];
$laboral = $r['area'] === 'laboral';
$asunto = 'Nueva consulta web · ' . $datos['area'] . ($laboral ? ' (' . $c['laboral']['nombre'] . ')' : '') . ' · ' . $datos['nombre'];

guardar_copia('consulta', $datos);
if (!entregar($laboral ? 'contacto-laboral' : 'contacto', $asunto, $datos, $r['email'])) {
  error_log('consulta: fallo al enviar el aviso ' . $r['id']);
  $es_json
    ? json_resp(502, ['ok' => false, 'error' => 'entrega', 'id' => $r['id']])
    : pagina(502, 'No hemos podido recibir tu consulta', '<p>Ha fallado la entrega. Vuelve atrás e inténtalo de nuevo, o escribe a ' . esc($c['despacho']['email']) . '.</p>');
}
$es_json ? json_resp(200, ['ok' => true, 'id' => $r['id']]) : a_gracias();
