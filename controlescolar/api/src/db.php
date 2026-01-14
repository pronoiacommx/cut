<?php
function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;

  $host = getenv('DB_HOST') ?: '127.0.0.1';
  $name = getenv('DB_NAME') ?: 'prospectos';
  $user = getenv('DB_USER') ?: 'root';
  $pass = getenv('DB_PASS') ?: '';
  $charset = 'utf8mb4';

  $dsn = "mysql:host=$host;dbname=$name;charset=$charset";
  $pdo = new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
  ]);
  return $pdo;
}
