import { Stack } from 'expo-router';

import { cores } from '../../tema';

export default function HistoricoLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: cores.primaria }, headerTintColor: '#fff' }}>
      <Stack.Screen name="index" options={{ title: 'Histórico' }} />
      <Stack.Screen name="[id]" options={{ title: 'Treino' }} />
    </Stack>
  );
}
