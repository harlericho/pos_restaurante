<?php
// controllers/AuthController.php

require_once __DIR__ . '/../models/UsuarioModel.php';
require_once __DIR__ . '/../helpers/JwtHelper.php';
require_once __DIR__ . '/../helpers/Response.php';

class AuthController
{
  private UsuarioModel $model;

  public function __construct()
  {
    $this->model = new UsuarioModel();
  }

  public function login(?object $tokenData = null): void
  {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $usuario  = trim($body['usuario'] ?? '');
    $password = $body['password'] ?? '';

    if ($usuario === '' || $password === '') {
      Response::json(422, ['error' => 'Los campos usuario y password son requeridos']);
    }

    $user = $this->model->findByUsuario($usuario);

    if (!$user || !password_verify($password, $user['password'])) {
      Response::json(401, ['error' => 'Credenciales incorrectas']);
    }

    $token = JwtHelper::generarToken([
      'sub'    => $user['id'],
      'nombre' => $user['nombre'],
      'rol'    => $user['rol'],
    ]);

    Response::json(200, [
      'mensaje' => 'Login exitoso',
      'token'   => $token,
      'usuario' => [
        'id'     => $user['id'],
        'nombre' => $user['nombre'],
        'rol'    => $user['rol'],
      ],
    ]);
  }
}
