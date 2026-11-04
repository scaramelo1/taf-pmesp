import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { cores } from '../../tema';

type NomeIcone = ComponentProps<typeof Ionicons>['name'];

// A tab bar sempre passa a cor como string; o tipo ColorValue do RN inclui null.
const icone =
  (nome: NomeIcone) =>
  ({ color, size }: { color: unknown; size: number }) => <Ionicons name={nome} color={color as string} size={size} />;

export default function AbasLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: cores.primaria },
        headerTintColor: '#fff',
        tabBarActiveTintColor: cores.destaque,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', headerTitle: 'ReadyTAF', tabBarIcon: icone('home') }} />
      <Tabs.Screen name="novo-treino" options={{ title: 'Novo treino', tabBarIcon: icone('add-circle') }} />
      <Tabs.Screen
        name="historico"
        options={{ title: 'Histórico', headerShown: false, tabBarIcon: icone('list') }}
      />
      <Tabs.Screen name="desempenho" options={{ title: 'Desempenho', tabBarIcon: icone('stats-chart') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icone('person') }} />
    </Tabs>
  );
}
