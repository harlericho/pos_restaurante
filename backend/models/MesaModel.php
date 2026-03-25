<?php
// models/MesaModel.php

require_once __DIR__ . '/../config/database.php';

class MesaModel
{
  private PDO $db;

  public function __construct()
  {
    $this->db = Database::getConnection();
  }

  public function findAll(): array
  {
    return $this->db
      ->query("SELECT * FROM mesas ORDER BY numero")
      ->fetchAll();
  }

  public function findById(int $id)
  {
    $stmt = $this->db->prepare("SELECT * FROM mesas WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch();
  }

  public function create(array $data): int
  {
    $stmt = $this->db->prepare("INSERT INTO mesas (numero, estado) VALUES (?, 'libre')");
    $stmt->execute([$data['numero']]);
    return (int) $this->db->lastInsertId();
  }

  public function update(int $id, array $data): bool
  {
    $fields = [];
    $params = [];

    foreach (['numero', 'estado'] as $field) {
      if (array_key_exists($field, $data)) {
        $fields[] = "$field = ?";
        $params[] = $data[$field];
      }
    }

    if (empty($fields)) return false;

    $params[] = $id;
    $stmt = $this->db->prepare("UPDATE mesas SET " . implode(', ', $fields) . " WHERE id = ?");
    return $stmt->execute($params);
  }

  public function tienePedidos(int $id): bool
  {
    $stmt = $this->db->prepare("SELECT id FROM pedidos WHERE mesa_id = ? LIMIT 1");
    $stmt->execute([$id]);
    return (bool) $stmt->fetch();
  }

  public function delete(int $id): bool
  {
    $stmt = $this->db->prepare("DELETE FROM mesas WHERE id = ?");
    return $stmt->execute([$id]);
  }

  public function numeroExiste(int $numero, int $excludeId = 0): bool
  {
    $stmt = $this->db->prepare("SELECT id FROM mesas WHERE numero = ? AND id != ?");
    $stmt->execute([$numero, $excludeId]);
    return (bool) $stmt->fetch();
  }
}
