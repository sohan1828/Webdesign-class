<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
// Public: shop checkout and the plan builder post here. Records the order in Sales.
// IMPORTANT: nothing here proves the money arrived. Until eSewa or Khalti verification is added,
// treat these as orders to confirm, not as received payments.

$b = body(20000);
rate_guard('order:' . client_ip(), 20, 3600);

$type = (string) ($b['type'] ?? '');
if (!in_array($type, ['shop', 'plan'], true)) fail('Unknown order type', 422);
$amount = $b['amount'] ?? null;
if (!is_int($amount) || $amount < 1 || $amount > 1000000) fail('Bad amount', 422);

$c = is_array($b['customer'] ?? null) ? $b['customer'] : [];
$sale = [
  'id' => new_id(), 'ts' => (int) (microtime(true) * 1000), 'type' => $type, 'amount' => $amount,
  'label' => clean((string) ($b['label'] ?? ''), 300),
  'method' => clean((string) ($b['method'] ?? ''), 40),
  'customer' => ['name' => clean((string) ($c['name'] ?? ''), 80), 'phone' => clean((string) ($c['phone'] ?? ''), 20), 'address' => clean((string) ($c['address'] ?? ''), 200)],
  'verified' => false,
];

$memberId = null;
$key = phone_key($sale['customer']['phone']);
if (strlen($key) >= 7) {
  $st = db()->prepare('SELECT id FROM members WHERE phone = ?');
  $st->execute([$key]);
  $m = $st->fetch();
  if ($m) { $memberId = $m['id']; $sale['memberId'] = $memberId; }
}

db()->prepare('INSERT INTO sales (id, ts, type, amount, member_id, data) VALUES (?, ?, ?, ?, ?, ?)')
  ->execute([$sale['id'], $sale['ts'], $type, $amount, $memberId, json_encode($sale, JSON_UNESCAPED_UNICODE)]);
out(['ok' => true]);
