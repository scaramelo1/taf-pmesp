/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { idadeEm } from '../datas.ts';
import { avaliarPontos, avaliarTreinoPontos, faixaDaIdade, valorParaPontos } from '../pontuacao.ts';
import { rotuloFaixa, TABELAS_TAF3 } from '../regras/taf3.ts';
import type { ExercicioId } from '../tipos.ts';

const t = (id: ExercicioId) => TABELAS_TAF3.find((x) => x.exercicio === id)!;
const pts = (id: ExercicioId, idade: number, valor: number) => avaliarPontos(t(id), idade, valor).pontos;

describe('estrutura da tabela', () => {
  it('6 testes, 17 linhas, colunas do tamanho das faixas', () => {
    assert.equal(TABELAS_TAF3.length, 6);
    for (const tab of TABELAS_TAF3) {
      assert.equal(tab.niveis.length, 17, tab.exercicio);
      assert.equal(tab.pontos.length, 17, tab.exercicio);
      for (const linha of tab.pontos) assert.equal(linha.length, tab.faixas.length, tab.exercicio);
    }
  });

  it('níveis nunca ficam mais fáceis de uma linha para a outra', () => {
    for (const tab of TABELAS_TAF3) {
      for (let i = 1; i < tab.niveis.length; i++) {
        const ok = tab.direcao === 'maior' ? tab.niveis[i] >= tab.niveis[i - 1] : tab.niveis[i] <= tab.niveis[i - 1];
        assert.ok(ok, `${tab.exercicio} linha ${i + 1}`);
      }
    }
  });

  it('cada faixa tem exatamente uma célula com 20 pontos (suficiência) e chega a 100', () => {
    for (const tab of TABELAS_TAF3) {
      tab.faixas.forEach((_, f) => {
        const coluna = tab.pontos.map((l) => l[f]);
        assert.equal(coluna.filter((p) => p === 20).length, 1, `${tab.exercicio} faixa ${f}`);
        assert.ok(coluna.includes(100), `${tab.exercicio} faixa ${f}`);
      });
    }
  });

  it('só a natação não tem suficiência', () => {
    assert.deepEqual(
      TABELAS_TAF3.filter((x) => !x.temSuficiencia).map((x) => x.exercicio),
      ['natacao50'],
    );
  });

  it('rótulos das faixas', () => {
    assert.equal(rotuloFaixa(t('barra'), 0), 'até 25');
    assert.equal(rotuloFaixa(t('barra'), 1), '26 a 30');
    assert.equal(rotuloFaixa(t('barra'), 7), '56 ou mais');
    assert.equal(rotuloFaixa(t('abdominal'), 0), 'até 40');
    assert.equal(rotuloFaixa(t('abdominal'), 1), '41 a 45');
  });
});

describe('faixa etária', () => {
  it('limites das faixas', () => {
    assert.equal(faixaDaIdade(t('barra'), 25), 0);
    assert.equal(faixaDaIdade(t('barra'), 26), 1);
    assert.equal(faixaDaIdade(t('barra'), 55), 6);
    assert.equal(faixaDaIdade(t('barra'), 56), 7);
    assert.equal(faixaDaIdade(t('barra'), 70), 7);
    assert.equal(faixaDaIdade(t('abdominal'), 40), 0);
    assert.equal(faixaDaIdade(t('abdominal'), 41), 1);
    assert.equal(faixaDaIdade(t('abdominal'), 56), 4);
  });

  it('idadeEm conta aniversário', () => {
    assert.equal(idadeEm('1990-10-28', '2026-10-27'), 35);
    assert.equal(idadeEm('1990-10-28', '2026-10-28'), 36);
    assert.equal(idadeEm('1990-12-01', '2026-10-28'), 35);
  });
});

describe('pontos conferidos na tabela', () => {
  it('corrida 2400 m', () => {
    assert.equal(pts('corrida2400', 28, 840), 20); // 14'00", 26–30: suficiência
    assert.equal(pts('corrida2400', 28, 825), 20); // 13'45" ainda é a linha de 14'00"
    assert.equal(pts('corrida2400', 28, 841), 10);
    assert.equal(pts('corrida2400', 22, 570), 100); // 9'30"
    assert.equal(pts('corrida2400', 60, 1050), 10); // 17'30", 56+
    assert.equal(pts('corrida2400', 60, 780), 100); // 13'00", 56+
    assert.equal(pts('corrida2400', 60, 600), 100); // acima da última célula continua 100
    assert.equal(pts('corrida2400', 22, 1100), 0); // pior que a 1ª linha
  });

  it('flexão na barra (linhas repetidas com 1 repetição)', () => {
    assert.equal(pts('barra', 22, 1), 0); // até 25: célula vazia
    assert.equal(pts('barra', 33, 1), 10); // 31–35, linha 6
    assert.equal(pts('barra', 48, 1), 40); // 46–50, linha 6
    assert.equal(pts('barra', 22, 4), 20);
    assert.equal(pts('barra', 22, 12), 100);
    assert.equal(pts('barra', 22, 15), 100);
  });

  it('apoio, 50 m e abdominal', () => {
    assert.equal(pts('apoio', 38, 20), 70); // 36–40, linha 11
    assert.equal(pts('apoio', 48, 6), 20); // 46–50: suficiência
    assert.equal(pts('corrida50', 30, 8.25), 50); // ≤ 8"30, 26–30
    assert.equal(pts('corrida50', 30, 8.31), 40);
    assert.equal(pts('abdominal', 43, 26), 20); // 41–45: suficiência
    assert.equal(pts('abdominal', 43, 24), 10);
    assert.equal(pts('abdominal', 43, 42), 100);
    assert.equal(pts('abdominal', 35, 34), 20); // até 40: suficiência
  });

  it('natação: sem suficiência, 1\'25" cobre as linhas 1 a 8', () => {
    const lenta = avaliarPontos(t('natacao50'), 22, 90);
    assert.equal(lenta.pontos, 0);
    assert.equal(lenta.suficiente, true);
    assert.equal(pts('natacao50', 22, 85), 10); // linha 8
    assert.equal(pts('natacao50', 22, 65), 40); // 1'05"
    assert.equal(pts('natacao50', 22, 35), 100);
  });
});

describe('suficiência e próximo nível', () => {
  it('abaixo de 20 é insuficiente', () => {
    assert.equal(avaliarPontos(t('barra'), 22, 3).suficiente, false); // 10 pts
    assert.equal(avaliarPontos(t('barra'), 22, 4).suficiente, true);
  });

  it('próximo nível e quanto falta', () => {
    const a = avaliarPontos(t('corrida2400'), 28, 825);
    assert.deepEqual(a.proximo, { valor: 810, pontos: 30, falta: 15 });
    const b = avaliarPontos(t('barra'), 22, 1);
    assert.deepEqual(b.proximo, { valor: 3, pontos: 10, falta: 2 });
    assert.equal(avaliarPontos(t('barra'), 22, 12).proximo, null);
    assert.equal(avaliarPontos(t('corrida2400'), 60, 780).proximo, null);
  });

  it('valorParaPontos', () => {
    assert.equal(valorParaPontos(t('corrida2400'), 28, 20), 840);
    assert.equal(valorParaPontos(t('corrida2400'), 28, 100), 600);
    assert.equal(valorParaPontos(t('abdominal'), 52, 20), 22);
  });
});

describe('avaliarTreinoPontos', () => {
  const r = (exercicio: ExercicioId, valor: number) => ({ exercicio, valor, tentativa: 1 as const });

  it('suficiente em tudo mas soma abaixo de 251 não é apto', () => {
    const av = avaliarTreinoPontos(TABELAS_TAF3, 28, [
      r('barra', 3), // 20
      r('abdominal', 34), // 20
      r('apoio', 14), // 20
      r('corrida50', 9.2), // 20
      r('corrida2400', 840), // 20
      r('natacao50', 90), // 0, mas não reprova
    ]);
    assert.equal(av.completo, true);
    assert.equal(av.aptoGeral, false);
    assert.equal(av.soma, 100);
    assert.equal(av.faltaTotal, 151);
    assert.ok(Math.abs(av.media! - 100 / 6) < 1e-9);
  });

  it('apto com soma ≥ 251 e suficiência em todos', () => {
    const base = [
      r('barra', 7), // 60
      r('abdominal', 40), // 50
      r('apoio', 22), // 60
      r('corrida50', 8.3), // 50
      r('corrida2400', 780), // 40
    ];
    const no250 = avaliarTreinoPontos(TABELAS_TAF3, 28, [...base, r('natacao50', 90)]); // natação 0
    assert.equal(no250.soma, 260);
    assert.equal(no250.aptoGeral, true);

    const abaixo = avaliarTreinoPontos(TABELAS_TAF3, 28, [...base.slice(0, 4), r('corrida2400', 840), r('natacao50', 90)]);
    assert.equal(abaixo.soma, 240); // 2400 m com 20
    assert.equal(abaixo.faltaTotal, 11);
    assert.equal(abaixo.aptoGeral, false);
  });

  it('soma alta não compensa teste insuficiente', () => {
    const av = avaliarTreinoPontos(TABELAS_TAF3, 28, [
      r('barra', 12),
      r('abdominal', 50),
      r('apoio', 32),
      r('corrida50', 6.5),
      r('corrida2400', 900), // 0 pts na faixa 26–30
      r('natacao50', 35),
    ]);
    assert.ok(av.soma >= 251);
    assert.equal(av.aptoGeral, false);
  });

  it('parcial e insuficiente', () => {
    const av = avaliarTreinoPontos(TABELAS_TAF3, 28, [r('barra', 2)]);
    assert.equal(av.completo, false);
    assert.equal(av.aptoGeral, false);
    assert.equal(av.pendentes.length, 5);
    assert.equal(av.exercicios[0].avaliacao.suficiente, false);
  });
});
