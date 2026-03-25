<?php
// models/RecetaModel.php

require_once __DIR__ . '/../config/database.php';

class RecetaModel
{
  private PDO $db;

  public function __construct()
  {
    $this->db = Database::getConnection();
  }

  public function findByProducto(int $productoId): array
  {
    $stmt = $this->db->prepare("
            SELECT r.*, i.nombre AS insumo_nombre, i.unidad
            FROM recetas r
            JOIN insumos i ON i.id = r.insumo_id
            WHERE r.producto_id = ?
        ");
    $stmt->execute([$productoId]);
    return $stmt->fetchAll();
  }

  public function findById(int $id)
  {
    $stmt = $this->db->prepare("SELECT * FROM recetas WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch();
  }

  public function yaExiste(int $productoId, int $insumoId): bool
  {
    $stmt = $this->db->prepare(
      "SELECT id FROM recetas WHERE producto_id = ? AND insumo_id = ? LIMIT 1"
    );
    $stmt->execute([$productoId, $insumoId]);
    return (bool) $stmt->fetch();
  }

  public function create(array $data): int
  {
    $stmt = $this->db->prepare(
      "INSERT INTO recetas (producto_id, insumo_id, cantidad) VALUES (?, ?, ?)"
    );
    $stmt->execute([
      $data['producto_id'],
      $data['insumo_id'],
      $data['cantidad'],
    ]);
    return (int) $this->db->lastInsertId();
  }

  public function delete(int $id): bool
  {
    $stmt = $this->db->prepare("DELETE FROM recetas WHERE id = ?");
    return $stmt->execute([$id]);
  }
}
