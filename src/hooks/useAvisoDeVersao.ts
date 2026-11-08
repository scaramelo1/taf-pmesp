import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { Alert, AppState, Linking } from 'react-native';

import { definirVersaoDoApp, lerVersaoPublicada } from '../api/cliente';
import { precisaAtualizar } from '../dominio/versao';

export const VERSAO_INSTALADA = Constants.expoConfig?.version ?? null;
definirVersaoDoApp(VERSAO_INSTALADA);

/** Mínimo entre duas consultas, para não perguntar toda vez que o app volta para a frente. */
const INTERVALO_MS = 6 * 3_600_000;

/** Ao abrir o app, avisa quando saiu um APK mais novo na página de download. Uma vez por versão nova. */
export function useAvisoDeVersao() {
  const ultimaConsulta = useRef(0);
  const jaAvisou = useRef<string | null>(null);

  useEffect(() => {
    const consultar = async () => {
      if (Date.now() - ultimaConsulta.current < INTERVALO_MS) return;
      ultimaConsulta.current = Date.now();
      try {
        const { versao, link } = await lerVersaoPublicada();
        if (!versao || !link || !precisaAtualizar(VERSAO_INSTALADA, versao) || jaAvisou.current === versao) return;
        jaAvisou.current = versao;
        Alert.alert(
          'Nova versão do ReadyTAF',
          `Saiu a versão ${versao} (a sua é a ${VERSAO_INSTALADA}). Baixe e instale por cima: seus treinos continuam salvos.`,
          [
            { text: 'Depois', style: 'cancel' },
            { text: 'Baixar', onPress: () => void Linking.openURL(link) },
          ],
        );
      } catch {
        // Sem internet: tenta de novo na próxima vez que o app abrir.
        ultimaConsulta.current = 0;
      }
    };
    void consultar();
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void consultar();
    });
    return () => assinatura.remove();
  }, []);
}
