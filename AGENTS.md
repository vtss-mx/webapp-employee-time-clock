# Webapp · Employee Time Clock — reglas de arquitectura

Reglas obligatorias para cualquier cambio (personas o agentes). Si una petición choca con ellas,
se señala el conflicto antes de escribir código; no se "rodean".

Stack: React 18 · TypeScript estricto · Vite · React Router · Vitest + Testing Library. Idioma:
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
  sugerencias del catálogo).
- **Capturas faciales solo con `LiveFaceFlow`** y se envían como `FaceCaptures` (frontales, una
  captura por giro del reto y el nombre de la cámara) con `postFaceCaptures`. La app no captura
  con una cámara virtual (`isVirtualCamera` con la lista de la política).
- Dispositivos de validadores: la llave vive en `utils/deviceKey.ts` (WebCrypto, no exportable);
  el login firma el reto cuando el backend lo pide (`AuthContext`), nunca de otra forma.
- Mensajes: **solo popups** (`useFeedback()`: `fromError`, `show`, `success`, `warning`...). La app
  **no usa toasts** ni avisos en línea; cada popup se personaliza con `MessageInput`.
- Errores: `ApiError` con `code` estable y `useFeedback().fromError` para mostrarlos.
- El permiso de la cámara es el **aviso nativo** del navegador (sin popup previo propio). Igual la
  ubicación: `currentLocation()` (`utils/geolocation.ts`) y sus problemas con `locationProblemMessage`.
- **Google Maps solo por `services/maps/googleMaps.ts`** (carga del SDK, geocodificación, lugares) y
  se dibuja solo en `components/location/MapCanvas.tsx`. Domicilios: `AddressFields` +
  `LocationPicker` y las reglas puras de `utils/address.ts`. Una API de Google no habilitada se
  explica con `mapsProblemMessage` (una vez) y el formulario sigue funcionando a mano.

## 3. Calidad (obligatoria antes de dar algo por terminado)

- `npm run typecheck`, `npm run lint` (sin advertencias: complejidad ≤ 20, archivo ≤ 450 líneas;
  si se pasa, se extraen componentes o hooks), `npm test`.
- Cobertura mínima: líneas/funciones/sentencias 90 %, ramas 85 % (`npm run coverage`).
- Cada pantalla, hook o servicio nuevo lleva prueba (incluidos errores y estados vacíos).
- Calidad global de ambos proyectos: script de la raíz del repositorio (ver
  `../scripts/quality/README.md`).
- **No usar prettier ni otros formateadores**: el estilo es el existente (comillas simples, líneas
  largas, imports ordenados por el lint).

## 4. Interfaz

- Mobile first; todo usable en teléfono (menú hamburguesa) y escritorio (sidebar contraíble).
- Área de trabajo blanca; paneles con borde y sombra suaves; sin encabezado superior.
- Accesibilidad: roles y `aria-*` correctos, foco gestionado en popups, navegación con teclado.
- Acciones que el usuario ya confirmó no generan avisos redundantes después.
- Toda contraseña que se asigna (alta, restablecer, cambiar) se escribe dos veces:
  `ConfirmPasswordField` + `validatePasswordConfirm`. La confirmación nunca se envía al backend.
- No se piden datos repetidos: el alta de empresa pide un solo correo (el del administrador, que
  también queda como contacto).
