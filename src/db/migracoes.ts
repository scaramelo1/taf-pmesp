import type { SQLiteDatabase } from 'expo-sqlite';

const VERSAO_ATUAL = 3;

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

  if (versao < 3) {
    // Backup na nuvem: uid identifica o treino em qualquer aparelho, e as exclusões
    // ficam anotadas para o treino não voltar pelo backup.
    // Numa transação só, com a versão junto: se o app fechar no meio, nada fica pela metade.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
      ALTER TABLE treino ADD COLUMN uid TEXT;
      UPDATE treino SET uid = lower(hex(randomblob(16))) WHERE uid IS NULL;
      CREATE UNIQUE INDEX idx_treino_uid ON treino (uid);

      -- Perfil antigo recebe uma data antiga: qualquer alteração feita depois vale mais que ele.
      ALTER TABLE perfil ADD COLUMN atualizado_em TEXT NOT NULL DEFAULT '2000-01-01T00:00:00.000Z';

      CREATE TABLE treino_excluido (uid TEXT PRIMARY KEY);

      -- Sessão da conta e outras preferências do aparelho.
      CREATE TABLE config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);

      PRAGMA user_version = 3;
      `);
    });
  }

  await db.execAsync(`PRAGMA user_version = ${VERSAO_ATUAL}`);
}
