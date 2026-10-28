import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Cartao, Selo, estilos as ui, TextoSuave, Titulo } from '../componentes/ui';
import { listarTreinos, obterPerfil, type Perfil, type Treino } from '../db/repositorio';
import { avaliarTreino } from '../dominio/avaliacao';
import { diasEntre, formatarData, hojeISO } from '../dominio/datas';
import { descreverDiferenca, formatarValor } from '../dominio/formato';
import { EDITAL_CANDIDATO, regrasCandidato } from '../dominio/regras/candidato';
import { regrasDoTreino } from '../dominio/regras';
import { cores, espaco } from '../tema';

export default function Inicio() {
  const db = useSQLiteContext();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [ultimo, setUltimo] = useState<Treino | null>(null);

  useFocusEffect(
    useCallback(() => {
      obterPerfil(db).then(setPerfil);
      listarTreinos(db).then((t) => setUltimo(t[0] ?? null));
    }, [db]),
  );

  const sexo = perfil?.sexo ?? 'M';
  const cargo = perfil?.cargo ?? 'soldado';
  const regras = regrasCandidato(sexo, cargo);
  const diasProva = perfil?.dataProva ? diasEntre(hojeISO(), perfil.dataProva) : null;
  const avUltimo = ultimo ? avaliarTreino(regrasDoTreino(ultimo), ultimo.resultados) : null;

  return (
    <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo}>
      {!perfil && (
        <Cartao style={{ borderColor: cores.alerta }}>
          <Titulo>Configure seu perfil</Titulo>
          <TextoSuave>
            Sexo e cargo definem os índices do seu TAF. Enquanto isso, mostramos os índices de Soldado masculino.
          </TextoSuave>
          <Link href="/perfil" style={estilos.link}>
            Ir para o perfil →
          </Link>
        </Cartao>
      )}

      {diasProva !== null && diasProva >= 0 && (
        <Cartao style={estilos.contagem}>
          <Text style={estilos.contagemNumero}>{diasProva === 0 ? 'Hoje!' : diasProva}</Text>
          <Text style={estilos.contagemTexto}>
            {diasProva === 0 ? 'é o dia da prova' : diasProva === 1 ? 'dia para a prova' : 'dias para a prova'}
          </Text>
        </Cartao>
      )}

      {ultimo && avUltimo && (
        <Cartao>
          <View style={estilos.linhaTopo}>
            <Titulo>Último treino</Titulo>
            <TextoSuave>{formatarData(ultimo.data)}</TextoSuave>
          </View>
          <Text style={estilos.resumo}>
            Aptos: {avUltimo.aptos} de {avUltimo.avaliados}
            {avUltimo.pendentes.length > 0 ? ` · ${avUltimo.pendentes.length} não feito(s)` : ''}
          </Text>
          {avUltimo.exercicios.map((e) => (
            <View key={e.regra.exercicio} style={estilos.linha}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.exercicio}>{e.regra.nome}</Text>
                <TextoSuave>
                  {formatarValor(e.regra.unidade, e.final.valor)} · {descreverDiferenca(e.regra, e.final.diferenca)}
                  {e.reteste ? ' · no reteste' : ''}
                </TextoSuave>
              </View>
              <Selo apto={e.apto} />
            </View>
          ))}
        </Cartao>
      )}

      {!ultimo && perfil && (
        <Cartao>
          <Titulo>Nenhum treino ainda</Titulo>
          <Link href="/novo-treino" style={estilos.link}>
            Registrar o primeiro treino →
          </Link>
        </Cartao>
      )}

      <Cartao>
        <Titulo>Índices mínimos</Titulo>
        <TextoSuave>
          {sexo === 'M' ? 'Masculino' : 'Feminino'} · {cargo === 'oficial' ? 'Aluno Oficial' : 'Soldado'}
        </TextoSuave>
        {regras.map((r) => (
          <View key={r.exercicio} style={estilos.linha}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.exercicio}>{r.nome}</Text>
              {!r.temReteste && <Text style={estilos.semReteste}>sem reteste</Text>}
            </View>
            <Text style={estilos.valor}>
              {r.direcao === 'menor' ? 'até ' : 'mín. '}
              {formatarValor(r.unidade, r.minimo)}
            </Text>
          </View>
        ))}
        <TextoSuave>{EDITAL_CANDIDATO.descricao}</TextoSuave>
      </Cartao>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  link: { color: cores.primaria, fontWeight: '600', marginTop: 4 },
  contagem: { backgroundColor: cores.primaria, borderColor: cores.primaria, alignItems: 'center' },
  contagemNumero: { fontSize: 40, fontWeight: '800', color: '#fff' },
  contagemTexto: { fontSize: 15, color: '#fff' },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resumo: { fontSize: 15, fontWeight: '600', color: cores.texto },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.p,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  exercicio: { fontSize: 15, color: cores.texto },
  semReteste: { fontSize: 12, color: cores.inapto, fontWeight: '600' },
  valor: { fontSize: 15, fontWeight: '700', color: cores.primaria },
});
