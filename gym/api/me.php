<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
// Lets the admin page ask "am I still logged in?" when it opens.
session_boot();
$idle = (int) cfg('session_idle', 7200);
if (!empty($_SESSION['role']) && ($_SESSION['last'] ?? 0) >= time() - $idle) {
  $_SESSION['last'] = time();
  out(['ok' => true, 'csrf' => $_SESSION['csrf'], 'role' => $_SESSION['role']]);
}
out(['ok' => false]);
