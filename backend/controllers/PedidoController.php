<?php
// controllers/PedidoController.php

require_once __DIR__ . '/../models/PedidoModel.php';
require_once __DIR__ . '/../models/MesaModel.php';
require_once __DIR__ . '/../models/ProductoModel.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../helpers/Response.php';

class PedidoController
{
  private PedidoModel $model;

  public function __construct()
  {
    $this->model = new PedidoModel();
  }

  public function index(object $tokenData): void
  {
    $estado = $_GET['estado'] ?? null;

    if ($estado !== null && !in_array($estado, ['abierto', 'cerrado'])) {
      Response::json(422, ['error' => 'El estado debe ser abierto o cerrado']);
    }

    Response::json(200, ['data' => $this->model->findAll($estado)]);
  }

  public function show(object $tokenData, string $id): void
  {
    $pedido = $this->model->findByIdWithDetails((int) $id);
    if (!$pedido) {
      Response::json(404, ['error' => 'Pedido no encontrado']);
    }
    Response::json(200, ['data' => $pedido]);
  }

  public function store(object $tokenData): void
  {
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $mesaId = $body['mesa_id'] ?? null;

    if (!$mesaId) {
      Response::json(422, ['error' => 'El campo mesa_id es requerido']);
    }

    $mesaModel = new MesaModel();
    $mesa      = $mesaModel->findById((int) $mesaId);
    if (!$mesa) {
      Response::json(404, ['error' => 'Mesa no encontrada']);
    }
    if ($mesa['estado'] === 'ocupada') {
      Response::json(409, ['error' => 'La mesa ya está ocupada']);
    }

    $pedidoId = $this->model->create([
      'mesa_id'    => (int) $mesaId,
      'usuario_id' => (int) $tokenData->sub,
    ]);

    Response::json(201, [
      'mensaje' => 'Pedido creado exitosamente',
      'data'    => $this->model->findByIdWithDetails($pedidoId),
    ]);
  }

  public function addDetalle(object $tokenData, string $id): void
  {
    $pedido = $this->model->findById((int) $id);
    if (!$pedido) {
      Response::json(404, ['error' => 'Pedido no encontrado']);
    }
    if ($pedido['estado'] !== 'abierto') {
      Response::json(409, ['error' => 'No se pueden agregar ítems a un pedido cerrado']);
    }

    $body       = json_decode(file_get_contents('php://input'), true) ?? [];
    $productoId = $body['producto_id'] ?? null;
    $cantidad   = $body['cantidad'] ?? null;

    if (!$productoId || !$cantidad) {
      Response::json(422, ['error' => 'Los campos producto_id y cantidad son requeridos']);
    }

    if (!is_numeric($cantidad) || (int) $cantidad <= 0) {
      Response::json(422, ['error' => 'La cantidad debe ser un entero positivo']);
    }

    $productoModel = new ProductoModel();
    $producto      = $productoModel->findById((int) $productoId);
    if (!$producto) {
      Response::json(404, ['error' => 'Producto no encontrado']);
    }
    if (!$producto['estado']) {
      Response::json(409, ['error' => 'El producto no está disponible']);
    }

    // Verificar stock suficiente (terminado = stock propio, elaborado = insumos)
    $stockError = $productoModel->verificarStock((int) $productoId, (int) $cantidad);
    if ($stockError !== null) {
      Response::json(409, ['error' => $stockError]);
    }

    $this->model->addDetalle((int) $id, [
      'producto_id' => (int) $productoId,
      'cantidad'    => (int) $cantidad,
      'precio'      => (float) $producto['precio'],
    ]);

    Response::json(201, [
      'mensaje' => 'Ítem agregado al pedido',
      'data'    => $this->model->findByIdWithDetails((int) $id),
    ]);
  }

  public function cerrar(object $tokenData, string $id): void
  {
    $pedido = $this->model->findById((int) $id);
    if (!$pedido) {
      Response::json(404, ['error' => 'Pedido no encontrado']);
    }
    if ($pedido['estado'] !== 'abierto') {
      Response::json(409, ['error' => 'El pedido ya está cerrado']);
    }

    $this->model->cerrar((int) $id);
    Response::json(200, [
      'mensaje' => 'Pedido cerrado exitosamente',
      'data'    => $this->model->findByIdWithDetails((int) $id),
    ]);
  }

  public function removeDetalle(object $tokenData, string $pedidoId, string $detalleId): void
  {
    $pedido = $this->model->findById((int) $pedidoId);
    if (!$pedido) {
      Response::json(404, ['error' => 'Pedido no encontrado']);
    }
    if ($pedido['estado'] !== 'abierto') {
      Response::json(409, ['error' => 'No se pueden modificar ítems de un pedido cerrado']);
    }

    $detalle = $this->model->findDetalleById((int) $detalleId);
    if (!$detalle) {
      Response::json(404, ['error' => 'Ítem no encontrado']);
    }
    if ((int) $detalle['pedido_id'] !== (int) $pedidoId) {
      Response::json(404, ['error' => 'El ítem no pertenece a este pedido']);
    }

    $this->model->deleteDetalle((int) $detalleId);
    Response::json(200, [
      'mensaje' => 'Ítem eliminado del pedido',
      'data'    => $this->model->findByIdWithDetails((int) $pedidoId),
    ]);
  }
}
