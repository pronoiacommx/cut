<?php
require_once 'config.php';
header('Content-Type: application/json');

$clase_id = $_GET['clase_id'] ?? null;

if (!$clase_id) {
    echo json_encode(["status" => "error", "message" => "ID de clase no proporcionado"]);
    exit;
}
try {
    $db = getDB();
    
    $sql = "SELECT 
                al.id as alumno_id,
                al.nombre,
                al.apellidos,
                al.matricula
            FROM alumnos al
            INNER JOIN alumnos_grupo ga ON al.id = ga.alumno_id
            INNER JOIN clases_asignadas ca ON ga.grupo_id = ca.grupo_id
            WHERE ca.id = ?
            ORDER BY al.apellidos ASC";

    $stmt = $db->prepare($sql);
    $stmt->execute([$clase_id]);
    $alumnos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($alumnos);
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}