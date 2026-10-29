import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { listarTreinos, obterPerfil, type Perfil, type Treino } from '../db/repositorio';
import { montarHistorico, type ItemHistorico } from '../dominio/desempenho';

export interface DadosHistorico {
  perfil: Perfil | null;
  /** Do mais recente para o mais antigo. */
  historico: ItemHistorico<Treino>[];
}

/** Perfil e histórico avaliado, recarregados sempre que a tela ganha foco; undefined até carregar. */
export function useHistorico(): [DadosHistorico | undefined, () => Promise<void>] {
  const db = useSQLiteContext();
  const [dados, setDados] = useState<DadosHistorico>();

  const recarregar = useCallback(async () => {
    const [perfil, treinos] = await Promise.all([obterPerfil(db), listarTreinos(db)]);
    setDados({ perfil, historico: montarHistorico(treinos, perfil?.dataNascimento ?? null) });
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar]),
  );

  return [dados, recarregar];
}
