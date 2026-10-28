import { StyleSheet, Text, View } from 'react-native';

import { cores, espaco } from '../tema';

export function EmConstrucao({ titulo, etapa }: { titulo: string; etapa: number }) {
  return (
    <View style={estilos.tela}>
      <Text style={estilos.titulo}>{titulo}</Text>
      <Text style={estilos.suave}>Em construção — etapa {etapa}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundo, padding: espaco.g },
  titulo: { fontSize: 18, fontWeight: '700', color: cores.texto },
  suave: { fontSize: 14, color: cores.textoSuave, marginTop: espaco.p },
});
