<?php
// controllers/MesaController.php

require_once __DIR__ . '/../models/MesaModel.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../helpers/Response.php';

class MesaController
{
  private MesaModel $model;

  public function __construct()
  {
    $this->model = new MesaModel();
  }

  public function index(object $tokenData): void
  {
    Response::json(200, ['data' => $this->model->findAll()]);
  }

  public function show(object $tokenData, string $id): void
  {
    $mesa = $this->model->findById((int) $id);
    if (!$mesa) {
      Response::json(404, ['error' => 'Mesa no encontrada']);
    }
    Response::json(200, ['data' => $mesa]);
  }

  public function store(object $tokenData): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $numero = $body['numero'] ?? null;

    if ($numero === null || !is_numeric($numero) || (int) $numero <= 0) {
      Response::json(422, ['error' => 'El campo numero es requerido y debe ser un entero positivo']);
    }

    if ($this->model->numeroExiste((int) $numero)) {
      Response::json(409, ['error' => 'Ya existe una mesa con ese número']);
    }

    $newId = $this->model->create(['numero' => (int) $numero]);
    Response::json(201, [
      'mensaje' => 'Mesa creada exitosamente',
      'data'    => $this->model->findById($newId),
    ]);
  }

  public function update(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $mesa = $this->model->findById((int) $id);
    if (!$mesa) {
      Response::json(404, ['error' => 'Mesa no encontrada']);
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    if (isset($body['numero'])) {
      if (!is_numeric($body['numero']) || (int) $body['numero'] <= 0) {
        Response::json(422, ['error' => 'El número de mesa debe ser un entero positivo']);
      }
      if ($this->model->numeroExiste((int) $body['numero'], (int) $id)) {
        Response::json(409, ['error' => 'Ya existe una mesa con ese número']);
      }
    }

    if (isset($body['estado']) && !in_array($body['estado'], ['libre', 'ocupada'])) {
      Response::json(422, ['error' => 'El estado debe ser libre u ocupada']);
    }

    $this->model->update((int) $id, $body);
    Response::json(200, [
      'mensaje' => 'Mesa actualizada exitosamente',
      'data'    => $this->model->findById((int) $id),
    ]);
  }

  public function destroy(object $tokenData, string $id): void
  {
    AuthMiddleware::requiereRol($tokenData, 'admin');

    $mesa = $this->model->findById((int) $id);
    if (!$mesa) {
      Response::json(404, ['error' => 'Mesa no encontrada']);
    }

    if ($mesa['estado'] === 'ocupada') {
      Response::json(409, ['error' => 'No se puede eliminar una mesa ocupada']);
    }

    if ($this->model->tienePedidos((int) $id)) {
      Response::json(409, ['error' => 'No se puede eliminar una mesa que tiene pedidos registrados']);
    }

    $this->model->delete((int) $id);
    Response::json(200, ['mensaje' => 'Mesa eliminada exitosamente']);
  }
}
