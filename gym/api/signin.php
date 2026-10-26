<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
// One sign-in for everyone on login.html.
//   Letters in the box   -> a staff username (owner or trainer)
//   Only digits          -> a member's phone number
$b = body(10000);
$id = clean((string) ($b['id'] ?? ''), 60);
$pass = (string) ($b['password'] ?? '');
$isStaff = (bool) preg_match('/[A-Za-z]/', $id);
$idKey = 'signin-id:' . strtolower($isStaff ? $id : phone_key($id));
$ipKey = 'signin-ip:' . client_ip();
if (rate_count($ipKey, 900) >= 15 || rate_count($idKey, 900) >= 5) fail('Too many attempts. Wait 15 minutes and try again.', 429);

$dummy = fn() => password_hash('no-such-user', PASSWORD_DEFAULT);
$hash = null; $fields = null; $role = '';
if ($isStaff) {
  $st = db()->prepare('SELECT id, pass_hash, role, trainer_id FROM admin_users WHERE username = ?');
  $st->execute([strtolower($id)]);
  if ($row = $st->fetch()) { $hash = $row['pass_hash']; $role = $row['role']; $fields = ['uid' => (int) $row['id'], 'role' => $role, 'trainerId' => $row['trainer_id']]; }
} else {
  $key = phone_key($id);
  if (strlen($key) >= 7) {
    $st = db()->prepare('SELECT m.id, l.pass_hash FROM members m JOIN member_logins l ON l.member_id = m.id WHERE m.phone = ?');
    $st->execute([$key]);
    if ($row = $st->fetch()) { $hash = $row['pass_hash']; $role = 'member'; $fields = ['role' => 'member', 'memberId' => $row['id']]; }
  }
}
// Always run one hash check, so a wrong id takes as long as a wrong password.
$ok = password_verify($pass, $hash ?? $dummy()) && $hash !== null;
if (!$ok) { rate_hit($ipKey); rate_hit($idKey); fail($isStaff ? 'Wrong username or password' : 'Wrong phone number or password', 401); }

$csrf = start_session($fields);
out(['ok' => true, 'csrf' => $csrf, 'role' => $role]);
