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
  `useFormState`; listas con `useSearchList` + `ListControls`. Código repetido se extrae.
- Catálogos (estados, motivos, países...) se leen de `useCatalogs()` (vienen de la BD), nunca se
  escriben en el código.
- Errores: `ApiError` con `code` estable y `useFeedback()` para mostrarlos (popups).

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
