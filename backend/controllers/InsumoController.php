<?php
// controllers/InsumoController.php

require_once __DIR__ . '/../models/InsumoModel.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../helpers/Response.php';

class InsumoController
{
  private InsumoModel $model;

  public function __construct()
  {
    $this->model = new InsumoModel();
  }

  public function index(object $tokenData): void
  {
    Response::json(200, ['data' => $this->model->findAll()]);
  }

  public function show(object $tokenData, string $id): void
  {
    $insumo = $this->model->findById((int) $id);
    if (!$insumo) {
      Response::json(404, ['error' => 'Insumo no encontrado']);
    }
    Response::json(200, ['data' => $insumo]);
  }

  public function store(object $tokenData): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $nombre = trim($body['nombre'] ?? '');
    $unidad = trim($body['unidad'] ?? '');

    if ($nombre === '' || $unidad === '') {
      Response::json(422, ['error' => 'Los campos nombre y unidad son requeridos']);
    }

    $stock = $body['stock'] ?? 0;
    if (!is_numeric($stock) || (float) $stock < 0) {
      Response::json(422, ['error' => 'El stock debe ser un número positivo']);
    }

    $newId = $this->model->create([
      'nombre' => $nombre,
      'stock'  => (float) $stock,
      'unidad' => $unidad,
    ]);

    Response::json(201, [
      'mensaje' => 'Insumo creado exitosamente',
      'data'    => $this->model->findById($newId),
    ]);
  }

  public function update(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $insumo = $this->model->findById((int) $id);
    if (!$insumo) {
      Response::json(404, ['error' => 'Insumo no encontrado']);
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    if (isset($body['stock']) && (!is_numeric($body['stock']) || (float) $body['stock'] < 0)) {
      Response::json(422, ['error' => 'El stock debe ser un número positivo']);
    }

    $this->model->update((int) $id, $body);
    Response::json(200, [
      'mensaje' => 'Insumo actualizado exitosamente',
      'data'    => $this->model->findById((int) $id),
    ]);
  }

  public function destroy(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $insumo = $this->model->findById((int) $id);
    if (!$insumo) {
      Response::json(404, ['error' => 'Insumo no encontrado']);
    }

    if ($this->model->tieneRecetas((int) $id)) {
      Response::json(409, ['error' => 'No se puede eliminar un insumo que está siendo usado en recetas']);
    }

    $this->model->delete((int) $id);
    Response::json(200, ['mensaje' => 'Insumo eliminado exitosamente']);
  }
}
