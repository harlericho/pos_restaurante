<?php
// models/CategoriaModel.php

require_once __DIR__ . '/../config/database.php';

class CategoriaModel
{
  private PDO $db;

  public function __construct()
  {
    $this->db = Database::getConnection();
  }

  public function findAll(): array
  {
    return $this->db
      ->query("SELECT * FROM categorias WHERE estado = 1 ORDER BY nombre")
      ->fetchAll();
  }

  public function findById(int $id)
  {
    $stmt = $this->db->prepare("SELECT * FROM categorias WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
  }

  public function create(array $data): int
  {
    $stmt = $this->db->prepare("INSERT INTO categorias (nombre, estado) VALUES (?, 1)");
    $stmt->execute([trim($data['nombre'])]);
    return (int) $this->db->lastInsertId();
  }

  public function update(int $id, array $data): bool
  {
    $fields = [];
    $params = [];

    foreach (['nombre', 'estado'] as $field) {
      if (array_key_exists($field, $data)) {
        $fields[] = "$field = ?";
        $params[] = $field === 'nombre' ? trim($data[$field]) : $data[$field];
      }
    }

    if (empty($fields)) return false;

    $params[] = $id;
    $stmt = $this->db->prepare("UPDATE categorias SET " . implode(', ', $fields) . " WHERE id = ?");
    return $stmt->execute($params);
  }

  public function delete(int $id): bool
  {
    $stmt = $this->db->prepare("UPDATE categorias SET estado = 0 WHERE id = ?");
    return $stmt->execute([$id]);
  }
}
