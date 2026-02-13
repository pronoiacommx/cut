<?php
require_once 'config.php';
$clase_id = $_GET['clase_id'] ?? 0;

$db = getDB();
$stmt = $db->prepare("
    SELECT a.id, a.nombre, a.apellidos, a.matricula 
    FROM alumnos a
    JOIN inscripciones i ON a.id = i.alumno_id
    JOIN clases_asignadas ca ON i.grupo_id = ca.grupo_id
    WHERE ca.id = ?
    ORDER BY a.apellidos ASC
");
$stmt->execute([$clase_id]);
echo json_encode($stmt->fetchAll());