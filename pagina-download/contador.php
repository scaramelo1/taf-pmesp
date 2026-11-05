<?php
// Contador de downloads do APK. O arquivo fica na pasta publicada e não é sobrescrito pelo publicar.sh.
const CONTADOR = __DIR__ . '/downloads.txt';

function lerDownloads(): int {
    $v = @file_get_contents(CONTADOR);
    return $v === false ? 0 : (int) trim($v);
}

function somarDownload(): void {
    $f = @fopen(CONTADOR, 'c+');
    if (!$f) return;                 // sem permissão: o download segue sem contar
    if (flock($f, LOCK_EX)) {        // dois downloads ao mesmo tempo não se perdem
        $n = (int) trim(stream_get_contents($f)) + 1;
        ftruncate($f, 0);
        rewind($f);
        fwrite($f, (string) $n);
        fflush($f);
        flock($f, LOCK_UN);
    }
    fclose($f);
}
