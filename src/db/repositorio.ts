import type { SQLiteDatabase } from 'expo-sqlite';

import type { Cargo, ExercicioId, ResultadoRegistrado, Sexo } from '../dominio/tipos';

export type Modo = 'candidato' | 'efetivo';

export interface Perfil {
  nome: string;
  sexo: Sexo;
  cargo: Cargo;
  modo: Modo;
  dataNascimento: string | null; // AAAA-MM-DD
  dataProva: string | null; // AAAA-MM-DD
}

export interface Treino {
  id: number;
  data: string; // AAAA-MM-DD
  edital: string;
  sexo: Sexo;
  cargo: Cargo;
  /** Idade na data do treino (usada no TAF-3); null em treinos de candidato antigos. */
  idade: number | null;
  observacao: string;
  resultados: ResultadoRegistrado[];
}

export type NovoTreino = Omit<Treino, 'id'>;

interface LinhaPerfil {
  nome: string;
  sexo: Sexo;
  cargo: Cargo;
  modo: Modo;
  data_nascimento: string | null;
  data_prova: string | null;
}

export async function obterPerfil(db: SQLiteDatabase): Promise<Perfil | null> {
  const p = await db.getFirstAsync<LinhaPerfil>('SELECT * FROM perfil WHERE id = 1');
  if (!p) return null;
  return {
    nome: p.nome,
    sexo: p.sexo,
    cargo: p.cargo,
    modo: p.modo,
    dataNascimento: p.data_nascimento,
    dataProva: p.data_prova,
  };
}

export async function salvarPerfil(db: SQLiteDatabase, p: Perfil): Promise<void> {
  await db.runAsync(
    `INSERT INTO perfil (id, nome, sexo, cargo, modo, data_nascimento, data_prova)
     VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       nome = excluded.nome, sexo = excluded.sexo, cargo = excluded.cargo, modo = excluded.modo,
       data_nascimento = excluded.data_nascimento, data_prova = excluded.data_prova`,
    p.nome,
    p.sexo,
    p.cargo,
    p.modo,
    p.dataNascimento,
    p.dataProva,
  );
}

export async function criarTreino(db: SQLiteDatabase, t: NovoTreino): Promise<number> {
  let id = 0;
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      'INSERT INTO treino (data, edital, sexo, cargo, idade, observacao) VALUES (?, ?, ?, ?, ?, ?)',
      t.data,
      t.edital,
      t.sexo,
      t.cargo,
      t.idade,
      t.observacao,
    );
    id = r.lastInsertRowId;
    for (const res of t.resultados) {
      await db.runAsync(
        'INSERT INTO resultado (treino_id, exercicio, valor, tentativa) VALUES (?, ?, ?, ?)',
        id,
        res.exercicio,
        res.valor,
        res.tentativa,
      );
    }
  });
  return id;
}

/** Todos os treinos com resultados, do mais recente para o mais antigo. */
export async function listarTreinos(db: SQLiteDatabase): Promise<Treino[]> {
  const treinos = await db.getAllAsync<Omit<Treino, 'resultados'>>(
    'SELECT id, data, edital, sexo, cargo, idade, observacao FROM treino ORDER BY data DESC, id DESC',
  );
  const resultados = await db.getAllAsync<ResultadoRegistrado & { treino_id: number }>(
    'SELECT treino_id, exercicio, valor, tentativa FROM resultado',
  );

  const porTreino = new Map<number, ResultadoRegistrado[]>();
  for (const { treino_id, exercicio, valor, tentativa } of resultados) {
    const lista = porTreino.get(treino_id) ?? [];
    lista.push({ exercicio: exercicio as ExercicioId, valor, tentativa });
    porTreino.set(treino_id, lista);
  }
  return treinos.map((t) => ({ ...t, resultados: porTreino.get(t.id) ?? [] }));
}

export async function excluirTreino(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM treino WHERE id = ?', id);
}
