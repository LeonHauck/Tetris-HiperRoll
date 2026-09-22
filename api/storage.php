<?php
// Armazenamento simples em arquivo — sem precisar de banco de dados.
// O PHP grava direto num arquivo JSON dentro de api/data/, com trava
// (flock) pra não embolar quando várias pessoas jogam ao mesmo tempo
// no evento e a pontuação de duas pessoas chega quase junto.

define('HIPERTRIS_DATA_FILE', __DIR__ . '/data/scores.json');

// Troque aqui se quiser restringir de qual domínio a API aceita chamadas.
// '*' libera geral (ok pra a maioria dos casos).
define('HIPERTRIS_ALLOWED_ORIGIN', '*');

function hipertris_ensure_data_dir() {
    $dir = dirname(HIPERTRIS_DATA_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
}

function hipertris_read_all() {
    hipertris_ensure_data_dir();
    if (!file_exists(HIPERTRIS_DATA_FILE)) {
        return [];
    }
    $fp = fopen(HIPERTRIS_DATA_FILE, 'r');
    if (!$fp) return [];
    flock($fp, LOCK_SH);
    $content = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $data = json_decode($content, true);
    return is_array($data) ? $data : [];
}

// Acrescenta uma pontuação no arquivo e devolve a lista inteira já
// atualizada. LOCK_EX garante que duas pessoas enviando pontuação ao
// mesmo tempo não pisem uma na escrita da outra.
function hipertris_append_score($record) {
    hipertris_ensure_data_dir();
    $fp = fopen(HIPERTRIS_DATA_FILE, 'c+');
    if (!$fp) {
        throw new Exception('Não foi possível abrir o arquivo de dados.');
    }
    flock($fp, LOCK_EX);
    $content = stream_get_contents($fp);
    $data = json_decode($content, true);
    if (!is_array($data)) $data = [];
    $data[] = $record;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $data;
}

function hipertris_cors() {
    header('Access-Control-Allow-Origin: ' . HIPERTRIS_ALLOWED_ORIGIN);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Content-Type: application/json; charset=utf-8');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// Nunca devolve o telefone: só o que pode aparecer no ranking público.
function hipertris_public(array $records) {
    return array_map(function ($r) {
        return ['name' => $r['name'], 'score' => $r['score']];
    }, $records);
}
