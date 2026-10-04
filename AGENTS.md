# Webapp · Employee Time Clock — reglas de arquitectura

Reglas obligatorias para cualquier cambio (personas o agentes). Si una petición choca con ellas,
se señala el conflicto antes de escribir código; no se "rodean".

Stack: React 19 · TypeScript 6 estricto · Vite 8 · React Router 7 · Vitest + Testing Library. Idioma:
identificadores en inglés; comentarios, textos de la interfaz y documentación en **español**.

## 1. El frontend no decide permisos: dibuja lo que envía el backend

- **Menú, rutas e inicio salen de `user.screens` y `user.home`** (los envía el backend en login,
  renovación y `/users/me`). Prohibido: menús fijos, `if (user.role === ...)` para mostrar
  pantallas u opciones, listas de rutas por rol.
- `src/routes/screens.tsx` es el **único** registro de pantallas: código → rutas y componentes
  (carga diferida desde `lazyPages.ts`), más el mapa de íconos. `AppRouter` arma las rutas solo
  con las pantallas del usuario; una pantalla conocida que no tiene lleva a su inicio.
- `src/layouts/navigation.ts` convierte las pantallas en el menú (sidebar en escritorio; cajón con
  menú hamburguesa en teléfonos, `MobileBar.tsx`, personalizable en `mobileMenu.ts`). Los
  contadores (`screen.badge`) se resuelven por su código.
- Prueba de contrato `src/routes/screens.contract.test.ts`: las pantallas del frontend deben ser
  las mismas que el seed del backend (`alembic/seed/catalogs.json`), con la misma ruta base.
- Toda validación del cliente es solo UX: el backend vuelve a validar todo.

### Agregar una pantalla
1. Backend primero (seed + migración + `require_screen`; ver su `AGENTS.md`).
2. Ruta en `src/routes/paths.ts`, página en `src/pages/<área>/`, export diferido en
   `lazyPages.ts` y su entrada en `SCREEN_VIEWS` (y el ícono en `ICONS` si es nuevo).
3. Actualizar `src/test/screens.ts` (copia del seed para las pruebas).

## 2. Estructura

| Carpeta | Responsabilidad |
|---|---|
| `src/pages/` | Pantallas por área (`admin`, `company`, `employee`, `validator`). Orquestan; no hablan HTTP directamente. |
| `src/components/` | Componentes de la aplicación. `components/ui/` = base visual reutilizable (Button, Panel, Overlay, Floating, campos...). |
| `src/hooks/` | Estado y efectos reutilizables (formularios, polling, disponibilidad...). |
| `src/services/` | Única capa que llama a la API: `apiRequest` + validación de la forma de `data` (`utils/guards`). |
| `src/context/` | Sesión (`AuthContext`), catálogos, mensajes. |
| `src/routes/` | Router, guardas, rutas (`paths.ts`) y registro de pantallas. |
| `src/types/` | Tipos del contrato con la API. |
| `src/utils/` | Funciones puras (validación, formato, teléfonos...). |
| `src/styles/global.css` | Estilos con tokens en `:root`; sin estilos en línea salvo posiciones calculadas. |

- **Reutilizar antes de crear**: popups solo con `Overlay`/`Modal`/`ConfirmDialog`; superficies
  flotantes de campos solo con `Floating` (portal: ningún panel las recorta); formularios con
  `useFormState`; listas desplegables solo con `Select` (lista propia, nunca `<select>` nativo).
  Código repetido se extrae.
- **Todo listado se pagina en el backend** y se muestra con el paginador único `Paginator`
  (`ListPaginator` para conectarlo a una lista): `usePagedList` (página, tamaño, cancelación,
  "Reintentar") o `useSearchList` (además búsqueda y filtro) + `ListToolbar`/`ListResults`. Por
  omisión 10 por página con opciones 10/20/30/40/50 (`config.pageSizes`/`config.pageSize`). Se
  personaliza con props (`noun`, `labels`, `show`, `siblings`, `sizes`, `variant`) y tokens
  `--pager-*`; no se crean paginadores propios ni listas que carguen todo.
- **Reportes** (`components/reports/`): el asistente, el constructor y los guardados solo dibujan lo
  que responde `reportService`. El Excel se descarga con `apiDownload` + `saveFile`
  (`utils/download.ts`). El frontend nunca interpreta preguntas ni arma consultas.
- **Estados de un listado solo con `PagedItems`** (esqueleto, "Reintentar", vacío o los elementos
  con su paginador; `ListResults` lo usa para las tablas). Sin registros se muestra `EmptyState`
  (ícono, título y qué aparecerá ahí; la acción para crear el primero si aplica; `compact` dentro de
  un panel; `tone="success"` cuando "nada pendiente" es buena noticia) y **el paginador se oculta**.
  Con filtros activos, el vacío dice que nada coincide con la búsqueda.
- **Datos y acciones de una pantalla, con los hooks únicos** (nada de `useEffect` + `try/catch`
  propios):
  - `useResource((signal) => ..., key, errorTitle)`: lo que la pantalla necesita para mostrarse. La
    petición recibe un `AbortSignal` y se cancela al cambiar de registro o salir: no queda ocupando
    la red ni el servidor.
  - `useAction()`: botones (activar, eliminar, rotar...), con `busy`, popup de éxito o del error.
  - `useSubmit()`: guardar un formulario. Los errores del backend por campo se marcan con
    `fieldErrorsFrom`.
- Un QR que se dibuja en la pantalla se genera en el navegador con `useQrImage(texto)` (carga
  `qrcode` solo cuando se usa); el backend nunca envía imágenes de QR.
- Tareas asíncronas que actualizan estado tras esperar (peticiones, `sleep`) consultan
  `useMountedRef()`; nunca `useRef(true)` apagado solo al desmontar: en desarrollo StrictMode
  desmonta y vuelve a montar, y la marca quedaría en `false` (el flujo ignoraría las respuestas).
- Correos, teléfonos y datos únicos se validan en vivo con `useAvailability(field, value)` (canal
  WebSocket del backend con respaldo HTTP); no se crean verificaciones propias por formulario.
- Catálogos (estados, motivos, países...) se leen de `useCatalogs()` (vienen de la BD), nunca se
  escriben en el código.
- **Todo formulario es una pantalla** (ruta propia con `Panel` + `PanelFooter`): alta, edición,
  contraseñas, motivos... Los popups (`Modal`/`ConfirmDialog`) son solo para mensajes,
  confirmaciones de una acción y vistas ampliadas (p. ej. el QR), nunca para capturar datos.
  Reutilizar `NewPasswordFields` (contraseña escrita dos veces) y `ReasonField` (motivo con
  sugerencias del catálogo). Un formulario con motivo es `ReasonFormPanel`; si la acción afecta a
  muchos (p. ej. nueva verificación a todos), su `confirm` pide la confirmación ANTES de enviar
  (cancelar deja el formulario disponible).
- El óvalo del rostro se ajusta al dispositivo con unidades de contenedor (`.camera` es
  `container-type: size`; `--oval-w` y `--arrow-size`): nunca con medidas fijas ni `matchMedia`.
- **Capturas faciales solo con `LiveFaceFlow`** y se envían como `FaceCaptures` (frontales, una
  captura por giro del reto y el nombre de la cámara) con `postFaceCaptures`. La app no captura
  con una cámara virtual (`isVirtualCamera` con la lista de la política).
- **QR del empleado: dinámico y de un solo uso.** Se muestra solo con `useDynamicQr` +
  `DynamicQrCode` (se renueva al vencer, al usarse y bajo demanda; pausa con la pantalla oculta).
  El anillo de vigencia es una animación CSS y solo `QrCountdown` se redibuja cada segundo: nada
  de temporizadores que redibujen toda la pantalla varias veces por segundo.
  Nunca se descarga, imprime ni se escanea desde la app del propio empleado: lo lee un validador.
- **Reconocimiento evolutivo:** lo decide el backend; la app solo lo muestra (`FaceLearningPanel` en
  el tablero, lo aprendido y "Olvidar lo aprendido" en el expediente, el interruptor en
  Configuración).
- **Fechas y horas en la zona del negocio** (hora del Centro, `user.timezone`): solo con
  `formatDate`/`formatDateTime`/`timeAgo` y "hoy" con `businessToday`/`businessDate`/`businessHour`
  (`utils/format.ts`); nunca `new Date().getHours()` ni formatos con la zona del dispositivo.
- Valores para copiar (llaves, URL, comandos) solo con `CopyField` / `useCopy`. Un secreto que el
  backend entrega una sola vez (llave de la API) se muestra en un popup que solo se cierra
  confirmando que se guardó (`apiKeySecretMessage`).
- Dispositivos de validadores: la llave vive en `utils/deviceKey.ts` (WebCrypto, no exportable);
  el login firma el reto cuando el backend lo pide (`AuthContext`), nunca de otra forma.
- **Prohibido `localStorage` y `sessionStorage`** (el lint los bloquea): cualquier script los lee,
  no caducan y no se cifran. Los datos de la persona viven en el backend (preferencias, cuenta
  recordada). Si hay sesión que restaurar se pregunta con `authService.sessionStatus()`
  (`GET /auth/session`). Lo propio del dispositivo va en IndexedDB (`utils/indexedDb.ts`; base
  `tc-device`): `deviceStore` para valores accesorios (la cámara elegida) y `deviceKey` para la llave.
  Una marca de la pestaña va en `history.state` (recarga por versión nueva). Si IndexedDB no está
  disponible, la app funciona sin recordar.
- **El ADMIN de la plataforma consulta, no administra**: la lista de empleados de una empresa
  (`CompanyEmployeesPage`) es de solo lectura (`ListResults` sin `onOpen`: filas sin clic). El
  acceso a Integraciones se cambia con un interruptor, y quitarlo pide confirmación.
- Mensajes: **solo popups** (`useFeedback()`: `fromError`, `show`, `success`, `warning`...). La app
  **no usa toasts** ni avisos en línea; cada popup se personaliza con `MessageInput`.
- **Toda respuesta del backend se procesa y toda falla se avisa**: el backend responde SIEMPRE con el
  contrato único (`success, statusCode, code, message, data, errors, traceId, timestamp`) y
  `apiClient` lo convierte en datos validados o en `ApiError` (con `code`, `fieldErrors`,
  `retryAfterMs`, `traceId`). Cualquier falla llega a la persona como popup personalizable
  (`useFeedback().fromError`, `useErrorPopup`, o ya integrado en `useResource`/`usePagedList`/
  `useAction`/`useSubmit`), con "Reintentar" cuando sirve y el `traceId` para soporte. Ninguna
  promesa se traga en silencio (`.catch(() => undefined)` solo en lo accesorio y comentando por
  qué). Los resultados normales (cargar una tabla, un detalle) NO generan avisos.
- El permiso de la cámara es el **aviso nativo** del navegador (sin popup previo propio). Igual la
  ubicación: `currentLocation()` (`utils/geolocation.ts`) y sus problemas con `locationProblemMessage`.
- **Google Maps solo por `services/maps/googleMaps.ts`** (carga del SDK, geocodificación, lugares) y
  se dibuja solo en `components/location/MapCanvas.tsx`. Domicilios: `AddressFields` +
  `LocationPicker` y las reglas puras de `utils/address.ts`. Una API de Google no habilitada se
  explica con `mapsProblemMessage` (una vez) y el formulario sigue funcionando a mano.

## 3. Resiliencia y rendimiento (en toda función)

- **Nada se queda colgado**: cada petición tiene tiempo límite (`apiClient`; opción `timeoutMs`);
  solo los GET (y lo idempotente) se reintentan, con espera creciente y respetando `Retry-After`
  (opción `retries`; `/validation` usa 0). Toda espera es cancelable (`utils/waits.ts`: `sleep`
  con señal y `whenOnline`) y toda petición de una pantalla recibe su `AbortSignal`.
- **La red vuelve, la app se recupera sola**: `useResource`/`usePagedList`/catálogos reintentan al
  volver la conexión (`useRetryOnReconnect`, solo errores pasajeros); la sesión se restaura con
  reintentos (solo un 401 lleva al login); el canal en vivo cae a HTTP y cierra sockets a medias.
- **Despliegues sin pantallas rotas**: una pantalla diferida que no carga se reintenta una vez y la
  app solo se recarga si hay una versión nueva (una vez, con marca de tiempo: sin bucles).
- **Cámara y dispositivo**: una pista que termina (`ended`) o se silencia (`mute`) se detecta; "la
  cámara aún no da imagen" se reintenta; los reinicios automáticos tienen tope y esperan la red.
- **Rendimiento**: pantallas con carga diferida (`lazyPages`); listas paginadas en el backend;
  nada de temporizadores que redibujen pantallas completas; contadores del menú con UNA consulta
  periódica compartida (`usePolledCount`), pausada con la pestaña oculta.

## 4. Calidad (obligatoria antes de dar algo por terminado)

- `npm run typecheck`, `npm run lint` (sin advertencias: complejidad ≤ 20, archivo ≤ 450 líneas;
  si se pasa, se extraen componentes o hooks), `npm test`.
- **Cobertura del 100 %** (líneas, funciones, sentencias y ramas; `npm run coverage`) cubriendo todos los
  escenarios: éxito, cada error del backend (4xx/5xx/red/tiempo agotado), permisos, estados vacíos,
  cancelaciones y reintentos. El código que no se puede ejecutar se elimina (no se excluye).
- Cada pantalla, hook o servicio nuevo lleva prueba (incluidos errores y estados vacíos).
- Calidad global de ambos proyectos: script de la raíz del repositorio (ver
  `../scripts/quality/README.md`).
- **Dependencias al día sin romper nada**: cada actualización mayor se prueba antes de adoptarse
  (TypeScript se queda en la versión más nueva que soporta typescript-eslint: hoy 6.x, no 7). Con
  TypeScript 6 los tipos globales se declaran en `tsconfig` (`types`), y con React 19 una referencia
  de `useRef(null)` es `RefObject<T | null>` y el envío de un formulario es `SubmitEvent`.
- **No usar prettier ni otros formateadores**: el estilo es el existente (comillas simples, líneas
  largas, imports ordenados por el lint).

## 5. Interfaz

- Mobile first; todo usable en teléfono (menú hamburguesa) y escritorio (sidebar contraíble con un
  botón redondo montado sobre su borde: mitad sobre el menú y mitad sobre el contenido).
- **Teléfonos y tabletas** (se revisan en iPhone y iPad, vertical y horizontal, antes de dar algo
  por terminado):
  - Con dedo (`pointer: coarse`) ningún control mide menos de 44×44 px; una fila con interruptor
    es tocable completa (`Switch` es una `<label>`).
  - Las listas se acomodan al ancho de su contenedor (`@container`), no al de la pantalla: una
    columna en teléfono, acciones a un lado en tableta, una fila en escritorio.
  - Las tablas se vuelven tarjetas en pantallas angostas: la persona arriba, los datos cortos como
    fichas con su etiqueta (`data-label`) y las celdas largas a lo ancho (`className="table__wide"`).
  - Nunca desbordamiento horizontal de la página; las acciones principales quedan a lo ancho, al
    alcance del pulgar.
- Área de trabajo blanca; paneles con borde y sombra suaves; sin encabezado superior.
- Accesibilidad: roles y `aria-*` correctos, foco gestionado en popups, navegación con teclado.
- Acciones que el usuario ya confirmó no generan avisos redundantes después.
- **Cerrar sesión siempre pide confirmación** con `useConfirmLogout()` (`components/auth/logoutConfirm.tsx`):
  popup con la cuenta, este dispositivo, qué implica salir según el rol y las opciones "Cerrar
  sesión", "Salir de todos mis dispositivos" y "Seguir aquí". Solo las salidas forzadas (sesión
  vencida, dispositivo no permitido) cierran sin preguntar.
- Toda contraseña que se asigna (alta, restablecer, cambiar) se escribe dos veces:
  `ConfirmPasswordField` + `validatePasswordConfirm`. La confirmación nunca se envía al backend.
- No se piden datos repetidos: el alta de empresa pide un solo correo (el del administrador, que
  también queda como contacto).
