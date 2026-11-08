import { DatabaseSync } from 'node:sqlite';

export interface Conta {
  id: string;
  nome: string;
  nomeCompleto: string | null;
  email: string | null;
  foto: string | null;
}

export interface DadosGoogle {
  nome: string;
  nomeCompleto: string;
  email: string | null;
  foto: string | null;
}

/** Uma linha por conta para a página de admin, com o backup cru. */
export interface ContaAdmin {
  id: string;
  nome: string;
  nomeCompleto: string | null;
  email: string | null;
  foto: string | null;
  criadaEm: string;
  ultimoAcesso: number | null;
  sessoes: number;
  dados: string | null;
  backupEm: string | null;
}

const CAMPOS_CONTA = 'c.id, c.nome, c.nome_completo AS nomeCompleto, c.email, c.foto';

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

      -- Do Google guardamos o identificador (sub), o nome, o e-mail e o endereço da foto.
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
    // Contas criadas antes de o app pedir e-mail e foto.
    const colunas = new Set(
      (this.db.prepare('PRAGMA table_info(conta)').all() as { name: string }[]).map((c) => c.name),
    );
    for (const coluna of ['nome_completo', 'email', 'foto']) {
      if (!colunas.has(coluna)) this.db.exec(`ALTER TABLE conta ADD COLUMN ${coluna} TEXT`);
    }
  }

  contaPorGoogle(googleSub: string): Conta | null {
    const linha = this.db.prepare(`SELECT ${CAMPOS_CONTA} FROM conta c WHERE c.google_sub = ?`).get(googleSub);
    return (linha as unknown as Conta | undefined) ?? null;
  }

  criarConta(id: string, googleSub: string, g: DadosGoogle) {
    this.db.prepare('INSERT INTO conta (id, google_sub, nome, nome_completo, email, foto) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, googleSub, g.nome, g.nomeCompleto, g.email, g.foto);
  }

  /** A cada login traz o que mudou na conta Google (nome, e-mail, foto). */
  atualizarGoogle(id: string, g: DadosGoogle) {
    this.db.prepare('UPDATE conta SET nome = ?, nome_completo = ?, email = ?, foto = ? WHERE id = ?')
      .run(g.nome, g.nomeCompleto, g.email, g.foto, id);
  }

  contaPorToken(tokenHash: string): Conta | null {
    const linha = this.db.prepare(
      `SELECT ${CAMPOS_CONTA} FROM conta c JOIN sessao s ON s.conta_id = c.id WHERE s.token_hash = ?`,
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

  /** Todas as contas com o backup, para a página de admin. */
  contasParaAdmin(): ContaAdmin[] {
    return this.db.prepare(
      `SELECT ${CAMPOS_CONTA}, c.criada_em AS criadaEm, c.ultimo_acesso AS ultimoAcesso,
         (SELECT COUNT(*) FROM sessao s WHERE s.conta_id = c.id) AS sessoes,
         b.dados, b.atualizado_em AS backupEm
       FROM conta c LEFT JOIN backup b ON b.conta_id = c.id
       ORDER BY c.criada_em`,
    ).all() as unknown as ContaAdmin[];
  }

  fechar() {
    this.db.close();
  }
}
