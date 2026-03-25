<?php
// helpers/JwtHelper.php

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

require_once __DIR__ . '/../config/config.php';

// Clase para manejar la generación y validación de tokens JWT
class JwtHelper
{
  public static function generarToken(array $payloadExtra = []): string
  {
    $now = time();

    $payload = array_merge([
      'iat' => $now,
      'exp' => $now + JWT_EXPIRATION
    ], $payloadExtra);

    return JWT::encode($payload, JWT_SECRET, 'HS256');
  }

  public static function validarToken(string $token)
  {
    return JWT::decode($token, new Key(JWT_SECRET, 'HS256'));
  }
}
