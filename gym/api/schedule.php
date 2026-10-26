<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
// Public: feeds the "This week on the floor" table on the home page. Session names, times, days and trainer names only.
$trainers = load_trainers();
$list = array_values(array_map(fn($c) => public_class($c, $trainers), load_classes()));
usort($list, fn($a, $b) => strcmp($a['time'], $b['time']));
header('Cache-Control: public, max-age=60');
out(['ok' => true, 'classes' => $list]);
