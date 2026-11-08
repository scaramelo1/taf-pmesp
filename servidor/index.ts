import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { criarApi } from './api.ts';
import { BancoSqlite } from './banco.ts';

const PORTA = Number(process.env.PORTA ?? 3101);
const HOST = process.env.HOST ?? '127.0.0.1';
const CAMINHO_BANCO = resolve(process.env.BANCO ?? 'servidor/dados/readytaf.db');

mkdirSync(dirname(CAMINHO_BANCO), { recursive: true });
const banco = new BancoSqlite(CAMINHO_BANCO);
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
const URL_PUBLICA = process.env.URL_PUBLICA ?? 'https://fsadesigners.com.br/readytaf-api';
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) console.warn('Login com Google desligado: faltam as credenciais');
const api = criarApi(banco, {
  google: GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
    ? { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, urlPublica: URL_PUBLICA }
    : undefined,
  versao: {
    // publicar.sh grava a versão do APK publicado.
    lerAtual: () => {
      try {
        return readFileSync(process.env.VERSAO_APK ?? '/var/www/fsa-designer/readytaf/versao.txt', 'utf8').trim() || null;
      } catch {
        return null;
      }
    },
    link: process.env.LINK_DOWNLOAD ?? 'https://fsadesigners.com.br/readytaf/',
  },
  admin: {
    senha: process.env.ADMIN_SENHA || undefined,
    emails: (process.env.ADMIN_EMAILS ?? '').split(','),
    lerDownloads: () => {
      try {
        const total = Number.parseInt(readFileSync(process.env.DOWNLOADS ?? '/var/www/fsa-designer/readytaf/downloads.txt', 'utf8'), 10);
        return Number.isFinite(total) ? total : null;
      } catch {
        return null;
      }
    },
  },
});

api.listen(PORTA, HOST, () => console.log(`ReadyTAF em http://${HOST}:${PORTA}`));

function encerrar() {
  api.close(() => {
    banco.fechar();
    process.exit(0);
  });
}
process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
