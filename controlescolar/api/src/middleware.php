<?php
require_once __DIR__.'/helpers.php';
require_once __DIR__.'/auth.php';

function bearer_token(): ?string {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  if (preg_match('/Bearer\s+(.+)/i', $h, $m)) return trim($m[1]);
  return null;
}

function require_auth(array $allowed_roles = []) {
  $token = bearer_token();
  if (!$token) json_response(['error'=>'Falta token'], 401);

  $me = auth_me($token);
  if (!$me) json_response(['error'=>'Token inválido o expirado'], 401);

  if ($allowed_roles && !in_array((int)$me['rol_id'], $allowed_roles, true)) {
    json_response(['error'=>'No autorizado'], 403);
  }
  return $me;
}
