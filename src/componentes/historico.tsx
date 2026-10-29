import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert, Text, View } from 'react-native';

import { excluirTreino } from '../db/repositorio';
import { formatarData } from '../dominio/datas';
import type { TreinoAvaliado } from '../dominio/desempenho';
import { formatarPercentual } from '../dominio/formato';
import { cores } from '../tema';
import { estilos as ui } from './ui';

/** Testes feitos num treino avulso: "Corrida 2400 m", "Barra + Apoio" ou "3 testes". */
export function testesDoAvulso(a: TreinoAvaliado): string {
  const nomes = a.modo === 'candidato' ? a.av.exercicios.map((e) => e.regra.nome) : a.av.exercicios.map((e) => e.tabela.nome);
  return nomes.length <= 2 ? nomes.join(' + ') : `${nomes.length} testes`;
}

/** "Aptos 3 de 4 · margem +5,2%", "260 pts" ou, no avulso, "Corrida 2400 m · apto". */
export function resumoTreino(a: TreinoAvaliado | null): string {
  if (!a) return 'Informe a data de nascimento no perfil para pontuar';
  if (!a.completo) {
    const quais = testesDoAvulso(a);
    if (a.modo === 'efetivo') return `${quais} · ${a.av.soma} pts`;
    const { aptos, avaliados } = a.av;
    return `${quais} · ${avaliados === 1 ? (aptos ? 'apto' : 'inapto') : `${aptos} de ${avaliados} aptos`}`;
  }
  if (a.modo === 'candidato') {
    const margem = a.nota !== null ? ` · margem ${formatarPercentual(a.nota)}` : '';
    return `Aptos ${a.av.aptos} de ${a.av.avaliados}${margem}`;
  }
  return `${a.av.soma} pts`;
}

/** APTO / INAPTO no TAF completo; AVULSO quando o treino teve só alguns testes. */
export function SeloTreino({ avaliado }: { avaliado: TreinoAvaliado | null }) {
  if (!avaliado) return null;
  const [texto, cor] = avaliado.aptoGeral
    ? ['APTO', cores.apto]
    : avaliado.completo
      ? ['INAPTO', cores.inapto]
      : ['AVULSO', cores.destaque];
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

