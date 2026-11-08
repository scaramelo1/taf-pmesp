/// <reference types="node" />
import { createHash } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

import { ErroApi, aguardarLoginGoogle, criarCliente, urlDoLogin } from '../../src/api/cliente.ts';
import type { Cliente } from '../../src/api/cliente.ts';
import { sincronizar } from '../../src/api/sincronizar.ts';
import type { DadosLocais } from '../../src/api/sincronizar.ts';
import { COPIA_VAZIA, mesclar } from '../../src/dominio/sincronia.ts';
import type { CopiaDados, TreinoCopia } from '../../src/dominio/sincronia.ts';
import { resumirAdmin } from '../admin.ts';
import { criarApi } from '../api.ts';
import { BancoSqlite } from '../banco.ts';
import { paginaDeRetorno } from '../google.ts';

const treino = (uid: string): TreinoCopia => ({
  uid,
  data: '2026-11-01',
  edital: 'pmesp-2025',
  sexo: 'F',
  cargo: 'soldado',
  idade: 22,
  observacao: '',
  criadoEm: '2026-11-01 10:00:00',
  resultados: [{ exercicio: 'corrida2400', valor: 720, tentativa: 1 }],
});

/** Um aparelho de mentira: guarda a cópia na memória, como o SQLite faria. */
function aparelho(inicial: CopiaDados = COPIA_VAZIA) {
  let copia = inicial;
  const local: DadosLocais = {
    ler: async () => copia,
    aplicar: async (nova) => { copia = mesclar(copia, nova); },
  };
  return {
    local,
    get copia() { return copia; },
    set copia(nova: CopiaDados) { copia = nova; },
  };
}

/** Desafio PKCE como o app calcula. */
const desafioDe = (verificador: string) => createHash('sha256').update(verificador).digest('base64url');

describe('servidor do ReadyTAF', () => {
  const banco = new BancoSqlite(':memory:');
  let idTokenFalso = '';
  const api = criarApi(banco, {
    loginDeTeste: true,
    google: {
      clientId: 'cliente-teste',
      clientSecret: 'segredo',
      urlPublica: 'https://exemplo.test/readytaf-api',
      trocarCodigo: async () => idTokenFalso,
      esperaMs: 300,
    },
    admin: { senha: 'senha-certa', emails: ['Chefe@Exemplo.test'], lerDownloads: () => 10 },
  });
  let base = '';

  const entrar = async (sub: string, nome = 'Ana') => {
    const resposta = await fetch(`${base}/auth/teste`, { method: 'POST', body: JSON.stringify({ sub, nome }) });
    return ((await resposta.json()) as { token: string }).token;
  };

  before(async () => {
    await new Promise<void>((pronto) => { api.listen(0, '127.0.0.1', pronto); });
    base = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
  });

  after(() => {
    api.close();
    banco.fechar();
  });

  it('login com Google pelo navegador e espera da sessão', async () => {
    const verificador = 'v'.repeat(64);
    const inicio = await fetch(urlDoLogin('tafpmesp://login', desafioDe(verificador), base), { redirect: 'manual' });
    assert.equal(inicio.status, 302);
    const google = new URL(inicio.headers.get('location') as string);
    assert.equal(google.searchParams.get('redirect_uri'), 'https://exemplo.test/readytaf-api/auth/google/retorno');

    const carga = {
      iss: 'https://accounts.google.com', aud: 'cliente-teste', exp: Date.now() / 1000 + 600, sub: 'g-1',
      given_name: 'Bia', name: 'Bia Souza', email: 'bia@exemplo.test', picture: 'https://lh3.googleusercontent.com/a/foto',
    };
    idTokenFalso = `x.${Buffer.from(JSON.stringify(carga)).toString('base64url')}.y`;
    const retorno = await fetch(`${base}/auth/google/retorno?code=abc&state=${google.searchParams.get('state')}`);
    assert.match(await retorno.text(), /Voltar ao ReadyTAF/);

    const sessao = await aguardarLoginGoogle(verificador, base);
    assert.ok('token' in sessao);
    assert.equal(sessao.nome, 'Bia');
    assert.equal(google.searchParams.get('scope'), 'openid profile email');
    assert.deepEqual(await criarCliente(sessao.token, base).eu(), {
      nome: 'Bia', nomeCompleto: 'Bia Souza', email: 'bia@exemplo.test',
      foto: 'https://lh3.googleusercontent.com/a/foto', conta: sessao.conta, admin: false,
    });

    assert.deepEqual(await aguardarLoginGoogle('w'.repeat(64), base), { pendente: true });
  });

  it('sessão chega mesmo se a primeira resposta se perder, e recarregar a página não dá erro', async () => {
    const verificador = 'p'.repeat(64);
    const inicio = await fetch(urlDoLogin('exp://127.0.0.1:8081/--/login', desafioDe(verificador), base), { redirect: 'manual' });
    const estado = new URL(inicio.headers.get('location') as string).searchParams.get('state');

    // O app pergunta e o Android corta a rede: o pedido é abandonado no meio da espera.
    const abandonado = new AbortController();
    const perdido = fetch(`${base}/auth/google/aguardar`, {
      method: 'POST', body: JSON.stringify({ verificador }), signal: abandonado.signal,
    }).catch(() => null);
    abandonado.abort();

    const carga = { iss: 'accounts.google.com', aud: 'cliente-teste', exp: Date.now() / 1000 + 600, sub: 'g-9', given_name: 'Caio' };
    idTokenFalso = `x.${Buffer.from(JSON.stringify(carga)).toString('base64url')}.y`;
    assert.equal((await fetch(`${base}/auth/google/retorno?code=abc&state=${estado}`)).status, 200);
    await perdido;
    await new Promise((pronto) => { setTimeout(pronto, 400); });

    const sessao = await aguardarLoginGoogle(verificador, base);
    assert.ok('token' in sessao && sessao.nome === 'Caio');

    const recarregada = await fetch(`${base}/auth/google/retorno?code=abc&state=${estado}`);
    assert.equal(recarregada.status, 200);
    assert.match(await recarregada.text(), /Pode fechar esta página/);
    assert.equal((await fetch(`${base}/auth/google/retorno?code=abc&state=desconhecido`)).status, 400);
  });

  it('recusa endereço de retorno de outro app', async () => {
    const r = await fetch(urlDoLogin('https://malicioso.test', desafioDe('v'.repeat(64)), base), { redirect: 'manual' });
    assert.equal(r.status, 400);
  });

  it('sem sessão não acessa o backup', async () => {
    await assert.rejects(criarCliente('token-falso', base).lerBackup(), (e: ErroApi) => e.status === 401);
  });

  it('backup leva os treinos para um celular novo', async () => {
    const token = await entrar('g-2');
    const api1: Cliente = criarCliente(token, base);
    const celular = aparelho({ ...COPIA_VAZIA, treinos: [treino('aaaaaaaa')] });
    assert.equal(await sincronizar(api1, celular.local), false);

    const novo = aparelho();
    assert.equal(await sincronizar(criarCliente(await entrar('g-2'), base), novo.local), true);
    assert.deepEqual(novo.copia.treinos.map((t) => t.uid), ['aaaaaaaa']);
  });

  it('dois aparelhos: soma treinos e respeita exclusões', async () => {
    const a = aparelho();
    const b = aparelho();
    const apiA = criarCliente(await entrar('g-3'), base);
    const apiB = criarCliente(await entrar('g-3'), base);

    a.copia = { ...COPIA_VAZIA, treinos: [treino('aaaaaaaa')] };
    await sincronizar(apiA, a.local);
    b.copia = { ...COPIA_VAZIA, treinos: [treino('bbbbbbbb')] };
    await sincronizar(apiB, b.local);
    await sincronizar(apiA, a.local);
    assert.deepEqual(a.copia.treinos.map((t) => t.uid), ['aaaaaaaa', 'bbbbbbbb']);

    a.copia = { ...a.copia, treinos: a.copia.treinos.filter((t) => t.uid !== 'bbbbbbbb'), excluidos: ['bbbbbbbb'] };
    await sincronizar(apiA, a.local);
    await sincronizar(apiB, b.local);
    // No aparelho de verdade, aplicar apaga o treino excluído; aqui basta a lista juntada.
    assert.deepEqual(mesclar(b.copia, COPIA_VAZIA).treinos.map((t) => t.uid), ['aaaaaaaa']);
  });

  it('gravação com versão velha é recusada', async () => {
    const api1 = criarCliente(await entrar('g-4'), base);
    await api1.gravarBackup(0, COPIA_VAZIA);
    await assert.rejects(api1.gravarBackup(0, COPIA_VAZIA), (e: ErroApi) => e.status === 409);
    await assert.rejects(
      api1.gravarBackup(1, { ...COPIA_VAZIA, treinos: [{ ...treino('aaaaaaaa'), sexo: 'X' as 'M' }] }),
      (e: ErroApi) => e.status === 400,
    );
  });

  it('sair encerra só aquela sessão; apagar a conta apaga tudo', async () => {
    const token1 = await entrar('g-5');
    const token2 = await entrar('g-5');
    await criarCliente(token1, base).gravarBackup(0, { ...COPIA_VAZIA, treinos: [treino('aaaaaaaa')] });
    await criarCliente(token1, base).sair();
    await assert.rejects(criarCliente(token1, base).eu(), (e: ErroApi) => e.status === 401);

    await criarCliente(token2, base).apagarConta();
    await assert.rejects(criarCliente(token2, base).eu(), (e: ErroApi) => e.status === 401);
    const nova = await criarCliente(await entrar('g-5'), base).lerBackup();
    assert.deepEqual(nova, { versao: 0, dados: null });
  });

  it('páginas públicas: início, privacidade e apagar conta', async () => {
    for (const [caminho, texto] of [['/', 'ReadyTAF'], ['/privacidade', 'Política de Privacidade'], ['/apagar-conta', 'Apagar conta e backup']]) {
      const r = await fetch(base + caminho);
      assert.equal(r.status, 200);
      assert.match(await r.text(), new RegExp(texto));
    }
    assert.equal((await fetch(`${base}/icone.png`)).headers.get('content-type'), 'image/png');
  });

  it('painel do admin no app: só o e-mail do admin vê', async () => {
    const comum = await entrar('g-comum', 'Zé');
    await assert.rejects(criarCliente(comum, base).resumoAdmin(), (e: ErroApi) => e.status === 403);

    const resposta = await fetch(`${base}/auth/teste`, {
      method: 'POST', body: JSON.stringify({ sub: 'g-chefe', nome: 'Chefe', email: 'chefe@exemplo.test' }),
    });
    const chefe = (await resposta.json()) as { token: string; admin: boolean };
    assert.equal(chefe.admin, true);
    const api = criarCliente(chefe.token, base);
    await api.gravarBackup(0, { perfil: null, treinos: [treino('chefe-treino-1')], excluidos: [] });
    const resumo = await api.resumoAdmin();
    assert.ok(resumo.contas >= 2);
    assert.ok(resumo.treinos >= 1);
    assert.equal(resumo.downloads, 10);
    assert.ok(resumo.linhas.some((l) => l.email === 'chefe@exemplo.test' && l.treinos === 1));
  });

  it('página de admin no site pede a senha', async () => {
    const semLogin = await fetch(`${base}/admin`);
    assert.match(await semLogin.text(), /type="password"/);

    const errada = await fetch(`${base}/admin/entrar`, {
      method: 'POST', body: 'senha=errada', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual',
    });
    assert.equal(errada.status, 401);

    const certa = await fetch(`${base}/admin/entrar`, {
      method: 'POST', body: 'senha=senha-certa', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual',
    });
    assert.equal(certa.status, 303);
    const cookie = String(certa.headers.get('set-cookie'));
    assert.match(cookie, /Path=\/readytaf-api\/admin; HttpOnly; Secure; SameSite=Strict/);
    const painel = await fetch(`${base}/admin`, { headers: { cookie: cookie.split(';')[0] } });
    const texto = await painel.text();
    assert.match(texto, /Pessoas cadastradas/);
    assert.match(texto, /Downloads do APK/);
    assert.doesNotMatch(texto, /type="password"/);
  });

  it('página de admin bloqueia depois de muitas senhas erradas', async () => {
    const tentar = (senha: string) => fetch(`${base}/admin/entrar`, {
      method: 'POST', body: `senha=${senha}`, redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Real-IP': '9.9.9.9' },
    });
    for (let i = 0; i < 5; i++) await tentar('chute');
    assert.equal((await tentar('senha-certa')).status, 429);
  });

  it('resumo do admin conta treinos e cadastros por dia, no horário de Brasília', () => {
    const agora = Date.parse('2026-11-08T15:00:00Z');
    const r = resumirAdmin([
      {
        id: 'a', nome: 'Ana', nomeCompleto: 'Ana Lima', email: 'ana@x.test', foto: null,
        criadaEm: '2026-11-08 02:00:00', ultimoAcesso: agora - 3_600_000, sessoes: 1, backupEm: null,
        dados: JSON.stringify({
          perfil: { modo: 'candidato' },
          treinos: [{ criadoEm: '2026-11-08 12:00:00' }, { criadoEm: '2026-11-08 01:00:00' }, { criadoEm: '2026-09-01 12:00:00' }],
        }),
      },
      {
        id: 'b', nome: 'Beto', nomeCompleto: null, email: null, foto: null,
        criadaEm: '2026-10-01 12:00:00', ultimoAcesso: null, sessoes: 0, backupEm: null, dados: null,
      },
    ], agora);
    assert.equal(r.contas, 2);
    assert.equal(r.novas7, 1);
    assert.equal(r.ativos1, 1);
    assert.equal(r.treinos, 3);
    assert.equal(r.treinos7, 2);
    assert.equal(r.comTreino, 1);
    assert.equal(r.lancaram7, 1);
    assert.deepEqual(r.modos, { candidato: 1, efetivo: 0, semPerfil: 1 });
    // 01:00 UTC de 08/11 ainda é 07/11 em Brasília; 02:00 UTC também.
    const hoje = r.dias[r.dias.length - 1];
    assert.equal(hoje.dia, '2026-11-08');
    assert.equal(hoje.treinos, 1);
    assert.equal(r.dias[r.dias.length - 2].treinos, 1);
    assert.equal(r.dias[r.dias.length - 2].cadastros, 1);
    assert.equal(r.linhas[0].nome, 'Ana Lima');
  });

  it('página de retorno escapa o endereço', () => {
    assert.doesNotMatch(paginaDeRetorno('tafpmesp://login?codigo="><script>'), /"><script>/);
  });
});
