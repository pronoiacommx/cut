<?php
require_once __DIR__.'/../src/helpers.php';
require_once __DIR__.'/../src/auth.php';
require_once __DIR__.'/../src/middleware.php';
require_once __DIR__.'/../src/controllers/prospects.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS');
if ($method === 'OPTIONS') exit;

// ===== Normaliza PATH para XAMPP subfolder =====
// Ej: /controlescolar/api/public/index.php/login  =>  /login
$uriPath  = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$script   = $_SERVER['SCRIPT_NAME']; // /controlescolar/api/public/index.php
$path     = $uriPath;

if (strpos($path, $script) === 0) {
  $path = substr($path, strlen($script));
}
if ($path === '' || $path === false) $path = '/';
if ($path[0] !== '/') $path = '/'.$path;

// ===== Rutas (SIN /api) =====
if ($path === '/health') json_response(['ok'=>true]);

if ($path === '/login' && $method === 'POST') {
  auth_login(get_json_body());
}

if ($path === '/prospects' && $method === 'GET') {
  $me = require_auth([1,2]); // ADMIN, VENDEDOR
  prospects_list($me);
}

// Opción A: Captura pública + auto-asignación
if ($path === '/prospects/intake' && $method === 'POST') {
  prospects_intake_and_autoassign(get_json_body());
}

json_response(['error'=>'Ruta no encontrada', 'path'=>$path], 404);
