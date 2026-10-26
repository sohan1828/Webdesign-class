<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
// Public: the join form on the home page posts here. Adds a "not paid yet" member.

$b = body(20000);
rate_guard('join:' . client_ip(), 10, 3600);

// Hidden field that real visitors never fill in. Bots do. Pretend it worked.
if (clean((string) ($b['website'] ?? ''), 100) !== '') out(['ok' => true]);

$name  = clean((string) ($b['name'] ?? ''), 80);
$phone = clean((string) ($b['phone'] ?? ''), 20);
$email = clean((string) ($b['email'] ?? ''), 120);
if (mb_strlen($name) < 2) fail('Please enter your name', 422);
$key = phone_key($phone);
if (strlen($key) < 7 || strlen(preg_replace('/\D/', '', $phone) ?? '') > 15) fail('Please enter a valid phone number', 422);
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Please enter a valid email', 422);

$pick = function (string $k, array $allowed) use ($b): string { $v = (string) ($b[$k] ?? ''); return in_array($v, $allowed, true) ? $v : ''; };
$dob = (string) ($b['dob'] ?? '');
if ($dob !== '' && (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob) || $dob > date('Y-m-d') || $dob < '1900-01-01')) $dob = '';

$member = [
  'id' => new_id(), 'name' => $name, 'phone' => $phone, 'email' => $email,
  'gender' => $pick('gender', ['male', 'female']),
  'plan' => $pick('plan', ['monthly', 'quarterly', 'yearly']) ?: 'monthly',
  'joined' => (int) (microtime(true) * 1000), 'start' => null, 'expires' => null,
  'goal' => $pick('goal', ['lose', 'gain', 'fit', 'strength', 'sport', 'rehab']),
  'experience' => $pick('experience', ['new', 'some', 'exp']),
  'source' => $pick('source', ['friend', 'social', 'walk', 'google', 'other']),
  'program' => $pick('program', ['Strength', 'Conditioning', 'Personal coaching', 'Beginner start']),
  'dob' => $dob, 'emergency' => '', 'health' => '', 'notes' => '', 'trainerId' => '',
];

// If the number is already a member, do nothing and still say thanks, so the form never reveals who is a member.
try {
  db()->prepare('INSERT INTO members (id, phone, joined, data) VALUES (?, ?, ?, ?)')
    ->execute([$member['id'], $key, $member['joined'], json_encode($member, JSON_UNESCAPED_UNICODE)]);
} catch (PDOException $e) {
  if (($e->errorInfo[1] ?? 0) !== 1062) throw $e;
}
out(['ok' => true]);
