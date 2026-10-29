import { useState } from 'react';
import { View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { formatarDataCurta } from '../dominio/datas';
import type { PontoSerie } from '../dominio/desempenho';
import { escalaGrafico } from '../dominio/escala';
import { cores } from '../tema';
import { TextoSuave } from './ui';

interface Props {
  pontos: PontoSerie[];
  /** Texto das marcas do eixo Y. */
  formatar: (valor: number) => string;
  /** Linha tracejada (mínimo, 20 pts, soma mínima…). */
  referencia?: number | null;
  rotuloReferencia?: string;
  /** Eixo só com inteiros (repetições, pontos). */
  inteiro?: boolean;
}

const ALTURA = 160;
const EIXO_Y = 56;
const MARGEM = 14;
const LARGURA_ROTULO = 44;
/** Máximo de datas no eixo X; as demais ficam sem rótulo. */
const MAX_ROTULOS = 5;

/**
 * Gráfico de linha da evolução. O eixo Y começa em `escala.base` em vez de zero:
 * os valores são deslocados e as marcas recebem o texto do valor real.
 */
export function GraficoLinha({ pontos, formatar, referencia, rotuloReferencia, inteiro }: Props) {
  const [largura, setLargura] = useState(0);

  if (pontos.length === 0) return <TextoSuave>Sem treinos com este teste ainda.</TextoSuave>;

  const ref = referencia ?? null;
  const escala = escalaGrafico(
    ref !== null ? [...pontos.map((p) => p.valor), ref] : pontos.map((p) => p.valor),
    4,
    inteiro,
  );
  const area = Math.max(0, largura - EIXO_Y - 8);
  const spacing = pontos.length > 1 ? (area - 2 * MARGEM) / (pontos.length - 1) : 0;
  const cadaRotulo = Math.ceil(pontos.length / MAX_ROTULOS);

  const dados = pontos.map((p, i) => ({
    value: p.valor - escala.base,
    // Conta a partir do último para a data mais recente sempre aparecer.
    label: (pontos.length - 1 - i) % cadaRotulo === 0 ? formatarDataCurta(p.data) : '',
  }));

  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={{ minHeight: ALTURA + 40 }}>
      {area > 0 && (
        <LineChart
          data={dados}
          width={area}
          height={ALTURA}
          maxValue={escala.passo * escala.secoes}
          stepValue={escala.passo}
          noOfSections={escala.secoes}
          yAxisLabelTexts={escala.marcas.map(formatar)}
          yAxisLabelWidth={EIXO_Y}
          yAxisTextStyle={{ fontSize: 10, color: cores.textoSuave }}
          xAxisLabelTextStyle={{
            fontSize: 10,
            color: cores.textoSuave,
            width: LARGURA_ROTULO,
            marginLeft: (spacing - LARGURA_ROTULO) / 2,
          }}
          spacing={spacing}
          initialSpacing={MARGEM}
          endSpacing={MARGEM}
          disableScroll
          color={cores.destaque}
          thickness={2}
          dataPointsColor={cores.primaria}
          dataPointsRadius={4}
          rulesColor={cores.borda}
          xAxisColor={cores.borda}
          yAxisColor={cores.borda}
          showReferenceLine1={ref !== null}
          referenceLine1Position={ref !== null ? ref - escala.base : 0}
          referenceLine1Config={{
            color: cores.laranja,
            thickness: 1.5,
            dashWidth: 6,
            dashGap: 4,
            labelText: rotuloReferencia,
            labelTextStyle: { fontSize: 10, color: cores.laranja, fontWeight: '700' },
          }}
        />
      )}
    </View>
  );
}
