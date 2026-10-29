import { PONTOS_SUFICIENCIA, type TabelaPontos } from './regras/taf3.ts';
import type { ExercicioId, ResultadoRegistrado } from './tipos.ts';

export interface AvaliacaoPontos {
  valor: number;
  /** Índice da linha atingida (0 = primeira); -1 se nem a primeira. */
  nivel: number;
  pontos: number;
  suficiente: boolean;
  /** Próxima linha que dá mais pontos nesta faixa etária; null se já está no máximo. */
  proximo: { valor: number; pontos: number; falta: number } | null;
}

export interface AvaliacaoTreinoPontos {
  exercicios: { tabela: TabelaPontos; avaliacao: AvaliacaoPontos }[];
  pendentes: ExercicioId[];
  completo: boolean;
  /** Completo e com suficiência em todos os testes que a exigem. */
  aptoGeral: boolean;
  soma: number;
  /** Média dos pontos dos testes feitos; null se nenhum. */
  media: number | null;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

const atinge = (t: TabelaPontos, valor: number, exigido: number) =>
  t.direcao === 'maior' ? valor >= exigido : valor <= exigido;

export function faixaDaIdade(t: TabelaPontos, idade: number): number {
  return t.faixas.findIndex((max) => idade <= max);
}

/** Maior linha cujo valor exigido o resultado alcança; -1 se nenhuma. */
export function nivelAtingido(t: TabelaPontos, valor: number): number {
  let nivel = -1;
  t.niveis.forEach((exigido, i) => {
    if (atinge(t, valor, exigido)) nivel = i;
  });
  return nivel;
}

export function avaliarPontos(t: TabelaPontos, idade: number, valor: number): AvaliacaoPontos {
  const faixa = faixaDaIdade(t, idade);
  const nivel = nivelAtingido(t, valor);

  // Melhor pontuação entre as linhas alcançadas: acima da última célula preenchida
  // da faixa (ex.: 56+ a partir da linha 11) continua valendo 100.
  let pontos = 0;
  for (let i = 0; i <= nivel; i++) pontos = Math.max(pontos, t.pontos[i][faixa] ?? 0);

  let proximo: AvaliacaoPontos['proximo'] = null;
  for (let i = nivel + 1; i < t.niveis.length; i++) {
    const p = t.pontos[i][faixa];
    if (p !== null && p > pontos) {
      const exigido = t.niveis[i];
      proximo = { valor: exigido, pontos: p, falta: arredondar(Math.abs(exigido - valor)) };
      break;
    }
  }

  return { valor, nivel, pontos, suficiente: !t.temSuficiencia || pontos >= PONTOS_SUFICIENCIA, proximo };
}

/** Valor que dá ao menos `pontos` nesta idade; null se a faixa não chega lá. */
export function valorParaPontos(t: TabelaPontos, idade: number, pontos: number): number | null {
  const faixa = faixaDaIdade(t, idade);
  const i = t.pontos.findIndex((linha) => (linha[faixa] ?? -1) >= pontos);
  return i === -1 ? null : t.niveis[i];
}

/** Avalia só a 1ª tentativa de cada teste (o TAF-3 não prevê reteste). */
export function avaliarTreinoPontos(
  tabelas: TabelaPontos[],
  idade: number,
  resultados: ResultadoRegistrado[],
): AvaliacaoTreinoPontos {
  const exercicios: AvaliacaoTreinoPontos['exercicios'] = [];
  const pendentes: ExercicioId[] = [];
  for (const tabela of tabelas) {
    const r = resultados.find((x) => x.exercicio === tabela.exercicio && x.tentativa === 1);
    if (r) exercicios.push({ tabela, avaliacao: avaliarPontos(tabela, idade, r.valor) });
    else pendentes.push(tabela.exercicio);
  }

  const soma = exercicios.reduce((s, e) => s + e.avaliacao.pontos, 0);
  const completo = pendentes.length === 0;
  return {
    exercicios,
    pendentes,
    completo,
    aptoGeral: completo && exercicios.every((e) => e.avaliacao.suficiente),
    soma,
    media: exercicios.length ? soma / exercicios.length : null,
  };
}
