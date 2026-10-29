import { descreverDiferenca } from './formato.ts';
import { PONTOS_MINIMOS_TOTAL, PONTOS_SUFICIENCIA, type TabelaPontos } from './regras/taf3.ts';
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
  /** Completo, com suficiência em todos os testes que a exigem e soma ≥ mínimo. */
  aptoGeral: boolean;
  soma: number;
  /** Pontos que faltam para a soma mínima (0 se já atingiu). */
  faltaTotal: number;
  /** Média dos pontos dos testes feitos que contam na soma; null se nenhum. */
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
  // Tempo 0 (natação não realizada) não alcança nenhuma linha.
  const nivel = t.direcao === 'menor' && valor <= 0 ? -1 : nivelAtingido(t, valor);

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

/** "faltam 2 reps p/ 50 pts", "pontuação máxima" ou, fora da soma, se a natação foi feita. */
export function descreverPontos(t: TabelaPontos, av: AvaliacaoPontos): string {
  if (!t.contaNaSoma) return av.valor === 0 ? 'não realizada' : 'não conta na pontuação';
  return av.proximo ? `${descreverDiferenca(t, -av.proximo.falta)} p/ ${av.proximo.pontos} pts` : 'pontuação máxima';
}

/** Testes que entram na soma do TAF-3. */
export const testesQueContam = (tabelas: TabelaPontos[]) => tabelas.filter((t) => t.contaNaSoma).length;

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
    else if (tabela.contaNaSoma) pendentes.push(tabela.exercicio);
  }

  const contam = exercicios.filter((e) => e.tabela.contaNaSoma);
  const soma = contam.reduce((s, e) => s + e.avaliacao.pontos, 0);
  const completo = pendentes.length === 0;
  const faltaTotal = Math.max(0, PONTOS_MINIMOS_TOTAL - soma);
  return {
    exercicios,
    pendentes,
    completo,
    aptoGeral: completo && faltaTotal === 0 && contam.every((e) => e.avaliacao.suficiente),
    soma,
    faltaTotal,
    media: contam.length ? soma / contam.length : null,
  };
}
