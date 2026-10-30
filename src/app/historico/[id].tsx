import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { confirmarExclusao, resumoTreino, SeloTreino } from '../../componentes/historico';
import { Botao, Cartao, Selo, SeloPontos, SetaTendencia, estilos as ui, TextoSuave, Titulo } from '../../componentes/ui';
import type { Tendencia } from '../../dominio/avaliacao';
import { formatarData } from '../../dominio/datas';
import { compararComAnteriores, type TreinoAvaliado } from '../../dominio/desempenho';
import { descreverDiferenca, formatarValor, formatarVariacao } from '../../dominio/formato';
import { descreverPontos } from '../../dominio/pontuacao';
import { PONTOS_MINIMOS_TOTAL } from '../../dominio/regras/taf3';
import type { ExercicioId } from '../../dominio/tipos';
import { useHistorico } from '../../hooks/useHistorico';
import { cores, espaco } from '../../tema';

interface PropsLinha {
  nome: string;
  valor: string;
  detalhe: string;
  seta?: Tendencia;
  selo: ReactNode;
}

function Linha({ nome, valor, detalhe, seta, selo }: PropsLinha) {
  return (
    <View style={estilos.linha}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={estilos.exercicio}>{nome}</Text>
        <View style={estilos.valorLinha}>
          <Text style={estilos.valor}>{valor}</Text>
          <SetaTendencia tendencia={seta ?? null} />
        </View>
        <TextoSuave>{detalhe}</TextoSuave>
      </View>
      {selo}
    </View>
  );
}

function Exercicios({ avaliado, setas }: { avaliado: TreinoAvaliado; setas: Map<ExercicioId, Tendencia> }) {
  if (avaliado.modo === 'candidato') {
    return avaliado.av.exercicios.map((e) => (
      <Linha
        key={e.regra.exercicio}
        nome={e.regra.nome}
        valor={formatarValor(e.regra.unidade, e.final.valor)}
        detalhe={
          descreverDiferenca(e.regra, e.final.diferenca) +
          (e.reteste ? ` · no reteste (1ª: ${formatarValor(e.regra.unidade, e.primeira.valor)})` : '')
        }
        seta={setas.get(e.regra.exercicio)}
        selo={<Selo apto={e.apto} />}
      />
    ));
  }
  return avaliado.av.exercicios.map(({ tabela, avaliacao }) => (
    <Linha
      key={tabela.exercicio}
      nome={tabela.nome}
      valor={formatarValor(tabela.unidade, avaliacao.valor)}
      detalhe={descreverPontos(tabela, avaliacao)}
      seta={setas.get(tabela.exercicio)}
      selo={<SeloPontos pontos={avaliacao.pontos} suficiente={avaliacao.suficiente} naoConta={!tabela.contaNaSoma} />}
    />
  ));
}

export default function DetalheTreino() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [dados] = useHistorico();

  if (!dados) return <View style={ui.tela} />;

  const { historico } = dados;
  const i = historico.findIndex((h) => String(h.treino.id) === id);
  if (i === -1) {
    return (
      <View style={[ui.tela, ui.conteudo]}>
        <Cartao>
          <Titulo>Treino não encontrado</Titulo>
          <TextoSuave>Ele pode ter sido excluído.</TextoSuave>
        </Cartao>
      </View>
    );
  }

  const item = historico[i];
  const { treino, avaliado, modo } = item;
  const anteriores = historico
    .slice(i + 1)
    .flatMap((h) => (h.modo === modo && h.treino.sexo === treino.sexo && h.avaliado ? [h.avaliado] : []));
  const setas = avaliado ? compararComAnteriores(avaliado, anteriores) : new Map<ExercicioId, Tendencia>();
  const { comparadoCom } = item;

  const sexoTreino = treino.sexo === 'M' ? 'masculino' : 'feminino';
  const perfilTreino =
    modo === 'candidato'
      ? `Candidato · ${treino.cargo === 'oficial' ? 'Aluno Oficial' : 'Soldado'} · ${sexoTreino}`
      : `Policial (TAF-3) · ${sexoTreino}${treino.idade !== null ? ` · ${treino.idade} anos` : ''}`;

  return (
    <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo}>
      <Stack.Screen options={{ title: formatarData(treino.data) }} />

      <Cartao>
        <View style={estilos.topo}>
          <Titulo>{formatarData(treino.data)}</Titulo>
          <SeloTreino avaliado={avaliado} />
        </View>
        <TextoSuave>{perfilTreino}</TextoSuave>
        <Text style={estilos.resumo}>{resumoTreino(avaliado)}</Text>
        {avaliado?.modo === 'efetivo' && avaliado.completo && (
          <Text style={[estilos.status, avaliado.aptoGeral && { color: cores.apto }]}>
            {avaliado.aptoGeral
              ? 'APTO no TAF-3'
              : avaliado.av.faltaTotal > 0
                ? `Faltaram ${avaliado.av.faltaTotal} pts para os ${PONTOS_MINIMOS_TOTAL}`
                : 'Soma atingida, mas houve teste abaixo de 20 pts'}
          </Text>
        )}
        {avaliado && !avaliado.completo && (
          <TextoSuave>Treino avulso: conta no desempenho de cada teste, mas não na nota geral do TAF.</TextoSuave>
        )}
        {item.tendencia && comparadoCom && (
          <View style={estilos.valorLinha}>
            <SetaTendencia
              tendencia={item.tendencia}
              texto={item.variacao !== null ? formatarVariacao(modo, item.variacao) : undefined}
            />
            <TextoSuave>em relação a {formatarData(comparadoCom.data)}</TextoSuave>
          </View>
        )}
      </Cartao>

      {avaliado && avaliado.av.exercicios.length > 0 && (
        <Cartao>
          <Titulo>Testes</Titulo>
          <Exercicios avaliado={avaliado} setas={setas} />
        </Cartao>
      )}

      {treino.observacao !== '' && (
        <Cartao>
          <Titulo>Observação</Titulo>
          <Text style={estilos.observacao}>{treino.observacao}</Text>
        </Cartao>
      )}

      <Botao titulo="Excluir treino" variante="perigo" onPress={() => confirmarExclusao(db, treino, () => router.back())} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resumo: { fontSize: 15, fontWeight: '600', color: cores.texto },
  status: { fontSize: 13, fontWeight: '600', color: cores.inapto },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.p,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  valorLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco.p },
  exercicio: { fontSize: 15, color: cores.texto },
  valor: { fontSize: 15, fontWeight: '700', color: cores.primaria },
  observacao: { fontSize: 15, color: cores.texto },
});
