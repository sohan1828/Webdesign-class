<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
// The member's own account: membership, trainer, bookable sessions, bookings, password.
require_role('member');
$pdo = db();
$mid = (string) $_SESSION['memberId'];

$st = $pdo->prepare('SELECT data FROM members WHERE id = ?');
$st->execute([$mid]);
$row = $st->fetch();
if (!$row) fail('Account not found', 404);
$m = json_decode($row['data'], true);
$classes = load_classes();
$trainers = load_trainers();
$today = date('Y-m-d');
$last = date('Y-m-d', strtotime('+13 days'));

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
  $counts = [];
  $st = $pdo->prepare('SELECT class_id, date, COUNT(*) AS c FROM bookings WHERE date BETWEEN ? AND ? GROUP BY class_id, date');
  $st->execute([$today, $last]);
  foreach ($st->fetchAll() as $r) $counts[$r['class_id'] . '|' . $r['date']] = (int) $r['c'];

  $st = $pdo->prepare('SELECT data FROM bookings WHERE member_id = ? AND date >= ? ORDER BY date');
  $st->execute([$mid, $today]);
  $mine = array_map(fn($r) => json_decode($r['data'], true), $st->fetchAll());

  $st = $pdo->prepare('SELECT SUM(ts > ?) AS c, MAX(ts) AS l FROM checkins WHERE member_id = ?');
  $st->execute([(time() - 30 * 86400) * 1000, $mid]);
  $v = $st->fetch();

  $t = $trainers[$m['trainerId'] ?? ''] ?? null;
  $list = array_values(array_map(fn($c) => public_class($c, $trainers), $classes));
  usort($list, fn($a, $b) => strcmp($a['time'], $b['time']));
  out(['ok' => true, 'now' => (int) (microtime(true) * 1000),
    'member' => ['name' => $m['name'], 'phone' => $m['phone'], 'plan' => $m['plan'] ?? 'monthly', 'start' => $m['start'] ?? null, 'expires' => $m['expires'] ?? null, 'goal' => $m['goal'] ?? '', 'experience' => $m['experience'] ?? ''],
    'trainer' => $t ? ['name' => $t['name'], 'specialty' => $t['specialty'] ?? '', 'hours' => $t['hours'] ?? ''] : null,
    'classes' => $list, 'bookings' => array_map(fn($b) => ['id' => $b['id'], 'classId' => $b['classId'], 'date' => $b['date']], array_filter($mine, 'is_array')),
    'counts' => $counts, 'visits30' => (int) ($v['c'] ?? 0), 'lastVisit' => $v['l'] ? (int) $v['l'] : null]);
}

$b = body(10000);
$action = (string) ($b['action'] ?? '');

if ($action === 'book') {
  $cid = (string) ($b['classId'] ?? ''); $date = (string) ($b['date'] ?? '');
  $c = $classes[$cid] ?? null;
  if (!$c || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) fail('Session not found', 404);
  if ($date < $today || $date > $last) fail('You can book from today up to two weeks ahead.', 422);
  if (!in_array((int) date('w', strtotime($date)), array_map('intval', (array) $c['days']), true)) fail('That session does not run on that day.', 422);
  $start = class_start($c, $date);
  if ($start <= time()) fail('That session has already started.', 422);
  if ((int) ($m['expires'] ?? 0) < $start * 1000) fail('Your membership is not active for that session. Please contact the gym to renew.', 403);
  rate_guard('book:' . $mid, 30, 3600);
  try {
    $pdo->beginTransaction();
    $st = $pdo->prepare('SELECT id FROM bookings WHERE class_id = ? AND date = ? FOR UPDATE');
    $st->execute([$cid, $date]);
    if (count($st->fetchAll()) >= (int) $c['cap']) { $pdo->rollBack(); fail('This session is full.', 409); }
    $bk = ['id' => new_id(), 'classId' => $cid, 'date' => $date, 'memberId' => $mid];
    $pdo->prepare('INSERT INTO bookings (id, class_id, date, member_id, data) VALUES (?, ?, ?, ?, ?)')->execute([$bk['id'], $cid, $date, $mid, json_encode($bk)]);
    $pdo->commit();
  } catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if (($e->errorInfo[1] ?? 0) === 1062) fail('You are already booked on this session.', 409);
    throw $e;
  }
  out(['ok' => true, 'id' => $bk['id']]);
}

if ($action === 'cancel') {
  $st = $pdo->prepare('SELECT class_id, date FROM bookings WHERE id = ? AND member_id = ?');
  $st->execute([(string) ($b['bookingId'] ?? ''), $mid]);
  $bk = $st->fetch();
  if (!$bk) fail('Booking not found', 404);
  $c = $classes[$bk['class_id']] ?? null;
  if ($c && class_start($c, $bk['date']) <= time()) fail('That session has already started.', 422);
  $pdo->prepare('DELETE FROM bookings WHERE id = ? AND member_id = ?')->execute([(string) $b['bookingId'], $mid]);
  out(['ok' => true]);
}

if ($action === 'password') {
  rate_guard('pw:' . $mid, 5, 900);
  $next = (string) ($b['next'] ?? '');
  if (strlen($next) < 8) fail('The new password needs at least 8 characters.', 422);
  $st = $pdo->prepare('SELECT pass_hash FROM member_logins WHERE member_id = ?');
  $st->execute([$mid]);
  $r = $st->fetch();
  if (!$r || !password_verify((string) ($b['current'] ?? ''), $r['pass_hash'])) fail('Your current password is not right.', 403);
  $pdo->prepare('UPDATE member_logins SET pass_hash = ? WHERE member_id = ?')->execute([password_hash($next, PASSWORD_DEFAULT), $mid]);
  out(['ok' => true]);
}
fail('Unknown action', 400);
