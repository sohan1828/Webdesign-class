<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';

$b = body(10000);
$user = strtolower(clean((string) ($b['username'] ?? ''), 40));
$pass = (string) ($b['password'] ?? '');
$ipKey = 'login-ip:' . client_ip();
$userKey = 'login-user:' . $user;

// 10 wrong tries per IP or 5 per username in 15 minutes locks logins for that IP or username until the window passes.
if (rate_count($ipKey, 900) >= 10 || rate_count($userKey, 900) >= 5) fail('Too many attempts. Wait 15 minutes and try again.', 429);

$st = db()->prepare('SELECT id, pass_hash, role FROM admin_users WHERE username = ?');
$st->execute([$user]);
$row = $st->fetch();

// Hash even when the user does not exist, so a wrong username takes as long as a wrong password.
$ok = password_verify($pass, $row ? $row['pass_hash'] : password_hash('no-such-user', PASSWORD_DEFAULT)) && $row;
if (!$ok) {
  rate_hit($ipKey); rate_hit($userKey);
  fail('Wrong username or password', 401);
}

session_boot();
session_regenerate_id(true);
$_SESSION = ['uid' => (int) $row['id'], 'role' => $row['role'], 'csrf' => bin2hex(random_bytes(32)), 'last' => time()];
if (password_needs_rehash($row['pass_hash'], PASSWORD_DEFAULT)) {
  db()->prepare('UPDATE admin_users SET pass_hash = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), $row['id']]);
}
out(['ok' => true, 'csrf' => $_SESSION['csrf'], 'user' => $user, 'role' => $row['role']]);
