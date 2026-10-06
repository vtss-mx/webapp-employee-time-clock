# Frontend — React + Vite + TypeScript

Portal web responsive de Employee Time Clock. La documentación general está en el [README principal](../README.md).

## Instalación

```bash
npm install          # postinstall: copia MediaPipe WASM y descarga el modelo a public/mediapipe
# TODA la configuración (VITE_*) vive en .env, completa; se valida en src/utils/config.ts
node scripts/generate-env.mjs > .env   # instalación nueva: el .env completo (luego las claves de Google)
npm run dev          # http://localhost:5173
npm run build        # verifica tipos y genera dist/
npm test             # pruebas unitarias (Vitest + Testing Library)
npm run coverage     # coverage con umbrales mínimos (coverage/index.html)
npm run quality      # anomalías: tipado, obsoletos, duplicidad (jscpd), dependencias, coverage
```

## Cámara en móviles

`getUserMedia` solo funciona en un **contexto seguro**: HTTPS o `localhost`. Para usarla desde otro dispositivo tienes tres opciones:

- **Red local con Vite:** en `frontend/.env`, configura `VITE_DEV_HTTPS=true` y `VITE_API_URL=/api` (Vite hace proxy de `/api` a `VITE_PROXY_TARGET`). Abre `https://<IP>:5173` y acepta el certificado.
- **Docker:** `https://<IP>:8443`.
- **ngrok:** `ngrok http 5173` (desarrollo) o `ngrok http 8080` (Docker). Los dominios `*.ngrok-free.app`, `*.ngrok-free.dev`, `*.ngrok.app` e `*.ngrok.io` ya están permitidos en Vite. El cliente HTTP envía `ngrok-skip-browser-warning` para que la página de advertencia del plan gratuito no intercepte las llamadas a la API.

## Piezas clave

| Archivo | Qué hace |
|---|---|
| `hooks/useCamera.ts` | Permisos, `enumerateDevices`, cámara preferida (frontal para rostro, trasera para QR), cambio y selección por `deviceId`, captura de frames, `MediaStreamTrack.stop()` al salir u ocultar la página, errores de permisos. Recuerda la última cámara elegida. |
| `components/CameraCapture.tsx` | Video (`playsInline` para iOS), estados y controles **🔄 Cambiar cámara** y selector. |
| `hooks/useFaceDetection.ts` | MediaPipe BlazeFace: guía en vivo (una persona, distancia, centrado, pose frontal, luz) y captura automática. Modo `turn` para la prueba de vida. |
| `components/LiveFaceFlow.tsx` | Flujo frontal → validación de accesorios → reto de giro → envío (registro y verificación). |
| `services/apiClient.ts` + `services/http/envelope.ts` | Cliente HTTP: normaliza CUALQUIER respuesta al contrato único, timeouts, reintentos con jitter/`Retry-After`, renovación automática del token. |
| `hooks/useQrScanner.ts` | Lectura de QR con jsQR. |
| `context/AuthContext.tsx` | Access token solo en memoria; refresh con cookie HttpOnly (restaura la sesión al recargar), renovación proactiva y cierre ante sesión revocada. |
| `context/CatalogContext.tsx` + `hooks/useCatalogs.ts` | Catálogos de la BD (`GET /api/catalogs`): roles, estados, motivos, accesorios, países, niveles de confianza… Única fuente de listas y etiquetas; se cargan una vez por sesión y viven solo en memoria. `useCatalogs()` da las listas, `byCode`, `nameOf` y `active` (solo activos, para elegir). |
| `routes/ProtectedRoute.tsx` | Protección de rutas por rol: un EMPLOYEE que entra a `/company/*` ve **Acceso denegado**. |

## Rutas

`/login` · `/company/dashboard` · `/company/employees` · `/company/employees/new` · `/company/employees/:id` · `/company/employees/:id/edit` · `/employee/dashboard` (= `/employee/verify`) · `/employee/verify/face` · `/employee/verify/qr` · `/employee/qr` (Mi código QR) · `/employee/enroll` · `/employee/pending` · `/company/validations` · `/profile` (incluye sesiones activas) · `*` (404)
