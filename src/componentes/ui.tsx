import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import type { Tendencia } from '../dominio/avaliacao';
import { cores, espaco } from '../tema';

export function Cartao({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[estilos.cartao, style]}>{children}</View>;
}

export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={estilos.titulo}>{children}</Text>;
}

export function TextoSuave({ children }: { children: ReactNode }) {
  return <Text style={estilos.suave}>{children}</Text>;
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <Text style={estilos.rotulo}>{children}</Text>;
}

export function Erro({ children }: { children: ReactNode }) {
  return <Text style={estilos.erro}>{children}</Text>;
}

type CampoProps = TextInputProps & { rotulo?: string; erro?: string };

export function Campo({ rotulo, erro, style, ...props }: CampoProps) {
  return (
    <View style={{ gap: 4 }}>
      {rotulo && <Rotulo>{rotulo}</Rotulo>}
      <TextInput
        placeholderTextColor={cores.textoSuave}
        style={[estilos.campo, erro ? { borderColor: cores.inapto } : null, style]}
        {...props}
      />
      {erro && <Erro>{erro}</Erro>}
    </View>
  );
}

interface Opcao<T extends string> {
  valor: T;
  rotulo: string;
}

export function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: Opcao<T>[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={estilos.segmentado}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onChange(o.valor)}
            accessibilityRole="button"
            accessibilityState={{ selected: ativo }}
            style={[estilos.segmento, ativo && estilos.segmentoAtivo]}
          >
            <Text style={[estilos.segmentoTexto, ativo && estilos.segmentoTextoAtivo]}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  desabilitado,
}: {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'perigo';
  desabilitado?: boolean;
}) {
  const primario = variante === 'primario';
  const corTexto = variante === 'perigo' ? cores.inapto : cores.primaria;
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      accessibilityRole="button"
      style={({ pressed }) => [
        estilos.botao,
        primario ? estilos.botaoPrimario : [estilos.botaoSecundario, { borderColor: corTexto }],
        (pressed || desabilitado) && { opacity: desabilitado ? 0.4 : 0.8 },
      ]}
    >
      <Text style={[estilos.botaoTexto, !primario && { color: corTexto }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Selo({ apto }: { apto: boolean }) {
  return (
    <View style={[estilos.selo, { backgroundColor: apto ? cores.apto : cores.inapto }]}>
      <Text style={estilos.seloTexto}>{apto ? 'APTO' : 'INAPTO'}</Text>
    </View>
  );
}

export function SeloPontos({ pontos, suficiente }: { pontos: number; suficiente: boolean }) {
  return (
    <View style={[estilos.selo, { backgroundColor: suficiente ? cores.apto : cores.inapto }]}>
      <Text style={estilos.seloTexto}>{pontos} PTS</Text>
    </View>
  );
}

const SETAS: Record<Tendencia, { simbolo: string; cor: string; rotulo: string }> = {
  melhorou: { simbolo: '▲', cor: cores.apto, rotulo: 'melhorou' },
  piorou: { simbolo: '▼', cor: cores.inapto, rotulo: 'piorou' },
  manteve: { simbolo: '=', cor: cores.textoSuave, rotulo: 'manteve' },
};

/** ▲ melhorou, ▼ piorou, = manteve; `texto` vem ao lado da seta (ex.: "+12 pts"). */
export function SetaTendencia({ tendencia, texto }: { tendencia: Tendencia | null; texto?: string }) {
  if (!tendencia) return null;
  const s = SETAS[tendencia];
  return (
    <Text style={[estilos.seta, { color: s.cor }]} accessibilityLabel={texto ? `${s.rotulo}, ${texto}` : s.rotulo}>
      {s.simbolo}
      {texto ? ` ${texto}` : ''}
    </Text>
  );
}

/** Texto pequeno à direita de um campo de exercício. */
export function Detalhe({ children }: { children: ReactNode }) {
  return <Text style={estilos.detalhe}>{children}</Text>;
}

export const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.m, gap: espaco.m, paddingBottom: espaco.g * 2 },
  cartao: {
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: espaco.m,
    borderWidth: 1,
    borderColor: cores.borda,
    gap: espaco.p,
  },
  titulo: { fontSize: 18, fontWeight: '700', color: cores.texto },
  suave: { fontSize: 13, color: cores.textoSuave },
  rotulo: { fontSize: 13, fontWeight: '600', color: cores.textoSuave },
  erro: { fontSize: 12, color: cores.inapto },
  campo: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: cores.texto,
    backgroundColor: '#fff',
  },
  segmentado: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: cores.primaria,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segmento: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentoAtivo: { backgroundColor: cores.primaria },
  segmentoTexto: { fontSize: 15, color: cores.primaria, fontWeight: '600' },
  segmentoTextoAtivo: { color: '#fff' },
  botao: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  botaoPrimario: { backgroundColor: cores.primaria },
  botaoSecundario: { borderWidth: 1, borderColor: cores.primaria, paddingVertical: 10 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  selo: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  seloTexto: { color: '#fff', fontSize: 12, fontWeight: '800' },
  seta: { fontSize: 13, fontWeight: '700' },
  detalhe: { fontSize: 13, color: cores.textoSuave, textAlign: 'right' },
});
