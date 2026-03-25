<?php
// models/FacturaConfigModel.php

require_once __DIR__ . '/../config/database.php';

class FacturaConfigModel
{
  private PDO $db;

  public function __construct()
  {
    $this->db = Database::getConnection();
  }

  public function getConfig(): array
  {
    $row = $this->db->query("SELECT * FROM factura_config WHERE id = 1")->fetch();
    if (!$row) {
      // Inicializar si no existe
      $this->db->exec("INSERT INTO factura_config (id, establecimiento, punto_emision, secuencial) VALUES (1,'001','001',0)");
      $row = $this->db->query("SELECT * FROM factura_config WHERE id = 1")->fetch();
    }
    return $row;
  }

  public function updateConfig(string $establecimiento, string $puntoEmision): void
  {
    $stmt = $this->db->prepare(
      "UPDATE factura_config SET establecimiento = ?, punto_emision = ? WHERE id = 1"
    );
    $stmt->execute([$establecimiento, $puntoEmision]);
  }

  /**
   * Incrementa el secuencial de forma atómica (dentro de una transacción activa)
   * y devuelve el número formateado: 001-001-000000130
   * Debe llamarse DENTRO de la transacción de la venta.
   */
  public function generarNumero(): string
  {
    // Asegurar que la fila existe antes de actualizar
    $this->db->exec(
      "INSERT INTO factura_config (id, establecimiento, punto_emision, secuencial)
       VALUES (1, '001', '001', 0)
       ON DUPLICATE KEY UPDATE id = id"
    );

    $this->db->exec("UPDATE factura_config SET secuencial = secuencial + 1 WHERE id = 1");
    $cfg = $this->db->query(
      "SELECT establecimiento, punto_emision, secuencial FROM factura_config WHERE id = 1"
    )->fetch();

    return $cfg['establecimiento'] . '-'
      . $cfg['punto_emision'] . '-'
      . str_pad((string) $cfg['secuencial'], 9, '0', STR_PAD_LEFT);
  }
}
