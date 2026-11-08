import { SplashScreen, Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { migrar } from '../db/migracoes';
import { useAvisoDeVersao } from '../hooks/useAvisoDeVersao';
import { ProvedorConta, useConta } from '../hooks/useConta';
import { cores } from '../tema';

// A abertura fica na tela até saber se já existe uma conta neste aparelho.
SplashScreen.preventAutoHideAsync();

/** O login com Google é obrigatório: sem conta, só a tela de login existe. */
function Navegacao() {
  const { carregando, nome } = useConta();
  useAvisoDeVersao();
  if (carregando) return null;
  SplashScreen.hide();
  const logado = nome !== null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={logado}>
        <Stack.Screen name="(abas)" />
        <Stack.Screen
          name="admin"
          options={{
            headerShown: true,
            title: 'Painel do admin',
            headerStyle: { backgroundColor: cores.primaria },
            headerTintColor: '#fff',
          }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!logado}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="taf.db" onInit={migrar}>
      <StatusBar style="light" />
      <ProvedorConta>
        <Navegacao />
      </ProvedorConta>
    </SQLiteProvider>
  );
}
