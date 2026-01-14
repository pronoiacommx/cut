<?php
require_once __DIR__.'/../db.php';
require_once __DIR__.'/../helpers.php';

function prospects_list($me) {
  $pdo = db();
  $where = [];
  $params = [];

  // vendedores ven lo suyo; admin ve todo
  if ((int)$me['rol_id'] === 2) { // VENDEDOR
    $where[] = "p.vendedor_id=?";
    $params[] = $me['id'];
  }

  $q = $_GET['q'] ?? null;
  if ($q) {
    $where[]="(p.nombre_completo LIKE ? OR p.email LIKE ? OR p.telefono LIKE ? OR p.curp LIKE ?)";
    $like="%$q%";
    array_push($params,$like,$like,$like,$like);
  }

  $sql = "SELECT p.*, e.nombre AS etapa_nombre
          FROM prospectos p
          JOIN pipeline_etapas e ON e.id=p.etapa_id";
  if ($where) $sql .= " WHERE ".implode(" AND ", $where);
  $sql .= " ORDER BY p.actualizado_en DESC, p.creado_en DESC LIMIT 300";

  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  json_response(['items'=>$stmt->fetchAll()]);
}

function pick_vendor_least_load(PDO $pdo): ?int {
  $sql = "
    SELECT u.id
    FROM usuarios u
    LEFT JOIN prospectos p
      ON p.vendedor_id=u.id
     AND p.etapa_id NOT IN ((SELECT id FROM pipeline_etapas WHERE clave IN ('INSCRITO','DESCARTADO')))
    WHERE u.rol_id=(SELECT id FROM roles WHERE nombre='VENDEDOR') AND u.activo=1
    GROUP BY u.id
    ORDER BY COUNT(p.id) ASC, u.id ASC
    LIMIT 1
  ";
  $v = $pdo->query($sql)->fetch();
  return $v ? (int)$v['id'] : null;
}

function prospects_intake_and_autoassign(array $body) {
  // endpoint público: crea prospecto + asigna vendedor automáticamente
  $pdo = db();

  $interes = $body['interes'] ?? 'FRIO';
  $nombre  = trim((string)($body['nombre_completo'] ?? ''));
  $email   = trim((string)($body['email'] ?? ''));
  $tel     = trim((string)($body['telefono'] ?? ''));
  $curp    = normalize_curp($body['curp'] ?? null);
  $fuente  = $body['fuente'] ?? 'web';
  $campaña = $body['campaña'] ?? null;

  if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['error'=>'Email inválido'], 422);
  }
  if ($curp && !is_valid_curp($curp)) {
    json_response(['error'=>'CURP inválido (formato)'], 422);
  }

  $vendor_id = pick_vendor_least_load($pdo);
  if (!$vendor_id) json_response(['error'=>'No hay vendedores activos'], 409);

  $pdo->beginTransaction();
  try {
    $stmt = $pdo->prepare("
      INSERT INTO prospectos(interes,nombre_completo,curp,email,telefono,fuente,campaña,etapa_id,vendedor_id)
      VALUES(?,?,?,?,?,?,?, (SELECT id FROM pipeline_etapas WHERE clave='ASIGNADO_VENDEDOR'), ?)
    ");
    $stmt->execute([$interes,$nombre?:null,$curp,$email?:null,$tel?:null,$fuente,$campaña,$vendor_id]);
    $id = (int)$pdo->lastInsertId();

    $pdo->prepare("INSERT INTO prospecto_historial(prospecto_id,usuario_id,accion,detalle)
                   VALUES(?,NULL,'CREATE_PUBLIC',JSON_OBJECT('fuente',?,'interes',?))")
        ->execute([$id,$fuente,$interes]);

    $pdo->prepare("INSERT INTO prospecto_historial(prospecto_id,usuario_id,accion,detalle)
                   VALUES(?,NULL,'AUTO_ASSIGN',JSON_OBJECT('vendedor_id',?))")
        ->execute([$id,$vendor_id,$vendor_id]);

    $pdo->commit();

    json_response([
      'ok'=>true,
      'prospecto_id'=>$id,
      'vendedor_id'=>$vendor_id
    ], 201);
  } catch (Throwable $e) {
    $pdo->rollBack();
    // manejo simple por duplicados (email/curp)
    $msg = $e->getMessage();
    if (str_contains($msg, 'uq_prospectos_email')) $msg = 'Ya existe un prospecto con ese email';
    if (str_contains($msg, 'uq_prospectos_curp'))  $msg = 'Ya existe un prospecto con ese CURP';
    json_response(['error'=>$msg], 409);
  }
}
