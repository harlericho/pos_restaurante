<?php
// models/InsumoModel.php

require_once __DIR__ . '/../config/database.php';

class InsumoModel
{
  private PDO $db;

  public function __construct()
  {
    $this->db = Database::getConnection();
  }

  public function findAll(): array
  {
    return $this->db
      ->query("SELECT * FROM insumos ORDER BY nombre")
      ->fetchAll();
  }

  public function findById(int $id)
  {
    $stmt = $this->db->prepare("SELECT * FROM insumos WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch();
  }

  public function create(array $data): int
  {
    $stmt = $this->db->prepare(
      "INSERT INTO insumos (nombre, stock, unidad) VALUES (?, ?, ?)"
    );
    $stmt->execute([
      trim($data['nombre']),
      $data['stock'] ?? 0,
      trim($data['unidad']),
    ]);
    return (int) $this->db->lastInsertId();
  }

  public function update(int $id, array $data): bool
  {
    $fields = [];
    $params = [];

    foreach (['nombre', 'stock', 'unidad'] as $field) {
      if (array_key_exists($field, $data)) {
        $fields[] = "$field = ?";
        $params[] = in_array($field, ['nombre', 'unidad']) ? trim($data[$field]) : $data[$field];
      }
    }

    if (empty($fields)) return false;

    $params[] = $id;
    $stmt = $this->db->prepare("UPDATE insumos SET " . implode(', ', $fields) . " WHERE id = ?");
    return $stmt->execute($params);
  }

  public function ajustarStock(int $id, float $cantidad): bool
  {
    $stmt = $this->db->prepare("UPDATE insumos SET stock = stock + ? WHERE id = ?");
    return $stmt->execute([$cantidad, $id]);
  }

  public function tieneRecetas(int $id): bool
  {
    $stmt = $this->db->prepare("SELECT id FROM recetas WHERE insumo_id = ? LIMIT 1");
    $stmt->execute([$id]);
    return (bool) $stmt->fetch();
  }

  public function delete(int $id): bool
  {
    $stmt = $this->db->prepare("DELETE FROM insumos WHERE id = ?");
    return $stmt->execute([$id]);
  }
}
