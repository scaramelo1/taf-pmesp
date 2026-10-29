import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GraficoLinha } from '../componentes/GraficoLinha';
import { Cartao, SetaTendencia, estilos as ui, TextoSuave, Titulo } from '../componentes/ui';
import { formatarData, hojeISO, idadeEm } from '../dominio/datas';
import {
  avaliadosDoModo,
  desempenhoGeral,
  exerciciosCandidato,
  exerciciosEfetivo,
  pontoFraco,
  type DesempenhoExercicio,
} from '../dominio/desempenho';
import { formatarEixo, formatarNota, formatarPercentual, formatarValor } from '../dominio/formato';
import { regrasCandidato } from '../dominio/regras/candidato';
import { PONTOS_MINIMOS_TOTAL } from '../dominio/regras/taf3';
import type { Modo } from '../dominio/tipos';
import { useHistorico } from '../hooks/useHistorico';
import { cores, espaco } from '../tema';

const TEXTO_TENDENCIA = { melhorou: 'melhorando', piorou: 'piorando', manteve: 'estável' };

function Indicador({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <View style={estilos.indicador}>
      <Text style={estilos.indicadorRotulo}>{rotulo}</Text>
      {children}
    </View>
  );
}

function CartaoExercicio({ ex, modo, fraco }: { ex: DesempenhoExercicio; modo: Modo; fraco: boolean }) {
  const { medida } = ex;
  const valor = (v: number) => formatarValor(medida.unidade, v);
  return (
    <Cartao style={fraco ? { borderColor: cores.laranja, borderWidth: 2 } : undefined}>
      <View style={estilos.topo}>
        <Titulo>{medida.nome}</Titulo>
        {fraco && (
          <View style={[ui.selo, { backgroundColor: cores.laranja }]}>
            <Text style={ui.seloTexto}>PONTO FRACO</Text>
          </View>
        )}
      </View>
      {medida.direcao === 'menor' && <TextoSuave>Tempo: quanto menor, melhor.</TextoSuave>}

      <GraficoLinha
        pontos={ex.serie}
        formatar={(v) => formatarEixo(medida.unidade, v)}
        referencia={ex.referencia}
        rotuloReferencia={modo === 'candidato' ? 'mínimo' : '20 pts'}
        inteiro={medida.unidade === 'reps'}
      />

      {ex.serie.length > 0 && (
        <View style={estilos.indicadores}>
          <Indicador rotulo="Melhor marca">
            <Text style={estilos.indicadorValor}>{valor(ex.melhor!.valor)}</Text>
            <TextoSuave>{formatarData(ex.melhor!.data)}</TextoSuave>
          </Indicador>
          <Indicador rotulo={ex.serie.length >= 3 ? 'Média últ. 3' : 'Média'}>
            <Text style={estilos.indicadorValor}>
              {medida.unidade === 'reps' ? ex.mediaRecente!.toFixed(1).replace('.', ',') + ' reps' : valor(ex.mediaRecente!)}
            </Text>
            <TextoSuave>
              {modo === 'candidato'
                ? `margem ${formatarPercentual(ex.notaRecente!)}`
                : `${Math.round(ex.notaRecente!)} pts em média`}
            </TextoSuave>
          </Indicador>
          <Indicador rotulo="Tendência">
            {ex.tendencia ? (
              <SetaTendencia tendencia={ex.tendencia} texto={TEXTO_TENDENCIA[ex.tendencia]} />
            ) : (
              <TextoSuave>faça mais treinos</TextoSuave>
            )}
          </Indicador>
          {ex.taxaDePrimeira !== null && (
            <Indicador rotulo="Apto de primeira">
              <Text style={estilos.indicadorValor}>{Math.round(ex.taxaDePrimeira * 100)}%</Text>
              <TextoSuave>
                {ex.serie.length} {ex.serie.length === 1 ? 'treino' : 'treinos'}
              </TextoSuave>
            </Indicador>
          )}
        </View>
      )}
    </Cartao>
  );
}

export default function Desempenho() {
  const [dados] = useHistorico();
  if (!dados) return <View style={ui.tela} />;

  const { perfil, historico } = dados;
  const modo: Modo = perfil?.modo ?? 'candidato';
  const avaliados = avaliadosDoModo(historico, modo);

  if (avaliados.length === 0) {
    return (
      <View style={[ui.tela, ui.conteudo]}>
        <Cartao>
          <Titulo>Sem dados ainda</Titulo>
          <TextoSuave>
            Registre treinos como {modo === 'efetivo' ? 'Policial (TAF-3)' : 'Candidato'} para ver sua evolução aqui.
          </TextoSuave>
          <Link href="/novo-treino" style={estilos.link}>
            Registrar um treino →
          </Link>
        </Cartao>
      </View>
    );
  }

  const geral = desempenhoGeral(avaliados);
  const idade = perfil?.dataNascimento ? idadeEm(perfil.dataNascimento, hojeISO()) : avaliados[0].treino.idade;
  const exercicios =
    modo === 'candidato'
      ? exerciciosCandidato(avaliados, regrasCandidato(perfil?.sexo ?? 'M', perfil?.cargo ?? 'soldado'))
      : exerciciosEfetivo(avaliados, idade ?? 0);
  const fraco = pontoFraco(exercicios);
  const nomeFraco = exercicios.find((e) => e.medida.exercicio === fraco)?.medida.nome;
  const prova = modo === 'efetivo' ? 'o TAF' : 'a prova';

  return (
    <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo}>
      <Cartao>
        <Titulo>Evolução</Titulo>
        <TextoSuave>
          {modo === 'candidato'
            ? 'Margem média sobre os índices mínimos (cada teste conta até +20%).'
            : `Pontos totais por treino; aprovação com ${PONTOS_MINIMOS_TOTAL}.`}
        </TextoSuave>
        <GraficoLinha
          pontos={geral.serie}
          formatar={(v) => (modo === 'candidato' ? formatarPercentual(v) : String(Math.round(v)))}
          referencia={modo === 'candidato' ? 0 : PONTOS_MINIMOS_TOTAL}
          rotuloReferencia={modo === 'candidato' ? 'mínimo' : `${PONTOS_MINIMOS_TOTAL} pts`}
          inteiro={modo === 'efetivo'}
        />

        <View style={[estilos.pronto, { backgroundColor: geral.pronto ? cores.apto : cores.fundo }]}>
          <Text style={[estilos.prontoTitulo, geral.pronto && { color: '#fff' }]}>
            {geral.pronto ? `Pronto para ${prova}!` : `Ainda não pronto para ${prova}`}
          </Text>
          <Text style={[estilos.prontoTexto, geral.pronto && { color: '#fff' }]}>
            {geral.pronto
              ? `${geral.sequencia} treinos seguidos aptos em todos os testes.`
              : `${geral.sequencia} de 3 treinos seguidos aptos em todos os testes.`}
          </Text>
        </View>

        <View style={estilos.indicadores}>
          <Indicador rotulo="Treinos aptos">
            <Text style={estilos.indicadorValor}>
              {geral.aptos}/{geral.total}
            </Text>
          </Indicador>
          <Indicador rotulo="Recorde pessoal">
            {geral.recorde ? (
              <>
                <Text style={estilos.indicadorValor}>{formatarNota(modo, geral.recorde.valor)}</Text>
                <TextoSuave>{formatarData(geral.recorde.data)}</TextoSuave>
              </>
            ) : (
              <TextoSuave>faça um treino com todos os testes</TextoSuave>
            )}
          </Indicador>
        </View>
      </Cartao>

      {nomeFraco && (
        <Cartao style={{ borderColor: cores.laranja }}>
          <Text style={estilos.fracoTitulo}>Ponto fraco: {nomeFraco}</Text>
          <TextoSuave>
            {modo === 'candidato'
              ? 'É o teste com a menor margem sobre o mínimo nos seus últimos treinos. Priorize ele.'
              : 'É o teste que menos rende pontos nos seus últimos treinos. Priorize ele.'}
          </TextoSuave>
        </Cartao>
      )}

      {exercicios.map((ex) => (
        <CartaoExercicio key={ex.medida.exercicio} ex={ex} modo={modo} fraco={ex.medida.exercicio === fraco} />
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  link: { color: cores.destaque, fontWeight: '600', marginTop: 4 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaco.p },
  pronto: { borderRadius: 10, padding: 12, gap: 2 },
  prontoTitulo: { fontSize: 16, fontWeight: '800', color: cores.texto },
  prontoTexto: { fontSize: 13, color: cores.textoSuave },
  indicadores: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.p },
  indicador: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  indicadorRotulo: { fontSize: 12, fontWeight: '600', color: cores.textoSuave },
  indicadorValor: { fontSize: 17, fontWeight: '800', color: cores.primaria },
  fracoTitulo: { fontSize: 16, fontWeight: '700', color: cores.laranja },
});
