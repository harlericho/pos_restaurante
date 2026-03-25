<?php
// controllers/UsuarioController.php

require_once __DIR__ . '/../models/UsuarioModel.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../helpers/Response.php';

class UsuarioController
{
  private UsuarioModel $model;

  public function __construct()
  {
    $this->model = new UsuarioModel();
  }

  public function index(object $tokenData): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');
    Response::json(200, ['data' => $this->model->findAll()]);
  }

  public function show(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $usuario = $this->model->findById((int) $id);
    if (!$usuario) {
      Response::json(404, ['error' => 'Usuario no encontrado']);
    }

    Response::json(200, ['data' => $usuario]);
  }

  public function store(object $tokenData): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $nombre   = trim($body['nombre'] ?? '');
    $usuario  = trim($body['usuario'] ?? '');
    $password = $body['password'] ?? '';
    $rol      = $body['rol'] ?? 'mesero';

    if ($nombre === '' || $usuario === '' || $password === '') {
      Response::json(422, ['error' => 'Los campos nombre, usuario y password son requeridos']);
    }

    if (!in_array($rol, ['admin', 'mesero'])) {
      Response::json(422, ['error' => 'El rol debe ser admin o mesero']);
    }

    if ($this->model->usuarioExiste($usuario)) {
      Response::json(409, ['error' => 'El nombre de usuario ya está en uso']);
    }

    $newId = $this->model->create([
      'nombre'   => $nombre,
      'usuario'  => $usuario,
      'password' => $password,
      'rol'      => $rol,
    ]);

    Response::json(201, [
      'mensaje' => 'Usuario creado exitosamente',
      'data'    => $this->model->findById($newId),
    ]);
  }

  public function update(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $usuario = $this->model->findById((int) $id);
    if (!$usuario) {
      Response::json(404, ['error' => 'Usuario no encontrado']);
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    if (isset($body['rol']) && !in_array($body['rol'], ['admin', 'mesero'])) {
      Response::json(422, ['error' => 'El rol debe ser admin o mesero']);
    }

    if (isset($body['usuario'])) {
      $body['usuario'] = trim($body['usuario']);
      if ($this->model->usuarioExiste($body['usuario'], (int) $id)) {
        Response::json(409, ['error' => 'El nombre de usuario ya está en uso']);
      }
    }

    $this->model->update((int) $id, $body);

    Response::json(200, [
      'mensaje' => 'Usuario actualizado exitosamente',
      'data'    => $this->model->findById((int) $id),
    ]);
  }

  public function destroy(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $usuario = $this->model->findById((int) $id);
    if (!$usuario) {
      Response::json(404, ['error' => 'Usuario no encontrado']);
    }

    // No permitir eliminar el propio usuario
    if ((int) $id === (int) $tokenData->sub) {
      Response::json(403, ['error' => 'No puedes desactivar tu propia cuenta']);
    }

    $this->model->delete((int) $id);
    Response::json(200, ['mensaje' => 'Usuario desactivado exitosamente']);
  }
}
