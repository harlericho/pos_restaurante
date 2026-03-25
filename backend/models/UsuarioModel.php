<?php
// models/UsuarioModel.php

require_once __DIR__ . '/../config/database.php';

class UsuarioModel
{
  private PDO $db;

  public function __construct()
  {
    $this->db = Database::getConnection();
  }

  public function findAll(): array
  {
    return $this->db
      ->query("SELECT id, nombre, usuario, rol, estado, created_at FROM usuarios ORDER BY id")
      ->fetchAll();
  }

  public function findById(int $id)
  {
    $stmt = $this->db->prepare(
      "SELECT id, nombre, usuario, rol, estado, created_at FROM usuarios WHERE id = ?"
    );
    $stmt->execute([$id]);
    return $stmt->fetch();
  }

  public function findByUsuario(string $usuario)
  {
    $stmt = $this->db->prepare("SELECT * FROM usuarios WHERE usuario = ? AND estado = 1");
    $stmt->execute([$usuario]);
    return $stmt->fetch();
  }

  public function create(array $data): int
  {
    $stmt = $this->db->prepare(
      "INSERT INTO usuarios (nombre, usuario, password, rol, estado) VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->execute([
      $data['nombre'],
      $data['usuario'],
      password_hash($data['password'], PASSWORD_BCRYPT),
      $data['rol'] ?? 'mesero',
      $data['estado'] ?? 1,
    ]);
    return (int) $this->db->lastInsertId();
  }

  public function update(int $id, array $data): bool
  {
    $fields = [];
    $params = [];

    foreach (['nombre', 'usuario', 'rol', 'estado'] as $field) {
      if (array_key_exists($field, $data)) {
        $fields[] = "$field = ?";
        $params[] = $data[$field];
      }
    }

    if (array_key_exists('password', $data) && $data['password'] !== '') {
      $fields[] = "password = ?";
      $params[] = password_hash($data['password'], PASSWORD_BCRYPT);
    }

    if (empty($fields)) return false;

    $params[] = $id;
    $stmt = $this->db->prepare("UPDATE usuarios SET " . implode(', ', $fields) . " WHERE id = ?");
    return $stmt->execute($params);
  }

  public function delete(int $id): bool
  {
    $stmt = $this->db->prepare("UPDATE usuarios SET estado = 0 WHERE id = ?");
    return $stmt->execute([$id]);
  }

  public function usuarioExiste(string $usuario, int $excludeId = 0): bool
  {
    $stmt = $this->db->prepare("SELECT id FROM usuarios WHERE usuario = ? AND id != ?");
    $stmt->execute([$usuario, $excludeId]);
    return (bool) $stmt->fetch();
  }
}
