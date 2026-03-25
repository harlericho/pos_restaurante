<?php
// controllers/RecetaController.php

require_once __DIR__ . '/../models/RecetaModel.php';
require_once __DIR__ . '/../models/ProductoModel.php';
require_once __DIR__ . '/../models/InsumoModel.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../helpers/Response.php';

class RecetaController
{
  private RecetaModel $model;

  public function __construct()
  {
    $this->model = new RecetaModel();
  }

  public function indexByProducto(object $tokenData, string $productoId): void
  {
    $productoModel = new ProductoModel();
    if (!$productoModel->findById((int) $productoId)) {
      Response::json(404, ['error' => 'Producto no encontrado']);
    }

    Response::json(200, ['data' => $this->model->findByProducto((int) $productoId)]);
  }

  public function store(object $tokenData): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $body       = json_decode(file_get_contents('php://input'), true) ?? [];
    $productoId = $body['producto_id'] ?? null;
    $insumoId   = $body['insumo_id'] ?? null;
    $cantidad   = $body['cantidad'] ?? null;

    if (!$productoId || !$insumoId || $cantidad === null) {
      Response::json(422, ['error' => 'Los campos producto_id, insumo_id y cantidad son requeridos']);
    }

    if (!is_numeric($cantidad) || (float) $cantidad <= 0) {
      Response::json(422, ['error' => 'La cantidad debe ser mayor a cero']);
    }

    $productoModel = new ProductoModel();
    if (!$productoModel->findById((int) $productoId)) {
      Response::json(422, ['error' => 'El producto especificado no existe']);
    }

    $insumoModel = new InsumoModel();
    if (!$insumoModel->findById((int) $insumoId)) {
      Response::json(422, ['error' => 'El insumo especificado no existe']);
    }

    if ($this->model->yaExiste((int) $productoId, (int) $insumoId)) {
      Response::json(409, ['error' => 'Este insumo ya está registrado en la receta de ese producto']);
    }

    $newId = $this->model->create([
      'producto_id' => (int) $productoId,
      'insumo_id'   => (int) $insumoId,
      'cantidad'    => (float) $cantidad,
    ]);

    Response::json(201, [
      'mensaje' => 'Ingrediente de receta agregado exitosamente',
      'data'    => $this->model->findById($newId),
    ]);
  }

  public function destroy(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $receta = $this->model->findById((int) $id);
    if (!$receta) {
      Response::json(404, ['error' => 'Registro de receta no encontrado']);
    }

    $this->model->delete((int) $id);
    Response::json(200, ['mensaje' => 'Ingrediente eliminado de la receta']);
  }
}
