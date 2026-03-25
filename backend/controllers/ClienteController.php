<?php
// controllers/ClienteController.php

require_once __DIR__ . '/../models/ClienteModel.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../helpers/Response.php';

class ClienteController
{
  private ClienteModel $model;

  public function __construct()
  {
    $this->model = new ClienteModel();
  }

  /** GET /api/clientes  — todos los roles autenticados pueden listar */
  public function index(object $tokenData): void
  {
    $q = trim($_GET['q'] ?? '');
    if ($q !== '') {
      Response::json(200, ['data' => $this->model->search($q)]);
    }
    Response::json(200, ['data' => $this->model->findAll()]);
  }

  /** GET /api/clientes/{id} */
  public function show(object $tokenData, string $id): void
  {
    $cliente = $this->model->findById((int) $id);
    if (!$cliente) {
      Response::json(404, ['error' => 'Cliente no encontrado']);
    }
    Response::json(200, ['data' => $cliente]);
  }

  /** POST /api/clientes — admin y mesero */
  public function store(object $tokenData): void
  {
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $nombre = trim($body['nombre'] ?? '');
    $ciNit  = trim($body['ci_nit']  ?? '');
    $email  = trim($body['email']   ?? '');

    if ($nombre === '') {
      Response::json(422, ['error' => 'El campo nombre es requerido']);
    }
    if ($ciNit === '') {
      Response::json(422, ['error' => 'El campo CI / RUC es requerido']);
    }
    if ($email === '') {
      Response::json(422, ['error' => 'El campo email es requerido']);
    }

    $newId = $this->model->create([
      'nombre'   => $nombre,
      'ci_nit'   => $ciNit,
      'telefono' => trim($body['telefono'] ?? '') ?: null,
      'email'    => $email,
    ]);

    Response::json(201, [
      'mensaje' => 'Cliente creado exitosamente',
      'data'    => $this->model->findById($newId),
    ]);
  }

  /** PUT /api/clientes/{id} — solo admin */
  public function update(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $cliente = $this->model->findById((int) $id);
    if (!$cliente) {
      Response::json(404, ['error' => 'Cliente no encontrado']);
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    if (isset($body['nombre']) && trim($body['nombre']) === '') {
      Response::json(422, ['error' => 'El nombre no puede quedar vacío']);
    }
    if (isset($body['ci_nit']) && trim($body['ci_nit']) === '') {
      Response::json(422, ['error' => 'El CI / RUC no puede quedar vacío']);
    }
    if (isset($body['email']) && trim($body['email']) === '') {
      Response::json(422, ['error' => 'El email no puede quedar vacío']);
    }

    $this->model->update((int) $id, $body);

    Response::json(200, [
      'mensaje' => 'Cliente actualizado exitosamente',
      'data'    => $this->model->findById((int) $id),
    ]);
  }

  /** DELETE /api/clientes/{id} — solo admin */
  public function destroy(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $cliente = $this->model->findById((int) $id);
    if (!$cliente) {
      Response::json(404, ['error' => 'Cliente no encontrado']);
    }

    $this->model->delete((int) $id);
    Response::json(200, ['mensaje' => 'Cliente eliminado exitosamente']);
  }
}
