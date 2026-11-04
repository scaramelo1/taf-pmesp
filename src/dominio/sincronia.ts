// Backup na nuvem: o aparelho e o servidor guardam uma cópia de tudo e as duas são juntadas.
// Funções puras: o app e o servidor usam as mesmas regras.
import type { Cargo, ExercicioId, Modo, ResultadoRegistrado, Sexo } from './tipos.ts';

export interface PerfilCopia {
  nome: string;
  sexo: Sexo;
  cargo: Cargo;
  modo: Modo;
  dataNascimento: string | null;
  dataProva: string | null;
  /** Data e hora ISO da última alteração: decide qual perfil vale quando os dois mudaram. */
  atualizadoEm: string;
}

export interface TreinoCopia {
  /** Identificador do treino em qualquer aparelho; o id numérico é só do banco local. */
  uid: string;
  data: string;
  edital: string;
  sexo: Sexo;
  cargo: Cargo;
  idade: number | null;
  observacao: string;
  criadoEm: string;
  resultados: ResultadoRegistrado[];
}

export interface CopiaDados {
  perfil: PerfilCopia | null;
  treinos: TreinoCopia[];
  /** Treinos excluídos: impedem que outro aparelho os traga de volta. */
  excluidos: string[];
}

export const COPIA_VAZIA: CopiaDados = { perfil: null, treinos: [], excluidos: [] };

export const LIMITES = { treinos: 10_000, excluidos: 20_000, resultados: 20, texto: 2_000 };

const EXERCICIOS: readonly ExercicioId[] = ['barra', 'abdominal', 'apoio', 'corrida50', 'corrida2400', 'natacao50'];
const UID = /^[A-Za-z0-9_-]{8,64}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Junta duas cópias: soma os treinos, aplica as exclusões dos dois lados e fica com o perfil mais novo. */
export function mesclar(a: CopiaDados, b: CopiaDados): CopiaDados {
  const excluidos = [...new Set([...a.excluidos, ...b.excluidos])].sort();
  const fora = new Set(excluidos);
  const porUid = new Map<string, TreinoCopia>();
  // Treinos não são editados, então o mesmo uid é o mesmo treino nos dois lados.
  for (const t of [...a.treinos, ...b.treinos]) if (!fora.has(t.uid) && !porUid.has(t.uid)) porUid.set(t.uid, t);
  const treinos = [...porUid.values()].sort((x, y) => x.uid.localeCompare(y.uid));

  let perfil = a.perfil ?? b.perfil;
  if (a.perfil && b.perfil && b.perfil.atualizadoEm > a.perfil.atualizadoEm) perfil = b.perfil;
  return { perfil, treinos, excluidos };
}

/** Compara pelo conteúdo, sem depender da ordem dos treinos. */
export function mesmaCopia(a: CopiaDados, b: CopiaDados): boolean {
  const normalizar = (c: CopiaDados) => JSON.stringify(mesclar(c, COPIA_VAZIA));
  return normalizar(a) === normalizar(b);
}

const texto = (v: unknown, max = 40): v is string => typeof v === 'string' && v.length <= max;
const dataOuNulo = (v: unknown) => v === null || (typeof v === 'string' && DATA.test(v));
const umDe = <T extends string>(v: unknown, opcoes: readonly T[]): v is T => opcoes.includes(v as T);
const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function lerPerfil(v: unknown): PerfilCopia | null | undefined {
  if (v === null) return null;
  if (!objeto(v)) return undefined;
  const { nome, sexo, cargo, modo, dataNascimento, dataProva, atualizadoEm } = v;
  if (!texto(nome, 100) || !umDe(sexo, ['M', 'F'] as const) || !umDe(cargo, ['soldado', 'oficial'] as const)
    || !umDe(modo, ['candidato', 'efetivo'] as const) || !dataOuNulo(dataNascimento) || !dataOuNulo(dataProva)
    || !texto(atualizadoEm) || !atualizadoEm) return undefined;
  return {
    nome, sexo, cargo, modo,
    dataNascimento: dataNascimento as string | null,
    dataProva: dataProva as string | null,
    atualizadoEm,
  };
}

function lerResultado(v: unknown): ResultadoRegistrado | undefined {
  if (!objeto(v)) return undefined;
  const { exercicio, valor, tentativa } = v;
  if (!umDe(exercicio, EXERCICIOS) || typeof valor !== 'number' || !Number.isFinite(valor)
    || (tentativa !== 1 && tentativa !== 2)) return undefined;
  return { exercicio, valor, tentativa };
}

function lerTreino(v: unknown): TreinoCopia | undefined {
  if (!objeto(v)) return undefined;
  const { uid, data, edital, sexo, cargo, idade, observacao, criadoEm, resultados } = v;
  if (!texto(uid, 64) || !UID.test(uid) || !texto(data) || !DATA.test(data) || !texto(edital)
    || !umDe(sexo, ['M', 'F'] as const) || !umDe(cargo, ['soldado', 'oficial'] as const)
    || !(idade === null || (Number.isInteger(idade) && (idade as number) >= 0 && (idade as number) <= 120))
    || !texto(observacao, LIMITES.texto) || !texto(criadoEm) || !Array.isArray(resultados)
    || resultados.length > LIMITES.resultados) return undefined;
  const lidos = resultados.map(lerResultado);
  if (lidos.some((r) => !r)) return undefined;
  return {
    uid, data, edital, sexo, cargo, observacao, criadoEm,
    idade: idade as number | null,
    resultados: lidos as ResultadoRegistrado[],
  };
}

/** Confere uma cópia vinda de fora (do app ou do servidor); null se algo estiver fora do formato. */
export function validarCopia(v: unknown): CopiaDados | null {
  if (!objeto(v) || !Array.isArray(v.treinos) || !Array.isArray(v.excluidos)) return null;
  if (v.treinos.length > LIMITES.treinos || v.excluidos.length > LIMITES.excluidos) return null;
  const perfil = lerPerfil(v.perfil ?? null);
  if (perfil === undefined) return null;
  const treinos = v.treinos.map(lerTreino);
  if (treinos.some((t) => !t)) return null;
  if (!v.excluidos.every((u) => texto(u, 64) && UID.test(u))) return null;
  return { perfil, treinos: treinos as TreinoCopia[], excluidos: v.excluidos as string[] };
}
