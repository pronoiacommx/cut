<?php
require_once '../config.php';

// Limpiar todas las variables de sesión
$_SESSION = array();

// Destruir la cookie de sesión si existe
if (isset($_COOKIE[session_name()])) {
    setcookie(session_name(), '', time()-42000, '/');
}

// Destruir la sesión física en el servidor
session_destroy();

echo json_encode(["status" => "success", "message" => "Sesión cerrada"]);