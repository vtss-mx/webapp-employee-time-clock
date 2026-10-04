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
- **Componentes altamente personalizados, nunca controles nativos** (decisión del dueño del
  producto): nada de la apariencia del navegador o del sistema operativo. Fechas con `DateField`,
  horas con `TimeField`, números con `NumberField` (botones − y +, unidad, mínimo, máximo y paso),
  casillas con `Checkbox`, opciones excluyentes con `RadioCard`/`ChoiceGroup`, listas con `Select`,
  deslizadores propios (como `ConfidenceSlider`). Prohibido `<input type="time|date|number|range|
  checkbox|radio|file|color">` visible, `<select>` y `accent-color` como sustituto de un diseño: el
  input nativo, si se usa por accesibilidad, queda oculto y el componente dibuja su propio control.
  Cada componente vive en `components/ui/`, se dibuja con los tokens CSS y expone props para
  personalizarlo (textos, íconos, tamaño, variante); en teléfono cada parte tocable mide al menos
  44×44 px.
- **Todo listado se pagina en el backend** y se muestra con el paginador único `Paginator`
  (`ListPaginator` para conectarlo a una lista): `usePagedList` (página, tamaño, cancelación,
  "Reintentar") o `useSearchList` (además búsqueda y filtro) + `ListToolbar`/`ListResults`. Por
  omisión 10 por página con opciones 10/20/30/40/50 (`config.pageSizes`/`config.pageSize`). Se
  personaliza con props (`noun`, `labels`, `show`, `siblings`, `sizes`, `variant`) y tokens
  `--pager-*`; no se crean paginadores propios ni listas que carguen todo.
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
  - `useAction()`: botones (activar, eliminar, rotar...), con `busy`, popup de éxito o del error;
    su opción `confirm` pregunta antes (ver "Confirmar antes de crear, editar o eliminar").
  - `useSubmit()`: guardar un formulario (`submit(task, errorTitle, { confirm, onError })`). Los
    errores del backend por campo se marcan con `fieldErrorsFrom`.
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
  sugerencias del catálogo). Un formulario con motivo es `ReasonFormPanel`; su `confirm` (puede
  depender del motivo escrito) pide la confirmación ANTES de enviar (cancelar deja el formulario
  disponible). Rechazar una solicitud del empleado (cambio de turno, vacaciones o permiso) es
  `RejectRequestPanel` (nota obligatoria con `validateRejectNote` y la misma confirmación).
- El óvalo del rostro se ajusta al dispositivo con unidades de contenedor (`.camera` es
  `container-type: size`; `--oval-w` y `--arrow-size`): nunca con medidas fijas ni `matchMedia`.
- **Capturas faciales solo con `LiveFaceFlow`** y se envían como `FaceCaptures` (frontales, una
  captura por movimiento del reto, una por color del destello —`flash`, en orden— y el nombre de la
  cámara) con `postFaceCaptures`. La app no captura con una cámara virtual (`isVirtualCamera` con la
  lista de la política).
  - **Prueba de vida** (el reto lo decide el servidor, `FaceChallenge`): primero el **destello**
    (`useScreenFlash` + `FlashOverlay`: capa a pantalla completa en un portal, sobre todo, con una
    ventana sobre el óvalo; cada color espera `config.faceFlashSettleMs` y captura un cuadro; el color
    cambia al instante también con "reducir movimiento"). Si la cámara falla o la pantalla se oculta,
    sin `flash_required` se sigue sin él y con él se pide otro reto. Luego cada **movimiento**
    (`TURN_LEFT`, `TURN_RIGHT`, `LOOK_UP`, `LOOK_DOWN`, `MOVE_CLOSER`) con su señal (`LivenessCues`:
    flecha, doble flecha, óvalo punteado del tamaño objetivo), su anillo de avance y regreso al frente
    entre uno y otro.
  - Las medidas son las del servidor (`utils/facePose.ts`: giro, altura de la nariz entre ojos y boca,
    ancho del rostro) contra el rostro "en reposo" que `useFaceAutoCapture` entrega al quedar estable de
    frente (`onStable(sample)`), más el margen de la app (`faceTurnMargin`, `facePitchMargin`,
    `faceCloserMargin`).
  - Tiempo: cada movimiento `faceChallengeTimeoutMs`, sin pasar del vencimiento del reto (`expires_in`
    menos `faceChallengeMarginMs`); al agotarse se pide otro reto conservando el escaneo (hasta dos).
    Las reglas puras del visor (mensaje, títulos "Prueba de vida · paso 2 de 3", qué se mide) viven en
    `components/liveFaceView.ts`; las pruebas del flujo usan `test/faceFlow.tsx` (+ `faceFlowMocks.ts`).
- **QR del empleado: dinámico y de un solo uso.** Se muestra solo con `useDynamicQr` +
  `DynamicQrCode` (se renueva al vencer, al usarse y bajo demanda; pausa con la pantalla oculta).
  El anillo de vigencia es una animación CSS y solo `QrCountdown` se redibuja cada segundo: nada
  de temporizadores que redibujen toda la pantalla varias veces por segundo.
  Nunca se descarga, imprime ni se escanea desde la app del propio empleado: lo lee un validador.
- **Reconocimiento evolutivo:** lo decide el backend y **lo administra solo el ADMIN** (la aplicación
  de la empresa no tiene nada que ver con aprendizaje automático): `FaceLearningPanel` en la política
  de cada empresa (`CompanyPolicyPage`, junto a su interruptor) y lo aprendido de cada empleado con
  "Olvidar" en `CompanyEmployeesPage`. Ninguna pantalla de la empresa lo muestra.
- **La política de verificación la configura el ADMIN** para cada empresa (`CompanyPolicyPage`, desde
  la ficha de la empresa). La empresa y su personal solo la leen (`settingsService`,
  `useVerificationPolicy`); ninguna pantalla de la empresa la modifica. Sus ajustes de la prueba de
  vida (`PolicyTuning`): movimientos (1 a 3), tiempo del reto y destello (`flash_modes` del catálogo);
  exigir el destello lleva la advertencia `warning` de `TuningSave` (calibrar antes).
- **Seguridad facial** (`ADMIN_FACE_SECURITY`, `FaceSecurityPage`, `faceSecurityService`, secciones en
  `components/faceSecurity`, reglas puras en `utils/faceSecurity.ts`): solo dibuja lo que la
  plataforma calibró sola (cada umbral con `RangeMeter` entre su mínimo y su tope), las empresas
  reforzadas por ataques y lo medido del destello con su veredicto (`flashReadiness`: cuándo conviene
  exigirlo). "Recalcular ahora" pregunta con `useAction({ confirm })` y avisa el mensaje del servidor.
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
  (`CompanyEmployeesPage`) es de solo lectura (`ListResults` sin `onOpen`: filas sin clic); su única
  acción es "Olvidar" lo aprendido del rostro (con confirmación), porque el aprendizaje lo administra
  el ADMIN. El acceso a Integraciones se cambia con un interruptor (darlo y quitarlo se confirman).
- **Errores del sistema:** "Marcar como solucionados" solo aparece con un seguimiento o una gravedad
  específicos en el filtro (nunca con "todo" ni con "Solucionado"), pide confirmación diciendo qué
  filtro aplica y envía el `as_of` de la lista que se ve (`useSearchList<T, X>` conserva los campos
  propios de la página y `appliedSearch` es la búsqueda con que se pidió).
- **Turnos y asistencia** (pantallas `COMPANY_ATTENDANCE`, `COMPANY_SHIFTS`, `COMPANY_SITES`,
  `EMPLOYEE_ATTENDANCE`; tipos en `types/shifts.ts`; servicios `siteService`, `shiftService`,
  `attendanceService`; presentación pura en `utils/shifts.ts`):
  - Qué puede registrar el empleado lo decide el servidor (`today.actions`); la app nunca lo calcula.
  - La hora de cada registro es la del servidor; los "cuánto falta" parten de `today.now`, no del
    reloj del teléfono. Las horas se muestran con `formatTime` (zona del negocio).
  - Cada registro va con el rostro (`LiveFaceFlow`) y la ubicación (`currentLocation()`, aviso nativo)
    y se confirma ANTES de abrirlos ("¿Registrar tu entrada?", con su turno; la salida avisa que cierra
    la jornada): los botones de `TimeClockCard` preguntan y luego abren `AttendanceRecordPage`.
  - Estados con nombre y color de los catálogos (`board_states`, `assignment_states`,
    `work_session_statuses`, `shift_request_statuses`), nunca escritos en la app.
  - El contador de solicitudes pendientes del menú es `usePendingShiftRequests` (una consulta
    periódica); tras aprobar o rechazar se avisa con `notifyShiftRequestsChanged()`.
  - Los formularios de turnos, sitios y asignaciones reutilizan `components/shifts` (`WeekdayPicker`,
    `SitePicker`, `PlacementFields`, `RecordStatus`, `PendingRequest`, `QuickChoices`; reglas puras en
    `shiftRules.ts`) y los campos de `components/ui` (`TimeField` con horas sugeridas, `NumberField`
    con su unidad, `Checkbox`, `ChoiceGroup`). El sitio usa los límites de radio de `useValidatorForm`
    (los mismos del backend). Sus confirmaciones: `shiftConfirm` y `siteConfirm` (alta con lo que se
    crea, edición con "antes → después"), `RecordStatus` (activar, desactivar y eliminar) y
    `usePlacement().send(task, título, (turno, lugar) => ConfirmInput)`, que da el turno elegido y lo
    que se confirma de la asignación (desde cuándo, días remotos y los sitios con su nombre, que
    reporta `SitePicker`).
  - Las jornadas se dibujan solo con `components/attendance` (`SessionTimeline`, `SessionSummary`,
    `EventTimeline`, `MinutesBadge`, `sessionFacts`), las mismas para la empresa y el empleado; el
    tablero guarda el día en `?date=` (se puede compartir y sobrevive a recargar).
  - **Varios empleados a la vez** (asignar un turno, registrar una ausencia): se eligen solo con
    `EmployeePicker` (`components/employees`: búsqueda, estado, departamento, una casilla por fila,
    "Seleccionar los N de este filtro" con `employeeService.ids` —el servidor da los ids, hasta su
    tope— y cuántos van elegidos; `single` para una persona) y el resultado por empleado se muestra
    solo con `bulkResultMessage` / `BulkResultSummary` (omitidos primero, con su motivo). El turno que
    se asigna se elige con `ShiftChoice`. Pruebas: `components/employees/testData.ts`. `EmployeePicker`
    entrega también los nombres que conoce de los elegidos y la confirmación dice a quiénes afecta con
    `describeEmployees` (hasta 8 nombres y "y N más": los de "Seleccionar los N" llegan sin nombre).
  - **Calendario** (pantalla `COMPANY_CALENDAR`, servicio `calendarService`, tipos en
    `types/calendar.ts`): festivos, ausencias, solicitudes y días laborables. Los tipos de ausencia
    (`day_off_types`: nombre, color, frase y si el empleado los puede pedir) y los motivos de una
    corrección (`attendance_edit_reasons`) vienen del catálogo. El contador de solicitudes de
    vacaciones o permisos del menú es `usePendingAbsenceRequests`; tras registrar, aprobar, rechazar
    o cancelar se avisa con `notifyAbsenceRequestsChanged()`.
    La pantalla se arma con `components/calendar` (`MonthCalendar`: cuadrícula del mes propia, con
    teclado y marcas de festivos y de quién descansa; `PeriodSwitcher` para el año o el mes; una
    pestaña por sección en `?tab=`) y las pestañas accesibles de `components/ui/Tabs`. Cada ausencia
    se confirma con `absenceFacts` (empleado, tipo, fechas con sus días y nota). "Agregar festivos
    oficiales" explica qué hará (las fechas las decide el backend con la ley de su año; la app no las
    calcula) y al terminar el aviso lista cada festivo agregado.
  - Las solicitudes del empleado (cambio de turno, vacaciones o permiso) se envían con
    `useEmployeeRequest` (confirma lo que se enviará, avisa y vuelve a su lista); cancelar una
    pendiente también se confirma.
  - Qué días no se trabaja y cuándo se puede tomar el descanso lo dice el servidor
    (`today.day_off`, `today.break_window`, `board.day_off`): la app solo lo muestra, con la hora del
    servidor (`DayOffCard`, `breakWindowText`; `refreshAt` vuelve a preguntar cuando abre o cierra
    la ventana del descanso y cuando se cierra la entrada).
  - **Registrar o corregir asistencia es solo de la empresa** (`ManualSessionPage`, desde el tablero
    o el detalle de una jornada): descansos con `BreaksEditor`, reglas puras en `manualSession.ts` y
    estado en `useManualSession` (`save(task, título, () => ConfirmInput)`: registrar confirma lo que
    se guarda; corregir, solo lo que cambia con `manualFacts` y el motivo, y sin cambios no hay nada
    que corregir). Lo que registró la empresa se muestra de solo lectura, igual para la
    empresa y el empleado, con `CompanyBadge` / `CompanyEditNote` (insignia del catálogo `work_modes` y
    el motivo); el empleado nunca ve un botón para editar.
- Mensajes: **solo popups** (`useFeedback()`: `fromError`, `show`, `success`, `warning`...). La app
  **no usa toasts** ni avisos en línea; cada popup se personaliza con `MessageInput`.
- **Confirmar antes de crear, editar o eliminar** (decisión del dueño del producto: nada se crea,
  cambia ni borra por accidente). Toda acción que crea, edita, elimina o cambia el estado de un dato
  pregunta primero con un popup altamente personalizado; cancelar no envía nada, no marca la
  pantalla como ocupada, no avisa nada y deja el formulario como estaba.
  - Un solo mecanismo: `useConfirm()` (`hooks/useConfirm.ts`) abre `ConfirmDialog` desde
    `ConfirmProvider` (`context/ConfirmContext.tsx`, lo monta `FeedbackProvider`: una instancia, una
    confirmación a la vez y en orden). Casi nunca se usa directo: `useAction().run(task, { confirm })`,
    `useSubmit().submit(task, errorTitle, { confirm })`, `useFormState().save(task, title, confirm)` /
    `saveIfValid(errores, task, title, () => confirm)` y `ReasonFormPanel` (`confirm`) ya preguntan
    antes de enviar. Las pantallas no montan `ConfirmDialog` ni guardan "qué se está confirmando" en
    su estado; mientras se envía, el botón que lo pidió muestra `busy`.
  - **Obligatoria por tipos donde siempre se cambian datos**: `useSubmit`, `useFormState().save` /
    `saveIfValid`, `ReasonFormPanel`, `usePlacement().send` y `useManualSession().save` no compilan
    sin `confirm` (todo envío de formulario crea o cambia algo). En `useAction().run` es opcional
    porque también corre acciones que no cambian datos (consultar un estado, "Seleccionar los N de
    este filtro"): ahí lo exige la revisión, no el compilador.
  - `ConfirmInput` (`types/confirm.ts`): `kind` (`create` → "Crear", `edit` → "Guardar cambios",
    `delete` → "Eliminar" en rojo, `action`) pone ícono, color, etiqueta y botón por omisión; todo se
    cambia con `title` (una pregunta que nombra el registro: "¿Eliminar a Ana Ruiz?"), `message`,
    `icon`, `tone`, `eyebrow`, `confirmLabel`/`confirmIcon`, `cancelLabel`, `details` (qué se crea o
    se afecta: líneas o "Etiqueta: valor"), `changes` (al editar: "Campo: antes → después"), `note`
    (la consecuencia: "no se puede deshacer") y `confirmText` (escribir el nombre o número para
    borrados muy destructivos). Estilos con los tokens `--confirm-*`. En lo destructivo el foco empieza
    en "Cancelar" (un Enter de más no borra nada).
  - Lo que se crea sale de `describeValues` y los cambios de `describeChanges` (`utils/changes.ts`,
    con las etiquetas y formatos de cada campo; los secretos nunca se muestran). Una edición sin
    cambios (`changes: []`) no pregunta: avisa "Sin cambios" y no envía nada.
  - Si la pantalla que preguntó se cierra con el popup abierto, la confirmación se retira (nada se
    envía desde una pantalla que ya no está).
  - No se confirma: navegar, buscar o filtrar, preferencias de la interfaz (menú contraído), "Usar
    otra cuenta" en el inicio de sesión y las capturas de los validadores (un punto de control que
    identifica una fila de personas no se interrumpe). Lo que abre la cámara para crear un dato
    (registro facial, registro de asistencia) se confirma ANTES de abrirla. Cerrar sesión tiene su
    propio popup (`useConfirmLogout`).
- **Toda respuesta del backend se procesa y toda falla se avisa**: el backend responde SIEMPRE con el
  contrato único (`success, statusCode, code, message, data, errors, traceId, timestamp`) y
  `apiClient` lo convierte en datos validados o en `ApiError` (con `code`, `fieldErrors`,
  `retryAfterMs`, `traceId`). Cualquier falla llega a la persona como popup personalizable
  (`useFeedback().fromError`, `useErrorPopup`, o ya integrado en `useResource`/`usePagedList`/
  `useAction`/`useSubmit`), con "Reintentar" cuando sirve y el `traceId` para soporte. Ninguna
  promesa se traga en silencio (`.catch(() => undefined)` solo en lo accesorio y comentando por
  qué). Los resultados normales (cargar una tabla, un detalle) NO generan avisos.
- **Solo las fallas de la app se reportan al ADMIN** ("Errores del sistema", origen `CLIENT`) y solo
  con `services/clientErrorService.ts` (`reportClientError`, `reportMapsProblem`): una pantalla rota
  (`ErrorBoundary`, CRASH), un error inesperado sin capturar (`GlobalErrorHandler`, UNHANDLED) y una
  configuración de la plataforma que la persona no puede arreglar (una API de Google Maps sin
  habilitar, CONFIG). Nunca lo que la persona resuelve (permisos de cámara o ubicación, sin conexión,
  tiempos agotados, cancelaciones) ni un `ApiError` (el servidor ya registró sus fallas): el filtro
  vive en `isAppFailure`, no en quien reporta. Es de mejor esfuerzo (nunca lanza ni abre un popup,
  5 s de tiempo límite, sin reintentos), una vez por falla y carga de la página (con tope) y envía la
  pantalla sin query (`location.pathname`).
- El permiso de la cámara es el **aviso nativo** del navegador (sin popup previo propio). Igual la
  ubicación: `currentLocation()` (`utils/geolocation.ts`) y sus problemas con `locationProblemMessage`.
- **Google Maps solo por `services/maps/googleMaps.ts`** (carga del SDK, geocodificación, lugares) y
  se dibuja solo en `components/location/MapCanvas.tsx`. Domicilios: `AddressFields` +
  `LocationPicker` y las reglas puras de `utils/address.ts`. Si Google no responde o una API no está
  habilitada **nunca se abre un popup**: el buscador despliega su lista con "Sin resultados" (y qué
  hacer), y lo demás (autollenado, "Mi ubicación", dirección escrita) se dice en un aviso bajo el
  mapa; el formulario sigue funcionando a mano. Una API sin habilitar (`denied`) se reporta al ADMIN
  con `reportMapsProblem` (una vez por API; sin red o apagada, no).
  - Toda petición a Google tiene tiempo límite (`inTime`, 10 s): si no responde es una falla pasajera.
  - **Buscador** (`PlaceSearch`): Autocomplete de Places (New) (`suggestPlaces`), la API de Google
    más rápida para cada tecla: pausa de 220 ms, mínimo 3 letras, una sesión hasta elegir y solo se
    dibuja la respuesta de lo último que se escribió. Muestra **las 5 sugerencias más cercanas** (por
    `distanceMeters`; sin distancia, al final) con su distancia ("350 m", "1.2 km"). La referencia
    (`origin` + `locationBias` de 50 km) es el punto marcado; si no hay, el centro del mapa cuando ya
    se acercó a una ciudad (`MapCanvas.onView`); si no, la ubicación que el dispositivo ya conoce
    (`knownLocation`, solo con el permiso ya dado: nunca abre el aviso); si no, solo el país.
  - **Domicilio de un punto**: `reverseGeocode` junta TODOS los resultados de Google
    (`addressFromResults`: manda el más preciso; la calle, el código postal, el estado, el municipio,
    la ciudad y el país que le falten salen de los demás; el número nunca). Un lugar elegido al que le
    falte algo de su zona se completa igual con la geocodificación de su punto (de mejor esfuerzo, 3 s).
    En México `administrative_area_level_2` es el municipio, `locality` la ciudad y `sublocality` la
    colonia (no se usa).
  - **Pin de la marca**: SVG propio fijo al centro (sin Map ID ni `google.maps.Marker`, que es
    obsoleto), con los tokens `--map-accent`/`--map-pin` (el círculo del radio lee `--map-accent`); se
    levanta mientras se arrastra el mapa y tiene un halo con pulso suave. El contenedor recorta el
    mapa con su redondeo (`clip-path`) y quita el marco azul cuadrado que Google pone al enfocarlo; con
    teclado se ve un anillo propio (`:focus-visible`) con el mismo radio.

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
