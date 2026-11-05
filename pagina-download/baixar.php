<?php
// O botão passa por aqui: soma +1 no contador e manda para o APK.
require __DIR__ . '/contador.php';
$apk = __DIR__ . '/readytaf.apk';
if (!is_file($apk)) { header('Location: ./'); exit; }
somarDownload();
header('Cache-Control: no-store');
header('Location: readytaf.apk?v=' . filemtime($apk), true, 302);
