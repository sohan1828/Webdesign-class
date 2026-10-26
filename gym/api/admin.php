<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_admin();

$pdo = db();

/** GET ?action=bootstrap : every collection, for the admin pages to load. */
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
  if (($_GET['action'] ?? '') !== 'bootstrap') fail('Unknown action', 400);
  $res = ['ok' => true];
  foreach (FC_COLLECTIONS as $c) {
    $rows = $pdo->query('SELECT data FROM `' . $c . '`')->fetchAll();
    $res[$c] = array_values(array_filter(array_map(fn($r) => json_decode($r['data'], true), $rows), 'is_array'));
  }
  out($res);
}

/** POST {action:"save", collection, upserts:[records], deletes:[ids]} : changes only the records listed, so a new website sign-up is never overwritten. */
$b = body(4000000);
if (($b['action'] ?? '') !== 'save') fail('Unknown action', 400);
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
    $pdo->prepare('DELETE FROM `' . $c . '` WHERE id IN (' . implode(',', array_fill(0, count($del), '?')) . ')')->execute(array_values($del));
  }
  $pdo->commit();
} catch (PDOException $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  if (($e->errorInfo[1] ?? 0) === 1062) fail('That phone number (or booking) is already saved for someone else.', 409);
  throw $e;
}
out(['ok' => true]);
