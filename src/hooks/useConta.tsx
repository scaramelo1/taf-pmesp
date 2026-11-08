import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { ErroApi, aguardarLoginGoogle, criarCliente, urlDoLogin } from '../api/cliente';
import type { Cliente, DadosConta, ResumoAdmin } from '../api/cliente';
import { sincronizar } from '../api/sincronizar';
import {
  aplicarCopia,
  apagarConfig,
  apagarDadosLocais,
  lerConfig,
  lerCopia,
  salvarConfig,
} from '../db/repositorio';

const CHAVE_TOKEN = 'token';
const CHAVE_NOME = 'nome';
/** Conta dona dos dados deste aparelho; continua gravada mesmo se a sessão expirar. */
const CHAVE_CONTA = 'conta';
/** Nome completo, e-mail, foto e se é admin, em JSON. */
const CHAVE_GOOGLE = 'google';
/** Tempo para escolher a conta no Google; cada pedido espera até 25 s no servidor. */
const TEMPO_DE_LOGIN_MS = 5 * 60_000;
/** Pausa antes de tentar de novo quando a internet falha. */
const PAUSA_SEM_REDE_MS = 2_000;
/** Depois de fechar o navegador, o tempo para a sessão ainda chegar. */
const FOLGA_AO_FECHAR_MS = 10_000;
/** Junta várias mudanças seguidas num envio só. */
const ESPERA_ENVIO_MS = 1_500;

/** No Expo Go só o endereço exp:// abre o app; o esquema tafpmesp:// existe apenas no app instalado. */
function enderecoDeRetorno() {
  const servidor = Constants.expoConfig?.hostUri;
  return servidor ? `exp://${servidor}/--/login` : Linking.createURL('login');
}

export type EstadoBackup = 'ok' | 'enviando' | 'pendente';

/** Dados da conta Google mostrados no perfil. */
export interface ContaGoogle {
  nomeCompleto: string;
  email: string | null;
  foto: string | null;
  admin: boolean;
}

function lerGoogle(texto: string | null): ContaGoogle | null {
  if (!texto) return null;
  try {
    return JSON.parse(texto) as ContaGoogle;
  } catch {
    return null;
  }
}

const googleDe = (d: DadosConta): ContaGoogle => ({
  nomeCompleto: d.nomeCompleto || d.nome,
  email: d.email ?? null,
  foto: d.foto ?? null,
  admin: !!d.admin,
});

interface ValorConta {
  carregando: boolean;
  /** Primeiro nome da conta Google; null fora da conta. */
  nome: string | null;
  /** Nome completo, e-mail e foto da conta Google; null fora da conta ou antes de atualizar. */
  google: ContaGoogle | null;
  backup: EstadoBackup;
  /** Sobe quando o backup traz dados de outro aparelho: as telas recarregam. */
  versaoDados: number;
  entrarComGoogle: () => Promise<void>;
  /** Chamar depois de gravar qualquer coisa no banco local. */
  avisarMudanca: () => void;
  /** Envia agora; devolve false se não conseguiu (sem internet, por exemplo). */
  enviarBackup: () => Promise<boolean>;
  sair: () => Promise<void>;
  apagarConta: () => Promise<void>;
  /** Números do app para o painel do admin. */
  lerResumoAdmin: () => Promise<ResumoAdmin>;
}

const Contexto = createContext<ValorConta | null>(null);

export function ProvedorConta({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState<string | null>(null);
  const [google, setGoogle] = useState<ContaGoogle | null>(null);
  const [backup, setBackup] = useState<EstadoBackup>('ok');
  const [versaoDados, setVersaoDados] = useState(0);
  const cliente = useRef<Cliente | null>(null);
  const emAndamento = useRef<Promise<boolean> | null>(null);
  const deNovo = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const encerrarSessao = useCallback(async () => {
    cliente.current = null;
    await apagarConfig(db, CHAVE_TOKEN);
    setNome(null);
    setGoogle(null);
  }, [db]);

  const local = useMemo(
    () => ({ ler: () => lerCopia(db), aplicar: (copia: Parameters<typeof aplicarCopia>[1]) => aplicarCopia(db, copia) }),
    [db],
  );

  /** Uma sincronização por vez; mudanças feitas durante a atual geram mais uma rodada. */
  const enviarBackup = useCallback((): Promise<boolean> => {
    if (emAndamento.current) {
      deNovo.current = true;
      return emAndamento.current;
    }
    const rodar = async (): Promise<boolean> => {
      const api = cliente.current;
      if (!api) return false;
      setBackup('enviando');
      try {
        do {
          deNovo.current = false;
          if (await sincronizar(api, local)) setVersaoDados((v) => v + 1);
        } while (deNovo.current);
        setBackup('ok');
        return true;
      } catch (erro) {
        setBackup('pendente');
        // Sessão apagada no servidor: volta para o login, mas os dados ficam no aparelho.
        if (erro instanceof ErroApi && erro.status === 401) await encerrarSessao();
        else console.warn('Backup não enviado', erro);
        return false;
      }
    };
    // Limpa depois de terminar (sempre assíncrono), mesmo quando rodar() volta na hora.
    const tarefa = rodar().finally(() => {
      emAndamento.current = null;
    });
    emAndamento.current = tarefa;
    return tarefa;
  }, [encerrarSessao, local]);

  const avisarMudanca = useCallback(() => {
    setBackup('pendente');
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      void enviarBackup();
    }, ESPERA_ENVIO_MS);
  }, [enviarBackup]);

  // Abre a sessão gravada e manda o que ficou pendente.
  useEffect(() => {
    let ativo = true;
    (async () => {
      const [token, nomeSalvo, googleSalvo] = await Promise.all([
        lerConfig(db, CHAVE_TOKEN),
        lerConfig(db, CHAVE_NOME),
        lerConfig(db, CHAVE_GOOGLE),
      ]);
      if (!ativo) return;
      if (token) {
        const api = criarCliente(token);
        cliente.current = api;
        setNome(nomeSalvo ?? '');
        setGoogle(lerGoogle(googleSalvo));
        void enviarBackup();
        // Traz foto, e-mail e nome atualizados; sem internet fica o que estava gravado.
        api.eu().then(async (dados) => {
          if (!ativo || cliente.current !== api) return;
          const atual = googleDe(dados);
          setGoogle(atual);
          setNome(dados.nome);
          await salvarConfig(db, CHAVE_GOOGLE, JSON.stringify(atual));
          await salvarConfig(db, CHAVE_NOME, dados.nome);
        }).catch(() => undefined);
      }
      setCarregando(false);
    })().catch((erro: unknown) => {
      console.error('Falha ao abrir a sessão', erro);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [db, enviarBackup]);

  // Ao voltar para o app, tenta de novo o que não foi enviado e busca o que veio de outros aparelhos.
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && cliente.current) void enviarBackup();
    });
    return () => assinatura.remove();
  }, [enviarBackup]);

  const entrarComGoogle = useCallback(async () => {
    // O código só vale junto com o verificador, que nunca sai do aparelho.
    const verificador = `${Crypto.randomUUID()}${Crypto.randomUUID()}`;
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verificador, {
      encoding: Crypto.CryptoEncoding.BASE64,
    });
    const desafio = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const retorno = enderecoDeRetorno();
    let ativo = true;

    // A sessão vem direto do servidor, então o login funciona mesmo se o navegador não voltar ao app.
    // Com o navegador na frente, o Android pode cortar a rede do app: falha de conexão só faz tentar de novo.
    const esperarSessao = async () => {
      const fim = Date.now() + TEMPO_DE_LOGIN_MS;
      while (ativo && Date.now() < fim) {
        try {
          const resposta = await aguardarLoginGoogle(verificador);
          if ('token' in resposta) return resposta;
        } catch (erro) {
          if (!(erro instanceof ErroApi && erro.status === 0)) throw erro;
          await new Promise((pronto) => setTimeout(pronto, PAUSA_SEM_REDE_MS));
        }
      }
      return null;
    };
    const navegadorFechou = WebBrowser.openAuthSessionAsync(urlDoLogin(retorno, desafio), retorno)
      .catch((falha: unknown) => {
        console.warn('Navegador do login', falha);
      })
      .then(() => new Promise<null>((pronto) => setTimeout(() => pronto(null), FOLGA_AO_FECHAR_MS)));

    try {
      const sessao = await Promise.race([esperarSessao(), navegadorFechou]);
      if (!sessao) return;
      if (Platform.OS === 'ios') WebBrowser.dismissAuthSession();

      // Outra pessoa entrando neste aparelho não leva os treinos de quem usava antes.
      const contaAnterior = await lerConfig(db, CHAVE_CONTA);
      if (contaAnterior && contaAnterior !== sessao.conta) await apagarDadosLocais(db);
      await salvarConfig(db, CHAVE_TOKEN, sessao.token);
      await salvarConfig(db, CHAVE_NOME, sessao.nome);
      await salvarConfig(db, CHAVE_CONTA, sessao.conta);
      const dadosGoogle = googleDe(sessao);
      await salvarConfig(db, CHAVE_GOOGLE, JSON.stringify(dadosGoogle));
      cliente.current = criarCliente(sessao.token);

      // Traz o backup antes de abrir o app, para o celular novo já mostrar os treinos.
      await enviarBackup();
      setGoogle(dadosGoogle);
      setNome(sessao.nome);
    } catch (falha) {
      console.error('Falha no login', falha);
      const detalhe = falha instanceof ErroApi && falha.status === 0 ? ' Confira a internet.' : '';
      throw new Error(`Não foi possível entrar com o Google.${detalhe}`);
    } finally {
      ativo = false;
    }
  }, [db, enviarBackup]);

  /** Encerra a sessão e limpa o aparelho. A tela tenta enviar o backup e confirma antes. */
  const sair = useCallback(async () => {
    await cliente.current?.sair().catch(() => undefined);
    await apagarDadosLocais(db);
    await apagarConfig(db, CHAVE_CONTA);
    await apagarConfig(db, CHAVE_NOME);
    await apagarConfig(db, CHAVE_GOOGLE);
    await encerrarSessao();
    setBackup('ok');
  }, [db, encerrarSessao]);

  const apagarConta = useCallback(async () => {
    const api = cliente.current;
    if (!api) return;
    try {
      await api.apagarConta();
    } catch (erro) {
      throw new Error(
        erro instanceof ErroApi && erro.status === 0 ? 'Sem internet: a conta não foi apagada.' : 'Não foi possível apagar a conta.',
      );
    }
    await apagarDadosLocais(db);
    await apagarConfig(db, CHAVE_CONTA);
    await apagarConfig(db, CHAVE_NOME);
    await apagarConfig(db, CHAVE_GOOGLE);
    await encerrarSessao();
    setBackup('ok');
  }, [db, encerrarSessao]);

  const lerResumoAdmin = useCallback(async () => {
    const api = cliente.current;
    if (!api) throw new Error('Entre com a conta Google.');
    try {
      return await api.resumoAdmin();
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 0) throw new Error('Sem internet.');
      if (erro instanceof ErroApi && erro.status === 403) throw new Error('Esta conta não é de admin.');
      throw new Error('Não foi possível carregar os números.');
    }
  }, []);

  const valor = useMemo<ValorConta>(
    () => ({
      carregando,
      nome,
      google,
      backup,
      versaoDados,
      entrarComGoogle,
      avisarMudanca,
      enviarBackup,
      sair,
      apagarConta,
      lerResumoAdmin,
    }),
    [carregando, nome, google, backup, versaoDados, entrarComGoogle, avisarMudanca, enviarBackup, sair, apagarConta, lerResumoAdmin],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useConta() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useConta fora do ProvedorConta');
  return valor;
}
