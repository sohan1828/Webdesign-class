<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('POST only', 405);
session_boot();
$_SESSION = [];
if (ini_get('session.use_cookies')) {
  $p = session_get_cookie_params();
  setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
}
session_destroy();
out(['ok' => true]);
