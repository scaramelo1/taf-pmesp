import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';

import { migrar } from '../db/migracoes';
import { cores } from '../tema';

type NomeIcone = ComponentProps<typeof Ionicons>['name'];

// A tab bar sempre passa a cor como string; o tipo ColorValue do RN inclui null.
const icone =
  (nome: NomeIcone) =>
  ({ color, size }: { color: unknown; size: number }) => <Ionicons name={nome} color={color as string} size={size} />;

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="taf.db" onInit={migrar}>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: cores.primaria },
          headerTintColor: '#fff',
          tabBarActiveTintColor: cores.destaque,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Início', headerTitle: 'ReadyTAF', tabBarIcon: icone('home') }} />
        <Tabs.Screen name="novo-treino" options={{ title: 'Novo treino', tabBarIcon: icone('add-circle') }} />
        <Tabs.Screen name="historico" options={{ title: 'Histórico', tabBarIcon: icone('list') }} />
        <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icone('person') }} />
      </Tabs>
    </SQLiteProvider>
  );
}
