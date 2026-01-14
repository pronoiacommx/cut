<?php
function json_response($data, int $status=200) {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function get_json_body(): array {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function require_fields(array $data, array $fields) {
  foreach ($fields as $f) {
    if (!isset($data[$f]) || $data[$f] === '') {
      json_response(['error'=>"Falta campo: $f"], 422);
    }
  }
}

function normalize_curp(?string $curp): ?string {
  if ($curp === null) return null;
  $curp = strtoupper(trim($curp));
  $curp = preg_replace('/\s+/', '', $curp);
  return $curp ?: null;
}

function is_valid_curp(?string $curp): bool {
  if (!$curp) return false;
  // validación básica (no calcula dígito verificador)
  return (bool)preg_match('/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/', $curp);
}
