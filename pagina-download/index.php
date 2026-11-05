<?php
require __DIR__ . '/contador.php';
// O botão aparece sozinho quando readytaf.apk é colocado nesta pasta.
$apk = __DIR__ . '/readytaf.apk';
$temApk = is_file($apk);
$tamanho = $temApk ? number_format(filesize($apk) / 1048576, 0, ',', '.') . ' MB' : '';
$data = $temApk ? date('d/m/Y', filemtime($apk)) : '';
$downloads = lerDownloads();
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#12223A">
<title>ReadyTAF: baixar para Android</title>
<meta name="description" content="Baixe o ReadyTAF para Android e acompanhe seus treinos do TAF da PMESP.">
<link rel="icon" href="icone.png">
<style>
  :root {
    --fundo: #12223A; --cartao: #1B2F4D; --texto: #F4F6F8; --suave: #A9B8CC;
    --borda: #2E4A70; --destaque: #F57C1F; --sobre: #FFFFFF; --azul: #1E88E5;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--fundo); color: var(--texto); line-height: 1.5;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  main { max-width: 480px; margin: 0 auto; padding: 40px 16px 32px; }
  .topo { text-align: center; }
  .topo img { width: 96px; height: 96px; border-radius: 22px; display: block; margin: 0 auto 16px; }
  h1 { font-size: 30px; line-height: 1.15; margin: 0 0 8px; }
  .topo p { color: var(--suave); margin: 0 0 24px; }
  .botao {
    display: block; padding: 16px; border-radius: 12px; text-align: center; text-decoration: none;
    background: var(--destaque); color: var(--sobre); font-size: 18px; font-weight: 700;
  }
  .botao:focus-visible { outline: 3px solid var(--texto); outline-offset: 2px; }
  .contador { text-align: center; margin: 14px 0 0; color: var(--suave); font-size: 15px; }
  .contador strong { color: var(--destaque); font-size: 22px; }
  .aguarde { padding: 16px; border: 1px solid var(--borda); border-radius: 12px; text-align: center; color: var(--suave); }
  .info { color: var(--suave); font-size: 14px; text-align: center; margin: 10px 0 0; }
  .aviso { display: none; background: var(--cartao); border-left: 4px solid var(--destaque); border-radius: 8px; padding: 12px 14px; margin: 0 0 16px; text-align: left; }
  h2 { font-size: 19px; margin: 36px 0 12px; }
  ol { list-style: none; margin: 0; padding: 0; counter-reset: passo; }
  ol li {
    counter-increment: passo; position: relative; min-height: 32px; padding-left: 44px; margin-bottom: 14px;
  }
  ol li::before {
    content: counter(passo); position: absolute; left: 0; top: 0; width: 32px; height: 32px; border-radius: 50%;
    background: var(--cartao); border: 1px solid var(--borda); color: var(--destaque);
    display: flex; align-items: center; justify-content: center; font-weight: 700;
  }
  ul { margin: 0; padding-left: 20px; }
  ul li { margin-bottom: 8px; }
  .nota { background: var(--cartao); border-radius: 12px; padding: 14px 16px; margin-top: 36px; font-size: 15px; color: var(--suave); }
  .nota strong { color: var(--texto); }
  footer { text-align: center; color: var(--suave); font-size: 13px; margin-top: 28px; }
  footer a { color: var(--suave); }
</style>
</head>
<body>
<main>
  <section class="topo">
    <img src="icone.png" alt="" width="96" height="96">
    <h1>ReadyTAF</h1>
    <p>Registre seus treinos do TAF da PMESP, veja se está apto e acompanhe sua evolução até a prova.</p>
    <div class="aviso" id="iphone">Por enquanto o app existe só para Android. Abra esta página em um celular Android para baixar.</div>
<?php if ($temApk): ?>
    <a class="botao" href="baixar.php">Baixar para Android</a>
    <p class="contador"><strong><?= number_format($downloads, 0, ',', '.') ?></strong> <?= $downloads === 1 ? 'download' : 'downloads' ?></p>
    <p class="info"><?= $tamanho ?> · atualizado em <?= $data ?></p>
<?php else: ?>
    <div class="aguarde">O download estará disponível em breve.</div>
<?php endif; ?>
  </section>

  <h2>Como instalar</h2>
  <ol>
    <li>Toque em <strong>Baixar para Android</strong> e aguarde o download terminar.</li>
    <li>Abra o arquivo <strong>readytaf.apk</strong> nas notificações ou na pasta Downloads.</li>
    <li>Se o Android pedir, permita instalar apps desta fonte.</li>
    <li>Toque em <strong>Instalar</strong>, abra o app e entre com sua conta Google.</li>
  </ol>

  <h2>O que tem no app</h2>
  <ul>
    <li>Modo candidato: apto ou inapto pelos índices mínimos do concurso</li>
    <li>Modo policial: pontos pela tabela do TAF-3, por sexo e faixa etária</li>
    <li>Histórico, gráficos de evolução, recordes e ponto fraco</li>
    <li>Contagem regressiva para a prova</li>
    <li>Backup na conta Google: trocou de celular, seus treinos voltam</li>
  </ul>

  <div class="nota">
    <strong>Versão de testes, fora das lojas.</strong> O Android pode mostrar um aviso de app desconhecido,
    porque ele ainda não está na Play Store. Baixe somente por esta página.
    Para atualizar, baixe de novo e instale por cima: seus treinos continuam.
  </div>

  <footer>
    App não oficial; não substitui a avaliação da Polícia Militar.<br>
    <a href="/readytaf-api/privacidade">Política de Privacidade</a>
  </footer>
</main>
<script>
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) document.getElementById('iphone').style.display = 'block';
</script>
</body>
</html>
