#!/bin/sh
# Proxies de confianza DELANTE de este Nginx (CDN, balanceador de la nube, ngrok): NGINX_TRUSTED_PROXIES con
# sus IP o redes (CIDR) separadas por espacios o comas. Solo de ellos se toma la IP real del cliente
# (X-Forwarded-For); sin la variable, la IP del cliente es la que se conecta a este Nginx. Cualquier otro
# carácter se rechaza (el valor termina en la configuración de Nginx).
set -e
OUT=/etc/nginx/conf.d/00-real-ip.conf
: > "$OUT"
for cidr in $(printf '%s' "${NGINX_TRUSTED_PROXIES:-}" | tr ',' ' '); do
  case "$cidr" in
    *[!0-9A-Fa-f:./]*) echo "NGINX_TRUSTED_PROXIES: valor inválido '$cidr'" >&2; exit 1 ;;
  esac
  echo "set_real_ip_from $cidr;" >> "$OUT"
done
if [ -s "$OUT" ]; then
  printf 'real_ip_header X-Forwarded-For;\nreal_ip_recursive on;\n' >> "$OUT"
  echo "IP real del cliente tomada de X-Forwarded-For de: ${NGINX_TRUSTED_PROXIES}"
fi
