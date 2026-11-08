#!/bin/bash
# Liga o painel do admin do ReadyTAF e reinicia o servidor com o código novo (rodar como root).
# Uso: bash servidor/ligar-admin.sh [emails,separados,por,vírgula]
# Site: https://fsadesigners.com.br/readytaf-api/admin   (senha ADMIN_SENHA)
# App:  Perfil > Painel do admin, para as contas Google de ADMIN_EMAILS
set -euo pipefail

ENV=/etc/readytaf.env
EMAILS="${1:-fellipealexandre1@gmail.com,fsadesignerbr@gmail.com}"
cd /var/www/taf-pmesp

# Cópia do banco antes: o servidor novo acrescenta as colunas de e-mail e foto.
BANCO=/var/lib/private/readytaf/readytaf.db BACKUPS=/var/backups/readytaf node --no-warnings servidor/backup.ts
cp -a "$ENV" "/root/readytaf.env.antes-admin-$(date +%Y%m%d_%H%M%S)"

if ! grep -q '^ADMIN_SENHA=' "$ENV"; then
  echo "ADMIN_SENHA=$(openssl rand -base64 18 | tr -d '/+=')" >> "$ENV"
fi
if grep -q '^ADMIN_EMAILS=' "$ENV"; then
  sed -i "s/^ADMIN_EMAILS=.*/ADMIN_EMAILS=$EMAILS/" "$ENV"
else
  echo "ADMIN_EMAILS=$EMAILS" >> "$ENV"
fi
chmod 600 "$ENV"

systemctl restart readytaf
sleep 3
systemctl is-active readytaf
echo "API:        $(curl -s -m 10 https://fsadesigners.com.br/readytaf-api/saude)"
echo "Admin site: $(curl -s -o /dev/null -w '%{http_code}' -m 10 https://fsadesigners.com.br/readytaf-api/admin) (tem que ser 200)"
echo "Prancheta:  $(curl -s -m 10 https://fsadesigners.com.br/prancheta-api/saude)"
echo "Memória:    $(systemctl show readytaf -p MemoryCurrent --value) bytes"
echo
echo "Senha do admin: $(grep '^ADMIN_SENHA=' "$ENV" | cut -d= -f2-)"
echo "Admins no app:  $EMAILS"
