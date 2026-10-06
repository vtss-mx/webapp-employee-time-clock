# ---------- Build ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
# postinstall copia el WASM de MediaPipe y descarga el modelo de detección a public/
RUN npm ci
COPY . .
# Las variables VITE_* se toman de frontend/.env (copiado con el código fuente).
RUN npm run build
# Comprimidos una vez aquí (nivel máximo) y servidos tal cual con gzip_static: cero CPU por petición.
RUN find dist -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.css' -o -name '*.html' -o -name '*.json' \
      -o -name '*.svg' -o -name '*.wasm' -o -name '*.ttf' -o -name '*.webmanifest' \) -size +1k -exec gzip -9 -k {} +

# ---------- Runtime ----------
FROM nginx:1.30-alpine
RUN apk add --no-cache openssl
COPY docker/nginx.main.conf /etc/nginx/nginx.conf
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/proxy-headers.conf /etc/nginx/proxy-headers.conf
COPY docker/generate-cert.sh /docker-entrypoint.d/05-generate-cert.sh
COPY docker/10-trusted-proxies.sh /docker-entrypoint.d/10-trusted-proxies.sh
RUN chmod +x /docker-entrypoint.d/05-generate-cert.sh /docker-entrypoint.d/10-trusted-proxies.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
