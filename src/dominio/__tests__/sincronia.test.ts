/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { COPIA_VAZIA, mesclar, mesmaCopia, validarCopia } from '../sincronia.ts';
import type { CopiaDados, PerfilCopia, TreinoCopia } from '../sincronia.ts';

const treino = (uid: string, data = '2026-11-01'): TreinoCopia => ({
  uid,
  data,
  edital: 'pmesp-2025',
  sexo: 'M',
  cargo: 'soldado',
  idade: 25,
  observacao: '',
  criadoEm: '2026-11-01 10:00:00',
  resultados: [{ exercicio: 'barra', valor: 8, tentativa: 1 }],
});

const perfil = (nome: string, atualizadoEm: string): PerfilCopia => ({
  nome,
  sexo: 'M',
  cargo: 'soldado',
  modo: 'candidato',
  dataNascimento: '2000-01-01',
  dataProva: null,
  atualizadoEm,
});

describe('mesclar', () => {
  it('soma os treinos dos dois lados sem repetir', () => {
    const a: CopiaDados = { perfil: null, treinos: [treino('aaaaaaaa'), treino('bbbbbbbb')], excluidos: [] };
    const b: CopiaDados = { perfil: null, treinos: [treino('bbbbbbbb'), treino('cccccccc')], excluidos: [] };
    assert.deepEqual(mesclar(a, b).treinos.map((t) => t.uid), ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);
  });

  it('treino excluído em um aparelho não volta pelo outro', () => {
    const a: CopiaDados = { perfil: null, treinos: [treino('aaaaaaaa')], excluidos: [] };
    const b: CopiaDados = { perfil: null, treinos: [], excluidos: ['aaaaaaaa'] };
    const m = mesclar(a, b);
    assert.deepEqual(m.treinos, []);
    assert.deepEqual(m.excluidos, ['aaaaaaaa']);
  });

  it('fica com o perfil alterado por último', () => {
    const velho = perfil('Ana', '2026-11-01T10:00:00.000Z');
    const novo = perfil('Ana Paula', '2026-11-02T10:00:00.000Z');
    assert.equal(mesclar({ ...COPIA_VAZIA, perfil: velho }, { ...COPIA_VAZIA, perfil: novo }).perfil?.nome, 'Ana Paula');
    assert.equal(mesclar({ ...COPIA_VAZIA, perfil: novo }, { ...COPIA_VAZIA, perfil: velho }).perfil?.nome, 'Ana Paula');
    assert.equal(mesclar(COPIA_VAZIA, { ...COPIA_VAZIA, perfil: velho }).perfil?.nome, 'Ana');
  });

  it('aparelho novo recebe tudo do backup', () => {
    const backup: CopiaDados = { perfil: perfil('Ana', '2026-11-01T10:00:00.000Z'), treinos: [treino('aaaaaaaa')], excluidos: [] };
    assert.ok(mesmaCopia(mesclar(COPIA_VAZIA, backup), backup));
  });
});

describe('mesmaCopia', () => {
  it('não depende da ordem', () => {
    const a: CopiaDados = { perfil: null, treinos: [treino('aaaaaaaa'), treino('bbbbbbbb')], excluidos: [] };
    const b: CopiaDados = { perfil: null, treinos: [treino('bbbbbbbb'), treino('aaaaaaaa')], excluidos: [] };
    assert.ok(mesmaCopia(a, b));
    assert.ok(!mesmaCopia(a, COPIA_VAZIA));
  });
});

describe('validarCopia', () => {
  it('aceita uma cópia válida', () => {
    const c: CopiaDados = { perfil: perfil('Ana', '2026-11-01T10:00:00.000Z'), treinos: [treino('aaaaaaaa')], excluidos: ['bbbbbbbb'] };
    assert.deepEqual(validarCopia(JSON.parse(JSON.stringify(c))), c);
  });

  it('recusa o que está fora do formato', () => {
    assert.equal(validarCopia(null), null);
    assert.equal(validarCopia({ perfil: null, treinos: [{ ...treino('aaaaaaaa'), sexo: 'X' }], excluidos: [] }), null);
    assert.equal(validarCopia({ perfil: null, treinos: [treino('a b')], excluidos: [] }), null);
    assert.equal(
      validarCopia({ perfil: null, treinos: [{ ...treino('aaaaaaaa'), resultados: [{ exercicio: 'x', valor: 1, tentativa: 1 }] }], excluidos: [] }),
      null,
    );
    assert.equal(validarCopia({ perfil: { nome: 'Ana' }, treinos: [], excluidos: [] }), null);
  });
});
