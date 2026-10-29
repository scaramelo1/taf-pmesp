import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert, Text, View } from 'react-native';

import { excluirTreino } from '../db/repositorio';
import { formatarData } from '../dominio/datas';
import type { TreinoAvaliado } from '../dominio/desempenho';
import { formatarPercentual } from '../dominio/formato';
import { cores } from '../tema';
import { estilos as ui } from './ui';

/** "Aptos 3 de 4 · margem +5,2%" ou "245 pts · 1 não feito". */
export function resumoTreino(a: TreinoAvaliado | null): string {
  if (!a) return 'Informe a data de nascimento no perfil para pontuar';
  const faltam = a.av.pendentes.length;
  const naoFeitos = faltam ? ` · ${faltam} não feito${faltam > 1 ? 's' : ''}` : '';
  if (a.modo === 'candidato') {
    const margem = a.nota !== null ? ` · margem ${formatarPercentual(a.nota)}` : '';
    return `Aptos ${a.av.aptos} de ${a.av.avaliados}${margem}${naoFeitos}`;
  }
  return `${a.av.soma} pts${naoFeitos}`;
}

/** APTO / INAPTO no treino inteiro; PARCIAL quando faltou algum teste. */
export function SeloTreino({ avaliado }: { avaliado: TreinoAvaliado | null }) {
  if (!avaliado) return null;
  const [texto, cor] = avaliado.aptoGeral
    ? ['APTO', cores.apto]
    : avaliado.completo
      ? ['INAPTO', cores.inapto]
      : ['PARCIAL', cores.textoSuave];
  return (
    <View style={[ui.selo, { backgroundColor: cor }]}>
      <Text style={ui.seloTexto}>{texto}</Text>
    </View>
  );
}

/** Pede confirmação e exclui; `depois` roda só se o treino foi excluído. */
export function confirmarExclusao(db: SQLiteDatabase, treino: { id: number; data: string }, depois: () => void) {
  Alert.alert('Excluir treino', `Excluir o treino de ${formatarData(treino.data)}? Não dá para desfazer.`, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Excluir',
      style: 'destructive',
      onPress: async () => {
        try {
          await excluirTreino(db, treino.id);
          depois();
        } catch (e) {
          Alert.alert('Erro ao excluir', String(e));
        }
      },
    },
  ]);
}

