import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useConta } from '../hooks/useConta';
import { cores, espaco } from '../tema';

export default function Login() {
  const { entrarComGoogle } = useConta();
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const entrar = async () => {
    setEntrando(true);
    setErro(null);
    try {
      await entrarComGoogle();
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setEntrando(false);
    }
  };

  return (
    <View style={estilos.tela}>
      <Image source={require('../../assets/splash-icon.png')} style={estilos.logo} resizeMode="contain" />
      <Text style={estilos.titulo}>Bem-vindo ao ReadyTAF</Text>
      <Text style={estilos.texto}>
        Entre com sua conta Google para guardar seus treinos com segurança. Se trocar de celular, é só entrar de novo
        que tudo volta.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: entrando }}
        disabled={entrando}
        onPress={entrar}
        style={({ pressed }) => [estilos.botao, (pressed || entrando) && { opacity: 0.7 }]}
      >
        {entrando ? <ActivityIndicator color="#1F1F1F" /> : <Ionicons name="logo-google" size={20} color="#1F1F1F" />}
        <Text style={estilos.botaoTexto}>{entrando ? 'Entrando…' : 'Entrar com Google'}</Text>
      </Pressable>

      {erro && <Text style={estilos.erro}>{erro}</Text>}
      <Text style={estilos.privacidade}>
        Do Google usamos só o seu primeiro nome. Não pegamos e-mail, contatos nem fotos.
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, justifyContent: 'center', padding: espaco.g, gap: espaco.m, backgroundColor: cores.primaria },
  logo: { width: 180, height: 180, alignSelf: 'center' },
  titulo: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  texto: { color: '#C9D3E0', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: espaco.p,
  },
  botaoTexto: { color: '#1F1F1F', fontSize: 15, fontWeight: '700' },
  erro: { color: '#FF8A80', fontSize: 14, textAlign: 'center' },
  privacidade: { color: '#8FA0B5', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
