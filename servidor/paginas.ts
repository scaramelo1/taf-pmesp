// Páginas públicas pedidas pelo Google (tela de consentimento) e pelo Google Play:
// página inicial, política de privacidade e como apagar a conta.

const CONTATO = 'fsadesignerbr@gmail.com';
const ATUALIZADA_EM = '8 de novembro de 2026';

function pagina(titulo: string, corpo: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>
body{margin:0;background:#F4F6F8;color:#1B2430;font:16px/1.6 system-ui,sans-serif}
header{background:#12223A;color:#fff;padding:28px 20px;text-align:center}
header img{width:96px;height:96px;border-radius:22px}
header h1{margin:12px 0 0;font-size:26px}
main{max-width:760px;margin:0 auto;padding:24px 20px 48px}
h2{font-size:19px;margin-top:28px;color:#12223A}
a{color:#1E88E5}
nav{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:12px}
nav a{color:#C9D3E0}
footer{color:#5F6B7A;font-size:13px;text-align:center;padding:0 20px 32px}
</style>
</head>
<body>
<header>
<img src="icone.png" alt="">
<h1>${titulo}</h1>
<nav><a href="./">Início</a><a href="privacidade">Privacidade</a><a href="apagar-conta">Apagar conta</a></nav>
</header>
<main>
${corpo}
</main>
<footer>ReadyTAF · FSA Designer · <a href="mailto:${CONTATO}">${CONTATO}</a></footer>
</body>
</html>`;
}

export const paginaInicial = () => pagina('ReadyTAF', `
<p><strong>ReadyTAF</strong> é um app para Android e iPhone para registrar os treinos do Teste de Aptidão
Física (TAF) da Polícia Militar do Estado de São Paulo e acompanhar a evolução.</p>
<ul>
<li><strong>Candidato:</strong> mostra se cada teste está apto ou inapto pelos índices mínimos do concurso.</li>
<li><strong>Policial (TAF-3):</strong> calcula os pontos pela tabela do efetivo, conforme sexo e faixa etária.</li>
<li><strong>Histórico e desempenho:</strong> gráficos, recordes, tendência e o ponto fraco de cada teste.</li>
<li><strong>Backup:</strong> entre com sua conta Google e seus treinos ficam guardados; ao trocar de celular, tudo volta.</li>
</ul>
<p>O ReadyTAF não é um app oficial da Polícia Militar. Os resultados servem para treino e não substituem a avaliação oficial.</p>
<p>Dúvidas e sugestões: <a href="mailto:${CONTATO}">${CONTATO}</a>.</p>
`);

export const paginaPrivacidade = () => pagina('Política de Privacidade', `
<p>Última atualização: ${ATUALIZADA_EM}.</p>
<p>Esta política explica quais dados o app <strong>ReadyTAF</strong>, da FSA Designer, coleta, por que e como você pode apagá-los.</p>

<h2>1. Dados que coletamos</h2>
<ul>
<li><strong>Da sua conta Google:</strong> um identificador da conta (um número que o Google cria para o app), seu nome,
seu e-mail e o endereço da foto do perfil. Não recebemos sua senha, contatos, arquivos nem qualquer outro dado da conta.</li>
<li><strong>Dados que você digita no app:</strong> perfil (nome, sexo, cargo pretendido, modo candidato ou policial, data de nascimento e data da prova)
e os treinos (data, resultados de cada teste e observações).</li>
</ul>
<p>Não coletamos localização, dados de saúde de outros apps, identificadores de publicidade nem histórico de navegação.</p>

<h2>2. Para que usamos</h2>
<ul>
<li>Para identificar você no login, mostrar seu nome e foto no app e guardar o backup dos seus treinos.</li>
<li>O e-mail serve para identificar sua conta caso você peça ajuda ou a exclusão dos dados. Não enviamos propaganda.</li>
<li>Números gerais de uso (quantas pessoas se cadastraram e quantos treinos foram lançados) são vistos apenas pela FSA Designer para melhorar o app.</li>
<li>Para devolver seus dados quando você entra em outro celular com a mesma conta.</li>
</ul>
<p>Os cálculos (apto/inapto, pontos, gráficos) são feitos no próprio celular.</p>

<h2>3. Compartilhamento</h2>
<p>Não vendemos, não alugamos e não compartilhamos seus dados com ninguém. O app não tem anúncios.
Os dados só seriam informados a autoridades se uma lei ou ordem judicial obrigar.</p>

<h2>4. Onde ficam e como protegemos</h2>
<p>Os dados ficam no seu celular e em um servidor próprio da FSA Designer. A comunicação com o servidor é sempre criptografada (HTTPS).
O acesso ao backup exige a sessão aberta pelo login com Google; a sessão é guardada no servidor apenas de forma cifrada (hash).
Fazemos uma cópia de segurança diária do servidor, mantida por até 14 dias.</p>

<h2>5. Por quanto tempo guardamos</h2>
<p>Enquanto sua conta existir. Ao apagar a conta, o backup é apagado na hora; as cópias de segurança do servidor somem em até 14 dias.</p>

<h2>6. Seus direitos (LGPD)</h2>
<p>Você pode, a qualquer momento, ver e corrigir seus dados no próprio app, pedir uma cópia, ou apagar sua conta e todos os dados
(veja <a href="apagar-conta">como apagar a conta</a>). Também pode tirar o acesso do ReadyTAF à sua conta Google em
<a href="https://myaccount.google.com/connections">myaccount.google.com/connections</a>.</p>

<h2>7. Crianças</h2>
<p>O ReadyTAF é feito para candidatos a concursos e policiais, e não é destinado a menores de 13 anos.</p>

<h2>8. Mudanças nesta política</h2>
<p>Se esta política mudar, a nova versão será publicada nesta página com a data de atualização.</p>

<h2>9. Contato</h2>
<p>FSA Designer — <a href="mailto:${CONTATO}">${CONTATO}</a>.</p>
`);

export const paginaApagarConta = () => pagina('Apagar conta do ReadyTAF', `
<h2>Pelo app (na hora)</h2>
<ol>
<li>Abra o ReadyTAF e entre com sua conta Google.</li>
<li>Vá na aba <strong>Perfil</strong>.</li>
<li>No cartão <strong>Conta Google</strong>, toque em <strong>Apagar conta e backup</strong> e confirme.</li>
</ol>
<p>Isso apaga a conta, o backup no servidor e os treinos do celular.</p>

<h2>Sem o app</h2>
<p>Se você não tem mais o app instalado, envie um e-mail para <a href="mailto:${CONTATO}?subject=Apagar%20conta%20ReadyTAF">${CONTATO}</a>
com o assunto "Apagar conta ReadyTAF", a partir do Gmail usado no login. Apagamos tudo em até 7 dias e respondemos confirmando.</p>

<h2>O que é apagado</h2>
<p>Tudo: identificador da conta Google, nome, e-mail, foto, perfil e todos os treinos. As cópias de segurança do servidor somem em até 14 dias.
Nada é mantido depois disso.</p>
`);

const escapar = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Aparece no navegador do login quando o app instalado é mais velho que o publicado. */
export const paginaAtualizar = (versao: string, link: string, continuar: string) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atualize o ReadyTAF</title>
<style>
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;box-sizing:border-box;background:#12223A;color:#fff;font:16px/1.5 system-ui,sans-serif;text-align:center}
img{width:88px;height:88px;border-radius:20px}
h1{font-size:22px;margin:0}
p{margin:0;max-width:360px;color:#C9D3E0}
.baixar{background:#F57C1F;color:#fff;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px}
.depois{color:#C9D3E0;font-size:14px}
</style>
</head>
<body>
<img src="../../icone.png" alt="">
<h1>Saiu a versão ${escapar(versao)} do ReadyTAF</h1>
<p>Baixe e instale por cima do app que você já tem. Seus treinos continuam salvos.</p>
<a class="baixar" href="${escapar(link)}">Baixar a versão nova</a>
<a class="depois" href="${escapar(continuar)}">Continuar com a versão antiga</a>
</body>
</html>`;
