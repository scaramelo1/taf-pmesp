#!/bin/bash
# Publica o servidor do ReadyTAF em https://fsadesigners.com.br/readytaf-api/ (rodar como root).
# Se algo falhar, restaura o Apache.
set -euo pipefail

CONF=/etc/apache2/sites-enabled/fsadesigners-le-ssl.conf
COPIA="/root/fsadesigners-le-ssl.conf.antes-readytaf-$(date +%Y%m%d_%H%M%S)"
ENV=/etc/readytaf.env

# Credenciais do Google: na primeira vez, usa as mesmas do Prancheta FC.
if [ ! -f "$ENV" ]; then
  if [ -f /etc/prancheta-fc.env ]; then
    grep -E '^GOOGLE_CLIENT_(ID|SECRET)=' /etc/prancheta-fc.env > "$ENV"
  else
    printf 'GOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\n' > "$ENV"
    echo "Preencha $ENV com as credenciais do Google e rode de novo."
  fi
  chmod 600 "$ENV"
fi

cp -a "$CONF" "$COPIA"
restaurar() {
  cp -a "$COPIA" "$CONF"
  apachectl configtest && systemctl reload apache2
  echo "Falhou: Apache restaurado de $COPIA"
}
trap restaurar ERR

if ! grep -q 'readytaf-api' "$CONF"; then
  python3 - "$CONF" <<'PY'
import re, sys
caminho = sys.argv[1]
texto = open(caminho).read()
log = '    ErrorLog ${APACHE_LOG_DIR}/fsadesigners_erro.log'
bloco = '''    # ReadyTAF: login com Google e backup dos treinos, servido pelo Node só em 127.0.0.1
    <Location "/readytaf-api/">
        ProxyPass "http://127.0.0.1:3101/"
        ProxyPassReverse "http://127.0.0.1:3101/"
        RequestHeader set X-Real-IP "%{REMOTE_ADDR}s"
        Header always set X-Robots-Tag "noindex, nofollow"
    </Location>

'''
# A API não pode receber a marca d'água dos projetos de clientes.
regra = re.search(r'<LocationMatch "\^/\(\?!([^)]*)\)\[\^/\]\+/">', texto)
assert regra and log in texto
nova = regra.group(0).replace(regra.group(1), regra.group(1) + '|readytaf-api/')
texto = texto.replace(regra.group(0), nova, 1)
open(caminho, 'w').write(texto.replace(log, bloco + log, 1))
PY
fi
apachectl configtest

cp /var/www/taf-pmesp/servidor/readytaf.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable readytaf
systemctl restart readytaf
sleep 3
systemctl is-active readytaf
curl -sf -m 5 http://127.0.0.1:3101/saude

cat > /etc/cron.d/readytaf-backup <<'CRON'
# Backup diário do banco do ReadyTAF, às 4h40
40 4 * * * root cd /var/www/taf-pmesp && BANCO=/var/lib/private/readytaf/readytaf.db BACKUPS=/var/backups/readytaf /usr/bin/node --no-warnings servidor/backup.ts
CRON

systemctl reload apache2
sleep 2
trap - ERR

echo
echo "API ReadyTAF: $(curl -s -m 10 https://fsadesigners.com.br/readytaf-api/saude)"
echo "Prancheta:    $(curl -s -m 10 https://fsadesigners.com.br/prancheta-api/saude)"
echo "FSA Designer: $(curl -s -o /dev/null -w '%{http_code}' -m 10 https://fsadesigners.com.br/)"
echo "Aldoria:      $(curl -s -o /dev/null -w '%{http_code}' -m 10 https://aldoria.com.br/)"
echo "Sistema PM:   $(curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1/)"
echo "Memória:      $(systemctl show readytaf -p MemoryCurrent --value) bytes"
echo "Cópia do Apache: $COPIA"
echo
echo "Falta 1 passo no Google Cloud (credenciais do Prancheta FC):"
echo "  adicionar o URI de redirecionamento https://fsadesigners.com.br/readytaf-api/auth/google/retorno"
