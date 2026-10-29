/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  avaliadosDoModo,
  compararComAnteriores,
  compararExercicios,
  desempenhoGeral,
  exerciciosCandidato,
  exerciciosEfetivo,
  montarHistorico,
  pontoFraco,
  tendenciaSerie,
  type TreinoBase,
} from '../desempenho.ts';
import { escalaGrafico } from '../escala.ts';
import { EDITAL_CANDIDATO, EDITAL_TAF3 } from '../regras/index.ts';
import { regrasCandidato } from '../regras/candidato.ts';
import type { ExercicioId, ResultadoRegistrado } from '../tipos.ts';

type Valores = Partial<Record<ExercicioId, number | [number, number]>>;

let proximoId = 1;

function treino(data: string, valores: Valores, edital = EDITAL_CANDIDATO.id, idade: number | null = 28): TreinoBase {
  const resultados: ResultadoRegistrado[] = [];
  for (const [exercicio, v] of Object.entries(valores) as [ExercicioId, number | [number, number]][]) {
    const [primeira, reteste] = Array.isArray(v) ? v : [v];
    resultados.push({ exercicio, valor: primeira, tentativa: 1 });
    if (reteste !== undefined) resultados.push({ exercicio, valor: reteste, tentativa: 2 });
  }
  return { id: proximoId++, data, edital, sexo: 'M', cargo: 'soldado', idade, resultados };
}

const aptoCompleto: Valores = { barra: 5, abdominal: 40, corrida50: 8, corrida2400: 750 };
const regras = regrasCandidato('M', 'soldado');
const completoTaf3: Valores = { barra: 12, abdominal: 50, apoio: 32, corrida50: 6.5, corrida2400: 570 };

describe('montarHistorico', () => {
  it('compara cada treino com o anterior do mesmo modo', () => {
    // Mais recente primeiro; o do meio é do efetivo e não entra na comparação do candidato.
    const h = montarHistorico(
      [
        treino('2026-10-20', { ...aptoCompleto, corrida2400: 740 }), // a barra já passa do teto de margem
        treino('2026-10-15', { barra: 5, abdominal: 30, apoio: 20, corrida50: 8.6, corrida2400: 840, natacao50: 60 }, EDITAL_TAF3.id),
        treino('2026-10-10', aptoCompleto),
        treino('2026-10-01', { barra: 2 }),
      ],
      null,
    );
    assert.equal(h[0].tendencia, 'melhorou');
    assert.ok(h[0].variacao! > 0);
    assert.equal(h[1].modo, 'efetivo');
    assert.equal(h[1].tendencia, null);
    assert.equal(h[0].comparadoCom?.data, '2026-10-10');
    assert.equal(h[2].tendencia, null); // o anterior é avulso: não compara a nota geral
    assert.equal(h[3].tendencia, null);
  });

  it('avulso de um teste compara com a última vez em que o teste foi feito', () => {
    const h = montarHistorico(
      [
        treino('2026-10-20', { corrida2400: 760 }),
        treino('2026-10-15', { barra: 6 }),
        treino('2026-10-10', aptoCompleto), // 2400 m em 750
        treino('2026-10-05', { barra: 2, corrida2400: 800 }),
      ],
      null,
    );
    assert.equal(h[0].tendencia, 'piorou');
    assert.equal(h[0].variacao, null);
    assert.equal(h[0].comparadoCom?.data, '2026-10-10');
    assert.equal(h[1].tendencia, 'melhorou'); // barra 6 contra 5
    assert.equal(h[3].tendencia, null); // avulso com 2 testes: sem seta geral
  });

  it('setas por teste contra a última vez de cada um', () => {
    const avs = avaliadosDoModo(
      montarHistorico(
        [
          treino('2026-10-20', { barra: 4, corrida2400: 700 }),
          treino('2026-10-15', { corrida2400: 720 }),
          treino('2026-10-10', { barra: 5 }),
        ],
        null,
      ),
      'candidato',
    );
    const setas = compararComAnteriores(avs[0], avs.slice(1));
    assert.equal(setas.get('corrida2400'), 'melhorou');
    assert.equal(setas.get('barra'), 'piorou');
  });

  it('efetivo sem idade usa a data de nascimento; sem nenhuma, não avalia', () => {
    const t = treino('2026-10-15', { barra: 5 }, EDITAL_TAF3.id, null);
    assert.equal(montarHistorico([t], null)[0].avaliado, null);
    const comNascimento = montarHistorico([t], '1998-01-01')[0].avaliado;
    assert.equal(comNascimento?.modo, 'efetivo');
    assert.equal(comNascimento?.nota, 40); // 5 barras, 26–30 anos
  });

  it('pontos iguais: manteve', () => {
    const h = montarHistorico(
      [treino('2026-10-20', { barra: 5 }, EDITAL_TAF3.id), treino('2026-10-10', { barra: 5 }, EDITAL_TAF3.id)],
      null,
    );
    assert.equal(h[0].tendencia, 'manteve');
    assert.equal(h[0].variacao, null); // avulso: compara o teste, não a soma
  });
});

describe('desempenhoGeral', () => {
  const avaliados = (ts: TreinoBase[]) => avaliadosDoModo(montarHistorico(ts, null), 'candidato');

  it('série, aptos X/Y, sequência e recorde só entre completos', () => {
    const g = desempenhoGeral(
      avaliados([
        treino('2026-10-20', { barra: 12 }), // margem enorme, mas incompleto
        treino('2026-10-10', aptoCompleto),
        treino('2026-10-01', { ...aptoCompleto, corrida2400: 800 }),
      ]),
    );
    assert.deepEqual(
      g.serie.map((p) => p.data),
      ['2026-10-01', '2026-10-10'],
    );
    assert.equal(g.aptos, 1);
    assert.equal(g.total, 2);
    assert.equal(g.avulsos, 1);
    assert.equal(g.recorde?.data, '2026-10-10');
    assert.equal(g.pronto, false);
    assert.equal(g.sequencia, 1); // o avulso de 20/10 não quebra a sequência
  });

  it('pronto com 3 treinos seguidos aptos', () => {
    const g = desempenhoGeral(
      avaliados([
        treino('2026-10-20', aptoCompleto),
        treino('2026-10-15', aptoCompleto),
        treino('2026-10-10', aptoCompleto),
        treino('2026-10-01', { barra: 1 }),
      ]),
    );
    assert.equal(g.pronto, true);
    assert.equal(g.aptos, 3);
    assert.equal(g.sequencia, 3);
  });
});

describe('por exercício', () => {
  it('candidato: melhor marca, média dos últimos 3, tendência e aprovação de primeira', () => {
    const avs = avaliadosDoModo(
      montarHistorico(
        [
          treino('2026-10-20', { barra: 6, corrida2400: 760 }),
          treino('2026-10-15', { barra: [2, 4], corrida2400: 770 }),
          treino('2026-10-10', { barra: 3, corrida2400: 800 }),
          treino('2026-10-01', { barra: 2, corrida2400: 820 }),
        ],
        null,
      ),
      'candidato',
    );
    const ex = exerciciosCandidato(avs, regras);
    const barra = ex.find((e) => e.medida.exercicio === 'barra')!;
    assert.deepEqual(
      barra.serie.map((m) => m.valor),
      [2, 3, 4, 6], // reteste vale no lugar da 1ª tentativa
    );
    assert.equal(barra.referencia, 3);
    assert.equal(barra.melhor?.valor, 6);
    assert.equal(barra.mediaRecente, (3 + 4 + 6) / 3);
    assert.equal(barra.tendencia, 'melhorou');
    assert.equal(barra.taxaDePrimeira, 0.5); // apto de primeira em 10/10 e 20/10

    const corrida = ex.find((e) => e.medida.exercicio === 'corrida2400')!;
    assert.equal(corrida.melhor?.valor, 760); // menor tempo
    assert.equal(corrida.tendencia, 'melhorou');

    const abdominal = ex.find((e) => e.medida.exercicio === 'abdominal')!;
    assert.equal(abdominal.serie.length, 0);
    assert.equal(abdominal.melhor, null);
    assert.equal(abdominal.tendencia, null);
    assert.equal(abdominal.taxaDePrimeira, null);
  });

  it('ponto fraco = menor margem recente', () => {
    const avs = avaliadosDoModo(montarHistorico([treino('2026-10-20', { barra: 6, abdominal: 37, corrida50: 8 })], null), 'candidato');
    assert.equal(pontoFraco(exerciciosCandidato(avs, regras)), 'abdominal');
    const so1 = avaliadosDoModo(montarHistorico([treino('2026-10-20', { barra: 6 })], null), 'candidato');
    assert.equal(pontoFraco(exerciciosCandidato(so1, regras)), null);
  });

  it('efetivo: linha de 20 pts pela idade, natação sem linha, ponto fraco por pontos', () => {
    const avs = avaliadosDoModo(
      montarHistorico([treino('2026-10-20', { barra: 5, apoio: 14, natacao50: 80 }, EDITAL_TAF3.id)], null),
      'efetivo',
    );
    const ex = exerciciosEfetivo(avs, 28);
    const barra = ex.find((e) => e.medida.exercicio === 'barra')!;
    assert.equal(barra.referencia, 3); // 26–30 anos: 20 pts com 3 barras
    assert.equal(barra.serie[0].nota, 40);
    assert.equal(ex.find((e) => e.medida.exercicio === 'natacao50')!.referencia, null);
    assert.equal(pontoFraco(ex), 'apoio');
  });

  it('efetivo: natação nunca é ponto fraco e tempo 0 fica fora do gráfico e das setas', () => {
    const hist = montarHistorico(
      [
        treino('2026-10-22', { ...completoTaf3, natacao50: 0 }, EDITAL_TAF3.id),
        treino('2026-10-20', { ...completoTaf3, natacao50: 85 }, EDITAL_TAF3.id),
      ],
      null,
    );
    const ex = exerciciosEfetivo(avaliadosDoModo(hist, 'efetivo'), 28);
    const natacao = ex.find((e) => e.medida.exercicio === 'natacao50')!;
    assert.deepEqual(
      natacao.serie.map((m) => m.valor),
      [85],
    );
    assert.notEqual(pontoFraco(ex), 'natacao50');
    assert.equal(hist[0].variacao, 0); // natação não mexe na soma
    assert.equal(compararExercicios(hist[0].avaliado!, hist[1].avaliado!).has('natacao50'), false);
  });
});

describe('tendenciaSerie', () => {
  it('compara blocos de até 3', () => {
    assert.equal(tendenciaSerie('maior', [5]), null);
    assert.equal(tendenciaSerie('maior', [5, 4]), 'piorou');
    assert.equal(tendenciaSerie('menor', [800, 790]), 'melhorou');
    assert.equal(tendenciaSerie('maior', [9, 1, 5, 5, 5, 5, 5, 5]), 'manteve'); // só os 6 últimos contam
  });
});

describe('compararExercicios', () => {
  it('▲▼ pelo valor bruto, só nos feitos nos dois', () => {
    const [a, b] = avaliadosDoModo(
      montarHistorico([treino('2026-10-20', { barra: 5, corrida50: 8.4 }), treino('2026-10-10', { barra: 4, corrida50: 8.2, abdominal: 40 })], null),
      'candidato',
    );
    const c = compararExercicios(a, b);
    assert.equal(c.get('barra'), 'melhorou');
    assert.equal(c.get('corrida50'), 'piorou');
    assert.equal(c.has('abdominal'), false);
  });
});

describe('escalaGrafico', () => {
  it('passos redondos cobrindo os valores', () => {
    const e = escalaGrafico([751, 780, 812]);
    assert.equal(e.passo, 20);
    assert.equal(e.base, 740);
    assert.ok(e.marcas.at(-1)! >= 812);
  });

  it('inteiros e valor único', () => {
    const e = escalaGrafico([3, 4], 4, true);
    assert.equal(e.passo, 1);
    assert.deepEqual(e.marcas, [3, 4]);
    const u = escalaGrafico([0]);
    assert.ok(u.secoes >= 1);
    assert.ok(u.marcas.length >= 2);
  });

  it('margens negativas e positivas', () => {
    const e = escalaGrafico([-0.08, 0, 0.12]);
    assert.equal(e.passo, 0.05);
    assert.equal(e.base, -0.1);
    assert.ok(e.marcas.includes(0));
  });
});
