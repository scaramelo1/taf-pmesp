import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ExercicioId, Medida } from '../dominio/tipos';
import { cores } from '../tema';
import { Cartao, Rotulo, TextoSuave } from './ui';

const NOME_CURTO: Record<ExercicioId, string> = {
  barra: 'Barra',
  abdominal: 'Abdominal',
  apoio: 'Apoio',
  corrida50: '50 m',
  corrida2400: '2400 m',
  natacao50: 'Natação',
};

function Chip({ rotulo, ativo, onPress }: { rotulo: string; ativo: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: ativo }}
      style={[estilos.chip, ativo && estilos.chipAtivo]}
    >
      <Text style={[estilos.chipTexto, ativo && estilos.chipTextoAtivo]}>{rotulo}</Text>
    </Pressable>
  );
}

/**
 * Escolhe os testes do treino: o TAF completo ou só alguns (ex.: só a corrida).
 * Com o TAF completo marcado, tocar num teste deixa só ele; desmarcar o último volta ao completo.
 */
export function SeletorTestes({
  medidas,
  selecionados,
  onChange,
}: {
  medidas: Medida[];
  selecionados: ExercicioId[];
  onChange: (ids: ExercicioId[]) => void;
}) {
  const todos = medidas.map((m) => m.exercicio);
  const completo = todos.every((id) => selecionados.includes(id));

  function alternar(id: ExercicioId) {
    if (completo) return onChange([id]);
    const novos = selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id];
    onChange(novos.length ? todos.filter((x) => novos.includes(x)) : todos);
  }

  return (
    <Cartao>
      <Rotulo>Testes de hoje</Rotulo>
      <View style={estilos.linha}>
        <Chip rotulo="TAF completo" ativo={completo} onPress={() => onChange(todos)} />
        {medidas.map((m) => (
          <Chip
            key={m.exercicio}
            rotulo={NOME_CURTO[m.exercicio]}
            ativo={!completo && selecionados.includes(m.exercicio)}
            onPress={() => alternar(m.exercicio)}
          />
        ))}
      </View>
      <TextoSuave>
        {completo
          ? 'Preencha só os testes que fez. Para treinar um teste só, toque nele.'
          : 'Treino avulso: entra no desempenho de cada teste, mas não na nota geral do TAF.'}
      </TextoSuave>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.fundo,
  },
  chipAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  chipTexto: { fontSize: 14, fontWeight: '600', color: cores.texto },
  chipTextoAtivo: { color: '#fff' },
});
