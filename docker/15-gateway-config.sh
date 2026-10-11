#!/bin/sh
# Parámetros del gateway que dependen de cuántas réplicas hay detrás y del equipo (decisión del dueño, 2026-10-07:
# «todo debe ser 100 % parametrizable»): llegan como variables NGINX_* desde docker-compose.yml (sus valores viven en
# el .env de la raíz; README §7 "docker compose" y "Escalar en cualquier momento") y aquí se escriben en la
# configuración de Nginx con envsubst, SOLO esas variables: las $variables propias de Nginx ($host, $request_id...)
# quedan intactas. Un valor que falta toma el MISMO valor por omisión que docker-compose.yml y el .env de la raíz
# (./scripts/quality.sh lo verifica). Cada valor se valida antes (termina dentro de la configuración):
#   - los numéricos y de tamaño: solo letras, números y punto (auto, 8192, 4s, 27m);
#   - los de una cabecera de seguridad (CSP, COOP, COEP, HSTS): texto de cabecera, que PUEDE ir vacío (= la cabecera
#     no se envía) y nunca puede llevar " $ ` { } \ (romperían la configuración o inyectarían una variable de Nginx).
# Además calcula el hash del script EN LÍNEA del index.html publicado para la CSP (ver csp_script_hashes).
set -e

# ---------- Hash de los scripts en línea (CSP, brecha A1 de docs/rd/certificaciones-seguridad-2026-10-08.md) ----------
# El index.html construido lleva UN script en línea: el aviso «Actualiza tu navegador» (decisión D-C1), que
# vite.config.ts compila aparte e inserta al final del <body>. Una CSP sin 'unsafe-inline' tiene que autorizarlo por
# su hash, y el hash cambia con cada compilación de ese guion. Se calcula AQUÍ, del archivo que de verdad se publica:
# así nunca queda desalineado y nadie tiene que acordarse de actualizarlo a mano.
HTML_INDEX="${NGINX_HTML_INDEX:-/usr/share/nginx/html/index.html}"

# Cuerpo EXACTO del n-ésimo <script> sin atributos de un HTML: `printf` en lugar de `print` para no agregar el salto
# de línea final que cambiaría el hash. Un script de varias líneas se vuelve a unir con su mismo salto.
inline_script_body() {
  awk -v want="$2" '
    BEGIN { n = 0; inside = 0; sep = "" }
    {
      line = $0
      while (1) {
        if (!inside) {
          i = index(line, "<script>")
          if (i == 0) break
          n++; inside = 1; sep = ""
          line = substr(line, i + 8)
          continue
        }
        j = index(line, "</script>")
        if (j == 0) { if (n == want) { printf "%s%s", sep, line; sep = "\n" } break }
        if (n == want) { printf "%s%s", sep, substr(line, 1, j - 1); exit }
        inside = 0
        line = substr(line, j + 9)
      }
    }
  ' "$1"
}

# Los hashes ('sha256-...') de TODOS los scripts en línea de un HTML, separados por espacio. Sin scripts en línea no
# imprime nada y la CSP queda sin hashes (que es lo correcto). Sin openssl no se inventa nada: se avisa y la CSP sale
# sin el hash (el aviso de navegador antiguo no se dibujaría; el servicio no se cae por eso, regla 7).
csp_script_hashes() {
  html="$1"
  if [ ! -f "$html" ]; then
    echo "Gateway: no se encontró $html; la CSP queda sin el hash del script en línea" >&2
    return 0
  fi
  if ! command -v openssl >/dev/null 2>&1; then
    echo "Gateway: sin openssl no se puede calcular el hash del script en línea; la CSP queda sin él" >&2
    return 0
  fi
  total=$(grep -o '<script>' "$html" | wc -l | tr -d ' ')
  i=1
  while [ "$i" -le "$total" ]; do
    printf "'sha256-%s' " "$(inline_script_body "$html" "$i" | openssl dgst -sha256 -binary | openssl base64 -A)"
    i=$((i + 1))
  done
}

# Modo de prueba (lo usa webapp-employee-time-clock/src/utils/securityHeaders.test.ts): imprime los hashes de un HTML
# y termina. El entrypoint de Nginx nunca pasa argumentos, así que en producción esta rama no existe.
if [ "$1" = "--csp-script-hashes" ]; then
  csp_script_hashes "${2:-$HTML_INDEX}"
  echo
  exit 0
fi

# ---------- Valores por omisión (los MISMOS de docker-compose.yml y del .env de la raíz) ----------
: "${NGINX_WORKER_PROCESSES:=auto}"
: "${NGINX_WORKER_CONNECTIONS:=8192}"
: "${NGINX_UPSTREAM_KEEPALIVE:=64}"
: "${NGINX_UPSTREAM_KEEPALIVE_REQUESTS:=100}"
: "${NGINX_UPSTREAM_KEEPALIVE_TIMEOUT:=4s}"
: "${NGINX_UPSTREAM_MAX_FAILS:=1}"
: "${NGINX_UPSTREAM_FAIL_TIMEOUT:=10s}"
: "${NGINX_RESOLVER_VALID:=5s}"
: "${NGINX_PROXY_CONNECT_TIMEOUT:=5s}"
: "${NGINX_PROXY_READ_TIMEOUT:=60s}"
: "${NGINX_PROXY_NEXT_UPSTREAM_TRIES:=3}"
: "${NGINX_PROXY_NEXT_UPSTREAM_TIMEOUT:=15s}"
: "${NGINX_WS_READ_TIMEOUT:=600s}"
: "${NGINX_CLIENT_MAX_BODY_SIZE:=27m}"
: "${NGINX_CSP_REPORT_ONLY:=false}"
: "${NGINX_CSP_CONNECT_EXTRA:=}"
: "${NGINX_CSP_EXTRA:=}"
: "${NGINX_COOP:=same-origin}"
: "${NGINX_COEP:=credentialless}"
: "${NGINX_HSTS:=max-age=31536000; includeSubDomains}"
NAMES="NGINX_WORKER_PROCESSES NGINX_WORKER_CONNECTIONS NGINX_UPSTREAM_KEEPALIVE NGINX_UPSTREAM_KEEPALIVE_REQUESTS
NGINX_UPSTREAM_KEEPALIVE_TIMEOUT NGINX_UPSTREAM_MAX_FAILS NGINX_UPSTREAM_FAIL_TIMEOUT NGINX_RESOLVER_VALID
NGINX_PROXY_CONNECT_TIMEOUT NGINX_PROXY_READ_TIMEOUT NGINX_PROXY_NEXT_UPSTREAM_TRIES NGINX_PROXY_NEXT_UPSTREAM_TIMEOUT
NGINX_WS_READ_TIMEOUT NGINX_CLIENT_MAX_BODY_SIZE NGINX_CSP_REPORT_ONLY"
# Texto de una cabecera de seguridad: puede llevar espacios, comillas simples, dos puntos, diagonales y punto y coma
# (una CSP o un HSTS los llevan) y puede quedar vacío.
HEADER_VALUES="NGINX_CSP_CONNECT_EXTRA NGINX_CSP_EXTRA NGINX_COOP NGINX_COEP NGINX_HSTS"
VARS=""
for name in $NAMES; do
  eval "value=\$$name"
  case "$value" in
    ''|*[!0-9A-Za-z.]*) echo "$name: valor inválido '$value' (solo letras, números y punto: auto, 8192, 4s, 27m)" >&2; exit 1 ;;
  esac
  export "$name"
  VARS="$VARS \${$name}"
done
for name in $HEADER_VALUES; do
  eval "value=\$$name"
  case "$value" in
    *'"'*|*'$'*|*'`'*|*'{'*|*'}'*|*'\'*)
      echo "$name: valor inválido (una cabecera no puede llevar \" \$ \` { } ni \\)" >&2; exit 1 ;;
  esac
  export "$name"
  VARS="$VARS \${$name}"
done

# Observar sin bloquear: con NGINX_CSP_REPORT_ONLY=true la misma política sale como Content-Security-Policy-Report-Only
# (el navegador solo reporta la violación). Es un interruptor, no un nombre de cabecera en el .env: así no hay erratas.
case "$NGINX_CSP_REPORT_ONLY" in
  true)  NGINX_CSP_HEADER=Content-Security-Policy-Report-Only ;;
  false) NGINX_CSP_HEADER=Content-Security-Policy ;;
  *)     echo "NGINX_CSP_REPORT_ONLY: debe ser true o false (valor '$NGINX_CSP_REPORT_ONLY')" >&2; exit 1 ;;
esac
NGINX_CSP_SCRIPT_HASHES="$(csp_script_hashes "$HTML_INDEX")"
export NGINX_CSP_HEADER NGINX_CSP_SCRIPT_HASHES
VARS="$VARS \${NGINX_CSP_HEADER} \${NGINX_CSP_SCRIPT_HASHES}"

TEMPLATES="${NGINX_GATEWAY_TEMPLATES:-/etc/nginx/gateway-templates}"
envsubst "$VARS" < "$TEMPLATES/nginx.main.conf.template" > /etc/nginx/nginx.conf
envsubst "$VARS" < "$TEMPLATES/nginx.conf.template" > /etc/nginx/conf.d/default.conf
echo "Gateway: $NGINX_WORKER_PROCESSES procesos x $NGINX_WORKER_CONNECTIONS conexiones; hacia la API keepalive" \
  "$NGINX_UPSTREAM_KEEPALIVE ($NGINX_UPSTREAM_KEEPALIVE_TIMEOUT, $NGINX_UPSTREAM_KEEPALIVE_REQUESTS peticiones)," \
  "max_fails=$NGINX_UPSTREAM_MAX_FAILS/$NGINX_UPSTREAM_FAIL_TIMEOUT, DNS cada $NGINX_RESOLVER_VALID, conectar" \
  "$NGINX_PROXY_CONNECT_TIMEOUT, leer $NGINX_PROXY_READ_TIMEOUT (WebSocket $NGINX_WS_READ_TIMEOUT), reintentos" \
  "$NGINX_PROXY_NEXT_UPSTREAM_TRIES en $NGINX_PROXY_NEXT_UPSTREAM_TIMEOUT, cuerpo $NGINX_CLIENT_MAX_BODY_SIZE"
echo "Gateway: $NGINX_CSP_HEADER con $(echo "$NGINX_CSP_SCRIPT_HASHES" | grep -o 'sha256-' | wc -l | tr -d ' ')" \
  "hash(es) de script en línea; COOP '$NGINX_COOP', COEP '$NGINX_COEP', HSTS '$NGINX_HSTS' (solo por HTTPS)"
