<?php
// models/ProductoModel.php

require_once __DIR__ . '/../config/database.php';

class ProductoModel
{
  private PDO $db;

  public function __construct()
  {
    $this->db = Database::getConnection();
  }

  public function findAll(?int $categoriaId = null): array
  {
    if ($categoriaId !== null) {
      $stmt = $this->db->prepare("
                SELECT p.*, c.nombre AS categoria_nombre
                FROM productos p
                LEFT JOIN categorias c ON c.id = p.categoria_id
                WHERE p.estado = 1 AND p.categoria_id = ?
                ORDER BY p.nombre
            ");
      $stmt->execute([$categoriaId]);
    } else {
      $stmt = $this->db->query("
                SELECT p.*, c.nombre AS categoria_nombre
                FROM productos p
                LEFT JOIN categorias c ON c.id = p.categoria_id
                WHERE p.estado = 1
                ORDER BY p.nombre
            ");
    }
    return $stmt->fetchAll();
  }

  public function findById(int $id)
  {
    $stmt = $this->db->prepare("
            SELECT p.*, c.nombre AS categoria_nombre
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            WHERE p.id = ?
        ");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
  }

  public function create(array $data): int
  {
    $stmt = $this->db->prepare(
      "INSERT INTO productos (nombre, descripcion, precio, categoria_id, codigo, tipo, stock, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 1)"
    );
    $stmt->execute([
      trim($data['nombre']),
      $data['descripcion'] ?? null,
      $data['precio'],
      $data['categoria_id'] ?? null,
      $data['codigo'] ?? null,
      $data['tipo'] ?? 'elaborado',
      $data['stock'] ?? 0,
    ]);
    return (int) $this->db->lastInsertId();
  }

  public function update(int $id, array $data): bool
  {
    $fields = [];
    $params = [];

    foreach (['nombre', 'descripcion', 'precio', 'categoria_id', 'codigo', 'tipo', 'stock', 'estado'] as $field) {
      if (array_key_exists($field, $data)) {
        $fields[] = "$field = ?";
        $params[] = $field === 'nombre' ? trim($data[$field]) : $data[$field];
      }
    }

    if (empty($fields)) return false;

    $params[] = $id;
    $stmt = $this->db->prepare("UPDATE productos SET " . implode(', ', $fields) . " WHERE id = ?");
    return $stmt->execute($params);
  }

  public function delete(int $id): bool
  {
    $stmt = $this->db->prepare("UPDATE productos SET estado = 0 WHERE id = ?");
    return $stmt->execute([$id]);
  }
}
