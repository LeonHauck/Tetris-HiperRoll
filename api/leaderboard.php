<?php
// GET /api/leaderboard.php -> Top 10 pontuações (nome + pontuação, sem telefone).

require __DIR__ . '/storage.php';
hipertris_cors();

$all = hipertris_read_all();
usort($all, function ($a, $b) { return $b['score'] <=> $a['score']; });
$top = array_slice($all, 0, 10);

echo json_encode(hipertris_public($top));
