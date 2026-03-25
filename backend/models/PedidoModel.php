<?php
// models/PedidoModel.php

require_once __DIR__ . '/../config/database.php';

class PedidoModel
{
  private PDO $db;

  public function __construct()
  {
    $this->db = Database::getConnection();
  }

  public function findAll(?string $estado = null): array
  {
    if ($estado !== null) {
      $stmt = $this->db->prepare("
                SELECT p.*, m.numero AS mesa_numero, u.nombre AS usuario_nombre
                FROM pedidos p
                JOIN mesas m ON m.id = p.mesa_id
                JOIN usuarios u ON u.id = p.usuario_id
                WHERE p.estado = ?
                ORDER BY p.fecha DESC
            ");
      $stmt->execute([$estado]);
    } else {
      $stmt = $this->db->query("
                SELECT p.*, m.numero AS mesa_numero, u.nombre AS usuario_nombre
                FROM pedidos p
                JOIN mesas m ON m.id = p.mesa_id
                JOIN usuarios u ON u.id = p.usuario_id
                ORDER BY p.fecha DESC
            ");
    }
    return $stmt->fetchAll();
  }

  public function findById(int $id)
  {
    $stmt = $this->db->prepare("
            SELECT p.*, m.numero AS mesa_numero, u.nombre AS usuario_nombre
            FROM pedidos p
            JOIN mesas m ON m.id = p.mesa_id
            JOIN usuarios u ON u.id = p.usuario_id
            WHERE p.id = ?
        ");
    $stmt->execute([$id]);
    return $stmt->fetch();
  }

  public function findByIdWithDetails(int $id)
  {
    $pedido = $this->findById($id);
    if (!$pedido) return false;

    $stmt = $this->db->prepare("
            SELECT pd.*, pr.nombre AS producto_nombre, pr.codigo AS producto_codigo
            FROM pedido_detalle pd
            JOIN productos pr ON pr.id = pd.producto_id
            WHERE pd.pedido_id = ?
            ORDER BY pd.id
        ");
    $stmt->execute([$id]);
    $pedido['detalle'] = $stmt->fetchAll();

    return $pedido;
  }

  public function create(array $data): int
  {
    // El trigger 'ocupar_mesa' se dispara automáticamente al insertar
    $stmt = $this->db->prepare(
      "INSERT INTO pedidos (mesa_id, usuario_id, estado, total) VALUES (?, ?, 'abierto', 0)"
    );
    $stmt->execute([$data['mesa_id'], $data['usuario_id']]);
    return (int) $this->db->lastInsertId();
  }

  public function addDetalle(int $pedidoId, array $detalle): int
  {
    // El trigger 'descontar_insumos' y 'actualizar_total_pedido' se disparan automáticamente
    $stmt = $this->db->prepare("
            INSERT INTO pedido_detalle (pedido_id, producto_id, cantidad, precio, subtotal)
            VALUES (?, ?, ?, ?, ?)
        ");
    $subtotal = $detalle['cantidad'] * $detalle['precio'];
    $stmt->execute([
      $pedidoId,
      $detalle['producto_id'],
      $detalle['cantidad'],
      $detalle['precio'],
      $subtotal,
    ]);
    return (int) $this->db->lastInsertId();
  }

  public function cerrar(int $id): bool
  {
    $this->db->beginTransaction();
    try {
      // Obtener mesa_id dentro de la transacción
      $pedido = $this->findById($id);
      if (!$pedido) {
        $this->db->rollBack();
        return false;
      }
      $stmt = $this->db->prepare("UPDATE pedidos SET estado = 'cerrado' WHERE id = ?");
      $stmt->execute([$id]);
      // Liberar la mesa cuando se cancela/cierra el pedido sin cobrar
      $stmtMesa = $this->db->prepare("UPDATE mesas SET estado = 'libre' WHERE id = ?");
      $stmtMesa->execute([$pedido['mesa_id']]);
      $this->db->commit();
      return true;
    } catch (Exception $e) {
      $this->db->rollBack();
      throw $e;
    }
  }

  public function findDetalleById(int $detalleId)
  {
    $stmt = $this->db->prepare(
      "SELECT * FROM pedido_detalle WHERE id = ?"
    );
    $stmt->execute([$detalleId]);
    return $stmt->fetch();
  }

  /**
   * Elimina un ítem del pedido y revierte el descuento de stock e insumos.
   * Como el trigger solo aplica en INSERT, el ajuste debe hacerse manual.
   */
  public function deleteDetalle(int $detalleId): bool
  {
    $this->db->beginTransaction();
    try {
      // Leer el detalle antes de borrar
      $detalle = $this->findDetalleById($detalleId);
      if (!$detalle) {
        $this->db->rollBack();
        return false;
      }

      // Revertir descuento de insumos (reponer stock)
      $stmtStock = $this->db->prepare("
        UPDATE insumos i
        JOIN recetas r ON r.insumo_id = i.id
        SET i.stock = i.stock + (r.cantidad * ?)
        WHERE r.producto_id = ?
      ");
      $stmtStock->execute([$detalle['cantidad'], $detalle['producto_id']]);

      // Borrar el ítem
      $stmtDel = $this->db->prepare("DELETE FROM pedido_detalle WHERE id = ?");
      $stmtDel->execute([$detalleId]);

      // Recalcular el total del pedido
      $stmtTotal = $this->db->prepare("
        UPDATE pedidos
        SET total = COALESCE((SELECT SUM(subtotal) FROM pedido_detalle WHERE pedido_id = ?), 0)
        WHERE id = ?
      ");
      $stmtTotal->execute([$detalle['pedido_id'], $detalle['pedido_id']]);

      $this->db->commit();
      return true;
    } catch (Exception $e) {
      $this->db->rollBack();
      throw $e;
    }
  }

  public function estaAbierto(int $id): bool
  {
    $stmt = $this->db->prepare("SELECT estado FROM pedidos WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row && $row['estado'] === 'abierto';
  }
}
