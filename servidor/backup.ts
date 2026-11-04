// Cópia diária e consistente do banco, mesmo com o servidor rodando. Guarda os últimos 14 dias.
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ORIGEM = process.env.BANCO ?? 'servidor/dados/readytaf.db';
const DESTINO = process.env.BACKUPS ?? 'servidor/dados/backups';
const MANTER = 14;

mkdirSync(DESTINO, { recursive: true, mode: 0o700 });
const data = new Date().toISOString().slice(0, 10);
const arquivo = join(DESTINO, `readytaf-${data}.db`);
rmSync(arquivo, { force: true });

const db = new DatabaseSync(ORIGEM, { readOnly: true });
db.prepare('VACUUM INTO ?').run(arquivo);
db.close();

const copias = readdirSync(DESTINO).filter((n) => n.startsWith('readytaf-')).sort();
for (const antiga of copias.slice(0, -MANTER)) rmSync(join(DESTINO, antiga));
console.log(`Backup em ${arquivo}`);
