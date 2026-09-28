<?php
// GET /api/leaderboard.php -> Top 10 (melhor pontuação de cada nome, sem telefone).

require __DIR__ . '/storage.php';
hipertris_cors();

$best = hipertris_best_per_name(hipertris_read_all());
usort($best, function ($a, $b) { return $b['score'] <=> $a['score']; });
$top = array_slice($best, 0, 10);

echo json_encode(hipertris_public($top));
