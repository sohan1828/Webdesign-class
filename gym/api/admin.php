<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_role('owner');

$pdo = db();

/** GET ?action=bootstrap : every collection, for the admin pages to load. */
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
  if (($_GET['action'] ?? '') !== 'bootstrap') fail('Unknown action', 400);
  $res = ['ok' => true];
  foreach (FC_COLLECTIONS as $c) {
    $rows = $pdo->query('SELECT data FROM `' . $c . '`')->fetchAll();
    $res[$c] = array_values(array_filter(array_map(fn($r) => json_decode($r['data'], true), $rows), 'is_array'));
  }
  $res['logins'] = ['members' => [], 'trainers' => []];
  foreach ($pdo->query('SELECT member_id FROM member_logins')->fetchAll() as $r) $res['logins']['members'][$r['member_id']] = true;
  foreach ($pdo->query("SELECT trainer_id, username FROM admin_users WHERE role = 'trainer'")->fetchAll() as $r) $res['logins']['trainers'][$r['trainer_id']] = $r['username'];
  out($res);
}

/** POST {action:"save", collection, upserts:[records], deletes:[ids]} : changes only the records listed, so a new website sign-up is never overwritten. */
$b = body(4000000);
$action = (string) ($b['action'] ?? '');

/** Give a member a login (they sign in on login.html with their phone number and this password). */
if ($action === 'set_member_password') {
  $id = (string) ($b['memberId'] ?? ''); $pw = (string) ($b['password'] ?? '');
  if (strlen($pw) < 8 || strlen($pw) > 100) fail('Password needs 8 to 100 characters', 422);
  $st = $pdo->prepare('SELECT 1 FROM members WHERE id = ?'); $st->execute([$id]);
  if (!$st->fetch()) fail('Member not found', 404);
  $pdo->prepare('INSERT INTO member_logins (member_id, pass_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE pass_hash = VALUES(pass_hash)')->execute([$id, password_hash($pw, PASSWORD_DEFAULT)]);
  out(['ok' => true]);
}

/** Give a trainer a login (a username and password that open trainer.html). One login per trainer. */
if ($action === 'set_trainer_login') {
  $tid = (string) ($b['trainerId'] ?? ''); $user = strtolower(clean((string) ($b['username'] ?? ''), 40)); $pw = (string) ($b['password'] ?? '');
  if (!preg_match('/^[a-z0-9._-]{3,40}$/', $user)) fail('Username: 3 to 40 letters, numbers, dot, dash or underscore', 422);
  if (strlen($pw) < 8 || strlen($pw) > 100) fail('Password needs 8 to 100 characters', 422);
  $st = $pdo->prepare('SELECT 1 FROM trainers WHERE id = ?'); $st->execute([$tid]);
  if (!$st->fetch()) fail('Trainer not found. Save the trainer first.', 404);
  $st = $pdo->prepare('SELECT role, trainer_id FROM admin_users WHERE username = ?'); $st->execute([$user]);
  $ex = $st->fetch();
  if ($ex && ($ex['role'] !== 'trainer' || $ex['trainer_id'] !== $tid)) fail('That username is taken. Choose another.', 409);
  $pdo->beginTransaction();
  $pdo->prepare("DELETE FROM admin_users WHERE role = 'trainer' AND trainer_id = ?")->execute([$tid]);
  $pdo->prepare("INSERT INTO admin_users (username, pass_hash, role, trainer_id) VALUES (?, ?, 'trainer', ?)")->execute([$user, password_hash($pw, PASSWORD_DEFAULT), $tid]);
  $pdo->commit();
  out(['ok' => true]);
}

if ($action !== 'save') fail('Unknown action', 400);
$c = (string) ($b['collection'] ?? '');
if (!in_array($c, FC_COLLECTIONS, true)) fail('Unknown collection', 400);
$up = $b['upserts'] ?? [];
$del = $b['deletes'] ?? [];
if (!is_array($up) || !is_array($del) || count($up) > 3000 || count($del) > 3000) fail('Too many changes in one request', 413);

// Check everything first so a bad record rejects the whole request and nothing is half saved.
$prepared = [];
foreach ($up as $it) {
  if (!is_array($it)) fail('Bad record', 422);
  $id = (string) ($it['id'] ?? '');
  if (!preg_match('/^[A-Za-z0-9]{1,40}$/', $id)) fail('Bad record id', 422);
  unset($it['dup']);
  $json = json_encode($it, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false || strlen($json) > 100000) fail('Record too large', 422);
  $prepared[] = ['id' => $id, 'data' => $json, 'cols' => columns_for($c, $it)];
}
foreach ($del as $id) if (!is_string($id) || !preg_match('/^[A-Za-z0-9]{1,40}$/', $id)) fail('Bad record id', 422);

try {
  $pdo->beginTransaction();
  foreach ($prepared as $p) {
    $names = array_merge(['id', 'data'], array_keys($p['cols']));
    $marks = implode(',', array_fill(0, count($names), '?'));
    $upd = implode(',', array_map(fn($n) => "`$n` = VALUES(`$n`)", array_slice($names, 1)));
    $sql = 'INSERT INTO `' . $c . '` (`' . implode('`,`', $names) . '`) VALUES (' . $marks . ') ON DUPLICATE KEY UPDATE ' . $upd;
    $pdo->prepare($sql)->execute(array_merge([$p['id'], $p['data']], array_values($p['cols'])));
  }
  if ($del) {
    $in = implode(',', array_fill(0, count($del), '?'));
    $pdo->prepare('DELETE FROM `' . $c . '` WHERE id IN (' . $in . ')')->execute(array_values($del));
    // Removing a person also removes their login.
    if ($c === 'members') $pdo->prepare('DELETE FROM member_logins WHERE member_id IN (' . $in . ')')->execute(array_values($del));
    if ($c === 'trainers') $pdo->prepare("DELETE FROM admin_users WHERE role = 'trainer' AND trainer_id IN (" . $in . ')')->execute(array_values($del));
  }
  $pdo->commit();
} catch (PDOException $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  if (($e->errorInfo[1] ?? 0) === 1062) fail('That phone number (or booking) is already saved for someone else.', 409);
  throw $e;
}
out(['ok' => true]);
