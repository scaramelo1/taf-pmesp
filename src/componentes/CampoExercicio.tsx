import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { type Entrada, tipoEntrada } from '../dominio/entrada';
import type { Medida } from '../dominio/tipos';
import { cores } from '../tema';
import { Erro, Rotulo, estilos as ui } from './ui';

interface Props {
  rotulo: string;
  regra: Medida;
  entrada: Entrada;
  onChange: (e: Entrada) => void;
  /** undefined = vazio; null = inválido. */
  valor: number | null | undefined;
  /** Resultado mostrado ao lado do campo (apto/inapto, pontos…). */
  children?: ReactNode;
}

/** Campo de digitação de um exercício (formato conforme o tipo) com o resultado ao lado. */
export function CampoExercicio({ rotulo, regra, entrada, onChange, valor, children }: Props) {
  const tipo = tipoEntrada(regra);

  return (
    <View style={{ gap: 4 }}>
      <Rotulo>{rotulo}</Rotulo>
      <View style={estilos.linha}>
        {tipo === 'minseg' ? (
          <View style={estilos.linha}>
            <TextInput
              style={[ui.campo, estilos.curto]}
              value={entrada.min}
              onChangeText={(min) => onChange({ ...entrada, min: min.replace(/\D/g, '') })}
              placeholder="min"
              placeholderTextColor={cores.textoSuave}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={estilos.separador}>:</Text>
            <TextInput
              style={[ui.campo, estilos.curto]}
              value={entrada.seg}
              onChangeText={(seg) => onChange({ ...entrada, seg: seg.replace(/\D/g, '') })}
              placeholder="seg"
              placeholderTextColor={cores.textoSuave}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        ) : (
          <View style={estilos.linha}>
            <TextInput
              style={[ui.campo, estilos.medio]}
              value={entrada.texto}
              onChangeText={(texto) => onChange({ ...entrada, texto })}
              placeholder={tipo === 'inteiro' ? '0' : '0,00'}
              placeholderTextColor={cores.textoSuave}
              keyboardType={tipo === 'inteiro' ? 'number-pad' : 'decimal-pad'}
              maxLength={6}
            />
            <Text style={estilos.unidade}>{regra.unidade === 'reps' ? 'reps' : 's'}</Text>
          </View>
        )}

        {children && <View style={estilos.resultado}>{children}</View>}
      </View>
      {valor === null && <Erro>Valor inválido</Erro>}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  curto: { width: 64, textAlign: 'center' },
  medio: { width: 96, textAlign: 'center' },
  separador: { fontSize: 20, fontWeight: '700', color: cores.texto },
  unidade: { fontSize: 15, color: cores.textoSuave },
  resultado: { flex: 1, alignItems: 'flex-end', gap: 2 },
});
