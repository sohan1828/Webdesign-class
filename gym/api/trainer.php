<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
// The trainer's own page: their clients, their sessions and who is booked. Nothing about other trainers' clients.
require_role('trainer');
$pdo = db();
$tid = (string) ($_SESSION['trainerId'] ?? '');
if ($tid === '') fail('This login is not linked to a trainer.', 403);

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  $b = body(10000);
  if (($b['action'] ?? '') !== 'note') fail('Unknown action', 400);
  $note = clean((string) ($b['note'] ?? ''), 2000);
  $pdo->beginTransaction();
  $st = $pdo->prepare('SELECT data FROM members WHERE id = ? AND trainer_id = ? FOR UPDATE');
  $st->execute([(string) ($b['memberId'] ?? ''), $tid]);
  $r = $st->fetch();
  if (!$r) { $pdo->rollBack(); fail('That is not one of your clients.', 403); }
  $m = json_decode($r['data'], true);
  $m['trainerNotes'] = $note;
  $pdo->prepare('UPDATE members SET data = ? WHERE id = ?')->execute([json_encode($m, JSON_UNESCAPED_UNICODE), $m['id']]);
  $pdo->commit();
  out(['ok' => true]);
}

$trainers = load_trainers();
$me = $trainers[$tid] ?? null;
if (!$me) fail('Trainer record not found', 404);

$st = $pdo->prepare('SELECT data FROM members WHERE trainer_id = ?');
$st->execute([$tid]);
$clients = [];
foreach ($st->fetchAll() as $r) {
  $m = json_decode($r['data'], true);
  $clients[$m['id']] = ['id' => $m['id'], 'name' => $m['name'], 'phone' => $m['phone'], 'plan' => $m['plan'] ?? 'monthly', 'start' => $m['start'] ?? null, 'expires' => $m['expires'] ?? null,
    'goal' => $m['goal'] ?? '', 'experience' => $m['experience'] ?? '', 'dob' => $m['dob'] ?? '', 'gender' => $m['gender'] ?? '', 'health' => $m['health'] ?? '', 'emergency' => $m['emergency'] ?? '',
    'trainerNotes' => $m['trainerNotes'] ?? '', 'visits30' => 0, 'lastVisit' => null];
}
if ($clients) {
  $ids = array_keys($clients);
  $st = $pdo->prepare('SELECT member_id, SUM(ts > ?) AS c, MAX(ts) AS l FROM checkins WHERE member_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ') GROUP BY member_id');
  $st->execute(array_merge([(time() - 30 * 86400) * 1000], $ids));
  foreach ($st->fetchAll() as $r) { $clients[$r['member_id']]['visits30'] = (int) $r['c']; $clients[$r['member_id']]['lastVisit'] = (int) $r['l']; }
}

$mine = array_filter(load_classes(), fn($c) => ($c['trainerId'] ?? '') === $tid);
$days = []; for ($i = 0; $i < 7; $i++) $days[] = date('Y-m-d', strtotime("+$i days"));
$booked = [];
if ($mine) {
  $ids = array_keys($mine);
  $st = $pdo->prepare('SELECT b.class_id, b.date, m.data FROM bookings b JOIN members m ON m.id = b.member_id WHERE b.class_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ') AND b.date BETWEEN ? AND ?');
  $st->execute(array_merge($ids, [$days[0], $days[6]]));
  foreach ($st->fetchAll() as $r) { $m = json_decode($r['data'], true); $booked[$r['class_id'] . '|' . $r['date']][] = ['name' => $m['name'], 'phone' => $m['phone']]; }
}
$roster = [];
foreach ($days as $d) {
  foreach ($mine as $c) {
    if (in_array((int) date('w', strtotime($d)), array_map('intval', (array) $c['days']), true)) $roster[] = ['classId' => $c['id'], 'date' => $d, 'members' => $booked[$c['id'] . '|' . $d] ?? []];
  }
}
out(['ok' => true, 'now' => (int) (microtime(true) * 1000),
  'trainer' => ['name' => $me['name'], 'specialty' => $me['specialty'] ?? '', 'hours' => $me['hours'] ?? '', 'years' => $me['years'] ?? 0],
  'clients' => array_values($clients), 'classes' => array_values(array_map(fn($c) => public_class($c, $trainers), $mine)), 'roster' => $roster]);
