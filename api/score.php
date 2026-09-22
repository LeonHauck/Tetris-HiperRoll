<?php
// POST /api/score.php  { name, phone, score }
// Salva uma pontuação no arquivo e devolve a posição no ranking (se
// estiver no Top 10) e o ranking atualizado. O telefone é opcional (o
// site não pede ele, só o app desktop) e, quando enviado, nunca é
// devolvido nem exibido no ranking público.

require __DIR__ . '/storage.php';
hipertris_cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$name = isset($input['name']) ? trim(mb_substr((string) $input['name'], 0, 40)) : '';
$phone = isset($input['phone']) ? trim(mb_substr((string) $input['phone'], 0, 30)) : '';
$score = isset($input['score']) ? (int) $input['score'] : -1;

if ($name === '' || $score < 0 || $score > 10000000) {
    http_response_code(400);
    echo json_encode(['error' => 'Dados inválidos']);
    exit;
}

$record = [
    'id' => uniqid('', true),
    'name' => $name,
    'phone' => $phone,
    'score' => $score,
    'date' => date('c'),
];

try {
    $all = hipertris_append_score($record);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Não foi possível salvar a pontuação.']);
    exit;
}

usort($all, function ($a, $b) { return $b['score'] <=> $a['score']; });

$rank = null;
foreach ($all as $i => $r) {
    if ($r['id'] === $record['id']) {
        if ($i < 10) $rank = $i + 1;
        break;
    }
}

$top = array_slice($all, 0, 10);

echo json_encode([
    'rank' => $rank,
    'leaderboard' => hipertris_public($top),
]);
