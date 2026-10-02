#!/bin/sh
# Genera un certificado autofirmado si no se montó uno propio en /etc/nginx/certs.
# HTTPS es obligatorio para usar la cámara (getUserMedia) desde teléfonos/tabletas en la red local.
set -e
CERT_DIR=/etc/nginx/certs
if [ ! -f "$CERT_DIR/server.crt" ]; then
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "$CERT_DIR/server.key" -out "$CERT_DIR/server.crt" \
    -subj "/CN=timeclock.local" \
    -addext "subjectAltName=DNS:localhost,DNS:timeclock.local,IP:127.0.0.1" >/dev/null 2>&1
  echo "Certificado autofirmado generado en $CERT_DIR"
fi
