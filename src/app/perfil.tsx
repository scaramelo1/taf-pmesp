import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { Botao, Campo, Cartao, estilos, Rotulo, Segmentado, TextoSuave } from '../componentes/ui';
import { obterPerfil, salvarPerfil, type Modo } from '../db/repositorio';
import { formatarData, lerData, mascararData } from '../dominio/datas';
import type { Cargo, Sexo } from '../dominio/tipos';

/** Valida um campo de data opcional: vazio é aceito. */
const erroData = (texto: string) => (texto && !lerData(texto) ? 'Data inválida (DD/MM/AAAA)' : undefined);

export default function PerfilTela() {
  const db = useSQLiteContext();
  const [nome, setNome] = useState('');
  const [sexo, setSexo] = useState<Sexo>('M');
  const [cargo, setCargo] = useState<Cargo>('soldado');
  const [modo, setModo] = useState<Modo>('candidato');
  const [nascimento, setNascimento] = useState('');
  const [prova, setProva] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    obterPerfil(db).then((p) => {
      if (!p) return;
      setNome(p.nome);
      setSexo(p.sexo);
      setCargo(p.cargo);
      setModo(p.modo);
      setNascimento(p.dataNascimento ? formatarData(p.dataNascimento) : '');
      setProva(p.dataProva ? formatarData(p.dataProva) : '');
    });
  }, [db]);

  const efetivo = modo === 'efetivo';
  // No TAF-3 a idade define a faixa de pontos, então a data de nascimento é obrigatória.
  const erroNascimento = efetivo && !nascimento ? 'Obrigatória no modo Policial' : erroData(nascimento);
  const erroProva = erroData(prova);

  async function salvar() {
    setSalvando(true);
    try {
      await salvarPerfil(db, {
        nome: nome.trim(),
        sexo: efetivo ? 'M' : sexo,
        cargo,
        modo,
        dataNascimento: lerData(nascimento),
        dataProva: lerData(prova),
      });
      Alert.alert('Perfil salvo', 'Os índices do seu TAF foram atualizados.');
      router.navigate('/');
    } catch (e) {
      Alert.alert('Erro ao salvar', String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <Cartao>
        <Rotulo>Eu sou</Rotulo>
        <Segmentado
          valor={modo}
          onChange={setModo}
          opcoes={[
            { valor: 'candidato', rotulo: 'Candidato' },
            { valor: 'efetivo', rotulo: 'Policial (TAF-3)' },
          ]}
        />
        <TextoSuave>
          {efetivo
            ? 'Pontuação pela tabela do TAF-3 do efetivo, conforme sua faixa etária.'
            : 'Apto/inapto pelos índices mínimos do concurso de ingresso.'}
        </TextoSuave>
      </Cartao>

      <Cartao>
        <Campo rotulo="Nome" value={nome} onChangeText={setNome} placeholder="Seu nome" autoCapitalize="words" />

        {efetivo ? (
          <TextoSuave>A tabela do TAF-3 disponível no app é a do efetivo masculino.</TextoSuave>
        ) : (
          <>
            <Rotulo>Sexo</Rotulo>
            <Segmentado
              valor={sexo}
              onChange={setSexo}
              opcoes={[
                { valor: 'M', rotulo: 'Masculino' },
                { valor: 'F', rotulo: 'Feminino' },
              ]}
            />

            <Rotulo>Cargo pretendido</Rotulo>
            <Segmentado
              valor={cargo}
              onChange={setCargo}
              opcoes={[
                { valor: 'soldado', rotulo: 'Soldado' },
                { valor: 'oficial', rotulo: 'Aluno Oficial' },
              ]}
            />
            <TextoSuave>Aluno Oficial também faz natação 50 m.</TextoSuave>
          </>
        )}
      </Cartao>

      <Cartao>
        <Campo
          rotulo={efetivo ? 'Data do próximo TAF (opcional)' : 'Data da prova (opcional)'}
          value={prova}
          onChangeText={(t) => setProva(mascararData(t))}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
          erro={erroProva}
        />
        <Campo
          rotulo={efetivo ? 'Data de nascimento' : 'Data de nascimento (opcional)'}
          value={nascimento}
          onChangeText={(t) => setNascimento(mascararData(t))}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
          erro={erroNascimento}
        />
        <TextoSuave>A data da prova ativa a contagem regressiva na tela inicial.</TextoSuave>
      </Cartao>

      <Botao titulo="Salvar perfil" onPress={salvar} desabilitado={salvando || !!erroNascimento || !!erroProva} />
    </ScrollView>
  );
}
