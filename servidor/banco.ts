import { DatabaseSync } from 'node:sqlite';

export interface Conta {
  id: string;
  nome: string;
}

export interface Backup {
  /** Sobe a cada gravação: quem grava a partir de uma versão velha precisa juntar de novo. */
  versao: number;
  dados: string | null;
}

/**
 * Banco do servidor do ReadyTAF. O node:sqlite é síncrono, então cada pedido lê e grava
 * sem que outro pedido entre no meio.
 */
export class BancoSqlite {
  private db: DatabaseSync;

  constructor(caminho: string) {
    this.db = new DatabaseSync(caminho);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      -- Do Google guardamos só o identificador (sub) e o primeiro nome; nada de e-mail.
      CREATE TABLE IF NOT EXISTS conta (
        id TEXT PRIMARY KEY,
        google_sub TEXT NOT NULL UNIQUE,
        nome TEXT NOT NULL,
        criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ultimo_acesso INTEGER
      );

      -- Uma conta pode estar aberta em mais de um aparelho.
      CREATE TABLE IF NOT EXISTS sessao (
        token_hash TEXT PRIMARY KEY,
        conta_id TEXT NOT NULL REFERENCES conta (id) ON DELETE CASCADE,
        criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS sessao_conta ON sessao (conta_id);

      CREATE TABLE IF NOT EXISTS backup (
        conta_id TEXT PRIMARY KEY REFERENCES conta (id) ON DELETE CASCADE,
        versao INTEGER NOT NULL,
        dados TEXT NOT NULL,
        atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  contaPorGoogle(googleSub: string): Conta | null {
    const linha = this.db.prepare('SELECT id, nome FROM conta WHERE google_sub = ?').get(googleSub);
    return (linha as unknown as Conta | undefined) ?? null;
  }

  criarConta(id: string, googleSub: string, nome: string) {
    this.db.prepare('INSERT INTO conta (id, google_sub, nome) VALUES (?, ?, ?)').run(id, googleSub, nome);
  }

  atualizarNome(id: string, nome: string) {
    this.db.prepare('UPDATE conta SET nome = ? WHERE id = ?').run(nome, id);
  }

  contaPorToken(tokenHash: string): Conta | null {
    const linha = this.db.prepare(
      'SELECT c.id, c.nome FROM conta c JOIN sessao s ON s.conta_id = c.id WHERE s.token_hash = ?',
    ).get(tokenHash);
    return (linha as unknown as Conta | undefined) ?? null;
  }

  criarSessao(contaId: string, tokenHash: string) {
    this.db.prepare('INSERT INTO sessao (token_hash, conta_id) VALUES (?, ?)').run(tokenHash, contaId);
  }

  apagarSessao(tokenHash: string) {
    this.db.prepare('DELETE FROM sessao WHERE token_hash = ?').run(tokenHash);
  }

  registrarAcesso(contaId: string, quandoMs: number) {
    this.db.prepare('UPDATE conta SET ultimo_acesso = ? WHERE id = ?').run(quandoMs, contaId);
  }

  /** Apaga a conta, as sessões e o backup. */
  apagarConta(contaId: string) {
    this.db.prepare('DELETE FROM conta WHERE id = ?').run(contaId);
  }

  lerBackup(contaId: string): Backup {
    const linha = this.db.prepare('SELECT versao, dados FROM backup WHERE conta_id = ?').get(contaId) as
      | { versao: number; dados: string }
      | undefined;
    return linha ?? { versao: 0, dados: null };
  }

  /** Grava só se ninguém gravou desde `versaoBase`; devolve a nova versão ou null. */
  gravarBackup(contaId: string, versaoBase: number, dados: string): number | null {
    const atual = this.lerBackup(contaId).versao;
    if (atual !== versaoBase) return null;
    const nova = atual + 1;
    this.db.prepare(
      `INSERT INTO backup (conta_id, versao, dados) VALUES (?, ?, ?)
       ON CONFLICT (conta_id) DO UPDATE SET versao = excluded.versao, dados = excluded.dados,
         atualizado_em = CURRENT_TIMESTAMP`,
    ).run(contaId, nova, dados);
    return nova;
  }

  fechar() {
    this.db.close();
  }
}
