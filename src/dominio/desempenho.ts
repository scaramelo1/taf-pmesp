import {
  avaliarTreino,
  prontoParaProva,
  taxaAprovacaoDePrimeira,
  tendencia as compararTendencia,
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
  /**
   * Completo: nota comparada ao completo anterior do mesmo modo.
   * Avulso de um teste só: aquele teste comparado à última vez em que foi feito.
   */
  tendencia: Tendencia | null;
  /** Diferença da nota para o completo anterior (fração da margem ou pontos); positiva = melhorou. */
  variacao: number | null;
  /** Treino usado na comparação acima. */
  comparadoCom: T | null;
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
  const t = compararTendencia('maior', Math.round(atual * escala), Math.round(anterior * escala));
  return { tendencia: t, variacao: atual - anterior };
}

/**
 * Treinos do mais recente para o mais antigo. Um completo é comparado ao completo anterior
 * do mesmo modo; um avulso (só alguns testes) não entra na nota geral, porque somar 1 teste
 * contra 5 não diz nada.
 */
export function montarHistorico<T extends TreinoBase>(
  recentesPrimeiro: T[],
  nascimento: string | null,
): ItemHistorico<T>[] {
  const avaliados = recentesPrimeiro.map((t) => avaliarTreinoSalvo(t, nascimento));
  return recentesPrimeiro.map((treino, i) => {
    const modo = modoDoTreino(treino);
    const avaliado = avaliados[i];
    const anteriores = avaliados.slice(i + 1).filter((a): a is TreinoAvaliado<T> => a?.modo === modo);
    let tendencia: Tendencia | null = null;
    let variacao: number | null = null;
    let comparadoCom: T | null = null;

    if (avaliado?.completo && avaliado.nota !== null) {
      const anterior = anteriores.find((a) => a.completo && a.nota !== null);
      if (anterior) {
        ({ tendencia, variacao } = compararNotas(modo, avaliado.nota, anterior.nota!));
        comparadoCom = anterior.treino;
      }
    } else if (avaliado) {
      const marcas = marcasDoTreino(avaliado);
      if (marcas.length === 1) {
        const { medida, valor } = marcas[0];
        const anterior = anteriores.find((a) => marcasDoTreino(a).some((m) => m.medida.exercicio === medida.exercicio));
        if (anterior) {
          const antes = marcasDoTreino(anterior).find((m) => m.medida.exercicio === medida.exercicio)!;
          tendencia = compararTendencia(medida.direcao, valor, antes.valor);
          comparadoCom = anterior.treino;
        }
      }
    }
    return { treino, modo, avaliado, tendencia, variacao, comparadoCom };
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
  /** Nota de cada treino completo em ordem cronológica. */
  serie: PontoSerie[];
  /** Treinos completos aptos / treinos completos. */
  aptos: number;
  total: number;
  /** Treinos com só alguns testes (ficam de fora da nota geral). */
  avulsos: number;
  /** Os 3 treinos completos mais recentes aptos. */
  pronto: boolean;
  /** Quantos treinos completos seguidos, a partir do mais recente, foram aptos. */
  sequencia: number;
  /** Maior nota entre os treinos completos. */
  recorde: PontoSerie | null;
}

export function desempenhoGeral(recentesPrimeiro: TreinoAvaliado[]): DesempenhoGeral {
  // Treino avulso não quebra a sequência nem puxa a curva geral para baixo.
  const completos = recentesPrimeiro.filter((a) => a.completo);
  const serie: PontoSerie[] = [];
  let recorde: PontoSerie | null = null;
  for (const a of [...completos].reverse()) {
    if (a.nota === null) continue;
    const ponto = { data: a.treino.data, valor: a.nota };
    serie.push(ponto);
    if (!recorde || a.nota > recorde.valor) recorde = ponto;
  }
  const sequencia = completos.findIndex((a) => !a.aptoGeral);
  return {
    serie,
    aptos: completos.filter((a) => a.aptoGeral).length,
    total: completos.length,
    avulsos: recentesPrimeiro.length - completos.length,
    pronto: prontoParaProva(completos),
    sequencia: sequencia === -1 ? completos.length : sequencia,
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
  /** false: teste fora da pontuação (natação do TAF-3); não vira ponto fraco. */
  contaNaNota: boolean;
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
  return compararTendencia(direcao, recentes, anteriores);
}

function montarExercicio(
  medida: Medida,
  serie: MarcaExercicio[],
  referencia: number | null,
  taxaDePrimeira: number | null,
  contaNaNota = true,
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
    contaNaNota,
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

/** Tempo 0 marca teste não realizado (só onde a medida aceita zero). */
export const realizado = (m: Medida, valor: number) => !(m.aceitaZero && valor === 0);

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
        return e && realizado(e.tabela, e.avaliacao.valor)
          ? [{ data: a.treino.data, valor: e.avaliacao.valor, nota: e.avaliacao.pontos }]
          : [];
      }),
      tabela.temSuficiencia ? valorParaPontos(tabela, idade, PONTOS_SUFICIENCIA) : null,
      null,
      tabela.contaNaSoma,
    ),
  );
}

/** Exercício com menor nota recente; null se menos de 2 exercícios têm dados. */
export function pontoFraco(exercicios: DesempenhoExercicio[]): ExercicioId | null {
  const comDados = exercicios.filter((e) => e.contaNaNota && e.notaRecente !== null);
  if (comDados.length < 2) return null;
  return comDados.reduce((a, b) => (b.notaRecente! < a.notaRecente! ? b : a)).medida.exercicio;
}

/** Resultado que valeu em cada exercício feito no treino. */
export function marcasDoTreino(a: TreinoAvaliado): { medida: Medida; valor: number }[] {
  return a.modo === 'candidato'
    ? a.av.exercicios.map((e) => ({ medida: e.regra, valor: e.final.valor }))
    : a.av.exercicios.flatMap((e) =>
        realizado(e.tabela, e.avaliacao.valor) ? [{ medida: e.tabela, valor: e.avaliacao.valor }] : [],
      );
}

/** ▲▼ de cada exercício do treino contra a última vez em que ele foi feito (`anteriores`: mais recentes primeiro). */
export function compararComAnteriores(atual: TreinoAvaliado, anteriores: TreinoAvaliado[]): Map<ExercicioId, Tendencia> {
  const resultado = new Map<ExercicioId, Tendencia>();
  for (const { medida, valor } of marcasDoTreino(atual)) {
    for (const a of anteriores) {
      const antes = marcasDoTreino(a).find((m) => m.medida.exercicio === medida.exercicio);
      if (antes) {
        resultado.set(medida.exercicio, compararTendencia(medida.direcao, valor, antes.valor));
        break;
      }
    }
  }
  return resultado;
}

/** ▲▼ de cada exercício feito nos dois treinos, pelo valor bruto. */
export function compararExercicios(atual: TreinoAvaliado, anterior: TreinoAvaliado): Map<ExercicioId, Tendencia> {
  const antes = new Map(marcasDoTreino(anterior).map((m) => [m.medida.exercicio, m.valor]));
  const resultado = new Map<ExercicioId, Tendencia>();
  for (const { medida, valor } of marcasDoTreino(atual)) {
    const v = antes.get(medida.exercicio);
    if (v !== undefined) resultado.set(medida.exercicio, compararTendencia(medida.direcao, valor, v));
  }
  return resultado;
}
