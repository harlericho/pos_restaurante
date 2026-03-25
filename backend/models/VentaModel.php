<?php
// models/VentaModel.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/FacturaConfigModel.php';

class VentaModel
{
  private PDO $db;

  public function __construct()
  {
    $this->db = Database::getConnection();
  }

  public function findAll(): array
  {
    return $this->db->query("
            SELECT v.*, p.mesa_id, m.numero AS mesa_numero, u.nombre AS usuario_nombre,
                   c.nombre AS cliente_nombre, c.ci_nit AS cliente_ci_nit,
                   c.telefono AS cliente_telefono, c.email AS cliente_email,
                   v.numero_factura
            FROM ventas v
            JOIN pedidos p ON p.id = v.pedido_id
            JOIN mesas m ON m.id = p.mesa_id
            JOIN usuarios u ON u.id = p.usuario_id
            LEFT JOIN clientes c ON c.id = v.cliente_id
            ORDER BY v.fecha DESC
        ")->fetchAll();
  }

  public function findById(int $id)
  {
    $stmt = $this->db->prepare("
            SELECT v.*, p.mesa_id, m.numero AS mesa_numero, u.nombre AS usuario_nombre,
                   c.nombre AS cliente_nombre, c.ci_nit AS cliente_ci_nit,
                   c.telefono AS cliente_telefono, c.email AS cliente_email,
                   v.numero_factura
            FROM ventas v
            JOIN pedidos p ON p.id = v.pedido_id
            JOIN mesas m ON m.id = p.mesa_id
            JOIN usuarios u ON u.id = p.usuario_id
            LEFT JOIN clientes c ON c.id = v.cliente_id
            WHERE v.id = ?
        ");
    $stmt->execute([$id]);
    return $stmt->fetch();
  }

  /**
   * Registra el pago y cierra el pedido en una transacción.
   * El trigger 'liberar_mesa' se dispara automáticamente al insertar en ventas.
   */
  public function create(array $data): int
  {
    $this->db->beginTransaction();
    try {
      // Generar número de factura dentro de la transacción (atómico)
      $facturaModel  = new FacturaConfigModel();
      $numeroFactura = $facturaModel->generarNumero();

      $clienteId = $data['cliente_id'] ?? null;
      $stmt = $this->db->prepare(
        "INSERT INTO ventas (pedido_id, cliente_id, numero_factura, total, metodo_pago) VALUES (?, ?, ?, ?, ?)"
      );
      $stmt->execute([$data['pedido_id'], $clienteId, $numeroFactura, $data['total'], $data['metodo_pago']]);
      $ventaId = (int) $this->db->lastInsertId();

      // Cerrar el pedido
      $stmtPedido = $this->db->prepare("UPDATE pedidos SET estado = 'cerrado' WHERE id = ?");
      $stmtPedido->execute([$data['pedido_id']]);

      $this->db->commit();
      return $ventaId;
    } catch (Exception $e) {
      $this->db->rollBack();
      throw $e;
    }
  }

  public function getReporte(string $desde, string $hasta): array
  {
    $stmt = $this->db->prepare("
            SELECT v.*, p.mesa_id, m.numero AS mesa_numero, u.nombre AS usuario_nombre,
                   c.nombre AS cliente_nombre, c.ci_nit AS cliente_ci_nit,
                   c.telefono AS cliente_telefono, c.email AS cliente_email,
                   v.numero_factura
            FROM ventas v
            JOIN pedidos p ON p.id = v.pedido_id
            JOIN mesas m ON m.id = p.mesa_id
            JOIN usuarios u ON u.id = p.usuario_id
            LEFT JOIN clientes c ON c.id = v.cliente_id
            WHERE DATE(v.fecha) BETWEEN ? AND ?
            ORDER BY v.fecha DESC
        ");
    $stmt->execute([$desde, $hasta]);
    $ventas = $stmt->fetchAll();

    $stmtResumen = $this->db->prepare("
            SELECT
                metodo_pago,
                COUNT(*) AS cantidad,
                SUM(total) AS subtotal
            FROM ventas
            WHERE DATE(fecha) BETWEEN ? AND ?
            GROUP BY metodo_pago
        ");
    $stmtResumen->execute([$desde, $hasta]);
    $resumen = $stmtResumen->fetchAll();

    $stmtTotal = $this->db->prepare(
      "SELECT COUNT(*) AS total_ventas, COALESCE(SUM(total), 0) AS total_ingresos
             FROM ventas WHERE DATE(fecha) BETWEEN ? AND ?"
    );
    $stmtTotal->execute([$desde, $hasta]);

    return [
      'ventas'  => $ventas,
      'resumen' => $resumen,
      'totales' => $stmtTotal->fetch(),
    ];
  }
}
