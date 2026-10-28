import { Link, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CampoExercicio } from '../componentes/CampoExercicio';
import { Botao, Campo, Cartao, estilos as ui, TextoSuave, Titulo } from '../componentes/ui';
import { criarTreino, obterPerfil, type Perfil } from '../db/repositorio';
import { avaliarTreino, avaliarValor } from '../dominio/avaliacao';
import { formatarData, hojeISO, lerData, mascararData } from '../dominio/datas';
import { ENTRADA_VAZIA, lerEntrada, type Entrada } from '../dominio/entrada';
import { formatarPercentual, formatarValor } from '../dominio/formato';
import { EDITAL_CANDIDATO, regrasDoTreino } from '../dominio/regras';
import type { ExercicioId, ResultadoRegistrado } from '../dominio/tipos';
import { cores } from '../tema';

interface EstadoExercicio {
  primeira: Entrada;
  reteste: Entrada;
  mostrarReteste: boolean;
}

const ESTADO_INICIAL: EstadoExercicio = { primeira: ENTRADA_VAZIA, reteste: ENTRADA_VAZIA, mostrarReteste: false };

export default function NovoTreino() {
  const db = useSQLiteContext();
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined);
  const [data, setData] = useState(() => formatarData(hojeISO()));
  const [observacao, setObservacao] = useState('');
  const [estado, setEstado] = useState<Partial<Record<ExercicioId, EstadoExercicio>>>({});
  const [salvando, setSalvando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      obterPerfil(db).then(setPerfil);
    }, [db]),
  );

  if (perfil === undefined) return <View style={ui.tela} />;

  if (perfil === null) {
    return (
      <View style={[ui.tela, ui.conteudo]}>
        <Cartao>
          <Titulo>Configure seu perfil primeiro</Titulo>
          <TextoSuave>Sexo e cargo definem quais testes e índices valem para você.</TextoSuave>
          <Link href="/perfil" style={estilos.link}>
            Ir para o perfil →
          </Link>
        </Cartao>
      </View>
    );
  }

  const regras = regrasDoTreino({ edital: EDITAL_CANDIDATO.id, sexo: perfil.sexo, cargo: perfil.cargo });
  const obter = (id: ExercicioId) => estado[id] ?? ESTADO_INICIAL;
  const atualizar = (id: ExercicioId, parcial: Partial<EstadoExercicio>) =>
    setEstado((e) => ({ ...e, [id]: { ...(e[id] ?? ESTADO_INICIAL), ...parcial } }));

  const leituras = regras.map((regra) => {
    const st = obter(regra.exercicio);
    const v1 = lerEntrada(regra, st.primeira);
    const av1 = typeof v1 === 'number' ? avaliarValor(regra, v1) : null;
    // Reteste só existe se a 1ª tentativa foi inapta e o teste permite.
    const podeReteste = !!av1 && !av1.apto && regra.temReteste;
    const v2 = podeReteste && st.mostrarReteste ? lerEntrada(regra, st.reteste) : undefined;
    const av2 = typeof v2 === 'number' ? avaliarValor(regra, v2) : null;
    return { regra, st, v1, av1, podeReteste, v2, av2 };
  });

  const resultados: ResultadoRegistrado[] = leituras.flatMap(({ regra, v1, v2 }) => [
    ...(typeof v1 === 'number' ? [{ exercicio: regra.exercicio, valor: v1, tentativa: 1 as const }] : []),
    ...(typeof v2 === 'number' ? [{ exercicio: regra.exercicio, valor: v2, tentativa: 2 as const }] : []),
  ]);
  const temInvalido = leituras.some((l) => l.v1 === null || l.v2 === null);
  const dataISO = lerData(data);
  const avaliacao = avaliarTreino(regras, resultados);

  async function salvar() {
    if (!dataISO || !perfil) return;
    setSalvando(true);
    try {
      await criarTreino(db, {
        data: dataISO,
        edital: EDITAL_CANDIDATO.id,
        sexo: perfil.sexo,
        cargo: perfil.cargo,
        observacao: observacao.trim(),
        resultados,
      });
      setEstado({});
      setObservacao('');
      setData(formatarData(hojeISO()));
      Alert.alert('Treino salvo', `Aptos: ${avaliacao.aptos} de ${avaliacao.avaliados}`);
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
      <Cartao>
        <Campo
          rotulo="Data do treino"
          value={data}
          onChangeText={(t) => setData(mascararData(t))}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
          erro={dataISO ? undefined : 'Data inválida (DD/MM/AAAA)'}
        />
        <TextoSuave>Preencha só os testes que fez hoje.</TextoSuave>
      </Cartao>

      {leituras.map(({ regra, st, v1, av1, podeReteste, v2, av2 }) => (
        <Cartao key={regra.exercicio}>
          <View style={estilos.cabecalho}>
            <Text style={estilos.exercicio}>{regra.nome}</Text>
            <Text style={estilos.indice}>
              {regra.direcao === 'menor' ? 'até ' : 'mín. '}
              {formatarValor(regra.unidade, regra.minimo)}
            </Text>
          </View>

          <CampoExercicio
            rotulo={st.mostrarReteste && podeReteste ? '1ª tentativa' : 'Resultado'}
            regra={regra}
            entrada={st.primeira}
            onChange={(primeira) => atualizar(regra.exercicio, { primeira })}
            valor={v1}
            avaliacao={av1}
          />

          {podeReteste && !st.mostrarReteste && (
            <Botao
              titulo="Registrar reteste"
              variante="secundario"
              onPress={() => atualizar(regra.exercicio, { mostrarReteste: true })}
            />
          )}

          {podeReteste && st.mostrarReteste && (
            <CampoExercicio
              rotulo="Reteste"
              regra={regra}
              entrada={st.reteste}
              onChange={(reteste) => atualizar(regra.exercicio, { reteste })}
              valor={v2}
              avaliacao={av2}
            />
          )}

          {av1 && !av1.apto && !regra.temReteste && (
            <Text style={estilos.alerta}>Este teste não tem reteste: na prova, seria eliminação.</Text>
          )}
        </Cartao>
      ))}

      <Cartao>
        <Campo
          rotulo="Observação (opcional)"
          value={observacao}
          onChangeText={setObservacao}
          placeholder="Ex.: pista molhada, pouco sono…"
          multiline
        />
      </Cartao>

      <Cartao style={estilos.resumo}>
        <Text style={estilos.resumoTitulo}>
          Aptos: {avaliacao.aptos} de {avaliacao.avaliados}
        </Text>
        {avaliacao.pendentes.length > 0 && avaliacao.avaliados > 0 && (
          <TextoSuave>{avaliacao.pendentes.length} teste(s) não registrado(s)</TextoSuave>
        )}
        {avaliacao.indice !== null && (
          <TextoSuave>Margem média sobre o mínimo: {formatarPercentual(avaliacao.indice)}</TextoSuave>
        )}
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

const estilos = StyleSheet.create({
  link: { color: cores.primaria, fontWeight: '600', marginTop: 4 },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  exercicio: { fontSize: 16, fontWeight: '700', color: cores.texto },
  indice: { fontSize: 14, fontWeight: '600', color: cores.primaria },
  alerta: { fontSize: 13, color: cores.inapto, fontWeight: '600' },
  resumo: { borderColor: cores.primaria },
  resumoTitulo: { fontSize: 17, fontWeight: '700', color: cores.texto },
});
