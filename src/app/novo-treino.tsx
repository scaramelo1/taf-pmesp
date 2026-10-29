import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Cartao, estilos as ui, TextoSuave, Titulo } from '../componentes/ui';
import { obterPerfil, type Perfil } from '../db/repositorio';
import { NovoTreinoCandidato } from '../telas/NovoTreinoCandidato';
import { NovoTreinoEfetivo } from '../telas/NovoTreinoEfetivo';
import { cores } from '../tema';

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <View style={[ui.tela, ui.conteudo]}>
      <Cartao>
        <Titulo>{titulo}</Titulo>
        <TextoSuave>{texto}</TextoSuave>
        <Link href="/perfil" style={estilos.link}>
          Ir para o perfil →
        </Link>
      </Cartao>
    </View>
  );
}

export default function NovoTreino() {
  const db = useSQLiteContext();
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      obterPerfil(db).then(setPerfil);
    }, [db]),
  );

  if (perfil === undefined) return <View style={ui.tela} />;

  if (perfil === null) {
    return <Aviso titulo="Configure seu perfil primeiro" texto="Seu perfil define quais testes e índices valem para você." />;
  }

  if (perfil.modo === 'efetivo') {
    if (!perfil.dataNascimento) {
      return (
        <Aviso titulo="Informe sua data de nascimento" texto="No TAF-3 a pontuação depende da sua faixa etária." />
      );
    }
    return <NovoTreinoEfetivo perfil={perfil} nascimento={perfil.dataNascimento} />;
  }

  return <NovoTreinoCandidato perfil={perfil} />;
}

const estilos = StyleSheet.create({
  link: { color: cores.destaque, fontWeight: '600', marginTop: 4 },
});
