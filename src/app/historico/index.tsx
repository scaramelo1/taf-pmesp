import { Link, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { confirmarExclusao, resumoTreino, SeloTreino } from '../../componentes/historico';
import { Cartao, SetaTendencia, estilos as ui, TextoSuave, Titulo } from '../../componentes/ui';
import { formatarData } from '../../dominio/datas';
import { formatarVariacao } from '../../dominio/formato';
import { useHistorico } from '../../hooks/useHistorico';
import { cores, espaco } from '../../tema';

export default function Historico() {
  const db = useSQLiteContext();
  const [dados, recarregar] = useHistorico();

  if (!dados) return <View style={ui.tela} />;

  const { perfil, historico } = dados;
  // Só identifica o modo na linha quando há treinos dos dois.
  const misturado = new Set(historico.map((h) => h.modo)).size > 1;

  return (
    <FlatList
      style={ui.tela}
      contentContainerStyle={ui.conteudo}
      data={historico}
      keyExtractor={(h) => String(h.treino.id)}
      ListHeaderComponent={
        historico.length > 0 ? (
          <TextoSuave>
            {historico.length} {historico.length === 1 ? 'treino' : 'treinos'} · ▲▼ em relação ao treino anterior.
            Toque para ver o detalhe; segure para excluir.
          </TextoSuave>
        ) : null
      }
      ListEmptyComponent={
        <Cartao>
          <Titulo>Nenhum treino ainda</Titulo>
          <TextoSuave>Os treinos que você registrar aparecem aqui, do mais recente para o mais antigo.</TextoSuave>
          <Link href={perfil ? '/novo-treino' : '/perfil'} style={estilos.link}>
            {perfil ? 'Registrar um treino →' : 'Configurar o perfil →'}
          </Link>
        </Cartao>
      }
      renderItem={({ item: h }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/historico/[id]', params: { id: String(h.treino.id) } })}
          onLongPress={() => confirmarExclusao(db, h.treino, recarregar)}
          accessibilityRole="button"
          accessibilityHint="Abre o detalhe do treino"
          style={({ pressed }) => [ui.cartao, pressed && { opacity: 0.7 }]}
        >
          <View style={estilos.linha}>
            <Text style={estilos.data}>{formatarData(h.treino.data)}</Text>
            <SetaTendencia
              tendencia={h.tendencia}
              texto={h.variacao !== null ? formatarVariacao(h.modo, h.variacao) : undefined}
            />
          </View>
          <View style={estilos.linha}>
            <View style={{ flex: 1 }}>
              <TextoSuave>{resumoTreino(h.avaliado)}</TextoSuave>
              {misturado && <Text style={estilos.modo}>{h.modo === 'efetivo' ? 'Policial (TAF-3)' : 'Candidato'}</Text>}
            </View>
            <SeloTreino avaliado={h.avaliado} />
          </View>
        </Pressable>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  link: { color: cores.destaque, fontWeight: '600', marginTop: 4 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco.p },
  data: { fontSize: 16, fontWeight: '700', color: cores.texto },
  modo: { fontSize: 12, fontWeight: '600', color: cores.destaque },
});
