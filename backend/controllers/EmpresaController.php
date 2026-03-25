<?php
// controllers/EmpresaController.php

require_once __DIR__ . '/../models/EmpresaModel.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../helpers/Response.php';

class EmpresaController
{
  private EmpresaModel $model;

  public function __construct()
  {
    $this->model = new EmpresaModel();
  }

  /** GET /api/empresa — público (necesario para generar PDF sin autenticación previa) */
  public function show(?object $tokenData): void
  {
    Response::json(200, ['data' => $this->model->getEmpresa()]);
  }

  /** PUT /api/empresa — solo admin */
  public function update(object $tokenData): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $ruc       = trim($body['ruc']       ?? '');
    $nombre    = trim($body['nombre']    ?? '');
    $direccion = trim($body['direccion'] ?? '');
    $telefono  = trim($body['telefono']  ?? '');
    $correo    = trim($body['correo']    ?? '');

    if ($nombre === '') {
      Response::json(422, ['error' => 'El nombre de la empresa es obligatorio.']);
      return;
    }
    if (strlen($nombre) > 150) {
      Response::json(422, ['error' => 'El nombre no puede superar los 150 caracteres.']);
      return;
    }
    if ($correo !== '' && !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
      Response::json(422, ['error' => 'El correo electrónico no tiene un formato válido.']);
      return;
    }

    $this->model->updateEmpresa($ruc, $nombre, $direccion, $telefono, $correo);

    Response::json(200, [
      'mensaje' => 'Datos de la empresa guardados correctamente.',
      'data'    => $this->model->getEmpresa(),
    ]);
  }
}
