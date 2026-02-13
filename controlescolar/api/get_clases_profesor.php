<?php
require_once 'config.php';
header('Content-Type: application/json');

// ID del profesor logueado (Simulado para la demo)
$id_empleado = 31; 

try {
    $db = getDB();

    // Consultamos directamente de clases_asignadas usando sus llaves foráneas
    $sql = "SELECT 
                cla.id AS carga_id,
                cla.hora_inicio,
                cla.hora_fin,
                cla.aula,
                m.nombre_materia,
                m.clave,
                g.nombre_grupo,
                d.nombre
            FROM clases_asignadas cla
            INNER JOIN cat_materias m ON cla.materia_id = m.id
            INNER JOIN cat_grupos g ON cla.grupo_id = g.id
            INNER JOIN cat_dias_semana d ON cla.dia_id = d.id
            WHERE cla.profesor_id = :id_empleado
            ORDER BY d.id ASC, cla.hora_inicio ASC";

    $stmt = $db->prepare($sql);
    $stmt->execute(['id_empleado' => $id_empleado]);
    $clases = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($clases);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Error al obtener la agenda: " . $e->getMessage()
    ]);
}