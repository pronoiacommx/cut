<?php
// Agrega esto al inicio para ver el error real en la consola o en el log
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);


// api/login.php
require_once 'config.php'; // Asegúrate de que este archivo tiene session_start() y getDB()
header('Content-Type: application/json');

// 1. Recibir y limpiar datos
$input = json_decode(file_get_contents("php://input"), true);
$u = isset($input['email']) ? trim($input['email']) : '';
$p = isset($input['password']) ? trim($input['password']) : '';

if (empty($u) || empty($p)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "message" => "Usuario y contraseña son obligatorios"]);
    exit;
}

try {
    $db = getDB();

    // 2. Consulta con JOIN a empleados y roles
    $sql = "SELECT 
                u.id, 
                u.email, 
                u.password, 
                u.status,
                u.force_change,
                r.nombre_rol AS rol,
                e.nombre,
                e.apellidos,
                e.id AS empleado_id
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.id
            JOIN empleados e ON u.perfil_id = e.id
            WHERE u.email = ?
            LIMIT 1";

    $stmt = $db->prepare($sql);
    $stmt->execute([$u]);
    $row = $stmt->fetch();

    // 3. Validar existencia
    if (!$row) {
        http_response_code(401);
        echo json_encode(["ok" => false, "message" => "Credenciales inválidas o cuenta inactiva"]);
        exit;
    }

    // 4. Verificar Contraseña con Bcrypt
    // PHP maneja los hashes $2b$ o $2y$ automáticamente con password_verify
    $stored_hash = trim($row["password"]);
    
    if (!password_verify($p, $stored_hash)) {
        http_response_code(401);
        echo json_encode(["ok" => false, "message" => "Contraseña incorrecta"]);
        exit;
    }

    // 5. Validar status activo (1 = activo)
    if ((int)$row["status"] !== 1) {
        http_response_code(401);
        echo json_encode(["ok" => false, "message" => "Cuenta inactiva"]);
        exit;
    }

    // 6. Generar Sesión en PHP (Equivalente al token de sesión)
    $_SESSION['user_id'] = $row['id'];
    $_SESSION['user_email'] = $row['email'];
    $_SESSION['user_name'] = $row['nombre'] . " " . $row['apellidos'];
    $_SESSION['user_role'] = $row['rol'];

    // Calcular iniciales
    $initials = strtoupper(substr($row['nombre'], 0, 1) . substr($row['apellidos'], 0, 1));
    $rol_usuario = trim($row["rol"]);
    // 7. Respuesta idéntica a tu modelo anterior
    echo json_encode([
        "status" => "success", // Para que tu JS lo detecte
        "ok" => true,
        "user" => [
            "id" => $row["id"],
            "email" => $row["email"],
            "nombre_completo" => $row['nombre'] . " " . $row['apellidos'],
            "rol" => $rol_usuario,
            "force_change" => (int)$row["force_change"],
            "initials" => $initials
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["ok" => false, "message" => "Error interno de base de datos"]);
}