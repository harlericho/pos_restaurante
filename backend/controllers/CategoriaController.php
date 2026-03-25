<?php
// controllers/CategoriaController.php

require_once __DIR__ . '/../models/CategoriaModel.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../helpers/Response.php';

class CategoriaController
{
  private CategoriaModel $model;

  public function __construct()
  {
    $this->model = new CategoriaModel();
  }

  public function index(object $tokenData): void
  {
    Response::json(200, ['data' => $this->model->findAll()]);
  }

  public function show(object $tokenData, string $id): void
  {
    $categoria = $this->model->findById((int) $id);
    if (!$categoria) {
      Response::json(404, ['error' => 'Categoría no encontrada']);
    }
    Response::json(200, ['data' => $categoria]);
  }

  public function store(object $tokenData): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $nombre = trim($body['nombre'] ?? '');

    if ($nombre === '') {
      Response::json(422, ['error' => 'El campo nombre es requerido']);
    }

    $newId = $this->model->create(['nombre' => $nombre]);
    Response::json(201, [
      'mensaje' => 'Categoría creada exitosamente',
      'data'    => $this->model->findById($newId),
    ]);
  }

  public function update(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $categoria = $this->model->findById((int) $id);
    if (!$categoria) {
      Response::json(404, ['error' => 'Categoría no encontrada']);
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    if (isset($body['nombre']) && trim($body['nombre']) === '') {
      Response::json(422, ['error' => 'El nombre no puede estar vacío']);
    }

    $this->model->update((int) $id, $body);
    Response::json(200, [
      'mensaje' => 'Categoría actualizada exitosamente',
      'data'    => $this->model->findById((int) $id),
    ]);
  }

  public function destroy(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $categoria = $this->model->findById((int) $id);
    if (!$categoria) {
      Response::json(404, ['error' => 'Categoría no encontrada']);
    }

    $this->model->delete((int) $id);
    Response::json(200, ['mensaje' => 'Categoría desactivada exitosamente']);
  }
}
