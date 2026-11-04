import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { gzipSync } from 'node:zlib';

import { validarCopia } from '../src/dominio/sincronia.ts';
import type { BancoSqlite, Conta } from './banco.ts';
import { LoginGoogle, paginaDeRetorno } from './google.ts';
import { paginaApagarConta, paginaInicial, paginaPrivacidade } from './paginas.ts';
import type { ConfigGoogle, UsuarioGoogle } from './google.ts';

/** Uns 10 mil treinos cabem com folga. */
const TAMANHO_MAXIMO_CORPO = 5_000_000;

class ErroHttp extends Error {
  status: number;

  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

const ICONE = readFileSync(new URL('../assets/icon.png', import.meta.url));

/** Páginas públicas exigidas pelo Google e pelo Google Play. */
const PAGINAS: Record<string, () => string> = {
  '/': paginaInicial,
  '/privacidade': paginaPrivacidade,
  '/apagar-conta': paginaApagarConta,
};

const hashDoToken = (token: string) => createHash('sha256').update(token).digest('hex');

async function lerCorpo(req: IncomingMessage): Promise<Record<string, unknown>> {
  const partes: Buffer[] = [];
  let tamanho = 0;
  for await (const parte of req) {
    tamanho += (parte as Buffer).length;
    if (tamanho > TAMANHO_MAXIMO_CORPO) throw new ErroHttp(413, 'Requisição grande demais');
    partes.push(parte as Buffer);
  }
  if (tamanho === 0) return {};
  try {
    const corpo: unknown = JSON.parse(Buffer.concat(partes).toString('utf8'));
    if (typeof corpo === 'object' && corpo !== null) return corpo as Record<string, unknown>;
  } catch {
    // Cai no erro abaixo.
  }
  throw new ErroHttp(400, 'JSON inválido');
}

function responder(req: IncomingMessage, res: ServerResponse, status: number, corpo: unknown) {
  const texto = Buffer.from(JSON.stringify(corpo));
  const comprimir = texto.length > 1024 && String(req.headers['accept-encoding'] ?? '').includes('gzip');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(comprimir ? { 'Content-Encoding': 'gzip' } : {}),
  });
  res.end(comprimir ? gzipSync(texto) : texto);
}

export interface OpcoesApi {
  relogio?: () => number;
  google?: ConfigGoogle;
  /** Só nos testes: entra sem passar pelo Google. */
  loginDeTeste?: boolean;
}

export function criarApi(banco: BancoSqlite, opcoes: OpcoesApi = {}): Server {
  const { relogio = Date.now, google, loginDeTeste = false } = opcoes;
  const login = google ? new LoginGoogle(google, relogio) : null;

  function tokenDe(req: IncomingMessage) {
    const [tipo, token] = String(req.headers.authorization ?? '').split(' ');
    return tipo === 'Bearer' && token ? token : null;
  }

  function autenticar(req: IncomingMessage): Conta {
    const token = tokenDe(req);
    const conta = token ? banco.contaPorToken(hashDoToken(token)) : null;
    if (!conta) throw new ErroHttp(401, 'Sessão expirada; entre de novo');
    banco.registrarAcesso(conta.id, relogio());
    return conta;
  }

  function abrirSessao(usuario: UsuarioGoogle) {
    let conta = banco.contaPorGoogle(usuario.sub);
    if (!conta) {
      conta = { id: randomUUID(), nome: usuario.nome };
      banco.criarConta(conta.id, usuario.sub, usuario.nome);
    } else if (conta.nome !== usuario.nome) {
      banco.atualizarNome(conta.id, usuario.nome);
      conta = { ...conta, nome: usuario.nome };
    }
    const token = randomBytes(32).toString('base64url');
    banco.criarSessao(conta.id, hashDoToken(token));
    return { token, nome: conta.nome, conta: conta.id };
  }

  async function atender(req: IncomingMessage, res: ServerResponse) {
    const { pathname, searchParams: params } = new URL(req.url ?? '/', 'http://localhost');
    const rota = `${req.method} ${pathname}`;
    const ok = (corpo: unknown, status = 200) => responder(req, res, status, corpo);

    if (rota === 'GET /saude') return ok({ ok: true });

    const html = req.method === 'GET' ? PAGINAS[pathname] : undefined;
    if (html) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      res.end(html());
      return undefined;
    }

    if (rota === 'GET /icone.png') {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
      res.end(ICONE);
      return undefined;
    }

    if (rota === 'GET /auth/google/inicio') {
      if (!login) throw new ErroHttp(503, 'Login com Google indisponível');
      const destino = login.iniciar(params.get('retorno'), params.get('desafio'));
      if (!destino) throw new ErroHttp(400, 'Pedido de login inválido');
      res.writeHead(302, { Location: destino, 'Cache-Control': 'no-store' });
      res.end();
      return undefined;
    }

    if (rota === 'GET /auth/google/retorno') {
      if (!login) throw new ErroHttp(503, 'Login com Google indisponível');
      const destino = await login.concluir(params.get('code'), params.get('state'));
      if (!destino) throw new ErroHttp(400, 'Login expirado; tente de novo');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(paginaDeRetorno(destino));
      return undefined;
    }

    if (rota === 'POST /auth/google/aguardar') {
      if (!login) throw new ErroHttp(503, 'Login com Google indisponível');
      const { verificador } = await lerCorpo(req);
      if (typeof verificador !== 'string' || verificador.length < 43 || verificador.length > 128) {
        throw new ErroHttp(400, 'Pedido de login inválido');
      }
      const usuario = await login.aguardar(verificador);
      return ok(usuario ? abrirSessao(usuario) : { pendente: true });
    }

    if (rota === 'POST /auth/teste' && loginDeTeste) {
      const { sub, nome } = await lerCorpo(req);
      return ok(abrirSessao({ sub: String(sub), nome: String(nome) }));
    }

    const conta = autenticar(req);

    if (rota === 'GET /eu') return ok({ nome: conta.nome, conta: conta.id });

    if (rota === 'POST /sair') {
      banco.apagarSessao(hashDoToken(tokenDe(req) as string));
      return ok({ ok: true });
    }

    if (rota === 'DELETE /conta') {
      banco.apagarConta(conta.id);
      return ok({ ok: true });
    }

    if (rota === 'GET /dados') {
      const { versao, dados } = banco.lerBackup(conta.id);
      return ok({ versao, dados: dados ? (JSON.parse(dados) as unknown) : null });
    }

    if (rota === 'PUT /dados') {
      const { versaoBase, dados } = await lerCorpo(req);
      if (!Number.isInteger(versaoBase)) throw new ErroHttp(400, 'Informe a versão');
      const copia = validarCopia(dados);
      if (!copia) throw new ErroHttp(400, 'Dados fora do formato');
      const versao = banco.gravarBackup(conta.id, versaoBase as number, JSON.stringify(copia));
      if (versao === null) throw new ErroHttp(409, 'O backup mudou em outro aparelho');
      return ok({ versao });
    }

    throw new ErroHttp(404, 'Rota não encontrada');
  }

  return createServer((req, res) => {
    atender(req, res).catch((erro: unknown) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (erro instanceof ErroHttp) {
        responder(req, res, erro.status, { erro: erro.message });
        return;
      }
      console.error(erro);
      responder(req, res, 500, { erro: 'Erro interno' });
    });
  });
}
