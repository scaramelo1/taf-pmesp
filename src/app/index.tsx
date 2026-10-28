import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { obterPerfil, type Perfil } from '../db/repositorio';
import { formatarValor } from '../dominio/formato';
import { EDITAL_CANDIDATO, regrasCandidato } from '../dominio/regras/candidato';
import { cores, espaco } from '../tema';

export default function Inicio() {
  const db = useSQLiteContext();
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useFocusEffect(
    useCallback(() => {
      obterPerfil(db).then(setPerfil);
    }, [db]),
  );

  const sexo = perfil?.sexo ?? 'M';
  const cargo = perfil?.cargo ?? 'soldado';
  const regras = regrasCandidato(sexo, cargo);

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      {!perfil && (
        <View style={[estilos.cartao, estilos.aviso]}>
          <Text style={estilos.titulo}>Configure seu perfil</Text>
          <Text style={estilos.suave}>
            Sexo e cargo definem os índices do seu TAF. Enquanto isso, mostramos os índices de Soldado masculino.
          </Text>
          <Link href="/perfil" style={estilos.link}>
            Ir para o perfil →
          </Link>
        </View>
      )}

      <View style={estilos.cartao}>
        <Text style={estilos.titulo}>Índices mínimos</Text>
        <Text style={estilos.suave}>
          {sexo === 'M' ? 'Masculino' : 'Feminino'} · {cargo === 'oficial' ? 'Aluno Oficial' : 'Soldado'}
        </Text>
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
        <Text style={[estilos.suave, { marginTop: espaco.p }]}>{EDITAL_CANDIDATO.descricao}</Text>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.m, gap: espaco.m },
  cartao: {
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: espaco.m,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  aviso: { borderColor: cores.alerta, gap: espaco.p },
  titulo: { fontSize: 18, fontWeight: '700', color: cores.texto },
  suave: { fontSize: 13, color: cores.textoSuave },
  link: { color: cores.primaria, fontWeight: '600', marginTop: 4 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  exercicio: { fontSize: 15, color: cores.texto },
  semReteste: { fontSize: 12, color: cores.inapto, fontWeight: '600' },
  valor: { fontSize: 15, fontWeight: '700', color: cores.primaria },
});
