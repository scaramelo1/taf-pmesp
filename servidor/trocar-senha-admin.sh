#!/bin/bash
# Troca a senha da página de admin do ReadyTAF (rodar como root).
# A senha é digitada sem aparecer na tela e fica só em /etc/readytaf.env.
set -euo pipefail

ENV=/etc/readytaf.env

read -rsp "Senha nova do admin: " SENHA; echo
read -rsp "Repita a senha: " DE_NOVO; echo
if [ "$SENHA" != "$DE_NOVO" ]; then echo "As senhas não batem. Nada foi trocado."; exit 1; fi
if [ ${#SENHA} -lt 8 ]; then echo "Use pelo menos 8 caracteres. Nada foi trocado."; exit 1; fi
if [[ "$SENHA" == *$'\n'* || "$SENHA" == *'"'* || "$SENHA" == *'\'* ]]; then
  echo "Não use aspas duplas nem barra invertida. Nada foi trocado."; exit 1
fi

cp -a "$ENV" "/root/readytaf.env.antes-senha-$(date +%Y%m%d_%H%M%S)"
# Reescreve sem a linha antiga (sem sed: a senha pode ter caracteres especiais).
grep -v '^ADMIN_SENHA=' "$ENV" > "$ENV.novo" || true
printf 'ADMIN_SENHA="%s"\n' "$SENHA" >> "$ENV.novo"
chmod 600 "$ENV.novo"
mv "$ENV.novo" "$ENV"

# Reiniciar encerra as sessões abertas do admin: entra de novo com a senha nova.
systemctl restart readytaf
sleep 3
systemctl is-active readytaf
echo "Admin: $(curl -s -o /dev/null -w '%{http_code}' -m 10 https://fsadesigners.com.br/readytaf-api/admin) (tem que ser 200)"
echo "Senha trocada."
