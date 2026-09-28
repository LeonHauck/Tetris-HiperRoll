<?php
// POST /api/score.php  { name, phone, score }
// Salva a pontuação no histórico completo (guarda todas as partidas,
// útil pros dados de contato do evento) e devolve a posição no ranking
// e o ranking atualizado — mas o ranking mostra só a MELHOR pontuação de
// cada nome, então jogar várias vezes não lota o Top 10 com o mesmo
// nome repetido. A posição só é informada quando essa partida for
// realmente o novo recorde pessoal de quem jogou. O telefone é opcional
// (o site não pede ele, só o app desktop) e, quando enviado, nunca é
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

if ($name === '' || $score < 0 || $score > 1000000000) {
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

$best = hipertris_best_per_name($all);
usort($best, function ($a, $b) { return $b['score'] <=> $a['score']; });

// Só informa posição se essa partida for o recorde pessoal atual de
// quem jogou (senão a pessoa já está ranqueada pela tentativa anterior,
// mais alta, e essa aqui não muda nada).
$rank = null;
foreach ($best as $i => $r) {
    if ($r['id'] === $record['id']) {
        if ($i < 10) $rank = $i + 1;
        break;
    }
}

$top = array_slice($best, 0, 10);

echo json_encode([
    'rank' => $rank,
    'leaderboard' => hipertris_public($top),
]);
