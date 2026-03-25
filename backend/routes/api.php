<?php
// routes/api.php

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/JwtHelper.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

// ── Manejador global de excepciones no capturadas ────────────────────────────
set_exception_handler(function (Throwable $e) {
  $code = $e instanceof PDOException ? 500 : 500;
  Response::json($code, [
    'error'   => 'Error interno del servidor',
    'detalle' => $e->getMessage(),
  ]);
});

// ── Models ────────────────────────────────────────────────────────────────────
require_once __DIR__ . '/../models/UsuarioModel.php';
require_once __DIR__ . '/../models/CategoriaModel.php';
require_once __DIR__ . '/../models/ProductoModel.php';
require_once __DIR__ . '/../models/InsumoModel.php';
require_once __DIR__ . '/../models/RecetaModel.php';
require_once __DIR__ . '/../models/MesaModel.php';
require_once __DIR__ . '/../models/PedidoModel.php';
require_once __DIR__ . '/../models/VentaModel.php';
require_once __DIR__ . '/../models/ClienteModel.php';
require_once __DIR__ . '/../models/FacturaConfigModel.php';
require_once __DIR__ . '/../models/EmpresaModel.php';

// ── Controllers ───────────────────────────────────────────────────────────────
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/UsuarioController.php';
require_once __DIR__ . '/../controllers/CategoriaController.php';
require_once __DIR__ . '/../controllers/ProductoController.php';
require_once __DIR__ . '/../controllers/InsumoController.php';
require_once __DIR__ . '/../controllers/RecetaController.php';
require_once __DIR__ . '/../controllers/MesaController.php';
require_once __DIR__ . '/../controllers/PedidoController.php';
require_once __DIR__ . '/../controllers/VentaController.php';
require_once __DIR__ . '/../controllers/ClienteController.php';
require_once __DIR__ . '/../controllers/FacturaConfigController.php';
require_once __DIR__ . '/../controllers/EmpresaController.php';

// ── Router ────────────────────────────────────────────────────────────────────
class Router
{
  private array $routes = [];

  public function add(string $method, string $path, array $action, bool $requireAuth = true): void
  {
    $this->routes[] = [
      'method'      => strtoupper($method),
      'path'        => $path,
      'action'      => $action,
      'requireAuth' => $requireAuth,
    ];
  }

  public function dispatch(string $method, string $uri): void
  {
    $method = strtoupper($method);

    foreach ($this->routes as $route) {
      if ($route['method'] !== $method) continue;

      $pattern = '#^' . preg_replace('/\{(\w+)\}/', '([^/]+)', $route['path']) . '$#';
      if (!preg_match($pattern, $uri, $matches)) continue;

      array_shift($matches); // quitar match completo

      $tokenData = null;
      if ($route['requireAuth']) {
        $tokenData = AuthMiddleware::requiereToken();
      }

      [$class, $methodName] = $route['action'];
      (new $class())->$methodName($tokenData, ...$matches);
      return;
    }

    Response::json(404, ['error' => 'Ruta no encontrada', 'uri' => $uri]);
  }
}

$router = new Router();

// ── Auth ──────────────────────────────────────────────────────────────────────
$router->add('POST', '/api/auth/login', [AuthController::class,    'login'],    false);

// ── Usuarios ──────────────────────────────────────────────────────────────────
$router->add('GET',    '/api/usuarios',       [UsuarioController::class, 'index']);
$router->add('GET',    '/api/usuarios/{id}',  [UsuarioController::class, 'show']);
$router->add('POST',   '/api/usuarios',       [UsuarioController::class, 'store']);
$router->add('PUT',    '/api/usuarios/{id}',  [UsuarioController::class, 'update']);
$router->add('DELETE', '/api/usuarios/{id}',  [UsuarioController::class, 'destroy']);

// ── Categorías ────────────────────────────────────────────────────────────────
$router->add('GET',    '/api/categorias',       [CategoriaController::class, 'index']);
$router->add('GET',    '/api/categorias/{id}',  [CategoriaController::class, 'show']);
$router->add('POST',   '/api/categorias',       [CategoriaController::class, 'store']);
$router->add('PUT',    '/api/categorias/{id}',  [CategoriaController::class, 'update']);
$router->add('DELETE', '/api/categorias/{id}',  [CategoriaController::class, 'destroy']);

// ── Productos ─────────────────────────────────────────────────────────────────
$router->add('GET',    '/api/productos',       [ProductoController::class, 'index']);
$router->add('GET',    '/api/productos/{id}',  [ProductoController::class, 'show']);
$router->add('POST',   '/api/productos',       [ProductoController::class, 'store']);
$router->add('PUT',    '/api/productos/{id}',  [ProductoController::class, 'update']);
$router->add('DELETE', '/api/productos/{id}',  [ProductoController::class, 'destroy']);

// ── Insumos ───────────────────────────────────────────────────────────────────
$router->add('GET',    '/api/insumos',       [InsumoController::class, 'index']);
$router->add('GET',    '/api/insumos/{id}',  [InsumoController::class, 'show']);
$router->add('POST',   '/api/insumos',       [InsumoController::class, 'store']);
$router->add('PUT',    '/api/insumos/{id}',  [InsumoController::class, 'update']);
$router->add('DELETE', '/api/insumos/{id}',  [InsumoController::class, 'destroy']);

// ── Recetas ───────────────────────────────────────────────────────────────────
$router->add('GET',    '/api/recetas/producto/{producto_id}', [RecetaController::class, 'indexByProducto']);
$router->add('POST',   '/api/recetas',       [RecetaController::class, 'store']);
$router->add('DELETE', '/api/recetas/{id}',  [RecetaController::class, 'destroy']);

// ── Mesas ─────────────────────────────────────────────────────────────────────
$router->add('GET',    '/api/mesas',       [MesaController::class, 'index']);
$router->add('GET',    '/api/mesas/{id}',  [MesaController::class, 'show']);
$router->add('POST',   '/api/mesas',       [MesaController::class, 'store']);
$router->add('PUT',    '/api/mesas/{id}',  [MesaController::class, 'update']);
$router->add('DELETE', '/api/mesas/{id}',  [MesaController::class, 'destroy']);

// ── Pedidos ───────────────────────────────────────────────────────────────────
$router->add('GET',    '/api/pedidos',                  [PedidoController::class, 'index']);
$router->add('GET',    '/api/pedidos/{id}',             [PedidoController::class, 'show']);
$router->add('POST',   '/api/pedidos',                  [PedidoController::class, 'store']);
$router->add('POST',   '/api/pedidos/{id}/detalle',                    [PedidoController::class, 'addDetalle']);
$router->add('DELETE', '/api/pedidos/{pedidoId}/detalle/{detalleId}',  [PedidoController::class, 'removeDetalle']);
$router->add('PATCH',  '/api/pedidos/{id}/cerrar',                     [PedidoController::class, 'cerrar']);

// ── Ventas ────────────────────────────────────────────────────────────────────
// IMPORTANTE: /api/ventas/reporte debe ir ANTES de /api/ventas/{id}
$router->add('GET',    '/api/ventas/reporte', [VentaController::class, 'reporte']);
$router->add('GET',    '/api/ventas',         [VentaController::class, 'index']);
$router->add('GET',    '/api/ventas/{id}',    [VentaController::class, 'show']);
$router->add('POST',   '/api/ventas',         [VentaController::class, 'store']);

// ── Clientes ──────────────────────────────────────────────────────────────────
$router->add('GET',    '/api/clientes',       [ClienteController::class, 'index']);
$router->add('GET',    '/api/clientes/{id}',  [ClienteController::class, 'show']);
$router->add('POST',   '/api/clientes',       [ClienteController::class, 'store']);
$router->add('PUT',    '/api/clientes/{id}',  [ClienteController::class, 'update']);
$router->add('DELETE', '/api/clientes/{id}',  [ClienteController::class, 'destroy']);
// ── Factura Config ──────────────────────────────────────────────────────────
$router->add('GET', '/api/factura-config',    [FacturaConfigController::class, 'show']);
$router->add('PUT', '/api/factura-config',    [FacturaConfigController::class, 'update']);
// ── Empresa ───────────────────────────────────────────────────────────────────
$router->add('GET', '/api/empresa',           [EmpresaController::class,      'show'],   false);
$router->add('PUT', '/api/empresa',           [EmpresaController::class,      'update']);
// ── Dispatch ──────────────────────────────────────────────────────────────────
// Determinar la URI relativa al directorio del script (public/)
$scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$uri       = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri       = ($scriptDir !== '' && strpos($uri, $scriptDir) === 0)
  ? substr($uri, strlen($scriptDir))
  : $uri;
$uri = '/' . ltrim($uri ?: '/', '/');

$router->dispatch($_SERVER['REQUEST_METHOD'], $uri);
