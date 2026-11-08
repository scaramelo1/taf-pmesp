import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, Text, View } from 'react-native';

import { Botao, Campo, Cartao, estilos, Rotulo, Segmentado, TextoSuave } from '../../componentes/ui';
import { obterPerfil, salvarPerfil, type Modo } from '../../db/repositorio';
import { formatarData, hojeISO, lerData, mascararData } from '../../dominio/datas';
import type { Cargo, Sexo } from '../../dominio/tipos';
import { useConta, type EstadoBackup } from '../../hooks/useConta';
import { cores } from '../../tema';

/** Valida um campo de data opcional: vazio é aceito. */
const erroData = (texto: string) => (texto && !lerData(texto) ? 'Data inválida (DD/MM/AAAA)' : undefined);

export default function PerfilTela() {
  const db = useSQLiteContext();
  const { avisarMudanca, versaoDados, nome: primeiroNome, google } = useConta();
  const nomeGoogle = google?.nomeCompleto || primeiroNome;
  const [nome, setNome] = useState('');
  const [sexo, setSexo] = useState<Sexo>('M');
  const [cargo, setCargo] = useState<Cargo>('soldado');
  const [modo, setModo] = useState<Modo>('candidato');
  const [nascimento, setNascimento] = useState('');
  const [prova, setProva] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    obterPerfil(db).then((p) => {
      // Primeiro acesso: já sugere o nome da conta Google.
      if (!p) {
        setNome((atual) => atual || (nomeGoogle ?? ''));
        return;
      }
      setNome(p.nome);
      setSexo(p.sexo);
      setCargo(p.cargo);
      setModo(p.modo);
      setNascimento(p.dataNascimento ? formatarData(p.dataNascimento) : '');
      setProva(p.dataProva ? formatarData(p.dataProva) : '');
    });
  }, [db, versaoDados, nomeGoogle]);

  const efetivo = modo === 'efetivo';
  // No TAF-3 a idade define a faixa de pontos, então a data de nascimento é obrigatória.
  const erroNascimento =
    efetivo && !nascimento
      ? 'Obrigatória no modo Policial'
      : (erroData(nascimento) ?? ((lerData(nascimento) ?? '') > hojeISO() ? 'A data não pode estar no futuro' : undefined));
  const erroProva = erroData(prova);

  async function salvar() {
    setSalvando(true);
    try {
      await salvarPerfil(db, {
        nome: nome.trim(),
        sexo,
        cargo,
        modo,
        dataNascimento: lerData(nascimento),
        dataProva: lerData(prova),
      });
      avisarMudanca();
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

        <Rotulo>Sexo</Rotulo>
        <Segmentado
          valor={sexo}
          onChange={setSexo}
          opcoes={[
            { valor: 'M', rotulo: 'Masculino' },
            { valor: 'F', rotulo: 'Feminino' },
          ]}
        />

        {efetivo ? (
          <TextoSuave>Define a tabela do TAF-3 usada nos novos treinos.</TextoSuave>
        ) : (
          <>
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

      <CartaoConta />
    </ScrollView>
  );
}

const TEXTO_BACKUP: Record<EstadoBackup, string> = {
  ok: 'Backup em dia ✓',
  enviando: 'Enviando backup…',
  pendente: 'Backup pendente: será enviado quando houver internet.',
};

/** Conta Google, estado do backup, sair e apagar a conta. */
function CartaoConta() {
  const { nome, google, backup, enviarBackup, sair, apagarConta } = useConta();
  const nomeConta = google?.nomeCompleto || nome;
  const [ocupado, setOcupado] = useState(false);

  async function confirmarSaida() {
    setOcupado(true);
    const enviado = await enviarBackup();
    setOcupado(false);
    const aviso = enviado
      ? 'Seus treinos ficam guardados no backup. Para vê-los de novo, entre com a mesma conta Google.'
      : 'Não foi possível enviar o backup agora (sem internet?). Se sair, os treinos que ainda não foram enviados serão perdidos.';
    Alert.alert('Sair da conta', aviso, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => void sair() },
    ]);
  }

  function confirmarApagar() {
    Alert.alert(
      'Apagar conta',
      'Isso apaga sua conta, o backup na nuvem e os treinos deste celular. Não dá para desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar tudo',
          style: 'destructive',
          onPress: async () => {
            setOcupado(true);
            try {
              await apagarConta();
            } catch (e) {
              Alert.alert('Conta não apagada', (e as Error).message);
            } finally {
              setOcupado(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Cartao>
      <Rotulo>Conta Google</Rotulo>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {google?.foto ? (
          <Image source={{ uri: google.foto }} style={{ width: 56, height: 56, borderRadius: 28 }} />
        ) : (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: cores.borda,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: '700', color: cores.textoSuave }}>
              {(nomeConta || '?').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: cores.texto }}>{nomeConta || 'Conectado'}</Text>
          {google?.email ? <TextoSuave>{google.email}</TextoSuave> : null}
        </View>
      </View>
      <TextoSuave>{TEXTO_BACKUP[backup]}</TextoSuave>
      {google?.admin ? <Botao titulo="Painel do admin" onPress={() => router.push('/admin')} /> : null}
      <Botao titulo="Sair da conta" variante="secundario" onPress={confirmarSaida} desabilitado={ocupado} />
      <Botao titulo="Apagar conta e backup" variante="perigo" onPress={confirmarApagar} desabilitado={ocupado} />
    </Cartao>
  );
}
