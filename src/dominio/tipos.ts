export type Sexo = 'M' | 'F';
export type Cargo = 'soldado' | 'oficial';
export type Unidade = 'reps' | 'segundos';
/** 'maior': quanto mais, melhor (repetições). 'menor': quanto menos, melhor (tempo). */
export type Direcao = 'maior' | 'menor';
export type ExercicioId = 'barra' | 'abdominal' | 'apoio' | 'corrida50' | 'corrida2400' | 'natacao50';

/** O que é medido em um exercício: base comum às regras de candidato e às tabelas do efetivo. */
export interface Medida {
  exercicio: ExercicioId;
  nome: string;
  unidade: Unidade;
  direcao: Direcao;
}

export interface RegraMinimo extends Medida {
  minimo: number;
  temReteste: boolean;
}

export interface ResultadoRegistrado {
  exercicio: ExercicioId;
  valor: number;
  tentativa: 1 | 2;
}
