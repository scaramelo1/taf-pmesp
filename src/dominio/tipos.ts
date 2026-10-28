export type Sexo = 'M' | 'F';
export type Cargo = 'soldado' | 'oficial';
export type Unidade = 'reps' | 'segundos';
/** 'maior': quanto mais, melhor (repetições). 'menor': quanto menos, melhor (tempo). */
export type Direcao = 'maior' | 'menor';
export type ExercicioId = 'barra' | 'abdominal' | 'corrida50' | 'corrida2400' | 'natacao50';

export interface RegraMinimo {
  exercicio: ExercicioId;
  nome: string;
  unidade: Unidade;
  direcao: Direcao;
  minimo: number;
  temReteste: boolean;
}

export interface ResultadoRegistrado {
  exercicio: ExercicioId;
  valor: number;
  tentativa: 1 | 2;
}
