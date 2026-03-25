CREATE DATABASE db_pos_restaurante;
USE db_pos_restaurante;
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    usuario VARCHAR(50) UNIQUE,
    password VARCHAR(255),
    rol ENUM('admin','mesero') DEFAULT 'mesero',
    estado TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    estado TINYINT DEFAULT 1
);
CREATE TABLE productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150),
    descripcion TEXT,
    precio DECIMAL(10,2),
    categoria_id INT,
    estado TINYINT DEFAULT 1,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);
CREATE TABLE insumos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    stock DECIMAL(10,2),
    unidad VARCHAR(20) -- kg, litros, unidades
);
CREATE TABLE recetas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT,
    insumo_id INT,
    cantidad DECIMAL(10,2),
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    FOREIGN KEY (insumo_id) REFERENCES insumos(id)
);
CREATE TABLE mesas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero INT,
    estado ENUM('libre','ocupada') DEFAULT 'libre'
);
CREATE TABLE pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mesa_id INT,
    usuario_id INT,
    estado ENUM('abierto','cerrado') DEFAULT 'abierto',
    total DECIMAL(10,2) DEFAULT 0,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mesa_id) REFERENCES mesas(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
CREATE TABLE pedido_detalle (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT,
    producto_id INT,
    cantidad INT,
    precio DECIMAL(10,2),
    subtotal DECIMAL(10,2),
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);
CREATE TABLE ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT,
    total DECIMAL(10,2),
    metodo_pago ENUM('efectivo','tarjeta','transferencia'),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
);
DELIMITER $$

CREATE TRIGGER descontar_insumos
AFTER INSERT ON pedido_detalle
FOR EACH ROW
BEGIN
    UPDATE insumos i
    JOIN recetas r ON r.insumo_id = i.id
    SET i.stock = i.stock - (r.cantidad * NEW.cantidad)
    WHERE r.producto_id = NEW.producto_id;
END$$

DELIMITER ;

DELIMITER $$

CREATE TRIGGER actualizar_total_pedido
AFTER INSERT ON pedido_detalle
FOR EACH ROW
BEGIN
    UPDATE pedidos
    SET total = (
        SELECT SUM(subtotal)
        FROM pedido_detalle
        WHERE pedido_id = NEW.pedido_id
    )
    WHERE id = NEW.pedido_id;
END$$

DELIMITER ;

DELIMITER $$

CREATE TRIGGER ocupar_mesa
AFTER INSERT ON pedidos
FOR EACH ROW
BEGIN
    UPDATE mesas SET estado = 'ocupada'
    WHERE id = NEW.mesa_id;
END$$

DELIMITER ;

DELIMITER $$

CREATE TRIGGER liberar_mesa
AFTER INSERT ON ventas
FOR EACH ROW
BEGIN
    UPDATE mesas m
    JOIN pedidos p ON p.mesa_id = m.id
    SET m.estado = 'libre'
    WHERE p.id = NEW.pedido_id;
END$$

DELIMITER ;

-- ============================================================
-- MÓDULO CLIENTES
-- ============================================================
CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    ci_nit VARCHAR(30),
    telefono VARCHAR(20),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relacionar ventas con cliente (opcional: consumidor final = NULL)
ALTER TABLE ventas ADD COLUMN cliente_id INT NULL AFTER pedido_id;
ALTER TABLE ventas ADD CONSTRAINT fk_ventas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;

-- Número de factura por venta
ALTER TABLE ventas ADD COLUMN numero_factura VARCHAR(30) NULL AFTER cliente_id;

-- Configuración de serie de factura
CREATE TABLE factura_config (
    id INT PRIMARY KEY DEFAULT 1,
    establecimiento VARCHAR(10) NOT NULL DEFAULT '001',
    punto_emision   VARCHAR(10) NOT NULL DEFAULT '001',
    secuencial      INT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT INTO factura_config (id, establecimiento, punto_emision, secuencial) VALUES (1, '001', '001', 0);

-- ============================================================
-- MÓDULO EMPRESA
-- ============================================================
CREATE TABLE empresa (
    id TINYINT UNSIGNED NOT NULL DEFAULT 1,
    ruc        VARCHAR(20)  NOT NULL DEFAULT '',
    nombre     VARCHAR(150) NOT NULL DEFAULT 'Mi Empresa',
    direccion  VARCHAR(300) NOT NULL DEFAULT '',
    telefono   VARCHAR(20)  NOT NULL DEFAULT '',
    correo     VARCHAR(100) NOT NULL DEFAULT '',
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO empresa (id) VALUES (1);

-- ============================================================
-- DATOS INICIALES
-- ============================================================

-- Usuarios de prueba
-- admin    → contraseña: admin2026*/
-- mesero   → contraseña: mesero123
INSERT INTO usuarios (nombre, usuario, password, rol, estado) VALUES
('Administrador',  'admin',  '$2y$10$gt7dnL7DvNzYLdNWT8jnCOHdabx5hoHAazWgNmk2.PowX5EGt/kXK', 'admin',   1),
('Juan Mesero',    'mesero', '$2y$10$wq.RgvAvDYT8lrqddKmbDu7WR7DJJ.TTACxGhC2GZhcKd4FYNzCWG', 'mesero',  1);

-- Mesas de prueba
INSERT INTO mesas (numero, estado) VALUES
(1, 'libre'),
(2, 'libre'),
(3, 'libre'),
(4, 'libre'),
(5, 'libre');