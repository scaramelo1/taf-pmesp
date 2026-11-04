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

    const carga = { iss: 'https://accounts.google.com', aud: 'cliente-teste', exp: Date.now() / 1000 + 600, sub: 'g-1', given_name: 'Bia' };
    idTokenFalso = `x.${Buffer.from(JSON.stringify(carga)).toString('base64url')}.y`;
    const retorno = await fetch(`${base}/auth/google/retorno?code=abc&state=${google.searchParams.get('state')}`);
    assert.match(await retorno.text(), /Voltar ao ReadyTAF/);

    const sessao = await aguardarLoginGoogle(verificador, base);
    assert.ok('token' in sessao);
    assert.equal(sessao.nome, 'Bia');
    assert.deepEqual(await criarCliente(sessao.token, base).eu(), { nome: 'Bia', conta: sessao.conta });

    assert.deepEqual(await aguardarLoginGoogle('w'.repeat(64), base), { pendente: true });
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

  it('página de retorno escapa o endereço', () => {
    assert.doesNotMatch(paginaDeRetorno('tafpmesp://login?codigo="><script>'), /"><script>/);
  });
});
