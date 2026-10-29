import type { Direcao, ExercicioId, RegraMinimo, ResultadoRegistrado } from './tipos.ts';

/** Teto da margem no índice geral, para um teste muito forte não esconder um fraco. */
export const LIMITE_MARGEM = 0.2;

export interface AvaliacaoTentativa {
  valor: number;
  apto: boolean;
  /** Positiva = sobra, negativa = falta (na unidade do exercício). */
  diferenca: number;
  /** diferenca / mínimo. Ex.: 0.11 = 11% acima do mínimo. */
  margem: number;
}

export interface AvaliacaoExercicio {
  regra: RegraMinimo;
  primeira: AvaliacaoTentativa;
  reteste?: AvaliacaoTentativa;
  /** A tentativa que vale: o reteste, se houve, senão a primeira. */
  final: AvaliacaoTentativa;
  apto: boolean;
  aptoDePrimeira: boolean;
}

export interface AvaliacaoTreino {
  exercicios: AvaliacaoExercicio[];
  aptos: number;
  avaliados: number;
  pendentes: ExercicioId[];
  completo: boolean;
  aptoGeral: boolean;
  /** Média das margens limitadas; null se nenhum exercício foi feito. */
  indice: number | null;
}

export type Tendencia = 'melhorou' | 'piorou' | 'manteve';

export interface ComparacaoExercicio {
  exercicio: ExercicioId;
  tendencia: Tendencia;
  /** Variação do valor no sentido "bom": positiva = melhorou. */
  variacao: number;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

export function avaliarValor(regra: RegraMinimo, valor: number): AvaliacaoTentativa {
  const diferenca = arredondar(regra.direcao === 'maior' ? valor - regra.minimo : regra.minimo - valor);
  return { valor, apto: diferenca >= 0, diferenca, margem: diferenca / regra.minimo };
}

export function avaliarExercicio(
  regra: RegraMinimo,
  resultados: ResultadoRegistrado[],
): AvaliacaoExercicio | null {
  const tentativas = resultados
    .filter((r) => r.exercicio === regra.exercicio)
    .sort((a, b) => a.tentativa - b.tentativa);
  if (tentativas.length === 0) return null;

  const primeira = avaliarValor(regra, tentativas[0].valor);
  const segunda = tentativas[1];
  const reteste =
    !primeira.apto && regra.temReteste && segunda ? avaliarValor(regra, segunda.valor) : undefined;
  const final = reteste ?? primeira;

  return { regra, primeira, reteste, final, apto: final.apto, aptoDePrimeira: primeira.apto };
}

export function avaliarTreino(regras: RegraMinimo[], resultados: ResultadoRegistrado[]): AvaliacaoTreino {
  const exercicios: AvaliacaoExercicio[] = [];
  const pendentes: ExercicioId[] = [];
  for (const regra of regras) {
    const av = avaliarExercicio(regra, resultados);
    if (av) exercicios.push(av);
    else pendentes.push(regra.exercicio);
  }

  const aptos = exercicios.filter((e) => e.apto).length;
  const completo = pendentes.length === 0;
  const indice =
    exercicios.length === 0
      ? null
      : exercicios.reduce((s, e) => s + Math.max(-1, Math.min(LIMITE_MARGEM, e.final.margem)), 0) /
        exercicios.length;

  return {
    exercicios,
    aptos,
    avaliados: exercicios.length,
    pendentes,
    completo,
    aptoGeral: completo && aptos === exercicios.length,
    indice,
  };
}

export function tendencia(direcao: Direcao, atual: number, anterior: number): Tendencia {
  const variacao = arredondar(direcao === 'maior' ? atual - anterior : anterior - atual);
  return variacao > 0 ? 'melhorou' : variacao < 0 ? 'piorou' : 'manteve';
}

/** Compara exercício a exercício (só os feitos nos dois treinos) e o índice geral. */
export function compararTreinos(
  atual: AvaliacaoTreino,
  anterior: AvaliacaoTreino,
): { exercicios: ComparacaoExercicio[]; indice: Tendencia | null } {
  const exercicios: ComparacaoExercicio[] = [];
  for (const a of atual.exercicios) {
    const b = anterior.exercicios.find((e) => e.regra.exercicio === a.regra.exercicio);
    if (!b) continue;
    const { direcao } = a.regra;
    exercicios.push({
      exercicio: a.regra.exercicio,
      tendencia: tendencia(direcao, a.final.valor, b.final.valor),
      variacao: arredondar(direcao === 'maior' ? a.final.valor - b.final.valor : b.final.valor - a.final.valor),
    });
  }

  const indice =
    atual.indice === null || anterior.indice === null
      ? null
      : tendencia('maior', Math.round(atual.indice * 1000), Math.round(anterior.indice * 1000));

  return { exercicios, indice };
}

/** Pronto quando os últimos `n` treinos (do mais recente) foram completos e todos aptos. */
export function prontoParaProva(avaliacoesRecentesPrimeiro: Pick<AvaliacaoTreino, 'aptoGeral'>[], n = 3): boolean {
  const ultimos = avaliacoesRecentesPrimeiro.slice(0, n);
  return ultimos.length === n && ultimos.every((a) => a.aptoGeral);
}

/** Fração das vezes em que o exercício foi apto já na primeira tentativa; null se nunca foi feito. */
export function taxaAprovacaoDePrimeira(avaliacoes: AvaliacaoTreino[], exercicio: ExercicioId): number | null {
  const feitos = avaliacoes.flatMap((a) => a.exercicios.filter((e) => e.regra.exercicio === exercicio));
  if (feitos.length === 0) return null;
  return feitos.filter((e) => e.aptoDePrimeira).length / feitos.length;
}
