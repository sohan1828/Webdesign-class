<?php
declare(strict_types=1);
// Run once from the command line on your server:  php create_admin.php yourusername
// It asks for the password (12 characters or more) and stores only a hash of it.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/lib.php';

$user = strtolower(trim($argv[1] ?? ''));
if (!preg_match('/^[a-z0-9._-]{3,40}$/', $user)) { fwrite(STDERR, "Usage: php create_admin.php username   (3-40 letters, numbers, . _ -)\n"); exit(1); }

echo 'Password (12+ characters, not shown): ';
$tty = stripos(PHP_OS, 'WIN') !== 0;
if ($tty) shell_exec('stty -echo');
$pass = rtrim((string) fgets(STDIN), "\r\n");
if ($tty) shell_exec('stty echo');
echo "\n";
if (strlen($pass) < 12) { fwrite(STDERR, "Password must be at least 12 characters.\n"); exit(1); }

$hash = password_hash($pass, PASSWORD_DEFAULT);
db()->prepare('INSERT INTO admin_users (username, pass_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE pass_hash = VALUES(pass_hash)')->execute([$user, $hash]);
echo "Admin '$user' saved.\n";
