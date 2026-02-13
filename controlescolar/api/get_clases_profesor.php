<?php
// api/get_clases_profesor.php
require_once 'config.php';
header('Content-Type: application/json');

// 1. Verificación de seguridad
if (!isset($_SESSION['user_id']) || $_SESSION['user_role'] !== 'Profesor') {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Sesión no válida o nivel de acceso insuficiente"]);
    exit;
}

try {
    $db = getDB();
    
    // 2. Consulta con JOINs a materias, grupos y el catálogo de días
    $sql = "SELECT 
                ca.id,
                m.nombre_materia,
                m.clave,
                g.nombre_grupo,
                d.nombre AS dia_nombre,
                TIME_FORMAT(ca.hora_inicio, '%H:%i') as hora_inicio,
                TIME_FORMAT(ca.hora_fin, '%H:%i') as hora_fin,
                ca.aula
            FROM clases_asignadas ca
            JOIN materias m ON ca.materia_id = m.id
            JOIN grupos g ON ca.grupo_id = g.id
            JOIN cat_dias_semana d ON ca.dia_id = d.id
            JOIN usuarios u ON u.perfil_id = ca.profesor_id
            WHERE u.id = ?
            ORDER BY d.id, ca.hora_inicio";

    $stmt = $db->prepare($sql);
    $stmt->execute([$_SESSION['user_id']]);
    $clases = $stmt->fetchAll();

    echo json_encode($clases);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}