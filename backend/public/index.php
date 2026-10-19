<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Atrás do rewrite do .htaccess a URL não tem /public/; aponta SCRIPT_NAME
// para a raiz do app para o Laravel detectar a base corretamente.
$publicDir = dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php');
if ($publicDir !== '/' && ! str_starts_with($_SERVER['REQUEST_URI'] ?? '', $publicDir.'/')) {
    $_SERVER['SCRIPT_NAME'] = $_SERVER['PHP_SELF'] = dirname($publicDir).'/index.php';
}

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

$app->handleRequest(Request::capture());
