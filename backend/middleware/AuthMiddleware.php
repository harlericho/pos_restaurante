<?php
// middleware/AuthMiddleware.php

require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/JwtHelper.php';

// Middleware para proteger rutas que requieren autenticación
class AuthMiddleware
{
  public static function requiereToken()
  {
    $headers = function_exists('getallheaders') ? getallheaders() : [];

    // Soporte para variaciones de capitalización del header
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;

    if (!$authHeader) {
      Response::json(401, ['error' => 'Token requerido en el header Authorization']);
    }

    if (substr($authHeader, 0, 7) !== 'Bearer ') {
      Response::json(400, ['error' => 'Formato de token inválido. Use: Bearer {token}']);
    }

    $token = substr($authHeader, 7);

    try {
      return JwtHelper::validarToken($token);
    } catch (Exception $e) {
      Response::json(403, ['error' => 'Token inválido o expirado', 'detalle' => $e->getMessage()]);
    }
  }

  public static function requiereRol(object $tokenData, string ...$roles): void
  {
    if (!in_array($tokenData->rol, $roles)) {
      Response::json(403, [
        'error' => 'Acceso denegado. Se requiere rol: ' . implode(' o ', $roles)
      ]);
    }
  }
}
