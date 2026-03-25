<?php
// models/ClienteModel.php

require_once __DIR__ . '/../config/database.php';

class ClienteModel
{
  private PDO $db;

  public function __construct()
  {
    $this->db = Database::getConnection();
  }

  public function findAll(): array
  {
    return $this->db
      ->query("SELECT * FROM clientes ORDER BY nombre")
      ->fetchAll();
  }

  public function findById(int $id)
  {
    $stmt = $this->db->prepare("SELECT * FROM clientes WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch();
  }

  public function search(string $q): array
  {
    $like = '%' . $q . '%';
    $stmt = $this->db->prepare(
      "SELECT * FROM clientes WHERE nombre LIKE ? OR ci_nit LIKE ? OR telefono LIKE ? ORDER BY nombre LIMIT 20"
    );
    $stmt->execute([$like, $like, $like]);
    return $stmt->fetchAll();
  }

  public function create(array $data): int
  {
    $stmt = $this->db->prepare(
      "INSERT INTO clientes (nombre, ci_nit, telefono, email) VALUES (?, ?, ?, ?)"
    );
    $stmt->execute([
      $data['nombre'],
      $data['ci_nit']   ?? null,
      $data['telefono'] ?? null,
      $data['email']    ?? null,
    ]);
    return (int) $this->db->lastInsertId();
  }

  public function update(int $id, array $data): bool
  {
    $fields = [];
    $params = [];

    foreach (['nombre', 'ci_nit', 'telefono', 'email'] as $field) {
      if (array_key_exists($field, $data)) {
        $fields[] = "$field = ?";
        $params[] = $data[$field];
      }
    }

    if (empty($fields)) return false;

    $params[] = $id;
    $stmt = $this->db->prepare("UPDATE clientes SET " . implode(', ', $fields) . " WHERE id = ?");
    $stmt->execute($params);
    return true;
  }

  public function delete(int $id): bool
  {
    $stmt = $this->db->prepare("DELETE FROM clientes WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->rowCount() > 0;
  }
}
