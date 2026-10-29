import {
  avaliarTreino,
  prontoParaProva,
  taxaAprovacaoDePrimeira,
  tendencia,
  type AvaliacaoTreino,
  type Tendencia,
} from './avaliacao.ts';
import { idadeEm } from './datas.ts';
import { avaliarTreinoPontos, valorParaPontos, type AvaliacaoTreinoPontos } from './pontuacao.ts';
import { ehEfetivo, regrasDoTreino, TABELAS_TAF3 } from './regras/index.ts';
import { PONTOS_SUFICIENCIA, type TabelaPontos } from './regras/taf3.ts';
import type { Cargo, ExercicioId, Medida, Modo, RegraMinimo, ResultadoRegistrado, Sexo } from './tipos.ts';

/** O que o domínio precisa de um treino salvo (o Treino do repositório atende). */
export interface TreinoBase {
  id: number;
  data: string; // AAAA-MM-DD
  edital: string;
  sexo: Sexo;
  cargo: Cargo;
  idade: number | null;
  resultados: ResultadoRegistrado[];
}

interface Comum<T> {
  treino: T;
  aptoGeral: boolean;
  completo: boolean;
  /** Margem média sobre o mínimo (candidato) ou soma dos pontos (efetivo); null se nada foi feito. */
  nota: number | null;
}

export type TreinoAvaliado<T extends TreinoBase = TreinoBase> =
  | (Comum<T> & { modo: 'candidato'; av: AvaliacaoTreino })
  | (Comum<T> & { modo: 'efetivo'; av: AvaliacaoTreinoPontos });

export interface ItemHistorico<T extends TreinoBase = TreinoBase> {
  treino: T;
  modo: Modo;
  /** null: treino do efetivo sem idade conhecida (não dá para pontuar). */
  avaliado: TreinoAvaliado<T> | null;
  /** Em relação ao treino anterior do mesmo modo. */
  tendencia: Tendencia | null;
  /** Diferença da nota para o anterior (fração da margem ou pontos); positiva = melhorou. */
  variacao: number | null;
}

export const modoDoTreino = (t: { edital: string }): Modo => (ehEfetivo(t.edital) ? 'efetivo' : 'candidato');

/** Avalia um treino com as regras da época; `nascimento` cobre treinos do efetivo sem idade gravada. */
export function avaliarTreinoSalvo<T extends TreinoBase>(t: T, nascimento: string | null): TreinoAvaliado<T> | null {
  if (modoDoTreino(t) === 'candidato') {
    const av = avaliarTreino(regrasDoTreino(t), t.resultados);
    return { modo: 'candidato', treino: t, av, aptoGeral: av.aptoGeral, completo: av.completo, nota: av.indice };
  }
  const idade = t.idade ?? (nascimento ? idadeEm(nascimento, t.data) : null);
  if (idade === null) return null;
  const av = avaliarTreinoPontos(TABELAS_TAF3, idade, t.resultados);
  return {
    modo: 'efetivo',
    treino: t,
    av,
    aptoGeral: av.aptoGeral,
    completo: av.completo,
    nota: av.exercicios.length ? av.soma : null,
  };
}

/** Margem comparada em décimos de ponto percentual, para ruído de arredondamento não virar ▲▼. */
function compararNotas(modo: Modo, atual: number, anterior: number): { tendencia: Tendencia; variacao: number } {
  const escala = modo === 'candidato' ? 1000 : 1;
  const t = tendencia('maior', Math.round(atual * escala), Math.round(anterior * escala));
  return { tendencia: t, variacao: atual - anterior };
}

/** Treinos do mais recente para o mais antigo, cada um comparado ao anterior do mesmo modo. */
export function montarHistorico<T extends TreinoBase>(
  recentesPrimeiro: T[],
  nascimento: string | null,
): ItemHistorico<T>[] {
  const avaliados = recentesPrimeiro.map((t) => avaliarTreinoSalvo(t, nascimento));
  return recentesPrimeiro.map((treino, i) => {
    const modo = modoDoTreino(treino);
    const avaliado = avaliados[i];
    let comparacao: ReturnType<typeof compararNotas> | null = null;
    if (avaliado?.nota != null) {
      const anterior = avaliados.slice(i + 1).find((a) => a?.modo === modo && a.nota !== null);
      if (anterior?.nota != null) comparacao = compararNotas(modo, avaliado.nota, anterior.nota);
    }
    return {
      treino,
      modo,
      avaliado,
      tendencia: comparacao?.tendencia ?? null,
      variacao: comparacao?.variacao ?? null,
    };
  });
}

/** Avaliações de um modo, do mais recente para o mais antigo (entrada de desempenhoGeral/porExercicio). */
export function avaliadosDoModo<T extends TreinoBase>(historico: ItemHistorico<T>[], modo: Modo): TreinoAvaliado<T>[] {
  return historico.flatMap((h) => (h.avaliado && h.modo === modo ? [h.avaliado] : []));
}

export interface PontoSerie {
  data: string;
  valor: number;
}

export interface DesempenhoGeral {
  /** Nota de cada treino em ordem cronológica. */
  serie: PontoSerie[];
  aptos: number;
  total: number;
  /** Os 3 treinos mais recentes completos e aptos. */
  pronto: boolean;
  /** Quantos treinos seguidos, a partir do mais recente, foram aptos. */
  sequencia: number;
  /** Maior nota entre os treinos completos. */
  recorde: PontoSerie | null;
}

export function desempenhoGeral(recentesPrimeiro: TreinoAvaliado[]): DesempenhoGeral {
  const serie: PontoSerie[] = [];
  let recorde: PontoSerie | null = null;
  for (const a of [...recentesPrimeiro].reverse()) {
    if (a.nota === null) continue;
    const ponto = { data: a.treino.data, valor: a.nota };
    serie.push(ponto);
    if (a.completo && (!recorde || a.nota > recorde.valor)) recorde = ponto;
  }
  const sequencia = recentesPrimeiro.findIndex((a) => !a.aptoGeral);
  return {
    serie,
    aptos: recentesPrimeiro.filter((a) => a.aptoGeral).length,
    total: recentesPrimeiro.length,
    pronto: prontoParaProva(recentesPrimeiro),
    sequencia: sequencia === -1 ? recentesPrimeiro.length : sequencia,
    recorde,
  };
}

export interface MarcaExercicio extends PontoSerie {
  /** Margem sobre o mínimo (candidato) ou pontos (efetivo). */
  nota: number;
}

export interface DesempenhoExercicio {
  medida: Medida;
  /** Resultado que valeu em cada treino, em ordem cronológica. */
  serie: MarcaExercicio[];
  /** Linha de referência no gráfico: índice mínimo ou valor que dá 20 pts; null se não há. */
  referencia: number | null;
  melhor: MarcaExercicio | null;
  /** Média do valor bruto nos últimos 3 treinos em que fez o teste. */
  mediaRecente: number | null;
  /** Média da nota nos últimos 3 treinos; usada para achar o ponto fraco. */
  notaRecente: number | null;
  tendencia: Tendencia | null;
  /** Fração de aptos já na 1ª tentativa (só candidato). */
  taxaDePrimeira: number | null;
}

const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/**
 * Compara a média dos últimos k valores com a dos k anteriores,
 * k = até 3 e no máximo metade da série (2 treinos → último contra penúltimo).
 */
export function tendenciaSerie(direcao: Medida['direcao'], valores: number[]): Tendencia | null {
  const k = Math.min(3, Math.floor(valores.length / 2));
  if (k === 0) return null;
  const recentes = media(valores.slice(-k))!;
  const anteriores = media(valores.slice(-2 * k, -k))!;
  return tendencia(direcao, recentes, anteriores);
}

function montarExercicio(
  medida: Medida,
  serie: MarcaExercicio[],
  referencia: number | null,
  taxaDePrimeira: number | null,
): DesempenhoExercicio {
  const melhor = serie.reduce<MarcaExercicio | null>(
    (m, x) => (!m || (medida.direcao === 'maior' ? x.valor > m.valor : x.valor < m.valor) ? x : m),
    null,
  );
  const ultimos = serie.slice(-3);
  return {
    medida,
    serie,
    referencia,
    melhor,
    mediaRecente: media(ultimos.map((x) => x.valor)),
    notaRecente: media(ultimos.map((x) => x.nota)),
    tendencia: tendenciaSerie(
      medida.direcao,
      serie.map((x) => x.valor),
    ),
    taxaDePrimeira,
  };
}

/** Por exercício das `regras` atuais, a partir dos treinos de candidato (mais recentes primeiro). */
export function exerciciosCandidato(recentesPrimeiro: TreinoAvaliado[], regras: RegraMinimo[]): DesempenhoExercicio[] {
  const avs = recentesPrimeiro.flatMap((a) => (a.modo === 'candidato' ? [a] : [])).reverse();
  return regras.map((regra) =>
    montarExercicio(
      regra,
      avs.flatMap((a) => {
        const e = a.av.exercicios.find((x) => x.regra.exercicio === regra.exercicio);
        return e ? [{ data: a.treino.data, valor: e.final.valor, nota: e.final.margem }] : [];
      }),
      regra.minimo,
      taxaAprovacaoDePrimeira(
        avs.map((a) => a.av),
        regra.exercicio,
      ),
    ),
  );
}

/** Por teste do TAF-3; a linha de 20 pts usa a `idade` atual. */
export function exerciciosEfetivo(
  recentesPrimeiro: TreinoAvaliado[],
  idade: number,
  tabelas: TabelaPontos[] = TABELAS_TAF3,
): DesempenhoExercicio[] {
  const avs = recentesPrimeiro.flatMap((a) => (a.modo === 'efetivo' ? [a] : [])).reverse();
  return tabelas.map((tabela) =>
    montarExercicio(
      tabela,
      avs.flatMap((a) => {
        const e = a.av.exercicios.find((x) => x.tabela.exercicio === tabela.exercicio);
        return e ? [{ data: a.treino.data, valor: e.avaliacao.valor, nota: e.avaliacao.pontos }] : [];
      }),
      tabela.temSuficiencia ? valorParaPontos(tabela, idade, PONTOS_SUFICIENCIA) : null,
      null,
    ),
  );
}

/** Exercício com menor nota recente; null se menos de 2 exercícios têm dados. */
export function pontoFraco(exercicios: DesempenhoExercicio[]): ExercicioId | null {
  const comDados = exercicios.filter((e) => e.notaRecente !== null);
  if (comDados.length < 2) return null;
  return comDados.reduce((a, b) => (b.notaRecente! < a.notaRecente! ? b : a)).medida.exercicio;
}

/** Resultado que valeu em cada exercício feito no treino. */
export function marcasDoTreino(a: TreinoAvaliado): { medida: Medida; valor: number }[] {
  return a.modo === 'candidato'
    ? a.av.exercicios.map((e) => ({ medida: e.regra, valor: e.final.valor }))
    : a.av.exercicios.map((e) => ({ medida: e.tabela, valor: e.avaliacao.valor }));
}

/** ▲▼ de cada exercício feito nos dois treinos, pelo valor bruto. */
export function compararExercicios(atual: TreinoAvaliado, anterior: TreinoAvaliado): Map<ExercicioId, Tendencia> {
  const antes = new Map(marcasDoTreino(anterior).map((m) => [m.medida.exercicio, m.valor]));
  const resultado = new Map<ExercicioId, Tendencia>();
  for (const { medida, valor } of marcasDoTreino(atual)) {
    const v = antes.get(medida.exercicio);
    if (v !== undefined) resultado.set(medida.exercicio, tendencia(medida.direcao, valor, v));
  }
  return resultado;
}
