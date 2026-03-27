<?php
// controllers/ProductoController.php

require_once __DIR__ . '/../models/ProductoModel.php';
require_once __DIR__ . '/../models/CategoriaModel.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../helpers/Response.php';

class ProductoController
{
  private ProductoModel $model;

  public function __construct()
  {
    $this->model = new ProductoModel();
  }

  public function index(object $tokenData): void
  {
    $categoriaId = isset($_GET['categoria_id']) ? (int) $_GET['categoria_id'] : null;
    Response::json(200, ['data' => $this->model->findAll($categoriaId)]);
  }

  public function show(object $tokenData, string $id): void
  {
    $producto = $this->model->findById((int) $id);
    if (!$producto) {
      Response::json(404, ['error' => 'Producto no encontrado']);
    }
    Response::json(200, ['data' => $producto]);
  }

  public function store(object $tokenData): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $nombre = trim($body['nombre'] ?? '');
    $precio = $body['precio'] ?? null;

    if ($nombre === '' || $precio === null) {
      Response::json(422, ['error' => 'Los campos nombre y precio son requeridos']);
    }

    if (!is_numeric($precio) || (float) $precio < 0) {
      Response::json(422, ['error' => 'El precio debe ser un número positivo']);
    }

    if (!empty($body['categoria_id'])) {
      $catModel = new CategoriaModel();
      if (!$catModel->findById((int) $body['categoria_id'])) {
        Response::json(422, ['error' => 'La categoría especificada no existe']);
      }
    }

    $tipo  = in_array($body['tipo'] ?? '', ['elaborado', 'terminado']) ? $body['tipo'] : 'elaborado';
    $stock = isset($body['stock']) ? (float) $body['stock'] : 0;

    $newId = $this->model->create([
      'nombre'       => $nombre,
      'descripcion'  => $body['descripcion'] ?? null,
      'precio'       => (float) $precio,
      'categoria_id' => !empty($body['categoria_id']) ? (int) $body['categoria_id'] : null,
      'codigo'       => $body['codigo'] ?? null,
      'tipo'         => $tipo,
      'stock'        => $stock,
    ]);

    Response::json(201, [
      'mensaje' => 'Producto creado exitosamente',
      'data'    => $this->model->findById($newId),
    ]);
  }

  public function update(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $producto = $this->model->findById((int) $id);
    if (!$producto) {
      Response::json(404, ['error' => 'Producto no encontrado']);
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    if (isset($body['precio']) && (!is_numeric($body['precio']) || (float) $body['precio'] < 0)) {
      Response::json(422, ['error' => 'El precio debe ser un número positivo']);
    }

    if (!empty($body['categoria_id'])) {
      $catModel = new CategoriaModel();
      if (!$catModel->findById((int) $body['categoria_id'])) {
        Response::json(422, ['error' => 'La categoría especificada no existe']);
      }
    }

    $this->model->update((int) $id, $body);
    Response::json(200, [
      'mensaje' => 'Producto actualizado exitosamente',
      'data'    => $this->model->findById((int) $id),
    ]);
  }

  public function destroy(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $producto = $this->model->findById((int) $id);
    if (!$producto) {
      Response::json(404, ['error' => 'Producto no encontrado']);
    }

    $this->model->delete((int) $id);
    Response::json(200, ['mensaje' => 'Producto desactivado exitosamente']);
  }
}
