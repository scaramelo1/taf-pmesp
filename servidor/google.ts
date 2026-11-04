import { createHash, randomBytes } from 'node:crypto';

const URL_AUTORIZACAO = 'https://accounts.google.com/o/oauth2/v2/auth';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const EMISSORES = ['https://accounts.google.com', 'accounts.google.com'];
const VALIDADE_LOGIN_MS = 10 * 60_000;
const VALIDADE_CODIGO_MS = 2 * 60_000;
const MAXIMO_PENDENTES = 5_000;
const ESPERA_MS = 25_000;
const INTERVALO_ESPERA_MS = 300;
/** Só o próprio app recebe o código: tafpmesp:// no build, exp:// no Expo Go. */
const RETORNO_VALIDO = /^(tafpmesp|exp|exps):\/\/[^\s]*$/;
const DESAFIO_VALIDO = /^[A-Za-z0-9_-]{43}$/;

export interface ConfigGoogle {
  clientId: string;
  clientSecret: string;
  urlPublica: string;
  /** Troca o código do Google pelo id_token; os testes substituem esta chamada. */
  trocarCodigo?: (codigo: string) => Promise<string>;
  /** Quanto tempo cada pedido do app espera o login terminar. */
  esperaMs?: number;
}

export interface UsuarioGoogle {
  sub: string;
  nome: string;
}

interface LoginPendente {
  retorno: string;
  desafio: string;
  expira: number;
}

interface CodigoPendente extends UsuarioGoogle {
  desafio: string;
  expira: number;
}

const escaparHtml = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * A página tenta voltar sozinha e oferece o botão, porque o navegador pode bloquear o salto automático.
 * Mesmo sem voltar, o login já vale: o app recebe a sessão por /auth/google/aguardar.
 */
export function paginaDeRetorno(destino: string) {
  const falhou = /[?&]erro=1/.test(destino);
  const href = escaparHtml(destino);
  const script = JSON.stringify(destino).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ReadyTAF</title>
<style>
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:24px;box-sizing:border-box;background:#12223A;color:#fff;font:16px system-ui,sans-serif;text-align:center}
a{background:#fff;color:#1f1f1f;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px}
</style>
</head>
<body>
<p>${falhou ? 'Não foi possível entrar. Volte ao app e tente de novo.' : 'Login concluído. Se o app não abrir sozinho, toque no botão ou feche esta página.'}</p>
<a href="${href}">Voltar ao ReadyTAF</a>
<script>location.href=${script};</script>
</body>
</html>`;
}

const token = () => randomBytes(32).toString('base64url');

const comParametros = (retorno: string, parametros: string) =>
  `${retorno}${retorno.includes('?') ? '&' : '?'}${parametros}`;

/**
 * O app abre o navegador, o Google devolve aqui, e o código volta ao app por deep link.
 * Funciona no Expo Go, ao contrário das bibliotecas nativas. O desafio (PKCE) impede que
 * outro app que capture o deep link use o código.
 */
export class LoginGoogle {
  private logins = new Map<string, LoginPendente>();
  private codigos = new Map<string, CodigoPendente>();
  /** Liga o desafio ao código, para o app receber a sessão sem depender da volta pelo navegador. */
  private porDesafio = new Map<string, string>();
  private config: ConfigGoogle;
  private relogio: () => number;

  constructor(config: ConfigGoogle, relogio: () => number) {
    this.config = config;
    this.relogio = relogio;
  }

  private get redirectUri() {
    return `${this.config.urlPublica}/auth/google/retorno`;
  }

  private limpar<T extends { expira: number }>(mapa: Map<string, T>) {
    const agora = this.relogio();
    for (const [chave, item] of mapa) if (item.expira <= agora) mapa.delete(chave);
    if (mapa.size >= MAXIMO_PENDENTES) mapa.clear();
  }

  iniciar(retorno: string | null, desafio: string | null) {
    if (!retorno || !desafio || !RETORNO_VALIDO.test(retorno) || !DESAFIO_VALIDO.test(desafio)) return null;
    this.limpar(this.logins);
    const estado = token();
    this.logins.set(estado, { retorno, desafio, expira: this.relogio() + VALIDADE_LOGIN_MS });

    const url = new URL(URL_AUTORIZACAO);
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid profile',
      state: estado,
      prompt: 'select_account',
    }).toString();
    return url.toString();
  }

  private async pedirIdToken(codigo: string) {
    if (this.config.trocarCodigo) return this.config.trocarCodigo(codigo);
    const resposta = await fetch(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: codigo,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!resposta.ok) throw new Error(`Google recusou o código: ${resposta.status}`);
    return ((await resposta.json()) as { id_token: string }).id_token;
  }

  /** O id_token vem direto do Google por HTTPS, então basta conferir os campos, sem checar a assinatura. */
  private lerUsuario(idToken: string): UsuarioGoogle | null {
    const dados = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>;
    const valido = EMISSORES.includes(String(dados.iss))
      && dados.aud === this.config.clientId
      && Number(dados.exp) * 1000 > this.relogio()
      && typeof dados.sub === 'string' && dados.sub.length > 0;
    if (!valido) return null;
    const nome = String(dados.given_name ?? dados.name ?? 'Atleta').slice(0, 40);
    return { sub: dados.sub as string, nome };
  }

  /** Devolve para onde redirecionar; null quando o login é desconhecido ou expirou. */
  async concluir(codigoGoogle: string | null, estado: string | null) {
    const login = estado ? this.logins.get(estado) : undefined;
    if (!estado || !login || login.expira <= this.relogio()) return null;
    this.logins.delete(estado);

    try {
      const usuario = codigoGoogle ? this.lerUsuario(await this.pedirIdToken(codigoGoogle)) : null;
      if (!usuario) return comParametros(login.retorno, 'erro=1');
      this.limpar(this.codigos);
      const codigo = token();
      this.codigos.set(codigo, { ...usuario, desafio: login.desafio, expira: this.relogio() + VALIDADE_CODIGO_MS });
      for (const [desafio, pendente] of this.porDesafio) if (!this.codigos.has(pendente)) this.porDesafio.delete(desafio);
      this.porDesafio.set(login.desafio, codigo);
      return comParametros(login.retorno, `codigo=${codigo}`);
    } catch (erro) {
      console.error('Falha no login com Google', erro);
      return comParametros(login.retorno, 'erro=1');
    }
  }

  /**
   * Espera o login terminar e devolve o usuário, ou null se o tempo acabar: o app pergunta de novo.
   * Só quem tem o verificador, que nunca sai do aparelho, chega ao desafio certo.
   */
  async aguardar(verificador: string) {
    const desafio = createHash('sha256').update(verificador).digest('base64url');
    const fim = Date.now() + (this.config.esperaMs ?? ESPERA_MS);
    for (;;) {
      const codigo = this.porDesafio.get(desafio);
      if (codigo) {
        this.porDesafio.delete(desafio);
        return this.trocar(codigo, verificador);
      }
      if (Date.now() >= fim) return null;
      await new Promise((pronto) => { setTimeout(pronto, INTERVALO_ESPERA_MS); });
    }
  }

  /** Cada código vale uma tentativa: errar o verificador também o queima. */
  trocar(codigo: string, verificador: string): UsuarioGoogle | null {
    const pendente = this.codigos.get(codigo);
    if (!pendente) return null;
    this.codigos.delete(codigo);
    this.porDesafio.delete(pendente.desafio);
    const desafio = createHash('sha256').update(verificador).digest('base64url');
    if (pendente.expira <= this.relogio() || desafio !== pendente.desafio) return null;
    return { sub: pendente.sub, nome: pendente.nome };
  }
}
