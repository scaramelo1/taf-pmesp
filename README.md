# ReadyTAF

App Android/iOS para registrar treinos do TAF da PMESP e acompanhar a evolução.

Dois modos, escolhidos no perfil:

- **Candidato**: apto/inapto pelos índices mínimos do concurso, com reteste
  (exceto 2400 m) e margem sobre o mínimo.
- **Policial (TAF-3)**: pontos pela tabela do efetivo masculino, conforme a
  faixa etária na data do treino; aprovação com soma ≥ 251 pts e ao menos
  20 pts em cada teste (natação não tem mínimo).

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

Candidato: edite `src/dominio/regras/candidato.ts` (índices e `EDITAL_CANDIDATO.id`).
TAF-3: `src/dominio/regras/taf3.ts` (linhas da tabela e pontos por faixa).
Ajuste os testes em `src/dominio/__tests__`. Treinos antigos guardam o edital
com que foram registrados.
