<?php
// config/config.php

// Zona horaria del servidor — ajusta según tu país
date_default_timezone_set('America/Guayaquil'); // UTC-5 (Ecuador)

$dbConfig  = parse_ini_file(__DIR__ . '/init/config.ini');
$jwtConfig = parse_ini_file(__DIR__ . '/init/jwt.ini');

if (!$dbConfig || !$jwtConfig) {
  die("Error: No se pudieron cargar los archivos de configuración .ini");
}

// Configuración de DB
define('DB_HOST', $dbConfig['DB_HOST']);
define('DB_NAME', $dbConfig['DB_NAME']);
define('DB_USER', $dbConfig['DB_USER']);
define('DB_PASS', $dbConfig['DB_PASS']);
define('DB_PORT', (int)$dbConfig['DB_PORT']);

// Configuración de JWT
define('JWT_SECRET', $jwtConfig['JWT_SECRET']);
define('JWT_EXPIRATION', (int)$jwtConfig['JWT_EXPIRATION']);
