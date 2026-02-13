<?php
require_once 'config.php';
header('Content-Type: application/json');

// Captura el JSON del cuerpo de la petición
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Validación de datos recibidos
if (empty($data) || !isset($data['clase_id']) || !isset($data['lista'])) {
    echo json_encode([
        "status" => "error", 
        "message" => "Datos incompletos",
        "debug" => $input // Esto te ayudará a ver qué está llegando realmente
    ]);
    exit;
}

$clase_id = $data['clase_id'];
$lista = $data['lista'];
$fecha = date('Y-m-d');
$profesor_id = $_SESSION['perfil_id'] ?? 1; // ID del profesor logueado

try {
    $db = getDB();
    $db->beginTransaction();

    // Usamos el nuevo nombre: alumno_asistencias
    $sql = "INSERT INTO alumno_asistencias (clase_asignada_id, alumno_id, fecha, estatus, profesor_id) 
            VALUES (?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE estatus = VALUES(estatus), created_at = CURRENT_TIMESTAMP";

    $stmt = $db->prepare($sql);

    foreach ($lista as $item) {
        $stmt->execute([
            $clase_id, 
            $item['alumno_id'], 
            $fecha, 
            $item['estatus'], 
            $profesor_id
        ]);
    }

    $db->commit();
    echo json_encode(["status" => "success", "message" => "Asistencia guardada con éxito"]);

} catch (Exception $e) {
    if($db) $db->rollBack();
    echo json_encode(["status" => "error", "message" => "Error en BD: " . $e->getMessage()]);
}

#1364 - Field 'num_empleado' doesn't have a default value
CUT-PROF-001