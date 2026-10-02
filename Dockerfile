# ---------- Build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
# postinstall copia el WASM de MediaPipe y descarga el modelo de detección a public/
RUN npm ci
COPY . .
# Las variables VITE_* se toman de frontend/.env (copiado con el código fuente).
RUN npm run build

# ---------- Runtime ----------
FROM nginx:1.27-alpine
RUN apk add --no-cache openssl
COPY docker/nginx.main.conf /etc/nginx/nginx.conf
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/generate-cert.sh /docker-entrypoint.d/05-generate-cert.sh
RUN chmod +x /docker-entrypoint.d/05-generate-cert.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
