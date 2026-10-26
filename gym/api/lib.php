<?php
declare(strict_types=1);
// Shared helpers for every endpoint. Not a public page: .htaccess blocks direct access.

ini_set("display_errors", "0");
$GLOBALS["fc_cfg"] = require __DIR__ . '/config.php';

if (PHP_SAPI !== 'cli') {
  header('Content-Type: application/json; charset=utf-8');
  header('X-Content-Type-Options: nosniff');
  header('Referrer-Policy: same-origin');
  header('Cache-Control: no-store');
}

set_exception_handler(function (Throwable $e): void {
  error_log('[fitness-club] ' . $e->getMessage());
  if (PHP_SAPI === 'cli') { fwrite(STDERR, $e->getMessage() . "\n"); exit(1); }
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Server error']);
  exit;
});

function cfg(string $key, $default = null) { return $GLOBALS['fc_cfg'][$key] ?? $default; }

function out(array $data, int $code = 200): void {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function fail(string $msg, int $code = 400): void { out(['ok' => false, 'error' => $msg], $code); }

function db(): PDO {
  static $pdo = null;
  if ($pdo === null) {
    $pdo = new PDO(
      sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', cfg('db_host'), cfg('db_name')),
      (string) cfg('db_user'), (string) cfg('db_pass'),
      [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
    );
  }
  return $pdo;
}

/** Reads and decodes the JSON request body. */
function body(int $maxBytes = 2000000): array {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('POST only', 405);
  if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) fail('Send JSON', 415);
  $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
  if ($raw === false || strlen($raw) > $maxBytes) fail('Request too large', 413);
  $data = json_decode($raw, true);
  if (!is_array($data)) fail('Bad JSON', 400);
  return $data;
}

function client_ip(): string { return substr((string) ($_SERVER['REMOTE_ADDR'] ?? '0'), 0, 45); }

function rate_count(string $key, int $windowSec): int {
  $st = db()->prepare('SELECT COUNT(*) AS c FROM rate_limits WHERE k = ? AND ts > ?');
  $st->execute([$key, time() - $windowSec]);
  return (int) $st->fetch()['c'];
}
function rate_hit(string $key): void {
  $pdo = db();
  if (random_int(1, 50) === 1) $pdo->prepare('DELETE FROM rate_limits WHERE ts < ?')->execute([time() - 86400]);
  $pdo->prepare('INSERT INTO rate_limits (k, ts) VALUES (?, ?)')->execute([$key, time()]);
}
/** Counts this request and stops it if the limit is passed. */
function rate_guard(string $key, int $max, int $windowSec): void {
  if (rate_count($key, $windowSec) >= $max) fail('Too many requests. Please try again later.', 429);
  rate_hit($key);
}

function session_boot(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;
  $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
  session_name('fcadmin');
  session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
  session_start();
}

/** Stops the request unless a logged-in admin sent it (and, for POST, sent the right CSRF token). */
function require_admin(): void {
  session_boot();
  if (empty($_SESSION['uid'])) fail('Not logged in', 401);
  if (($_SESSION['last'] ?? 0) < time() - (int) cfg('session_idle', 7200)) {
    $_SESSION = []; session_destroy();
    fail('Session expired. Please log in again.', 401);
  }
  $_SESSION['last'] = time();
  if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $sent = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($sent === '' || !hash_equals((string) ($_SESSION['csrf'] ?? ''), $sent)) fail('Bad security token. Reload the page.', 403);
  }
}

function new_id(): string { return bin2hex(random_bytes(8)); }
function phone_key(string $p): string { $d = preg_replace('/\D/', '', $p) ?? ''; return strlen($d) > 10 ? substr($d, -10) : $d; }
function clean(string $v, int $max): string { return mb_substr(trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $v) ?? ''), 0, $max); }

/** Tables the admin can read and write, and which record fields are copied into real columns. */
const FC_COLLECTIONS = ['members', 'sales', 'trainers', 'classes', 'bookings', 'checkins'];

/** Checks one record from the admin page and returns the column values to store beside its JSON. */
function columns_for(string $c, array $it): array {
  $s = fn($k, int $max = 40) => clean((string) ($it[$k] ?? ''), $max);
  switch ($c) {
    case 'members':
      $phone = phone_key((string) ($it['phone'] ?? ''));
      if ($s('name', 80) === '' || strlen($phone) < 7) fail('A member needs a name and a phone number', 422);
      return ['phone' => $phone, 'joined' => (int) ($it['joined'] ?? 0)];
    case 'sales':
      if (!in_array($it['type'] ?? '', ['membership', 'shop', 'plan'], true)) fail('Unknown sale type', 422);
      $amt = $it['amount'] ?? null;
      if (!is_int($amt) && !(is_float($amt) && floor($amt) === $amt)) fail('Sale amount must be a whole number', 422);
      if ($amt < 0 || $amt > 10000000) fail('Sale amount out of range', 422);
      return ['ts' => (int) ($it['ts'] ?? 0), 'type' => (string) $it['type'], 'amount' => (int) $amt, 'member_id' => ($it['memberId'] ?? '') === '' ? null : $s('memberId')];
    case 'bookings':
      if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($it['date'] ?? ''))) fail('Bad booking date', 422);
      return ['class_id' => $s('classId'), 'date' => (string) $it['date'], 'member_id' => $s('memberId')];
    case 'checkins':
      return ['member_id' => $s('memberId'), 'ts' => (int) ($it['ts'] ?? 0)];
    default:
      return [];
  }
}
