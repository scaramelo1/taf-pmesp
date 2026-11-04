# ReadyTAF

App Android/iOS para registrar treinos do TAF da PMESP e acompanhar a evolução.

Dois modos, escolhidos no perfil:

- **Candidato**: apto/inapto pelos índices mínimos do concurso, com reteste
  (exceto 2400 m) e margem sobre o mínimo.
- **Policial (TAF-3)**: pontos pela tabela do efetivo masculino ou feminino
  (escolhido no perfil), conforme a faixa etária na data do treino; aprovação com soma ≥ 251 pts e ao menos
  20 pts em cada teste (natação não tem mínimo).

**Treino avulso**: em Novo treino dá para escolher só alguns testes (ex.: só a
corrida). Ele entra no desempenho de cada teste, mas não na nota geral, na
sequência de "pronto para a prova" nem na contagem de TAFs aptos. No TAF-3,
a natação é registrada mas por enquanto não soma nem reprova.

**Histórico** lista os treinos com ▲▼ em relação ao anterior, abre o detalhe e
permite excluir. **Desempenho** mostra a evolução (margem média ou pontos), treinos
aptos, "pronto para a prova" (3 treinos seguidos aptos), recorde e, por teste,
gráfico com a linha do mínimo/20 pts, melhor marca, média recente, tendência,
aprovação de primeira e o ponto fraco.

**Conta e backup**: o app abre pedindo login com Google (obrigatório). Os treinos
continuam no aparelho (funciona sem internet) e são enviados para o backup a cada
mudança; ao entrar em outro celular com a mesma conta, tudo volta. Treinos de dois
aparelhos são somados, e um treino excluído não volta. No Perfil dá para sair ou
apagar a conta e o backup.

Expo SDK 58 · Expo Router · expo-sqlite (banco no aparelho, com backup na nuvem) ·
gráficos com react-native-gifted-charts (react-native-svg + expo-linear-gradient).

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
  telas/        telas grandes usadas por mais de uma rota
  hooks/        carregamento de dados (useHistorico)
  db/           migrações e acesso ao SQLite
  dominio/      regras do TAF, avaliação, desempenho e formatação (testado)
    regras/     índices por edital
```

## Atualizar índices de um novo edital

Candidato: edite `src/dominio/regras/candidato.ts` (índices e `EDITAL_CANDIDATO.id`).
TAF-3: `src/dominio/regras/taf3.ts` (linhas da tabela e pontos por faixa).
Ajuste os testes em `src/dominio/__tests__`. Treinos antigos guardam o edital
com que foram registrados.

## Servidor (login e backup)

Fica em `servidor/` (Node 22 puro, `node:sqlite`, sem dependências) e roda na VPS em
https://fsadesigners.com.br/readytaf-api/ (porta 3101, serviço `readytaf`, até 80 MB).
Do Google guarda só o identificador da conta e o primeiro nome; nada de e-mail.

- Publicar ou atualizar: `bash servidor/instalar-vps.sh` (como root). Na primeira vez,
  copia as credenciais do Google do Prancheta FC para `/etc/readytaf.env`.
- No Google Cloud, a credencial precisa do URI de redirecionamento
  `https://fsadesigners.com.br/readytaf-api/auth/google/retorno`.
- Banco em `/var/lib/private/readytaf/`, backup diário em `/var/backups/readytaf/`.
- Testes: `npm test` também roda os testes do servidor.
