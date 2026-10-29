import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Cartao, Selo, SeloPontos, estilos as ui, TextoSuave, Titulo } from '../componentes/ui';
import { listarTreinos, obterPerfil, type Perfil, type Treino } from '../db/repositorio';
import { avaliarTreino } from '../dominio/avaliacao';
import { diasEntre, formatarData, hojeISO, idadeEm } from '../dominio/datas';
import { descreverDiferenca, formatarValor } from '../dominio/formato';
import { avaliarTreinoPontos, faixaDaIdade, valorParaPontos } from '../dominio/pontuacao';
import { EDITAL_CANDIDATO, EDITAL_TAF3, ehEfetivo, regrasDoTreino, TABELAS_TAF3 } from '../dominio/regras';
import { regrasCandidato } from '../dominio/regras/candidato';
import { PONTOS_MINIMOS_TOTAL, PONTOS_SUFICIENCIA, rotuloFaixa } from '../dominio/regras/taf3';
import { cores, espaco } from '../tema';

function UltimoCandidato({ treino }: { treino: Treino }) {
  const av = avaliarTreino(regrasDoTreino(treino), treino.resultados);
  return (
    <>
      <Text style={estilos.resumo}>
        Aptos: {av.aptos} de {av.avaliados}
        {av.pendentes.length > 0 ? ` · ${av.pendentes.length} não feito(s)` : ''}
      </Text>
      {av.exercicios.map((e) => (
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
    </>
  );
}

function UltimoEfetivo({ treino, idade }: { treino: Treino; idade: number }) {
  const av = avaliarTreinoPontos(TABELAS_TAF3, idade, treino.resultados);
  return (
    <>
      <Text style={estilos.resumo}>
        Total: {av.soma} de {PONTOS_MINIMOS_TOTAL} pts
        {av.pendentes.length > 0 ? ` · ${av.pendentes.length} não feito(s)` : ''}
      </Text>
      <Text style={[estilos.semReteste, av.aptoGeral && { color: cores.apto }]}>
        {av.aptoGeral
          ? 'APTO no TAF-3'
          : av.faltaTotal > 0
            ? `Faltam ${av.faltaTotal} pts para o mínimo`
            : av.completo
              ? 'Soma atingida, mas há teste abaixo de 20 pts'
              : 'Faça os 6 testes para o resultado completo'}
      </Text>
      {av.exercicios.map(({ tabela, avaliacao }) => (
        <View key={tabela.exercicio} style={estilos.linha}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.exercicio}>{tabela.nome}</Text>
            <TextoSuave>
              {formatarValor(tabela.unidade, avaliacao.valor)}
              {avaliacao.proximo
                ? ` · ${descreverDiferenca(tabela, -avaliacao.proximo.falta)} p/ ${avaliacao.proximo.pontos}`
                : ' · máximo'}
            </TextoSuave>
          </View>
          <SeloPontos pontos={avaliacao.pontos} suficiente={avaliacao.suficiente} />
        </View>
      ))}
    </>
  );
}

function IndicesCandidato({ perfil }: { perfil: Perfil | null }) {
  const sexo = perfil?.sexo ?? 'M';
  const cargo = perfil?.cargo ?? 'soldado';
  return (
    <Cartao>
      <Titulo>Índices mínimos</Titulo>
      <TextoSuave>
        {sexo === 'M' ? 'Masculino' : 'Feminino'} · {cargo === 'oficial' ? 'Aluno Oficial' : 'Soldado'}
      </TextoSuave>
      {regrasCandidato(sexo, cargo).map((r) => (
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
  );
}

function TabelaEfetivo({ idade }: { idade: number }) {
  return (
    <Cartao>
      <Titulo>Sua tabela ({idade} anos)</Titulo>
      <View style={estilos.linha}>
        <Text style={[estilos.exercicio, { flex: 1 }]} />
        <Text style={estilos.colunaTitulo}>20 pts</Text>
        <Text style={estilos.colunaTitulo}>100 pts</Text>
      </View>
      {TABELAS_TAF3.map((t) => {
        const suf = t.temSuficiencia ? valorParaPontos(t, idade, PONTOS_SUFICIENCIA) : null;
        const max = valorParaPontos(t, idade, 100);
        return (
          <View key={t.exercicio} style={estilos.linha}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.exercicio}>{t.nome}</Text>
              <TextoSuave>faixa {rotuloFaixa(t, faixaDaIdade(t, idade))}</TextoSuave>
            </View>
            <Text style={estilos.coluna}>{suf !== null ? formatarValor(t.unidade, suf) : '—'}</Text>
            <Text style={estilos.coluna}>{max !== null ? formatarValor(t.unidade, max) : '—'}</Text>
          </View>
        );
      })}
      <TextoSuave>
        Aprovação: soma de {PONTOS_MINIMOS_TOTAL} pts nos 6 testes e ao menos 20 pts em cada um (natação não tem
        mínimo). {EDITAL_TAF3.descricao}.
      </TextoSuave>
    </Cartao>
  );
}

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

  const hoje = hojeISO();
  const efetivo = perfil?.modo === 'efetivo';
  const idadeHoje = perfil?.dataNascimento ? idadeEm(perfil.dataNascimento, hoje) : null;
  const diasProva = perfil?.dataProva ? diasEntre(hoje, perfil.dataProva) : null;
  const idadeUltimo = ultimo ? (ultimo.idade ?? idadeHoje) : null;

  return (
    <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo}>
      {!perfil && (
        <Cartao style={{ borderColor: cores.alerta }}>
          <Titulo>Configure seu perfil</Titulo>
          <TextoSuave>
            Escolha entre candidato (concurso) e policial (TAF-3). Enquanto isso, mostramos os índices de Soldado
            masculino.
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
            {diasProva === 0
              ? 'é o dia do teste'
              : `${diasProva === 1 ? 'dia' : 'dias'} para ${efetivo ? 'o TAF' : 'a prova'}`}
          </Text>
        </Cartao>
      )}

      {ultimo && (
        <Cartao>
          <View style={estilos.linhaTopo}>
            <Titulo>Último treino</Titulo>
            <TextoSuave>{formatarData(ultimo.data)}</TextoSuave>
          </View>
          {!ehEfetivo(ultimo.edital) ? (
            <UltimoCandidato treino={ultimo} />
          ) : idadeUltimo !== null ? (
            <UltimoEfetivo treino={ultimo} idade={idadeUltimo} />
          ) : (
            <TextoSuave>Informe a data de nascimento no perfil para calcular os pontos.</TextoSuave>
          )}
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

      {efetivo ? (
        idadeHoje !== null ? (
          <TabelaEfetivo idade={idadeHoje} />
        ) : (
          <Cartao>
            <TextoSuave>Informe sua data de nascimento no perfil para ver sua tabela do TAF-3.</TextoSuave>
          </Cartao>
        )
      ) : (
        <IndicesCandidato perfil={perfil} />
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  link: { color: cores.destaque, fontWeight: '600', marginTop: 4 },
  contagem: { backgroundColor: cores.primaria, borderColor: cores.primaria, alignItems: 'center' },
  contagemNumero: { fontSize: 40, fontWeight: '800', color: cores.laranja },
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
  colunaTitulo: { width: 64, textAlign: 'right', fontSize: 12, fontWeight: '700', color: cores.textoSuave },
  coluna: { width: 64, textAlign: 'right', fontSize: 14, fontWeight: '700', color: cores.primaria },
});
