import type { Medida, Sexo } from '../tipos.ts';

/** TAF-3 PMESP: cada sexo tem a sua tabela de pontuação. */
export const EDITAL_TAF3: Record<Sexo, { id: string; descricao: string }> = {
  M: { id: 'taf3-masc', descricao: 'TAF-3 PMESP — tabela do efetivo masculino' },
  F: { id: 'taf3-fem', descricao: 'TAF-3 PMESP — tabela do efetivo feminino' },
};

/** Pontos mínimos para o índice de suficiência (células em negrito da tabela). */
export const PONTOS_SUFICIENCIA = 20;

/** Soma mínima dos pontos dos testes que contam (hoje, todos menos a natação) para aprovação no TAF-3. */
export const PONTOS_MINIMOS_TOTAL = 251;

export interface TabelaPontos extends Medida {
  /** Valor exigido em cada nível (linha da tabela), do mais fácil para o mais difícil. */
  niveis: number[];
  /** Idade máxima de cada faixa etária; a última é Infinity ("ou mais"). */
  faixas: number[];
  /** pontos[nível][faixa]; null = célula vazia. */
  pontos: (number | null)[][];
  temSuficiencia: boolean;
  /** false: o teste é registrado, mas não soma, não reprova e não deixa o treino incompleto. */
  contaNaSoma: boolean;
}

const _ = null;

const FAIXAS_GERAL = [25, 30, 35, 40, 45, 50, 55, Infinity];
const FAIXAS_ABDOMINAL_M = [40, 45, 50, 55, Infinity];
const FAIXAS_ABDOMINAL_F = [35, 40, 45, 50, 55, Infinity];

// Colunas: até 25 | 26–30 | 31–35 | 36–40 | 41–45 | 46–50 | 51–55 | 56+
// Vale para barra, 2400 m, apoio, 50 m e natação (as linhas são as mesmas nos dois sexos).
const PONTOS_GERAL: (number | null)[][] = [
  [_, _, _, _, _, _, _, 10],
  [_, _, _, _, _, _, 10, 20],
  [_, _, _, _, _, 10, 20, 30],
  [_, _, _, _, 10, 20, 30, 40],
  [_, _, _, 10, 20, 30, 40, 50],
  [_, _, 10, 20, 30, 40, 50, 60],
  [_, 10, 20, 30, 40, 50, 60, 70],
  [10, 20, 30, 40, 50, 60, 70, 80],
  [20, 30, 40, 50, 60, 70, 80, 90],
  [30, 40, 50, 60, 70, 80, 90, 100],
  [40, 50, 60, 70, 80, 90, 100, _],
  [50, 60, 70, 80, 90, 100, _, _],
  [60, 70, 80, 90, 100, _, _, _],
  [70, 80, 90, 100, _, _, _, _],
  [80, 90, 100, _, _, _, _, _],
  [90, 100, _, _, _, _, _, _],
  [100, _, _, _, _, _, _, _],
];

// Colunas: até 40 | 41–45 | 46–50 | 51–55 | 56+
const PONTOS_ABDOMINAL_M: (number | null)[][] = [
  [_, _, _, _, 10],
  [_, _, _, 10, 20],
  [_, _, 10, 20, 30],
  [_, 10, 20, 30, 40],
  [_, 20, 30, 40, 50],
  [_, 30, 40, 50, 60],
  [_, 40, 50, 60, 70],
  [10, 50, 60, 70, 80],
  [20, 60, 70, 80, 90],
  [30, 70, 80, 90, 100],
  [40, 80, 90, 100, _],
  [50, 90, 100, _, _],
  [60, 100, _, _, _],
  [70, _, _, _, _],
  [80, _, _, _, _],
  [90, _, _, _, _],
  [100, _, _, _, _],
];

// Colunas: até 35 | 36–40 | 41–45 | 46–50 | 51–55 | 56+
const PONTOS_ABDOMINAL_F: (number | null)[][] = [
  [_, _, _, _, _, 10],
  [_, _, _, _, 10, 20],
  [_, _, _, 10, 20, 30],
  [_, _, 10, 20, 30, 40],
  [_, 10, 20, 30, 40, 50],
  [_, 20, 30, 40, 50, 60],
  [_, 30, 40, 50, 60, 70],
  [10, 40, 50, 60, 70, 80],
  [20, 50, 60, 70, 80, 90],
  [30, 60, 70, 80, 90, 100],
  [40, 70, 80, 90, 100, _],
  [50, 80, 90, 100, _, _],
  [60, 90, 100, _, _, _],
  [70, 100, _, _, _, _],
  [80, _, _, _, _, _],
  [90, _, _, _, _, _],
  [100, _, _, _, _, _],
];

const geral = (m: Medida, niveis: number[], temSuficiencia = true, contaNaSoma = true): TabelaPontos => ({
  ...m,
  niveis,
  faixas: FAIXAS_GERAL,
  pontos: PONTOS_GERAL,
  temSuficiencia,
  contaNaSoma,
});

// Tempos em segundos: 17'30" = 1050 | 11"30 = 11.30 | 1'25" = 85
const TABELAS_MASCULINO: TabelaPontos[] = [
  geral(
    { exercicio: 'barra', nome: 'Flexão na barra', unidade: 'reps', direcao: 'maior' },
    [1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  ),
  {
    exercicio: 'abdominal',
    nome: 'Abdominal remador',
    unidade: 'reps',
    direcao: 'maior',
    niveis: [18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50],
    faixas: FAIXAS_ABDOMINAL_M,
    pontos: PONTOS_ABDOMINAL_M,
    temSuficiencia: true,
    contaNaSoma: true,
  },
  geral(
    { exercicio: 'apoio', nome: 'Apoio de frente', unidade: 'reps', direcao: 'maior' },
    [2, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32],
  ),
  geral(
    { exercicio: 'corrida50', nome: 'Corrida 50 m', unidade: 'segundos', direcao: 'menor' },
    [11.3, 11.0, 10.7, 10.4, 10.1, 9.8, 9.5, 9.2, 8.9, 8.6, 8.3, 8.0, 7.7, 7.4, 7.1, 6.8, 6.5],
  ),
  geral(
    { exercicio: 'corrida2400', nome: 'Corrida 2400 m', unidade: 'segundos', direcao: 'menor' },
    [1050, 1020, 990, 960, 930, 900, 870, 840, 810, 780, 750, 720, 690, 660, 630, 600, 570],
  ),
  geral(
    { exercicio: 'natacao50', nome: 'Natação 50 m', unidade: 'segundos', direcao: 'menor', aceitaZero: true },
    [85, 85, 85, 85, 85, 85, 85, 85, 80, 70, 65, 60, 55, 50, 45, 40, 35],
    false, // "O teste de natação 50 m não possui índice de suficiência."
    false, // Por enquanto a natação não conta na pontuação; 0 = não realizada.
  ),
];

const TABELAS_FEMININO: TabelaPontos[] = [
  geral(
    { exercicio: 'barra', nome: 'Isometria na barra', unidade: 'segundos', direcao: 'maior' },
    [2, 2, 2, 2, 2, 2, 2, 2, 4, 7, 11, 15, 19, 23, 27, 31, 35],
  ),
  {
    exercicio: 'abdominal',
    nome: 'Abdominal remador',
    unidade: 'reps',
    direcao: 'maior',
    niveis: [16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48],
    faixas: FAIXAS_ABDOMINAL_F,
    pontos: PONTOS_ABDOMINAL_F,
    temSuficiencia: true,
    contaNaSoma: true,
  },
  geral(
    { exercicio: 'apoio', nome: 'Apoio de frente', unidade: 'reps', direcao: 'maior' },
    [6, 6, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34],
  ),
  geral(
    { exercicio: 'corrida50', nome: 'Corrida 50 m', unidade: 'segundos', direcao: 'menor' },
    [11.38, 11.15, 10.92, 10.69, 10.46, 10.23, 10.0, 9.77, 9.54, 9.31, 9.08, 8.85, 8.62, 8.39, 8.16, 7.93, 7.7],
  ),
  geral(
    { exercicio: 'corrida2400', nome: 'Corrida 2400 m', unidade: 'segundos', direcao: 'menor' },
    [1170, 1140, 1110, 1080, 1050, 1020, 990, 960, 930, 900, 870, 840, 810, 780, 750, 720, 690],
  ),
  geral(
    { exercicio: 'natacao50', nome: 'Natação 50 m', unidade: 'segundos', direcao: 'menor', aceitaZero: true },
    [90, 90, 90, 90, 90, 90, 90, 90, 85, 80, 70, 65, 60, 55, 50, 45, 40],
    false, // "O teste de natação 50 m não possui índice de suficiência."
    false, // Por enquanto a natação não conta na pontuação; 0 = não realizada.
  ),
];

export const TABELAS_TAF3: Record<Sexo, TabelaPontos[]> = { M: TABELAS_MASCULINO, F: TABELAS_FEMININO };

export function rotuloFaixa(t: TabelaPontos, indice: number): string {
  const max = t.faixas[indice];
  if (indice === 0) return `até ${max}`;
  const min = t.faixas[indice - 1] + 1;
  return max === Infinity ? `${min} ou mais` : `${min} a ${max}`;
}
