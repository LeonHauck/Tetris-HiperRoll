<?php
// GET /api/check-name.php?name=Fulano
// Diz se esse nome já foi usado por alguém (em qualquer pontuação salva,
// não só no Top 10) — pra evitar duas pessoas diferentes aparecendo com
// o mesmo nome no ranking. Comparação sem diferenciar maiúscula/minúscula
// e ignorando espaços nas pontas.

require __DIR__ . '/storage.php';
hipertris_cors();

$name = isset($_GET['name']) ? trim(mb_substr((string) $_GET['name'], 0, 40)) : '';

if ($name === '') {
    echo json_encode(['taken' => false]);
    exit;
}

$normalized = mb_strtolower($name);
$taken = false;
foreach (hipertris_read_all() as $r) {
    if (mb_strtolower(trim($r['name'])) === $normalized) {
        $taken = true;
        break;
    }
}

echo json_encode(['taken' => $taken]);
