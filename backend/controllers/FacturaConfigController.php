<?php
// controllers/FacturaConfigController.php

require_once __DIR__ . '/../models/FacturaConfigModel.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../helpers/Response.php';

class FacturaConfigController
{
  private FacturaConfigModel $model;

  public function __construct()
  {
    $this->model = new FacturaConfigModel();
  }

  /** GET /api/factura-config — solo admin */
  public function show(object $tokenData): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');
    Response::json(200, ['data' => $this->model->getConfig()]);
  }

  /** PUT /api/factura-config — solo admin */
  public function update(object $tokenData): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $estab = trim($body['establecimiento'] ?? '');
    $punto = trim($body['punto_emision']   ?? '');

    if ($estab === '' || $punto === '') {
      Response::json(422, ['error' => 'Los campos establecimiento y punto_emision son requeridos']);
    }

    // Validar formato: solo dígitos, máx 10 chars
    if (!preg_match('/^\d{1,10}$/', $estab) || !preg_match('/^\d{1,10}$/', $punto)) {
      Response::json(422, ['error' => 'Los códigos deben ser numéricos']);
    }

    $this->model->updateConfig($estab, $punto);
    Response::json(200, [
      'mensaje' => 'Configuración actualizada',
      'data'    => $this->model->getConfig(),
    ]);
  }
}
