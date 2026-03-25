<?php
// models/EmpresaModel.php

require_once __DIR__ . '/../config/database.php';

class EmpresaModel
{
  private PDO $db;

  public function __construct()
  {
    $this->db = Database::getConnection();
  }

  public function getEmpresa(): array
  {
    // Asegurar que existe la fila única
    $this->db->exec(
      "INSERT IGNORE INTO empresa (id) VALUES (1)"
    );
    $row = $this->db->query("SELECT * FROM empresa WHERE id = 1")->fetch();
    return $row ?: [
      'id'       => 1,
      'ruc'      => '',
      'nombre'   => 'Mi Empresa',
      'direccion' => '',
      'telefono' => '',
      'correo'   => '',
    ];
  }

  public function updateEmpresa(string $ruc, string $nombre, string $direccion, string $telefono, string $correo): void
  {
    $stmt = $this->db->prepare(
      "UPDATE empresa SET ruc = ?, nombre = ?, direccion = ?, telefono = ?, correo = ? WHERE id = 1"
    );
    $stmt->execute([$ruc, $nombre, $direccion, $telefono, $correo]);
  }
}
