# TAF PMESP

App Android/iOS para registrar treinos do TAF da PMESP e acompanhar a evolução
(apto/inapto, margem sobre o índice mínimo, melhorou/piorou por exercício e geral).

Expo SDK 58 · Expo Router · expo-sqlite (dados ficam só no aparelho).

## Rodar no seu PC

```bash
git clone https://github.com/scaramelo1/taf-pmesp.git
cd taf-pmesp
npm install
npx expo start
```

Leia o QR code com o app **Expo Go** (celular na mesma rede Wi-Fi do PC;
se não funcionar, use `npx expo start --tunnel`).

## Testes

As regras de avaliação ficam em `src/dominio` (TypeScript puro, sem React Native)
e são testadas com o test runner do Node (22.18+), sem dependências extras:

```bash
npm test
```

## Gerar APK

Builds pelo expo.dev (integração GitHub) usando o perfil `preview` do `eas.json`,
que gera `.apk`. O perfil `production` gera `.aab` para a Play Store.

## Estrutura

```
src/
  app/          telas (Expo Router: cada arquivo é uma rota)
  componentes/  componentes reutilizáveis
  db/           migrações e acesso ao SQLite
  dominio/      regras do TAF, avaliação e formatação (testado)
    regras/     índices por edital
```

## Atualizar índices de um novo edital

Edite `src/dominio/regras/candidato.ts` (índices e `EDITAL_CANDIDATO.id`) e
ajuste os testes em `src/dominio/__tests__`. Treinos antigos guardam o edital
com que foram registrados.
