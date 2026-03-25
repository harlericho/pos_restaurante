<?php
// controllers/VentaController.php

require_once __DIR__ . '/../models/VentaModel.php';
require_once __DIR__ . '/../models/PedidoModel.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../helpers/Response.php';

class VentaController
{
  private VentaModel $model;

  public function __construct()
  {
    $this->model = new VentaModel();
  }

  public function index(object $tokenData): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');
    Response::json(200, ['data' => $this->model->findAll()]);
  }

  public function show(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $venta = $this->model->findById((int) $id);
    if (!$venta) {
      Response::json(404, ['error' => 'Venta no encontrada']);
    }
    Response::json(200, ['data' => $venta]);
  }

  public function store(object $tokenData): void
  {
    $body      = json_decode(file_get_contents('php://input'), true) ?? [];
    $pedidoId   = $body['pedido_id']   ?? null;
    $metodoPago = trim($body['metodo_pago'] ?? '');
    $clienteId  = isset($body['cliente_id']) ? (int) $body['cliente_id'] : null;

    if (!$pedidoId || $metodoPago === '') {
      Response::json(422, ['error' => 'Los campos pedido_id y metodo_pago son requeridos']);
    }

    $metodosValidos = ['efectivo', 'tarjeta', 'transferencia'];
    if (!in_array($metodoPago, $metodosValidos)) {
      Response::json(422, [
        'error' => 'El método de pago debe ser: ' . implode(', ', $metodosValidos)
      ]);
    }

    $pedidoModel = new PedidoModel();
    $pedido      = $pedidoModel->findById((int) $pedidoId);

    if (!$pedido) {
      Response::json(404, ['error' => 'Pedido no encontrado']);
    }
    if ($pedido['estado'] !== 'abierto') {
      Response::json(409, ['error' => 'El pedido ya fue cobrado o está cerrado']);
    }
    if ((float) $pedido['total'] <= 0) {
      Response::json(409, ['error' => 'El pedido no tiene ítems para cobrar']);
    }

    // Calcular IVA desde la configuración
    require_once __DIR__ . '/../models/FacturaConfigModel.php';
    $facturaConfig  = new FacturaConfigModel();
    $cfg            = $facturaConfig->getConfig();
    $ivaPct         = (float) ($cfg['iva_porcentaje'] ?? 0);
    $totalBruto     = (float) $pedido['total'];

    if ($ivaPct > 0) {
      $subtotalBase = round($totalBruto / (1 + $ivaPct / 100), 2);
      $ivaValor     = round($totalBruto - $subtotalBase, 2);
    } else {
      $subtotalBase = $totalBruto;
      $ivaValor     = 0.00;
    }

    $ventaId = $this->model->create([
      'pedido_id'      => (int) $pedidoId,
      'cliente_id'     => $clienteId,
      'total'          => $totalBruto,
      'subtotal_base'  => $subtotalBase,
      'iva_valor'      => $ivaValor,
      'iva_porcentaje' => $ivaPct,
      'metodo_pago'    => $metodoPago,
    ]);

    Response::json(201, [
      'mensaje' => 'Venta registrada exitosamente',
      'data'    => $this->model->findById($ventaId),
    ]);
  }

  public function reporte(object $tokenData): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $hoy   = date('Y-m-d');
    $desde = $_GET['desde'] ?? $hoy;
    $hasta = $_GET['hasta'] ?? $hoy;

    // Validar formato de fechas
    $formatoFecha = '/^\d{4}-\d{2}-\d{2}$/';
    if (!preg_match($formatoFecha, $desde) || !preg_match($formatoFecha, $hasta)) {
      Response::json(422, ['error' => 'Las fechas deben tener el formato YYYY-MM-DD']);
    }

    Response::json(200, [
      'desde' => $desde,
      'hasta' => $hasta,
      'data'  => $this->model->getReporte($desde, $hasta),
    ]);
  }
}
