#!/bin/sh
# Parámetros del gateway que dependen de cuántas réplicas hay detrás y del equipo (decisión del dueño, 2026-10-07:
# «todo debe ser 100 % parametrizable»): llegan como variables NGINX_* desde docker-compose.yml (sus valores viven en
# el .env de la raíz; README §7 "docker compose" y "Escalar en cualquier momento") y aquí se escriben en la
# configuración de Nginx con envsubst, SOLO esas variables: las $variables propias de Nginx ($host, $request_id...)
# quedan intactas. Un valor que falta toma el MISMO valor por omisión que docker-compose.yml y el .env de la raíz
# (./scripts/quality.sh lo verifica). Cada valor se valida antes (termina dentro de la configuración): solo letras,
# números y punto (auto, 8192, 4s, 27m).
set -e
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
NAMES="NGINX_WORKER_PROCESSES NGINX_WORKER_CONNECTIONS NGINX_UPSTREAM_KEEPALIVE NGINX_UPSTREAM_KEEPALIVE_REQUESTS
NGINX_UPSTREAM_KEEPALIVE_TIMEOUT NGINX_UPSTREAM_MAX_FAILS NGINX_UPSTREAM_FAIL_TIMEOUT NGINX_RESOLVER_VALID
NGINX_PROXY_CONNECT_TIMEOUT NGINX_PROXY_READ_TIMEOUT NGINX_PROXY_NEXT_UPSTREAM_TRIES NGINX_PROXY_NEXT_UPSTREAM_TIMEOUT
NGINX_WS_READ_TIMEOUT NGINX_CLIENT_MAX_BODY_SIZE"
VARS=""
for name in $NAMES; do
  eval "value=\$$name"
  case "$value" in
    ''|*[!0-9A-Za-z.]*) echo "$name: valor inválido '$value' (solo letras, números y punto: auto, 8192, 4s, 27m)" >&2; exit 1 ;;
  esac
  export "$name"
  VARS="$VARS \${$name}"
done
TEMPLATES="${NGINX_GATEWAY_TEMPLATES:-/etc/nginx/gateway-templates}"
envsubst "$VARS" < "$TEMPLATES/nginx.main.conf.template" > /etc/nginx/nginx.conf
envsubst "$VARS" < "$TEMPLATES/nginx.conf.template" > /etc/nginx/conf.d/default.conf
echo "Gateway: $NGINX_WORKER_PROCESSES procesos x $NGINX_WORKER_CONNECTIONS conexiones; hacia la API keepalive" \
  "$NGINX_UPSTREAM_KEEPALIVE ($NGINX_UPSTREAM_KEEPALIVE_TIMEOUT, $NGINX_UPSTREAM_KEEPALIVE_REQUESTS peticiones)," \
  "max_fails=$NGINX_UPSTREAM_MAX_FAILS/$NGINX_UPSTREAM_FAIL_TIMEOUT, DNS cada $NGINX_RESOLVER_VALID, conectar" \
  "$NGINX_PROXY_CONNECT_TIMEOUT, leer $NGINX_PROXY_READ_TIMEOUT (WebSocket $NGINX_WS_READ_TIMEOUT), reintentos" \
  "$NGINX_PROXY_NEXT_UPSTREAM_TRIES en $NGINX_PROXY_NEXT_UPSTREAM_TIMEOUT, cuerpo $NGINX_CLIENT_MAX_BODY_SIZE"
