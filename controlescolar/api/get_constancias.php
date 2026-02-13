<?php
require_once '../config.php';
header('Content-Type: application/json');

// Opcional: Validar que el usuario esté logueado antes de dar datos
if (!isset($_SESSION['user_email'])) {
    http_response_code(401);
    echo json_encode(["error" => "No autorizado"]);
    exit;
}

$db = getDB();

$sql = "SELECT r.*, CONCAT(a.nombre, ' ', a.apellidos) AS nombre_alumno 
        FROM registro_constancias r 
        JOIN alumnos a ON r.id_alumno = a.id 
        ORDER BY r.id_registro DESC";

$stmt = $db->query($sql);
echo json_encode($stmt->fetchAll());