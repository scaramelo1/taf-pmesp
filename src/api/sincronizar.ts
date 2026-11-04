import { COPIA_VAZIA, mesclar, mesmaCopia } from '../dominio/sincronia.ts';
import type { CopiaDados } from '../dominio/sincronia.ts';
import { ErroApi } from './cliente.ts';
import type { Cliente } from './cliente.ts';

/** O que a sincronização precisa do banco do aparelho. */
export interface DadosLocais {
  ler: () => Promise<CopiaDados>;
  /** Grava no aparelho o que veio de outro aparelho. */
  aplicar: (copia: CopiaDados) => Promise<void>;
}

const TENTATIVAS = 3;

/**
 * Junta o aparelho com o backup e grava o resultado nos dois lados.
 * Se outro aparelho gravar no meio do caminho, o servidor recusa (409) e junta de novo.
 * Devolve true quando algo do backup entrou no aparelho.
 */
export async function sincronizar(api: Cliente, local: DadosLocais): Promise<boolean> {
  let mudouAqui = false;
  for (let i = 0; i < TENTATIVAS; i++) {
    const [aqui, backup] = await Promise.all([local.ler(), api.lerBackup()]);
    const remoto = backup.dados ?? COPIA_VAZIA;
    const junto = mesclar(aqui, remoto);
    if (!mesmaCopia(junto, aqui)) {
      await local.aplicar(junto);
      mudouAqui = true;
    }
    if (backup.dados && mesmaCopia(junto, remoto)) return mudouAqui;
    try {
      await api.gravarBackup(backup.versao, junto);
      return mudouAqui;
    } catch (erro) {
      if (!(erro instanceof ErroApi && erro.status === 409)) throw erro;
    }
  }
  throw new ErroApi(409, 'Backup ocupado; tente de novo');
}
