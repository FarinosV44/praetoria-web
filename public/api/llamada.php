<?php
// Solicitud de llamada / contacto prioritario (#33): POST /api/llamada (reescrito a este archivo en .htaccess)
// Igual que consulta.php (validación compartida, campo trampa y tiempo mínimo, sin adjuntos), pero con formulario
// corto y el asunto del correo marcado como URGENTE. No promete disponibilidad.
define('PRAETORIA_FORMULARIOS', true);
require __DIR__ . '/comun.php';

[$es_json, $campos] = leer_peticion(6000);
if (parece_automatico($campos, $es_json)) $es_json ? json_resp(200, ['ok' => true]) : a_gracias();
if (!$es_json && empty($campos['id'])) $campos['id'] = nuevo_id();

[$ok, $r] = validar_llamada($campos);
if (!$ok) {
  if ($es_json) json_resp(422, ['ok' => false, 'error' => 'validacion', 'errores' => $r]);
  $items = implode('', array_map(fn ($e) => '<li>' . esc($e) . '</li>', $r));
  pagina(422, 'Revisa tu solicitud', "<p>No la hemos enviado todavía:</p><ul>$items</ul>");
}

$c = catalogo();
$datos = [
  'prioridad' => 'URGENTE',
  'id' => $r['id'],
  'nombre' => $r['nombre'],
  'telefono' => $r['telefono'],
  'area' => $c['areas'][$r['area']],
  'servicio' => $r['servicio'] !== '' ? $c['servicios'][$r['servicio']]['nombre'] : '',
  'motivo' => $c['motivos'][$r['motivo']],
  'fecha' => $r['fecha'],
  'localidad' => $r['localidad'],
  'seguro' => $c['seguro'][$r['seguro']],
  'franja' => $r['franja'],
  'descripcion' => $r['descripcion'],
  'responsable' => responsable($r['area']),
  'origen' => $r['origen'],
  'privacidad' => 'aceptada',
];
$laboral = $r['area'] === 'laboral';
$asunto = 'URGENTE · Solicitud de llamada · ' . $datos['motivo'] . ($laboral ? ' (' . $c['laboral']['nombre'] . ')' : '') . ' · ' . $datos['nombre'];

guardar_copia('llamada', $datos);
if (!entregar($laboral ? 'llamada-urgente-laboral' : 'llamada-urgente', $asunto, $datos)) {
  error_log('llamada: fallo al enviar el aviso ' . $r['id']);
  $es_json
    ? json_resp(502, ['ok' => false, 'error' => 'entrega', 'id' => $r['id']])
    : pagina(502, 'No hemos podido recibir tu solicitud', '<p>Ha fallado la entrega. Inténtalo de nuevo o, si es urgente, llama directamente.</p>');
}
$es_json ? json_resp(200, ['ok' => true, 'id' => $r['id']]) : a_gracias();
