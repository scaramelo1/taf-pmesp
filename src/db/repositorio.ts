import type { SQLiteDatabase } from 'expo-sqlite';

import type { CopiaDados, TreinoCopia } from '../dominio/sincronia';
import type { Cargo, ExercicioId, Modo, ResultadoRegistrado, Sexo } from '../dominio/tipos';

export type { Modo };

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
  atualizado_em: string;
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

/** `atualizadoEm` só vem do backup; quem edita no aparelho grava a hora atual. */
export async function salvarPerfil(db: SQLiteDatabase, p: Perfil, atualizadoEm = new Date().toISOString()): Promise<void> {
  await db.runAsync(
    `INSERT INTO perfil (id, nome, sexo, cargo, modo, data_nascimento, data_prova, atualizado_em)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       nome = excluded.nome, sexo = excluded.sexo, cargo = excluded.cargo, modo = excluded.modo,
       data_nascimento = excluded.data_nascimento, data_prova = excluded.data_prova,
       atualizado_em = excluded.atualizado_em`,
    p.nome,
    p.sexo,
    p.cargo,
    p.modo,
    p.dataNascimento,
    p.dataProva,
    atualizadoEm,
  );
}

export async function criarTreino(db: SQLiteDatabase, t: NovoTreino): Promise<number> {
  let id = 0;
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      `INSERT INTO treino (uid, data, edital, sexo, cargo, idade, observacao)
       VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)`,
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

/** A exclusão fica anotada para o treino não voltar pelo backup de outro aparelho. */
export async function excluirTreino(db: SQLiteDatabase, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT OR IGNORE INTO treino_excluido (uid) SELECT uid FROM treino WHERE id = ?', id);
    await db.runAsync('DELETE FROM treino WHERE id = ?', id);
  });
}

// ---- Backup na nuvem ----

/** Tudo o que vai para o backup: perfil, treinos e exclusões. */
export async function lerCopia(db: SQLiteDatabase): Promise<CopiaDados> {
  const perfil = await db.getFirstAsync<LinhaPerfil>('SELECT * FROM perfil WHERE id = 1');
  const treinos = await db.getAllAsync<Omit<TreinoCopia, 'resultados'> & { id: number }>(
    'SELECT id, uid, data, edital, sexo, cargo, idade, observacao, criado_em AS criadoEm FROM treino',
  );
  const resultados = await db.getAllAsync<ResultadoRegistrado & { treino_id: number }>(
    'SELECT treino_id, exercicio, valor, tentativa FROM resultado',
  );
  const excluidos = await db.getAllAsync<{ uid: string }>('SELECT uid FROM treino_excluido');

  const porTreino = new Map<number, ResultadoRegistrado[]>();
  for (const { treino_id, exercicio, valor, tentativa } of resultados) {
    const lista = porTreino.get(treino_id) ?? [];
    lista.push({ exercicio, valor, tentativa });
    porTreino.set(treino_id, lista);
  }
  return {
    perfil: perfil && {
      nome: perfil.nome,
      sexo: perfil.sexo,
      cargo: perfil.cargo,
      modo: perfil.modo,
      dataNascimento: perfil.data_nascimento,
      dataProva: perfil.data_prova,
      atualizadoEm: perfil.atualizado_em,
    },
    treinos: treinos.map(({ id, ...t }) => ({ ...t, resultados: porTreino.get(id) ?? [] })),
    excluidos: excluidos.map((e) => e.uid),
  };
}

/**
 * Grava no aparelho o que veio do backup. Só acrescenta e exclui: um treino criado
 * aqui enquanto a sincronização rodava não se perde.
 */
export async function aplicarCopia(db: SQLiteDatabase, copia: CopiaDados): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const uid of copia.excluidos) {
      await db.runAsync('INSERT OR IGNORE INTO treino_excluido (uid) VALUES (?)', uid);
      await db.runAsync('DELETE FROM treino WHERE uid = ?', uid);
    }
    for (const t of copia.treinos) {
      const r = await db.runAsync(
        `INSERT OR IGNORE INTO treino (uid, data, edital, sexo, cargo, idade, observacao, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        t.uid,
        t.data,
        t.edital,
        t.sexo,
        t.cargo,
        t.idade,
        t.observacao,
        t.criadoEm,
      );
      if (r.changes === 0) continue;
      for (const res of t.resultados) {
        await db.runAsync(
          'INSERT INTO resultado (treino_id, exercicio, valor, tentativa) VALUES (?, ?, ?, ?)',
          r.lastInsertRowId,
          res.exercicio,
          res.valor,
          res.tentativa,
        );
      }
    }
    if (copia.perfil) {
      const atual = await db.getFirstAsync<{ atualizado_em: string }>('SELECT atualizado_em FROM perfil WHERE id = 1');
      if (!atual || copia.perfil.atualizadoEm > atual.atualizado_em) {
        const { atualizadoEm, ...perfil } = copia.perfil;
        await salvarPerfil(db, perfil, atualizadoEm);
      }
    }
  });
}

/** Ao sair da conta: o próximo a entrar neste aparelho não herda os treinos de quem saiu. */
export async function apagarDadosLocais(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM resultado; DELETE FROM treino; DELETE FROM treino_excluido; DELETE FROM perfil;');
  });
}

export async function lerConfig(db: SQLiteDatabase, chave: string): Promise<string | null> {
  const linha = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM config WHERE chave = ?', chave);
  return linha?.valor ?? null;
}

export async function salvarConfig(db: SQLiteDatabase, chave: string, valor: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor',
    chave,
    valor,
  );
}

export async function apagarConfig(db: SQLiteDatabase, chave: string): Promise<void> {
  await db.runAsync('DELETE FROM config WHERE chave = ?', chave);
}
