<?php
require_once __DIR__.'/db.php';
require_once __DIR__.'/helpers.php';

function auth_login(array $body) {
  require_fields($body, ['email','password']);

  $pdo = db();
  $stmt = $pdo->prepare("SELECT id, rol_id, password_hash, activo, nombre, email FROM usuarios WHERE email=? LIMIT 1");
  $stmt->execute([$body['email']]);
  $u = $stmt->fetch();
  if (!$u || !$u['activo'] || !password_verify($body['password'], $u['password_hash'])) {
    json_response(['error'=>'Credenciales inválidas'], 401);
  }

  $token = bin2hex(random_bytes(32));
  $expira = (new DateTime('now', new DateTimeZone('UTC')))->modify('+8 hours')->format('Y-m-d H:i:s');

  $stmt = $pdo->prepare("INSERT INTO auth_tokens(usuario_id, token, expira_en) VALUES(?,?,?)");
  $stmt->execute([$u['id'], $token, $expira]);

  json_response([
    'token'=>$token,
    'expira_en'=>$expira,
    'usuario'=>[
      'id'=>$u['id'],
      'rol_id'=>$u['rol_id'],
      'nombre'=>$u['nombre'],
      'email'=>$u['email']
    ]
  ]);
}

function auth_me(string $token) {
  $pdo = db();
  $stmt = $pdo->prepare("
    SELECT u.id,u.rol_id,u.nombre,u.email
    FROM auth_tokens t
    JOIN usuarios u ON u.id=t.usuario_id
    WHERE t.token=? AND t.expira_en>UTC_TIMESTAMP()
    LIMIT 1
  ");
  $stmt->execute([$token]);
  return $stmt->fetch() ?: null;
}
