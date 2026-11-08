#!/bin/bash
# Publica a página de download em https://fsadesigners.com.br/readytaf/ (rodar como root).
# Uso: bash publicar.sh [arquivo.apk | link do EAS]   (o APK é opcional)
#   bash publicar.sh https://expo.dev/artifacts/eas/XXXX.apk
set -euo pipefail

ORIGEM="$(cd "$(dirname "$0")" && pwd)"
DESTINO=/var/www/fsa-designer/readytaf
CONF=/etc/apache2/sites-enabled/fsadesigners-le-ssl.conf

mkdir -p "$DESTINO"
cp "$ORIGEM/index.php" "$ORIGEM/baixar.php" "$ORIGEM/contador.php" "$ORIGEM/icone.png" "$ORIGEM/.htaccess" "$DESTINO/"
if [ $# -ge 1 ]; then
  NOVO="$DESTINO/readytaf.apk.novo"
  if [[ "$1" =~ ^https:// ]]; then
    echo "Baixando o APK..."
    curl -fsSL --retry 3 -m 900 -o "$NOVO" "$1"
  else
    cp "$1" "$NOVO"
  fi
  # Confere se é mesmo um APK antes de trocar (lista numa variável: "unzip | grep -q" falha com pipefail).
  LISTA=$(unzip -Z1 "$NOVO" 2>/dev/null || true)
  if [ "$(head -c 2 "$NOVO")" != "PK" ] || ! grep -qx 'AndroidManifest.xml' <<< "$LISTA"; then
    rm -f "$NOVO"
    echo "Falhou: o arquivo não é um APK. Nada foi trocado."
    exit 1
  fi
  mv "$NOVO" "$DESTINO/readytaf.apk"   # troca de uma vez: ninguém baixa pela metade
fi
[ -f "$DESTINO/downloads.txt" ] || echo 0 > "$DESTINO/downloads.txt"   # o total nunca é apagado
chown -R www-data:www-data "$DESTINO"

# A página é do próprio app: fica fora da marca d'água dos projetos de clientes.
if ! grep -q '|readytaf/' "$CONF"; then
  COPIA="/root/fsadesigners-le-ssl.conf.antes-readytaf-pagina-$(date +%Y%m%d_%H%M%S)"
  cp -a "$CONF" "$COPIA"
  sed -i 's#|readytaf-api/)\[^/\]+/">#|readytaf-api/|readytaf/)[^/]+/">#' "$CONF"
  if ! grep -q '|readytaf/' "$CONF" || ! apachectl configtest; then
    cp -a "$COPIA" "$CONF"
    echo "Falhou: Apache restaurado de $COPIA"
    exit 1
  fi
  systemctl reload apache2
fi

sleep 1
echo "Página:       $(curl -s -o /dev/null -w '%{http_code}' -m 10 https://fsadesigners.com.br/readytaf/)"
echo "Marca d'água: $(curl -s -m 10 https://fsadesigners.com.br/readytaf/ | grep -c marca-dagua || true) (tem que ser 0)"
echo "Downloads:    $(cat "$DESTINO/downloads.txt")"
echo "Prancheta:    $(curl -s -o /dev/null -w '%{http_code}' -m 10 https://fsadesigners.com.br/prancheta/)"
echo "FSA Designer: $(curl -s -o /dev/null -w '%{http_code}' -m 10 https://fsadesigners.com.br/)"
if [ -f "$DESTINO/readytaf.apk" ]; then
  echo "APK:          $(du -h "$DESTINO/readytaf.apk" | cut -f1)"
else
  echo "APK:          ainda não enviado (a página mostra 'em breve')"
fi
