import type { SQLiteDatabase } from 'expo-sqlite';

const VERSAO_ATUAL = 2;

/** Passado como onInit do SQLiteProvider; roda a cada abertura do banco. */
export async function migrar(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON');

  const linha = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const versao = linha?.user_version ?? 0;
  if (versao >= VERSAO_ATUAL) return;

  if (versao < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE perfil (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        nome TEXT NOT NULL DEFAULT '',
        sexo TEXT NOT NULL CHECK (sexo IN ('M', 'F')),
        cargo TEXT NOT NULL CHECK (cargo IN ('soldado', 'oficial')),
        modo TEXT NOT NULL DEFAULT 'candidato' CHECK (modo IN ('candidato', 'efetivo')),
        data_nascimento TEXT,
        data_prova TEXT
      );

      -- sexo/cargo/edital ficam gravados no treino para ele ser sempre
      -- avaliado com as regras da época, mesmo se o perfil mudar.
      CREATE TABLE treino (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        edital TEXT NOT NULL,
        sexo TEXT NOT NULL,
        cargo TEXT NOT NULL,
        observacao TEXT NOT NULL DEFAULT '',
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_treino_data ON treino (data);

      CREATE TABLE resultado (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        treino_id INTEGER NOT NULL REFERENCES treino (id) ON DELETE CASCADE,
        exercicio TEXT NOT NULL,
        valor REAL NOT NULL,
        tentativa INTEGER NOT NULL DEFAULT 1 CHECK (tentativa IN (1, 2)),
        UNIQUE (treino_id, exercicio, tentativa)
      );
    `);
  }

  if (versao < 2) {
    // Idade na data do treino: define a faixa etária da tabela do TAF-3.
    await db.execAsync('ALTER TABLE treino ADD COLUMN idade INTEGER');
  }

  await db.execAsync(`PRAGMA user_version = ${VERSAO_ATUAL}`);
}
