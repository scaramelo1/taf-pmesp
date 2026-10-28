import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  avaliarExercicio,
  avaliarTreino,
  avaliarValor,
  compararTreinos,
  prontoParaProva,
  taxaAprovacaoDePrimeira,
} from '../avaliacao.ts';
import { regrasCandidato } from '../regras/candidato.ts';
import type { ExercicioId, RegraMinimo, ResultadoRegistrado } from '../tipos.ts';

const regra = (regras: RegraMinimo[], id: ExercicioId) => regras.find((r) => r.exercicio === id)!;
const res = (exercicio: ExercicioId, valor: number, tentativa: 1 | 2 = 1): ResultadoRegistrado => ({
  exercicio,
  valor,
  tentativa,
});

const masc = regrasCandidato('M', 'soldado');
const fem = regrasCandidato('F', 'soldado');

/** Treino masculino soldado todo no mínimo exato. */
const treinoNoLimite = [
  res('barra', 3),
  res('abdominal', 36),
  res('corrida50', 8.25),
  res('corrida2400', 780),
];

describe('regrasCandidato', () => {
  it('soldado não faz natação; oficial faz', () => {
    assert.equal(masc.length, 4);
    assert.ok(!masc.some((r) => r.exercicio === 'natacao50'));
    assert.equal(regra(regrasCandidato('M', 'oficial'), 'natacao50').minimo, 65);
    assert.equal(regra(regrasCandidato('F', 'oficial'), 'natacao50').minimo, 65);
  });

  it('índices por sexo', () => {
    assert.equal(regra(masc, 'barra').minimo, 3);
    assert.equal(regra(masc, 'barra').unidade, 'reps');
    assert.equal(regra(fem, 'barra').minimo, 7);
    assert.equal(regra(fem, 'barra').unidade, 'segundos');
    assert.equal(regra(masc, 'abdominal').minimo, 36);
    assert.equal(regra(fem, 'abdominal').minimo, 32);
    assert.equal(regra(masc, 'corrida50').minimo, 8.25);
    assert.equal(regra(fem, 'corrida50').minimo, 9.5);
    assert.equal(regra(masc, 'corrida2400').minimo, 780);
    assert.equal(regra(fem, 'corrida2400').minimo, 900);
  });

  it('2400 m é o único sem reteste', () => {
    const semReteste = regrasCandidato('M', 'oficial').filter((r) => !r.temReteste);
    assert.deepEqual(
      semReteste.map((r) => r.exercicio),
      ['corrida2400'],
    );
  });
});

describe('avaliarValor', () => {
  it('maior é melhor: no limite é apto, abaixo não', () => {
    assert.equal(avaliarValor(regra(masc, 'abdominal'), 36).apto, true);
    assert.equal(avaliarValor(regra(masc, 'abdominal'), 35).apto, false);
    const v = avaliarValor(regra(masc, 'abdominal'), 40);
    assert.equal(v.diferenca, 4);
    assert.ok(Math.abs(v.margem - 4 / 36) < 1e-9);
  });

  it('menor é melhor: tempo no limite é apto, 1 centésimo acima não', () => {
    assert.equal(avaliarValor(regra(masc, 'corrida50'), 8.25).apto, true);
    const acima = avaliarValor(regra(masc, 'corrida50'), 8.26);
    assert.equal(acima.apto, false);
    assert.equal(acima.diferenca, -0.01);
    const v = avaliarValor(regra(masc, 'corrida2400'), 750);
    assert.equal(v.diferenca, 30);
    assert.ok(Math.abs(v.margem - 30 / 780) < 1e-9);
  });

  it('isometria feminina conta segundos, maior é melhor', () => {
    assert.equal(avaliarValor(regra(fem, 'barra'), 7).apto, true);
    assert.equal(avaliarValor(regra(fem, 'barra'), 6.5).apto, false);
  });
});

describe('avaliarExercicio e reteste', () => {
  it('apto de primeira ignora a 2ª tentativa', () => {
    const av = avaliarExercicio(regra(masc, 'barra'), [res('barra', 4), res('barra', 1, 2)])!;
    assert.equal(av.apto, true);
    assert.equal(av.aptoDePrimeira, true);
    assert.equal(av.reteste, undefined);
    assert.equal(av.final.valor, 4);
  });

  it('inapto na primeira e apto no reteste', () => {
    const av = avaliarExercicio(regra(masc, 'barra'), [res('barra', 2), res('barra', 3, 2)])!;
    assert.equal(av.apto, true);
    assert.equal(av.aptoDePrimeira, false);
    assert.equal(av.final.valor, 3);
  });

  it('2400 m não aceita reteste', () => {
    const av = avaliarExercicio(regra(masc, 'corrida2400'), [res('corrida2400', 800), res('corrida2400', 770, 2)])!;
    assert.equal(av.apto, false);
    assert.equal(av.reteste, undefined);
  });

  it('sem resultado do exercício devolve null', () => {
    assert.equal(avaliarExercicio(regra(masc, 'barra'), [res('abdominal', 40)]), null);
  });
});

describe('avaliarTreino', () => {
  it('treino completo no limite é apto geral com índice 0', () => {
    const av = avaliarTreino(masc, treinoNoLimite);
    assert.equal(av.aptos, 4);
    assert.equal(av.completo, true);
    assert.equal(av.aptoGeral, true);
    assert.equal(av.indice, 0);
  });

  it('treino parcial lista pendentes e não é apto geral', () => {
    const av = avaliarTreino(masc, [res('corrida2400', 750)]);
    assert.equal(av.avaliados, 1);
    assert.deepEqual(av.pendentes, ['barra', 'abdominal', 'corrida50']);
    assert.equal(av.completo, false);
    assert.equal(av.aptoGeral, false);
  });

  it('um inapto derruba o apto geral', () => {
    const av = avaliarTreino(masc, [...treinoNoLimite.slice(0, 3), res('corrida2400', 790)]);
    assert.equal(av.aptos, 3);
    assert.equal(av.aptoGeral, false);
  });

  it('margem é limitada a +20% no índice', () => {
    const av = avaliarTreino(masc, [res('barra', 30)]); // 900% acima do mínimo
    assert.equal(av.indice, 0.2);
  });

  it('treino vazio tem índice null', () => {
    assert.equal(avaliarTreino(masc, []).indice, null);
  });

  it('resultado de exercício fora das regras é ignorado', () => {
    const av = avaliarTreino(masc, [...treinoNoLimite, res('natacao50', 90)]);
    assert.equal(av.avaliados, 4);
    assert.equal(av.aptoGeral, true);
  });
});

describe('compararTreinos', () => {
  it('tempo menor é melhora; menos reps é piora', () => {
    const anterior = avaliarTreino(masc, treinoNoLimite);
    const atual = avaliarTreino(masc, [
      res('barra', 3),
      res('abdominal', 34),
      res('corrida50', 8.1),
      res('corrida2400', 760),
    ]);
    const c = compararTreinos(atual, anterior);
    const t = Object.fromEntries(c.exercicios.map((e) => [e.exercicio, e]));
    assert.equal(t.barra.tendencia, 'manteve');
    assert.equal(t.abdominal.tendencia, 'piorou');
    assert.equal(t.abdominal.variacao, -2);
    assert.equal(t.corrida50.tendencia, 'melhorou');
    assert.equal(t.corrida50.variacao, 0.15);
    assert.equal(t.corrida2400.tendencia, 'melhorou');
    assert.equal(t.corrida2400.variacao, 20);
  });

  it('só compara exercícios feitos nos dois treinos', () => {
    const c = compararTreinos(
      avaliarTreino(masc, [res('barra', 5)]),
      avaliarTreino(masc, [res('abdominal', 40)]),
    );
    assert.equal(c.exercicios.length, 0);
  });
});

describe('prontoParaProva e taxa de primeira', () => {
  const apto = avaliarTreino(masc, treinoNoLimite);
  const inapto = avaliarTreino(masc, [...treinoNoLimite.slice(0, 3), res('corrida2400', 800)]);

  it('precisa dos 3 últimos aptos', () => {
    assert.equal(prontoParaProva([apto, apto, apto, inapto]), true);
    assert.equal(prontoParaProva([apto, inapto, apto]), false);
    assert.equal(prontoParaProva([apto, apto]), false);
  });

  it('taxa de aprovação de primeira', () => {
    const comReteste = avaliarTreino(masc, [res('barra', 2), res('barra', 3, 2)]);
    assert.equal(taxaAprovacaoDePrimeira([apto, comReteste], 'barra'), 0.5);
    assert.equal(taxaAprovacaoDePrimeira([apto], 'natacao50'), null);
  });
});
