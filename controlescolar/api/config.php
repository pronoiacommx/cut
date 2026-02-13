<?php
// api/config.php

// 1. Detección automática de entorno
$isLocal = in_array($_SERVER['REMOTE_ADDR'], ['127.0.0.1', '::1']) || $_SERVER['SERVER_NAME'] == 'localhost';

//if (!$isLocal) {
if (1==2) {
    // --- CONFIGURACIÓN LOCAL (XAMPP / WAMP) ---
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'cutlaguna');
    define('DB_USER', 'cut_user');
    define('DB_PASS', 'cutlaguna');
    
    // Para ver errores mientras programas
    ini_set('display_errors', 1);
    error_reporting(E_ALL);
} else {
    // --- CONFIGURACIÓN SERVIDOR REAL (PRODUCCIÓN) ---
    define('DB_HOST', 'MYSQL8003.site4now.net');
    define('DB_NAME', 'db_a11cfe_cutlagu');
    define('DB_USER', 'a11cfe_cutlagu');
    define('DB_PASS', 'admin.123');
    
    // Ocultar errores al público por seguridad
    ini_set('display_errors', 0);
    error_reporting(0);
}

// 2. Inicio de sesión y función getDB (igual que antes)
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function getDB() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        return new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        header('Content-Type: application/json');
        die(json_encode(["status" => "error", "message" => "No se pudo conectar a la DB"]));
    }
}