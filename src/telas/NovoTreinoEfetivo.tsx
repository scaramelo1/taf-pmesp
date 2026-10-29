import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { CampoExercicio } from '../componentes/CampoExercicio';
import { CartaoData, CartaoObservacao } from '../componentes/CamposTreino';
import { Botao, Cartao, Detalhe, SeloPontos, estilos as ui, TextoSuave } from '../componentes/ui';
import { criarTreino, type Perfil } from '../db/repositorio';
import { formatarData, hojeISO, idadeEm, lerData } from '../dominio/datas';
import { ENTRADA_VAZIA, lerEntrada, type Entrada } from '../dominio/entrada';
import { descreverDiferenca, formatarValor } from '../dominio/formato';
import { avaliarPontos, avaliarTreinoPontos, faixaDaIdade, valorParaPontos } from '../dominio/pontuacao';
import { EDITAL_TAF3, TABELAS_TAF3 } from '../dominio/regras';
import { PONTOS_MINIMOS_TOTAL, PONTOS_SUFICIENCIA, rotuloFaixa } from '../dominio/regras/taf3';
import type { ExercicioId, ResultadoRegistrado } from '../dominio/tipos';
import { cores } from '../tema';
import { estilos } from './NovoTreinoCandidato';

export function NovoTreinoEfetivo({ perfil, nascimento }: { perfil: Perfil; nascimento: string }) {
  const db = useSQLiteContext();
  const [data, setData] = useState(() => formatarData(hojeISO()));
  const [observacao, setObservacao] = useState('');
  const [entradas, setEntradas] = useState<Partial<Record<ExercicioId, Entrada>>>({});
  const [salvando, setSalvando] = useState(false);

  const dataISO = lerData(data);
  const idade = idadeEm(nascimento, dataISO ?? hojeISO());

  const leituras = TABELAS_TAF3.map((tabela) => {
    const entrada = entradas[tabela.exercicio] ?? ENTRADA_VAZIA;
    const valor = lerEntrada(tabela, entrada);
    const av = typeof valor === 'number' ? avaliarPontos(tabela, idade, valor) : null;
    return { tabela, entrada, valor, av };
  });

  const resultados: ResultadoRegistrado[] = leituras.flatMap(({ tabela, valor }) =>
    typeof valor === 'number' ? [{ exercicio: tabela.exercicio, valor, tentativa: 1 as const }] : [],
  );
  const temInvalido = leituras.some((l) => l.valor === null);
  const avaliacao = avaliarTreinoPontos(TABELAS_TAF3, idade, resultados);
  const suficientes = avaliacao.exercicios.filter((e) => e.avaliacao.suficiente).length;

  async function salvar() {
    if (!dataISO) return;
    setSalvando(true);
    try {
      await criarTreino(db, {
        data: dataISO,
        edital: EDITAL_TAF3.id,
        sexo: 'M',
        cargo: perfil.cargo,
        idade,
        observacao: observacao.trim(),
        resultados,
      });
      setEntradas({});
      setObservacao('');
      setData(formatarData(hojeISO()));
      Alert.alert('Treino salvo', `Total: ${avaliacao.soma} pontos`);
      router.navigate('/');
    } catch (e) {
      Alert.alert('Erro ao salvar', String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ScrollView
      style={ui.tela}
      contentContainerStyle={ui.conteudo}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <CartaoData data={data} onChange={setData} valida={!!dataISO} />

      {leituras.map(({ tabela, entrada, valor, av }) => {
        const suficiencia = tabela.temSuficiencia ? valorParaPontos(tabela, idade, PONTOS_SUFICIENCIA) : null;
        return (
          <Cartao key={tabela.exercicio}>
            <View style={estilos.cabecalho}>
              <Text style={estilos.exercicio}>{tabela.nome}</Text>
              <Text style={estilos.indice}>
                {suficiencia !== null ? `20 pts: ${formatarValor(tabela.unidade, suficiencia)}` : 'sem suficiência'}
              </Text>
            </View>
            <TextoSuave>Faixa {rotuloFaixa(tabela, faixaDaIdade(tabela, idade))} anos</TextoSuave>

            <CampoExercicio
              rotulo="Resultado"
              regra={tabela}
              entrada={entrada}
              onChange={(e) => setEntradas((x) => ({ ...x, [tabela.exercicio]: e }))}
              valor={valor}
            >
              {av && (
                <>
                  <SeloPontos pontos={av.pontos} suficiente={av.suficiente} />
                  <Detalhe>
                    {av.proximo
                      ? `${descreverDiferenca(tabela, -av.proximo.falta)} p/ ${av.proximo.pontos} pts`
                      : 'pontuação máxima'}
                  </Detalhe>
                </>
              )}
            </CampoExercicio>

            {av && !av.suficiente && <Text style={estilos.alerta}>Abaixo do índice de suficiência (20 pts).</Text>}
          </Cartao>
        );
      })}

      <CartaoObservacao valor={observacao} onChange={setObservacao} />

      <Cartao style={estilos.resumo}>
        <Text style={estilos.resumoTitulo}>
          Total: {avaliacao.soma} de {PONTOS_MINIMOS_TOTAL} pontos mínimos
        </Text>
        {avaliacao.exercicios.length > 0 && (
          <Text style={[estilos.alerta, avaliacao.faltaTotal === 0 && { color: cores.apto }]}>
            {avaliacao.faltaTotal > 0 ? `Faltam ${avaliacao.faltaTotal} pontos para o mínimo` : 'Soma mínima atingida'}
            {avaliacao.aptoGeral ? ' · APTO no TAF-3' : ''}
          </Text>
        )}
        {avaliacao.media !== null && (
          <TextoSuave>
            Média {Math.round(avaliacao.media)} pts · suficiente em {suficientes} de {avaliacao.exercicios.length}
          </TextoSuave>
        )}
        {avaliacao.pendentes.length > 0 && avaliacao.exercicios.length > 0 && (
          <TextoSuave>{avaliacao.pendentes.length} teste(s) não registrado(s)</TextoSuave>
        )}
        <TextoSuave>Idade considerada: {idade} anos</TextoSuave>
      </Cartao>

      <Botao
        titulo={salvando ? 'Salvando…' : 'Salvar treino'}
        onPress={salvar}
        desabilitado={salvando || resultados.length === 0 || temInvalido || !dataISO}
      />
      {temInvalido && <Text style={estilos.alerta}>Corrija os valores inválidos para salvar.</Text>}
    </ScrollView>
  );
}
