// Fala com o servidor do ReadyTAF. Sem React Native: os testes do servidor também usam este arquivo.
import type { CopiaDados } from '../dominio/sincronia.ts';

export const URL_API = 'https://fsadesigners.com.br/readytaf-api';

export class ErroApi extends Error {
  status: number;

  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

/** Sem resposta do servidor não há status: 0 significa falta de internet ou servidor fora do ar. */
async function pedir<T>(base: string, caminho: string, token: string | null, metodo = 'GET', corpo?: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(base + caminho, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(0, 'Sem conexão');
  }
  const dados = (await resposta.json().catch(() => ({}))) as { erro?: string };
  if (!resposta.ok) throw new ErroApi(resposta.status, dados.erro ?? 'Erro no servidor');
  return dados as T;
}

export interface Sessao {
  token: string;
  nome: string;
  /** Identificador da conta no servidor: mostra se quem entrou é a mesma pessoa de antes. */
  conta: string;
}

export interface Backup {
  versao: number;
  dados: CopiaDados | null;
}

export const urlDoLogin = (retorno: string, desafio: string, base = URL_API) =>
  `${base}/auth/google/inicio?retorno=${encodeURIComponent(retorno)}&desafio=${encodeURIComponent(desafio)}`;

/** Espera o login no navegador terminar; o servidor segura cada pedido por até 25 s. */
export const aguardarLoginGoogle = (verificador: string, base = URL_API) =>
  pedir<Sessao | { pendente: true }>(base, '/auth/google/aguardar', null, 'POST', { verificador });

export function criarCliente(token: string, base = URL_API) {
  return {
    eu: () => pedir<{ nome: string; conta: string }>(base, '/eu', token),
    sair: () => pedir<{ ok: boolean }>(base, '/sair', token, 'POST'),
    apagarConta: () => pedir<{ ok: boolean }>(base, '/conta', token, 'DELETE'),
    lerBackup: () => pedir<Backup>(base, '/dados', token),
    gravarBackup: (versaoBase: number, dados: CopiaDados) =>
      pedir<{ versao: number }>(base, '/dados', token, 'PUT', { versaoBase, dados }),
  };
}

export type Cliente = ReturnType<typeof criarCliente>;
