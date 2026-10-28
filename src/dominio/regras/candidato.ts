import type { Cargo, Direcao, ExercicioId, RegraMinimo, Sexo, Unidade } from '../tipos.ts';

/** Identifica a versão dos índices; fica gravada em cada treino. */
export const EDITAL_CANDIDATO = {
  id: 'candidato-2026',
  descricao: 'TAF de ingresso PMESP (índices de out/2026)',
};

interface IndicePorSexo {
  nome: string;
  unidade: Unidade;
  minimo: number;
}

interface Indice {
  exercicio: ExercicioId;
  direcao: Direcao;
  temReteste: boolean;
  somenteOficial?: boolean;
  M: IndicePorSexo;
  F: IndicePorSexo;
}

// Tempos em segundos: 8,25 s = 8.25 | 13:00 = 780 | 1:05 = 65
const INDICES: Indice[] = [
  {
    exercicio: 'barra',
    direcao: 'maior',
    temReteste: true,
    M: { nome: 'Barra fixa', unidade: 'reps', minimo: 3 },
    F: { nome: 'Barra fixa (isometria)', unidade: 'segundos', minimo: 7 },
  },
  {
    exercicio: 'abdominal',
    direcao: 'maior',
    temReteste: true,
    M: { nome: 'Abdominal remador', unidade: 'reps', minimo: 36 },
    F: { nome: 'Abdominal remador', unidade: 'reps', minimo: 32 },
  },
  {
    exercicio: 'corrida50',
    direcao: 'menor',
    temReteste: true,
    M: { nome: 'Corrida 50 m', unidade: 'segundos', minimo: 8.25 },
    F: { nome: 'Corrida 50 m', unidade: 'segundos', minimo: 9.5 },
  },
  {
    exercicio: 'corrida2400',
    direcao: 'menor',
    temReteste: false,
    M: { nome: 'Corrida 2400 m', unidade: 'segundos', minimo: 780 },
    F: { nome: 'Corrida 2400 m', unidade: 'segundos', minimo: 900 },
  },
  {
    exercicio: 'natacao50',
    direcao: 'menor',
    temReteste: true,
    somenteOficial: true,
    M: { nome: 'Natação 50 m', unidade: 'segundos', minimo: 65 },
    F: { nome: 'Natação 50 m', unidade: 'segundos', minimo: 65 },
  },
];

export function regrasCandidato(sexo: Sexo, cargo: Cargo): RegraMinimo[] {
  return INDICES.filter((i) => !i.somenteOficial || cargo === 'oficial').map((i) => ({
    exercicio: i.exercicio,
    direcao: i.direcao,
    temReteste: i.temReteste,
    ...i[sexo],
  }));
}
