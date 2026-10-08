# Webapp · Employee Time Clock — reglas de arquitectura

Reglas obligatorias para cualquier cambio (personas o agentes). Si una petición choca con ellas,
se señala el conflicto antes de escribir código; no se "rodean".

Stack: React 19 · TypeScript 6 estricto · Vite 8 · React Router 7 · Vitest + Testing Library. Idioma:
identificadores en inglés; comentarios y documentación en **español**; la interfaz, en **siete idiomas** (es-MX por
omisión, en-US, pt-BR, fr-FR, de-DE, it-IT y es-ES; regla 16 de la raíz): sus textos viven en los diccionarios de
`src/i18n/locales` (ver §7).

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
  producto): nada de la apariencia del navegador o del sistema operativo. Fechas con `DateField` (orden y separador
  del idioma activo con `Intl`, `dateLayout`: «dd/mm/aaaa», «mm/dd/yyyy», «TT.MM.JJJJ» en alemán; al teclear se aceptan
  «/», «.» y «-» y se normalizan al del idioma; el marcador de posición y `ui.dateField.invalid` del diccionario usan
  el mismo separador, `DateField.locales.test.tsx` lo exige), horas con `TimeField`, números con `NumberField` (botones − y +, unidad, mínimo, máximo, paso y
  `decimals` para dinero o porcentajes), casillas con `Checkbox`, opciones excluyentes con
  `RadioCard`/`ChoiceGroup`, listas con `Select`, archivos con `FilePicker`, video con `VideoPlayer` (sin `controls`
  nativos), deslizadores con `Slider`
  (input nativo transparente encima del dibujo; o propios como `ConfidenceSlider`). Prohibido `<input type="time|date|number|range|
  checkbox|radio|file|color">` visible, `<select>` y `accent-color` como sustituto de un diseño: el
  input nativo, si se usa por accesibilidad, queda oculto y el componente dibuja su propio control.
  Cada componente vive en `components/ui/`, se dibuja con los tokens CSS y expone props para
  personalizarlo (textos, íconos, tamaño, variante); en teléfono cada parte tocable mide al menos
  44×44 px.
- **Personas con su foto solo con `Avatar`** (`components/ui/Avatar.tsx`): la foto de perfil (`user.avatar`,
  `employee.avatar`: ruta versionada de la API) o, sin ella, las iniciales con un tono estable por nombre
  (`--avatar-tone-*`); tamaños `xs`…`xl`, `decorative` junto al nombre escrito, `alt` propio. Nunca un
  `<span className="avatar">` a mano ni una URL del bucket: la foto se pide por la API con la sesión
  (`useAvatarImage` → `avatarService.image` → URL `blob:` local), solo cuando el avatar se ve, y una vez por página
  (`utils/avatarCache.ts`: cuenta quién la usa, cancela lo que ya nadie espera, libera lo que no se muestra con
  tope `config.avatarCacheEntries` y se vacía al cerrar sesión). Si no llega, se quedan las iniciales sin popup
  (es accesoria). **Toda tabla, lista o tarjeta que muestra a una persona usa `Avatar` con su `src`** (decisión del
  dueño, 2026-10-06, que reemplaza «el ADMIN nunca recibe fotos de empleados» y «empleado inactivo sin foto»): cada
  persona de una respuesta trae `avatar` (`WithAvatar` de `types/avatar.ts`: `EmployeeRef`, `Employee`,
  `CompanyEmployee`, `CompanyAdmin`, `DepartmentPerson`, `Validator`, `FaceEnrollment`, `SimilarEmployee`,
  `CheckpointEmployee`, `CheckpointEvent`, `VerificationResult`, `UserUsage`; `ErrorOccurrence.user_avatar`) y el
  backend decide quién la ve (la empresa a su gente, el ADMIN a todos, el empleado la suya); sin ella, las iniciales.
  También en teléfono (las tarjetas de las tablas usan la misma celda). Un componente de persona recibe la ruta
  (`PersonItem avatar`, `EmployeeCard`, `FraudSubject`) y nunca la arma. Una empresa no es una persona: su logotipo
  sigue siendo sus iniciales (`company-row__logo`).
- **Cambiar la foto de perfil solo con `AvatarUploader`** (Mi perfil → `ProfilePhotoSection`): `FilePicker` (tipo y
  tamaño en MB revisados antes de subir, solo como ayuda) y `AvatarCropper` (arrastrar, pellizcar, rueda, `Slider`
  y teclado; la imagen se coloca en porcentajes con `utils/avatarCrop.ts`, sin medir), avance mientras sube y
  confirmación con la vista previa circular (`AvatarCropPreview`) antes de guardar y con la foto vigente antes de
  quitar (`useAction` + `confirm`); al guardar no hay aviso de éxito (la foto ya se ve) y el contexto la aplica con
  `useAuth().updateAvatar`. La foto elegida vive solo en memoria (URL `blob:` liberada al terminar).
- **Documentos de una empresa** (decisión del dueño, 2026-10-06: constancia fiscal, acta constitutiva, comprobante de
  domicilio... para facturarle; cifrados en el bucket, el navegador solo habla con la API): UNA implementación para el
  ADMIN (sección `CompanyDocumentsSection` en la ficha de una empresa VIGENTE, subir en
  `/admin/companies/:id/documents/new`) y la empresa (pantalla `COMPANY_DOCUMENTS`, `pages/company/DocumentsPages.tsx`).
  `companyDocumentService(documentsBase.admin(id) | documentsBase.company)` (mismas rutas y formas), tipos en
  `types/documents.ts`, reglas puras en `utils/companyDocuments.ts` (formatos, `VITE_COMPANY_DOCUMENT_MAX_MB` en MB, nota de
  300, códigos del backend que van al campo del archivo o del tipo aunque lleguen sin `field`, como un 413 del gateway),
  piezas en `components/documents`: `DocumentList` + `useDocumentList` (tabla con «Eliminados»; eliminar y restaurar solo
  con `can_delete` del backend —`TrashCells restorable`—, nunca se deduce en la app; «Descargar» sin confirmar ni avisar,
  base64 → `utils/download.ts`), `DocumentUploadForm` (`FilePicker` con revisión de formato, vacío y tamaño solo como
  ayuda, tipo activo del catálogo `company_document_types`, nota con `TextAreaField counter`, confirmación con lo que se
  sube y el aviso con el mensaje del servidor) y `documentConfirms`. El avance de una subida se dibuja solo con
  `ui/UploadProgress` (también la foto de perfil, `overlay`).
- **Todo listado se pagina en el backend** y se muestra con el paginador único `Paginator`
  (`ListPaginator` para conectarlo a una lista): `usePagedList` (página, tamaño, cancelación,
  "Reintentar") o `useSearchList` (además búsqueda y filtro) + `ListToolbar`/`ListResults`. Por
  omisión 10 por página con opciones 10/20/30/40/50 (`config.pageSizes`/`config.pageSize`). Se
  personaliza con props (`noun`, `labels`, `show`, `siblings`, `sizes`, `variant`) y tokens
  `--pager-*`; no se crean paginadores propios ni listas que carguen todo.
- **Estados de un listado solo con `PagedItems`** (esqueleto, "Reintentar", vacío o los elementos
  con su paginador; `ListResults` lo usa para las tablas). Sin registros se muestra `EmptyState` y
  **el paginador se oculta**. Decisión del dueño del producto (2026-10-06): **todo vacío lleva ícono, título y
  una línea de descripción** (la acción para crear el primero si aplica), en ese orden; `EmptyStateProps.description`
  es obligatoria por tipo, así `PagedItems`, `ListResults`, `listEmpty` y cada `<EmptyState>` no compilan sin ella.
  La caja es una sola para toda la app (`.empty-state` en `global.css`: centrada, mismo alto mínimo, márgenes y
  ritmo ícono → título → descripción → acción, descripción a lo más 44ch, degradado suave); ninguna pantalla la
  ajusta. `compact` (más baja) va dentro de una sección de un detalle, una pestaña o un panel lateral; la lista
  principal de una pantalla usa la normal. `tone="success"` cuando "nada pendiente" es buena noticia. Con
  búsqueda o filtro activos, el vacío dice que nada coincide (`noMatchEmpty`). Los textos, en §7.6.
- **Todo borrado es lógico: «Eliminados»** (decisión del dueño del producto; el backend lo guarda 1 año y luego
  lo depura; el rostro y las fotos de una persona se borran para siempre al eliminarla). Piezas únicas en
  `components/trash` (`TrashParts`, `useRestore`) y `ui/DeletedMark`:
  - Listado: `useSearchList` + `ListToolbar trash` (opción «Eliminados» = filtro `'deleted'`, envía
    `deleted=true` sin `active`; `statuses={false}` para «Todos» / «Eliminados»; sin `onSearch`, solo el
    filtro). Con `list.trash`: columnas `trashColumns()` + `TrashCells` (o `DeletedNote` + `RestoreButton` en
    tarjetas), filas sin `onOpen` ni editar/estado/eliminar; `listEmpty` y `listSubtitle` para el vacío y el
    subtítulo.
  - Restaurar solo con `useRestore().restore(id, servicio.restore, () => pregunta, alTerminar)`: confirma
    (`restoreConfirm`; a un empleado, que registrará su rostro de nuevo), el aviso es el mensaje del servidor y
    luego se refresca la lista o se muestra el registro vigente. Cada servicio expone `restore` con
    `restoreRecord` (`services/http/restore.ts`).
  - Detalle de un eliminado (`deleted_at`): `DeletedRecordPage` (aviso `DeletedBanner` con «Restaurar», sin
    acciones) y **sin pedir sus secciones** (el backend responde 404): la vista vigente vive en otro componente.
  - Eliminar confirma con `deleteNote()` («Pasará a «Eliminados»…»; `{ person: true }` añade el borrado del
    rostro y las fotos). Una referencia del historial eliminada (`EmployeeRef`/`ShiftRef`/`SiteRef.deleted`)
    lleva `DeletedMark` junto al nombre.
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
  escriben en el código. Un catálogo nuevo que el servidor aún no envía (despliegue gradual: backend anterior) llega
  como lista vacía (`withMissingCatalogs` en `catalogService`); uno con otra forma sigue rechazando la respuesta.
- **Todo formulario es una pantalla** (ruta propia con `Panel` + `PanelFooter`): alta, edición,
  contraseñas, motivos... Los popups (`Modal`/`ConfirmDialog`) son solo para mensajes,
  confirmaciones de una acción y vistas ampliadas (p. ej. el QR), nunca para capturar datos.
  Reutilizar `NewPasswordFields` (contraseña escrita dos veces) y `ReasonField` (motivo con
  sugerencias del catálogo). Un formulario con motivo es `ReasonFormPanel`; su `confirm` (puede
  depender del motivo escrito) pide la confirmación ANTES de enviar (cancelar deja el formulario
  disponible). Rechazar una solicitud del empleado (cambio de turno, vacaciones o permiso) es
  `RejectRequestPanel` (nota obligatoria con `validateRejectNote` y la misma confirmación).
- **El círculo del rostro se ajusta al dispositivo, 100 % adaptativo** (decisión del dueño, 2026-10-07: «los contenedores
  de foto/video/grabaciones deben variar su tamaño dependiendo de dónde se estén ejecutando»), con unidades de contenedor
  (`.camera` es `container-type: size`; `--face-d` diámetro, `--face-cy` centro, `--top-space` la franja del rótulo y los
  controles de la cámara, `--msg-space` lugar del mensaje, `--face-d-max` el tope y `--ring-r` la línea media del anillo,
  de la ✓ y de las señales): nunca con medidas fijas (salvo mínimos de accesibilidad) ni `matchMedia`.
  - **Área de captura por el espacio disponible, no por el ancho de la tarjeta**: el diámetro es el menor de lo que
    permite el ancho (80 %: la silueta, lo que un rostro en una selfie a la distancia del brazo) y lo que permite el alto
    (menos la franja de arriba, el mensaje y un aire), con tope `--face-d-max` (640 px: más grande no da más detalle) y
    nunca más de 64cqh. En escritorio y en tabletas horizontales la tarjeta mide lo que necesitan sus dos columnas,
    centrada, y el panel de la cámara envuelve al círculo con un margen moderado: la tarjeta estima el diámetro con la
    MISMA cuenta en unidades de la pantalla (`--fi-view-h` alto del visor, `--fi-msg`, `--fi-top`, `--fi-d`) y da al panel
    `--fi-view-ratio` (1.3) diámetros de ancho (las unidades de contenedor no miran hacia el padre; si la cuenta
    difiere, solo cambia el margen: el círculo siempre lo mide el visor real). Dos columnas (cámara y textos) solo
    donde el ancho lo permite (≥ 1024 px, horizontal ≥ 900 px y teléfonos horizontales de alto corto, con la franja y el
    mensaje reducidos); apilado si no. Ningún flujo deja medio visor vacío ni recorta el círculo.
  - **El video se escala respecto al CÍRCULO, no al visor** (`.faceid .camera__video`): su lado CORTO mide `--face-fov`
    (1.3) diámetros, con la relación de aspecto REAL del flujo (`--video-ar`, que `CameraCapture` escribe en el visor al
    conocer el flujo y cuando cambia, `loadedmetadata`/`resize`; `max()` elige el lado corto sea horizontal o vertical),
    centrado en el centro del círculo y recortado por el visor y el fondo opaco: el campo visual dentro de la guía es el
    mismo en una computadora portátil (16:9), un teléfono (3:4, 9:16) o una cámara web (4:3), y un rostro a la distancia
    del brazo o sentado frente a la computadora cabe en la guía con aire. El detector mide con la geometría real del
    `<video>` (`getBoundingClientRect`, transformación incluida), así `guideTarget` y lo que se dibuja siguen siendo lo
    mismo. Los clips de la revisión (`ui/VideoPlayer`) conservan la relación de aspecto del clip con alto máximo relativo
    a la pantalla (`60dvh`) y ancho al del panel.
- **Capturas faciales solo con `LiveFaceFlow`** y se envían como `FaceCaptures` (frontales, una
  captura por movimiento del reto, la ráfaga si el reto la pide y el nombre de la
  cámara) con `postFaceCaptures`. La app no captura con una cámara virtual (`isVirtualCamera` con la
  lista de la política: palabra completa, sin distinguir mayúsculas ni acentos en los dos lados con `foldText` de
  `utils/text.ts`, como el backend; «Câmera virtual», «Caméra virtuelle», «Virtuelle Kamera», «Fotocamera virtuale»
  quedan bloqueadas y «Câmera frontal», «Caméra avant», «Vordere Kamera», «Fotocamera anteriore» no; decisión D-C4).
  - **Visor (decisión del dueño, 2026-10-06; estilo de una selfie guiada con la marca propia; el mismo día pidió «algo más
    enterprise»: sin fondos de colores, sin transiciones ni animaciones)**: tarjeta CLARA (`.faceid`, tokens `--fi-*`: el
    blanco del área de trabajo, el azul de la marca para la interfaz y el verde solo para el avance). `FaceGuide` dibuja la
    cámara en un círculo (fuera de él, el fondo opaco de la tarjeta: `--scan-backdrop`), la **guía del rostro** (decisión
    del dueño, 2026-10-07: «que se pinte algo así… para que el usuario ponga bien su rostro»: un contorno con forma de
    rostro real —óvalo con el mentón más angosto, línea del cabello y hombros—, SVG propio en `faceGuideShape.ts`, trazo
    blanco de 3.5 px (`--scan-stroke`) con un halo oscuro de 1 px a baja opacidad (`--scan-halo`) para verse sobre
    cualquier fondo; blanca en reposo, verde con el rostro bien colocado y color de aviso cuando no lo está:
    `--scan-idle`/`--scan-ok`/`--scan-warn`; nunca se oculta durante las fotos ni los movimientos, apenas más tenue, y
    se retira solo al confirmar; la MISMA guía en registro, verificación, asistencia, validador y el video con preguntas)
    y UN anillo fino y continuo (`components/ui/ProgressRing`: arco con puntas redondas de
    un solo color `--ring-from`/`--ring-to` sobre la pista `--ring-track`). **Estados fijos**: el anillo cambia su
    `stroke-dashoffset` AL INSTANTE (sin transición, sin luz en la punta, sin brillo ni `active`), la silueta, la ventana y
    el fondo cambian sin fundidos, no hay insignia, marca ✓, pulso ni destello de «capturando»; al enviar (`complete`) el
    anillo lleno es la señal. Debajo, UNA indicación grande y sin globo (`camera__message--face`, `CrossfadeText` sin
    transición: recibe una función que se escribe al dibujarse) y, mientras se toman las fotos, la cuenta aparte
    (`detail`: «Capturas válidas: 24/32» en el registro, «Foto 2 de 3» en una verificación; cifras de ancho fijo y sin
    anunciarse en cada foto). En un teléfono, arriba solo va el rótulo de la etapa (`introFor().label`); la barra de
    etapas es el contador («Etapa 3 de 5» para lectores de pantalla). Nada vuelve a dibujar en React por cuadro (0
    dibujos de `LiveFaceFlow` con el rostro quieto; uno por foto). `global.css` no tiene `transition` ni `animation` en
    `.face-scan*`, `.progress-ring*`, `.flash*` ni `.enroll-steps*`: una animación nueva ahí choca con esta decisión.
    Nada se copia de otra marca (ni logotipos ni dibujos ajenos). **Accesorios: la insignia es el único aviso**
    (decisión del dueño, 2026-10-07: «las insignias deben aparecer sí o sí y considera todas»; lo que se quitó por
    completo fue el texto «Quítate los lentes para continuar»): `AccessoryBadges` (en `FaceGuide.tsx`, estados fijos)
    dibuja un chip por accesorio que el servidor reportó —ícono de `components/accessories.ts` y nombre del catálogo
    `accessories` en el idioma activo— en fila bajo el rostro (nunca sobre los ojos), en TODOS los flujos. Aparece con
    cada validación del servidor que los reporte (`faceService.check` aceptada: `accessories`, todos los detectados; un
    422 `ACCESSORIES_DETECTED` de la validación previa o del envío: `details.accessories`, los bloqueados;
    `reportedAccessories`/`detectedAccessories` de `utils/faceErrors.ts`) y permanece hasta la siguiente validación que
    ya no los reporte (`LiveFaceFlow.accessories`). **Detección CONTINUA** (decisión del dueño, 2026-10-07: «en cualquier
    momento del flujo… si trae cubrebocas/lentes, que aparezca la insignia»): en el registro, mientras se alinea (foto
    inicial) y durante las capturas, `useAccessoryWatch` revalida un cuadro en el servidor cada
    `config.faceAccessoryCheckIntervalMs` (throttleado, sin solaparse, para no spamear ni disparar la alerta de peticiones
    lentas), reutilizando la última captura durante la toma (`frontal.last()`: no agrega cuadros ni cambia la resolución) y
    tomando uno chico (`faceAccessoryCheckPx`) al alinear; una falla de calidad/pose/red deja las insignias como están.
    Ninguna frase de la app pide retirar algo: un rechazo por accesorio (`Blocked.reason = null`, `blockedByAccessory`)
    muestra la indicación de colocación «Muestra tu rostro completo» y nunca el mensaje del servidor; el escaneo se reanuda
    con la insignia a la vista. `ScannerHints` solo dibuja la señal del movimiento del reto.
  - **Borde rojo/verde al tomar las fotos** (decisión del dueño, 2026-10-07: «marca en rojo si no está enfocada y en
    verde cuando esté enfocada… usa los bordes»): durante la toma de fotos del registro (foto inicial y las 32 capturas),
    el borde de la guía (`FaceGuide`, token `--scan-*`) va en VERDE con el cuadro válido (enfocado + en la guía + de
    frente + con luz + quieto) y en ROJO (`--scan-bad`, `captureTone` de `liveFaceView.ts`) con un rostro que todavía no
    sirve (borroso, fuera de posición, en movimiento); sin rostro, neutro. En los demás flujos el aviso sigue en ámbar
    (`guidanceTone`). La nitidez/enfoque la decide el detector (`useFaceAutoCapture` con `quality`: `faceFrameSharpness`,
    varianza del Laplaciano ≥ `enrollmentMinSharpness`); un cuadro borroso es la guía `blurry` (borde rojo, no cuenta).
  - **Lo que se dibuja es lo que se exige** (decisión del dueño, 2026-10-07): la validez del encuadre se mide CONTRA la
    guía. `faceGuideShape.guideTarget` lleva la caja objetivo del dibujo (`TARGET_BOX`: donde cae la caja del detector
    —de las cejas al mentón— cuando el rostro llena el contorno; medida con un rostro real en el harness) a píxeles del
    video con la geometría real de la página (`getBoundingClientRect` del círculo, `guideRef` de `FaceGuide`, y del
    `<video>` con `object-fit: cover`; sin geometría, el círculo inscrito). `useFaceAutoCapture` exige: dentro del cuadro
    de la cámara (`cut_off`), llenado entre `config.faceGuideMinFill` y `faceGuideMaxFill` (`too_far`/`too_close`),
    centro a menos de `faceCenterTolerance` del de la guía (`off_center`; el doble en un movimiento y 1.3 veces más de
    llenado al acercarse), de frente estricto (`look_straight`: giro ≤ `faceFrontalMaxYaw`, inclinación ≤
    `faceFrontalMaxRollDegrees`, cabeceo en `faceFrontalPitchMin`-`faceFrontalPitchMax` y, con rostro en reposo, deriva
    ≤ `faceFrontalPitchDrift`: mirar abajo NO es válido), luz, nitidez (`blurry`) y quietud. La QUIETUD es SUAVIZADA
    (decisión del dueño, 2026-10-07: el rechazo por «movimiento no solicitado» saltaba de más en el iPhone;
    `facePose.steadyStep`): el desplazamiento se mide contra el PROMEDIO de una ventana de `faceSteadyWindow` cuadros y
    solo se marca `moving` si supera `faceSteadyMaxShift` durante `faceSteadyGraceFrames` cuadros SEGUIDOS (un pico de
    ruido del detector no rechaza). Afloja solo la quietud: la posición y la pose NO se relajan. Todos más estrictos que
    el servidor (MediaPipe y YuNet miden distinto) y calibrados con un rostro real (`.env`, README). Los ojos no se
    evalúan (BlazeFace no da apertura ocular). Una guía nueva se agrega al `FaceGuidance`, a `GUIDANCE_KEYS` (texto en
    siete idiomas) y a `PREPARING` si es de la etapa de preparación.
  - **Un solo anillo para todo el proceso, contado en fotos** (`scanProgress` → `capturePlan` + `captureProgress` de
    `liveFaceView.ts`): las fotos de frente (y, en una verificación, las ligeras del tramo quieto de la ráfaga, que
    `useSyncExternalStore` lee de `FaceBurstRecorder.subscribe/held`) y los movimientos
    (sigue a la cabeza en el que va). Por eso **el reto se pide al empezar el escaneo**, en paralelo a las fotos (su
    vida corre desde que llega: `challengeDeadline(reto, llegada)`), y el de un escaneo que se detuvo no cambia el anillo
    del siguiente (`scanRef`). Al enviar queda completo con la ✓.
  - **Registro facial en un orden fijo (decisión del dueño, 2026-10-06, que no se altera): foto inicial válida → 32 capturas
    VÁLIDAS con los movimientos → video con tres preguntas → listo.** Las páginas de registro pasan `{...enrollmentCapture()}`
    (`frontalFrames` = `config.enrollmentValidPhotos`, `frontalPhoto` con `config.enrollmentPhotoPx` y
    `config.enrollmentPhotoGapMs`) y el indicador de pasos fijo de su pantalla (`EnrollmentStepper`: Foto inicial →
    Capturas → Video → Listo; sin el paso del video cuando la política no lo exige; estados fijos).
    - **Tres opciones independientes y retomables** (decisión del dueño, 2026-10-07: «una opción para tomar la foto, otra
      para el enrolamiento y otra para tomar el video y contestar las preguntas»; el orden lo exige el SERVIDOR). La pantalla
      `EMPLOYEE_ENROLL` (sin cambios en `catalog.screens`) tiene su índice y una ruta hija por paso, registradas en la misma
      entrada de `SCREEN_VIEWS` (`paths.employee.enroll`, `enrollPhoto`, `enrollCapture`, `enrollVoice`):
      - Índice (`EnrollmentPage` + `components/enrollments/EnrollmentSteps`): el estado de cada paso lo dice el servidor
        (`enrollmentService.progress` con `useResource`: pendiente, completado con su fecha, bloqueado con lo que falta,
        vencido, intentos agotados, «2 de 3 respondidas»); `enrollmentStepRules.ts` solo lo traduce a etiqueta, aviso y
        botón (`enrollmentStepViews`; nada se calcula: un estado nuevo va primero al backend). Cada botón confirma ANTES de
        abrir la cámara (`enrollmentStepConfirm`: «Repetir foto» dice que reemplaza la anterior; un registro rechazado o
        una nueva verificación, que reemplaza el registro anterior) y navega con `state.confirmed`. **Lo hecho, completo
        en verde** (adenda del dueño, 2026-10-07: «se debe marcar todo en verde siempre y cuando se haya procesado de
        manera correcta»): un paso cuyo estado del SERVIDOR es «hecho» se dibuja entero en verde (`.enroll-index__step--done`:
        palomita en lugar del número, ícono, título, etiqueta «Completado · fecha», borde y fondo `--success-soft`,
        contraste AA) y su acción secundaria («Repetir foto») queda neutra, nunca el azul de la acción principal, que
        conserva solo un paso pendiente; uno bloqueado va en gris. Nunca verde por un estado local u optimista: solo por
        lo que responde `GET /enrollment/progress` (al volver de un paso el índice lo pide de nuevo antes de pintar). La
        misma regla en `EnrollmentStepper` (pasos hechos en verde con palomita, el activo en azul, los demás en gris) y en
        «En validación» (`PendingValidationPage`: `current="done"`, los tres hechos; el paso del video según la política).
      - Pantallas de los pasos (`pages/employee/EnrollmentStepPages.tsx`, `StepGate`): vuelven a pedir el estado; si el paso
        no toca (`enrollmentStepBlock`: falta el anterior, ya se hizo, intentos agotados, sin video en la política) lo dicen
        con su `EmptyState` y «Volver al registro» en lugar de abrir la cámara; abiertas a mano (sin `state.confirmed`:
        un enlace, recargar) piden la confirmación con «Abrir cámara» (nunca un popup al montar: StrictMode lo cancelaría).
        Al terminar, cancelar o fallar regresan al índice (`replace`), que pide el estado de nuevo; el último paso deja el
        registro en validación (`useFinished`: releer el usuario con `refreshWithRetry`, aviso y «En validación»).
      - Paso 1, `LiveFaceFlow enrollmentStep="photo"`: la foto inicial se toma a MANO (decisión del dueño, 2026-10-07: «debe
        haber una opción para tomar la foto»): un obturador «Tomar foto» (`FlowActions` `shutter`, ≥ 44 px) que solo se
        habilita con el cuadro VÁLIDO (borde verde; `isSteadyGuidance`, sin relajar la posición/pose/nitidez) y, al
        presionarlo, toma UNA foto (`onPhotoStable` → `shot()`) y la envía con `enrollmentService.photo` (`POST /enrollment/photo`:
        la valida y SE PROCESA después; rechazada —borrosa, oscura, accesorio bloqueado…— muestra el mensaje del servidor y
        deja volver a tomarla, con las insignias de accesorios continuas). Sin reto ni `/face/check` previo; cuatro etapas;
        `onStable` NO se auto-dispara en este paso. Paso 2, `enrollmentStep="captures"`: las fotos válidas y los cuatro
        movimientos SIN la foto inicial (ya guardada) con `enrollmentService.submit`, AUTOMÁTICO (es una secuencia). Sin
        `enrollmentStep` (el registro en persona de la empresa) el flujo de siempre: foto inicial validada y, en la misma
        toma, capturas y movimientos (auto).
      - Paso 3: la pantalla pide su sesión con `enrollmentService.startVoice()` (`POST /enrollment/voice/start`, una vez:
        `useAction` en un efecto con marca) y la responde con `VoiceVerificationFlow`; una sesión vencida o inválida se
        avisa y se pide otra (las respuestas aceptadas se conservan: llegan solo las que faltan y la cuenta sigue, «Pregunta
        2 de 3» = `answered` + la actual de `total`); intentos agotados o sin registro pendiente regresan al índice.
    - **Foto inicial** (`LiveFaceFlow.photographs`, el registro en persona; el propio la toma en su paso 1, arriba): con el
      rostro estable se toma UNA foto (`shot()`) y se valida en el servidor (`faceService.check`) ANTES de las demás; rechazada (borrosa, oscura, quemada, sin rostro o con un
      accesorio que la empresa bloquea: los códigos del catálogo `face_errors`), se explica con el mensaje del servidor
      (`blocked`) —salvo los accesorios, cuyo aviso es la insignia— y se vuelve a pedir sin tomar ninguna más; aceptada,
      sus `accessories` se dibujan como insignias informativas y las fotos siguen. En una verificación la validación
      previa sigue siendo la de siempre (las primeras 3 ya tomadas).
    - **32 fotos VÁLIDAS, no 32 intentos, y nunca se repite el proceso** (`useFrontalCapture` con `FrontalPhoto.valid`,
      que arma `useEnrollmentPhotoPlan`; decisión del dueño, 2026-10-07: «las fotos se deben tomar únicamente si son
      factibles… lo verde se debe ir marcando única y exclusivamente si se tienen fotos válidas, de lo contrario no se
      debe repetir»): un cuadro cuenta solo si el detector lo ve en ese instante dentro de la guía, centrado, completo, de
      frente estricto, quieto y ENFOCADO (`isSteadyGuidance`: la nitidez y la quietud ya las decide el detector, no
      `useFrontalCapture`; `useFaceAutoCapture` con `quality` = `faceFrameSharpness` —varianza del Laplaciano sobre el
      rostro en gris a 96 px ≥ `config.enrollmentMinSharpness` y brillo medio 40-225, los límites del servidor; un lienzo
      bloqueado contra huellas no descarta nada— y la quietud suavizada; el detector sigue leyendo durante las fotos sin
      disparar nada, contra el rostro en reposo: `continuous`, `detectionMode` con `baseline`, `detectorActive`). Un cuadro
      inválido NO cuenta, NO toma foto y NO reinicia nada: la indicación grande sigue a la guía (`photosStatus`: «Centra tu
      rostro», «Mira al frente», «Acércate», «Aléjate», «Más luz», «Mantente quieto», «Muestra tu rostro completo») con el
      borde de la guía en ROJO, y en verde «Mantente quieto» cuando sirve;
      `photos` cuenta solo válidas (el anillo y la cuenta). No hay tope de intentos (`VITE_FACE_ENROLLMENT_MAX_ATTEMPTS`
      y `CaptureAttemptsExhaustedError` se eliminaron): la toma espera a la persona y se detiene sola al cerrar la pantalla
      o empezar otro escaneo (`generation`); si el reto vence mientras se reúnen las fotos, `onFrontalStable` pide otro
      conservándolas (`challengeExpired`), sin aviso ni reintento. Cada foto es de un cuadro NUEVO del video
      (`utils/videoFrames.ts`). Todos los candados se conservan: misma resolución por toma (`shot()`), Exif, geometría,
      ráfaga, llave del dispositivo, telemetría.
    - **Video con tres preguntas** (`VoiceVerificationFlow`; la sesión la pide la pantalla del paso 3): el mismo encabezado de la
      tarjeta del escáner (`ScanHeader` de `FaceScan.tsx`: título, nombre de la app, pasos y «Cancelar»; vive una sola vez),
      la cámara ya abierta en su
      círculo (`FaceGuide` con `stage="voice"`), la pregunta grande (texto del catálogo `voice_questions` por su código, en el
      idioma activo), «Responde ahora», el medidor del micrófono (`MicLevel`, `useMicLevel`: solo él se redibuja) y, al
      grabar, un indicador fijo «Grabando» con los segundos y el anillo contra `config.voiceMaxAnswerSeconds`. Grabación
      solo con `useAnswerRecorder` (`MediaRecorder` con la pista de video de `useCamera().videoTrack()` y el micrófono pedido
      con el aviso NATIVO, formato `pickMimeType` —MP4 en WebKit, WebM en Blink y Gecko—, termina sola tras
      `config.voiceSilenceStopMs` de silencio después de `config.voiceMinSpeechMs` de voz, con «Listo» o al tope); sin
      `MediaRecorder` o sin micrófono se explica (`voice.unsupported`, `voice.micDenied`) y se regresa a la bienvenida,
      nunca se omite la etapa. Cada clip va con `enrollmentService.answerVoice(token, posición, clip)`: aceptado, el token
      renovado y la siguiente pregunta; 422, la MISMA pregunta con el mensaje del servidor (`localizeServerText`), los
      intentos que quedan (`details.attempts_left`) y el token renovado (`details.token`); `VOICE_RETRIES_EXHAUSTED`,
      `VOICE_SESSION_EXPIRED`/`INVALID`, `VOICE_NOT_PENDING` o `ENROLLMENT_NOT_FOUND` → `onRestart` (la pantalla avisa y pide
      otra sesión o regresa al índice); 5xx, 429, 0 o 408 repiten la pregunta sin tirar nada; lo demás → `onFatal`. La
      pantalla del paso 3 solo da el registro por terminado (`useFinished`: releer el usuario, popup, «En validación») tras
      `onDone`.
    - **Revisión de la empresa** (`ValidationReviewPage` → `components/enrollments/VoiceReviewSection`): cada respuesta con su
      pregunta, intentos, duración, «Se oyó: …» y los parecidos; el video se pide SOLO al tocar «Reproducir video»
      (`enrollmentService.voiceClip`: base64 por la API → URL `blob:` local, liberada al salir; nunca una URL del bucket) y
      se reproduce con `ui/VideoPlayer` (conserva la relación de aspecto del clip, alto máximo `60dvh`, ancho al del panel,
      sin medidas fijas); un 404 dice que ya venció, otra falla abre el popup y se puede reintentar.
    - La política `voice_verification` se cambia solo en `CompanyPolicyPage` (sección de seguridad, con su advertencia:
      apagarla relaja → regla de dos personas); `useVerificationPolicy` la trae en `STRICT_RULES` como encendida.
  - **Destello de colores: RETIRADO de la experiencia** (decisión del dueño del producto, 2026-10-06; README «Destello de
    colores retirado»): la pantalla NUNCA se pinta de un color, ni completa ni parcial, en ningún flujo (registro,
    verificación, asistencia, validador). No existen `FlashOverlay`, `useScreenFlash`, `flashPacingService` ni la fase
    `flash` del flujo (código eliminado, no excluido); el plan del anillo no cuenta colores; el envío no lleva
    `flash_image` ni comprobante; un reto que aún traiga `flash`, `flash_required` o `flash_pace` se responde sin ellos
    (`LiveFaceFlow.liveness.test.tsx` lo exige; la política de toda empresa está en OFF y el servidor no los pide). En la
    política del ADMIN «Destello de colores» (`PolicyTuning` → `RetiredRow`) y «Destello dictado por el servidor»
    (`CompanyPolicyPage`, `Section.retired`) se muestran apagados y sin control con `policy.retired` /
    `policy.tuning.flash.retired`; Seguridad facial conserva su panel de mediciones (históricas) con
    `faceSecurity.flash.retired`. Lo que cubre los ataques de presentación sin el destello: la ráfaga, los movimientos,
    las señales del servidor (paralaje, moiré, ruido) y la verificación por voz y video. Una capa de color nueva en el
    visor choca con esta decisión.
  - **Prueba de vida** (el reto lo decide el servidor, `FaceChallenge`; `faceService.getChallenge(purpose)`): cada
    **movimiento** (`TURN_LEFT`, `TURN_RIGHT`, `LOOK_UP`, `LOOK_DOWN`, `MOVE_CLOSER`) con su señal delicada
    (`LivenessCues`, del tamaño y en el lugar del anillo, sin insignias: girar y mirar arriba/abajo, un arco azul por
    fuera del anillo de ese lado y una punta fina con contorno blanco dentro del círculo que se desliza hacia él;
    acercarse, ondas finas que salen del anillo hasta el tamaño objetivo, `--closer-scale` con tope) y regreso al frente
    entre uno y otro; estados fijos, sin transiciones. **El registro pide la prueba de vida COMPLETA** (decisión del dueño,
    2026-10-07: «que mueva su cabeza a la derecha, izquierda, arriba, abajo y que centre su cara»): el flujo pide el reto
    con `purpose: 'ENROLLMENT'` (siempre los cuatro movimientos de la cabeza, en el orden que decida el servidor), tras
    CADA movimiento vuelve al frente con detección real (`recenter` contra el rostro en reposo: «Centra tu rostro» o la
    corrección precisa; «Mira al frente» mientras la cabeza siga arriba o abajo) y, tras el último, la vuelta al frente
    FINAL («Centra tu rostro para terminar.», `finalRecenter`, el anillo ya lleno) antes de enviar (`finish`). El anillo
    (`capturePlan`) cuenta los cuatro movimientos y el rótulo dice «Prueba de vida · paso 2 de 4». La verificación, la
    asistencia y el validador no cambian: su reto es el de la política y envían tras el último movimiento.
  - Las medidas son las del servidor (`utils/facePose.ts`: giro, altura de la nariz entre ojos y boca,
    ancho del rostro) contra el rostro "en reposo" que `useFaceAutoCapture` entrega al quedar estable de
    frente (`onStable(sample)`), más el margen de la app (`faceTurnMargin`, `facePitchMargin`,
    `faceCloserMargin`).
  - Tiempo: cada movimiento `faceChallengeTimeoutMs`, sin pasar del vencimiento del reto (`expires_in`
    menos `faceChallengeMarginMs`); al agotarse se pide otro reto conservando el escaneo (hasta dos).
    Las reglas puras del visor (mensaje, títulos "Prueba de vida · paso 2 de 3", qué se mide) viven en
    `components/liveFaceView.ts`; las pruebas del flujo usan `test/faceFlow.tsx` (+ `faceFlowMocks.ts`).
  - **Telemetría de la toma** (antifraude 1b; solo mide, el servidor la valida estricta y nunca niega por ella):
    `useCaptureTelemetry` (en `LiveFaceFlow`) arma con `utils/captureTelemetry.ts` el JSON `telemetry` que viaja con
    las capturas: automatización del navegador, si hay una cámara virtual instalada (solo el indicador, NUNCA la
    lista de cámaras), lo que la pista reporta frente a lo que dice poder (`useCamera().videoTrack()`), el ritmo de
    los cuadros (`requestVideoFrameCallback`, últimos `config.faceFrameRhythmSamples`, con el reloj de LLEGADA de cada
    cuadro, `metadata.presentationTime`, declarado en `frames.clock`; el `now` es el del dibujo, alineado al refresco de
    la pantalla, y una cámara real en fase daría intervalos idénticos) y la pantalla. Solo números y banderas (≈400
    bytes). Un dato nuevo va primero al contrato del backend (`schemas/capture.py`, que rechaza campos de más).
  - **Compatibilidad universal** (decisión del dueño, 2026-10-06; `docs/rd/compatibilidad-biometria.md`): toda función
    biométrica (cámara, detección, capturas, ráfaga, telemetría, llave del dispositivo, ubicación, QR, grabación de video
    y micrófono) declara
    en ese documento (§2) su soporte en Blink, WebKit y Gecko y en cada sistema, y su RESPALDO, en el mismo cambio. Reglas:
    - Una API se detecta antes de usarse (`typeof`, `in`) y su ausencia tiene respaldo o un problema de cámara con su
      ayuda traducida (`cameraDiagnostics`: `in-app` para un navegador integrado, `canvas-blocked` para un lienzo alterado
      contra huellas, `utils/canvasReadback.ts`); nunca un visor que espera para siempre.
    - Lo que el navegador no puede medir viaja como «sin medir» (`null`, el reloj declarado), nunca como un valor que
      parezca sospechoso; el servidor decide.
    - Todas las capturas de una toma salen del MISMO tamaño (`useFrontalCapture().shot()`): el servidor exige una sola
      resolución por intento; si la imagen cambia de tamaño a media toma (el teléfono giró), `CameraTurnedError` la
      repite sin enviar.
    - WebCrypto e IndexedDB con tiempo límite (`withinTime` de `utils/waits.ts`, `config.deviceKeyTimeoutMs`): tarde =
      sin llave.
    - Un cambio que toque los bytes o las APIs del navegador se prueba en el banco de motores (Playwright con
      Chromium, Firefox y WebKit; el documento, §1 y §9) además de las pruebas unitarias.
  - **Protocolo de captura** (antifraude 2a; lo pide el reto, nunca la app): la ráfaga la toma `useFaceBurst`
    (`utils/faceBurstRecorder.ts`, reglas puras en `utils/faceBurst.ts`): desde el rostro estable de frente (tramo quieto;
    antes del reto se espera, con tope `faceBurstHoldWaitMs`, a completarlo) y en el primer movimiento. Cada recorte es un
    `drawImage` a un lienzo de espera al ritmo de `requestVideoFrameCallback` (sin él, un temporizador) y la hoja se arma y
    codifica una sola vez al enviar (`OffscreenCanvas.convertToBlob` o `toBlob`): nada de `getImageData` ni trabajo pesado
    en el hilo de la interfaz (iPhone sin congelarse). Lo que pide (lado, cuántos, calidad, margen, tope en bytes, mínimo)
    viene del reto (`burst`); la hoja vive solo en memoria y se descarta al enviar. Su interruptor (`capture_burst`) está en
    la sección «Protocolo de captura» de la política del ADMIN (`CompanyPolicyPage`); apagarlo relaja la seguridad (regla de
    dos personas). El destello dictado por el servidor se retiró con el destello (arriba): `sha256Hex` (la huella de una
    captura para la firma del validador) vive en `utils/digest.ts`.
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
  vida (`PolicyTuning`): movimientos de una verificación (1 a 3; el registro pide siempre los cuatro) y tiempo del reto;
  el destello (`flash_modes` del catálogo) se muestra retirado (`RetiredRow`, decisión del dueño, 2026-10-06). Los tres
  accesorios del catálogo son interruptores (`CompanyPolicyPage.faceSection` sobre `ruledAccessories` de
  `components/accessories.ts`, el mismo módulo de la insignia); «Retirar los lentes» nace apagado en toda empresa
  (decisión del dueño, 2026-10-07; `STRICT_RULES.block_glasses = false`) y ningún nivel lo enciende.
- **Seguridad facial** (`ADMIN_FACE_SECURITY`, `FaceSecurityPage`, `faceSecurityService`, secciones en
  `components/faceSecurity`, reglas puras en `utils/faceSecurity.ts`): solo dibuja lo que la
  plataforma calibró sola (cada umbral con `RangeMeter` entre su mínimo y su tope), las empresas
  reforzadas por ataques y lo medido del destello con su veredicto (`flashReadiness`; mediciones históricas: el
  destello se retiró el 2026-10-06 y el panel lo dice con `faceSecurity.flash.retired`). "Recalcular ahora" pregunta con `useAction({ confirm })` y avisa el mensaje del servidor.
  El protocolo de captura (antifraude 2a) tiene su sección (`CaptureProtocolPanel`, `protocolReadiness`: destellos
  dictados, a tiempo y con ráfaga) y un umbral que es un máximo (`upper`: el moiré) se dibuja con sus extremos «Lo más
  estricto» y «De partida».
- **Deriva de señales** (`ADMIN_DRIFT`, `pages/admin/drift/DriftPage.tsx`, piezas en `components/drift/DriftParts.tsx`,
  reglas puras en `utils/drift.ts`, `driftService`, tipos en `types/drift.ts`, textos en el espacio `drift`; antifraude
  fase 3): solo dibuja lo que el mantenimiento calculó (resumen con `useResource`; pestañas Señales / Empresas / Versiones
  en `?tab=` con `Tabs` + `useQueryOption`; tablas con `useSearchList`/`usePagedList` + `ListResults`, paginadas en el
  servidor; filtros de semana, plataforma y estado con `Select`). Los estados (`STATUS_TONE`, `COMPANY_TONE`) y la cola
  vigilada (`tailKey`: el 10 % más bajo o, en un máximo, el más alto) son presentación; ningún umbral se calcula en la app
  (`psi_alert`, `tail_drop_alert`, `min_samples` vienen del resumen). «Calcular ahora» pregunta con `useAction({ confirm })`
  y avisa con el mensaje del servidor. Un componente nuevo de la bitácora del motor se muestra tal cual (su código es un
  dato; los conocidos, `COMPONENT_KEYS`).
- **Antifraude** (backend: motor de riesgo, casos de fraude y regla de dos personas; tipos en `types/fraud.ts` y
  `types/policy.ts`; textos en `fraud`, `policy` (`policy/antifraud.ts`) y `attendance.review`):
  - **Política del ADMIN** (`CompanyPolicyPage` + `components/policy`): `PolicyPresets` (Estándar, Alto, Máximo del
    catálogo `policy_presets`), `RiskEngineSection` (cortes en orden, acciones, respaldo, sospecha de duplicado,
    dispositivo y cada señal con su modo, puntos y línea base —una `measure_only` no ofrece «Obligatoria»—; reutiliza
    `TuningRow`/`saveOf` de `PolicyTuning`),
    `RiskSimulationPanel` ("¿qué habría pasado?": no guarda, no confirma ni avisa) y `PolicyChanges` (historial con
    `describeFieldChange` de `policyFields.ts`; aprobar y retirar con `useAction({ confirm })`, rechazar es
    `RejectPolicyChangePage` con `ReasonFormPanel`). `updatePolicy` y los niveles responden `{policy, change}`: si el
    cambio relaja la seguridad queda `PENDING`, la pantalla muestra lo que devolvió el servidor (la política sigue
    igual) y el aviso lo dice; la confirmación de lo que relaja lo advierte con la regla de dos personas. La vista
    optimista de un cambio la arma `withChanges` (también el de una señal).
  - **Casos de fraude** (`ADMIN_FRAUD_CASES`, `pages/admin/fraud`, `fraudCaseService`, contador
    `usePendingFraudCases` → `OPEN_FRAUD_CASES`): bandeja con filtros de estado y tipo, detalle (`FraudAttempts`,
    `FraudEvents`, `RiskBadge`) y decisiones como formularios con nota (`FraudCaseFormPages`). La evidencia
    (`FraudEvidence`) se pide solo tras confirmar (cada consulta queda en el historial del caso), llega en base64 por la
    API (nunca una URL del bucket) y vive en memoria; si un fotograma falla, se avisa y se muestran los demás.
  - **Registros "en revisión"** (empresa): `ReviewParts` (`ReviewBadge`, `ReviewFact` dentro de `SessionSummary`,
    `ReviewActions` en el detalle de la jornada), `RejectAttendanceReviewPage` (nota obligatoria que ve el empleado),
    filtro "Solo en revisión" del historial (`?review` desde el tablero) y contador `usePendingAttendanceReviews` →
    `PENDING_ATTENDANCE_REVIEWS`. El empleado ve la nota de la decisión; los motivos internos no le llegan.
  - **Dispositivos del empleado** (antifraude 1b, D2): `components/devices/EmployeeDevices` (lista paginada con
    `usePagedList`/`PagedItems`; nombre, estado del catálogo `device_statuses`, primer y último uso, usos y si superó
    un paso más). En la ficha del empleado la empresa aprueba o revoca con `useAction({ confirm })` (`decisionConfirm`:
    antes → después y qué implica; sin aviso de éxito: el cambio ya se ve); en Mi perfil el empleado solo ve los suyos
    (`employeeDeviceService.mine`). El modo (apagado, solo medir, un paso más, aprobación) lo fija el ADMIN en
    `RiskEngineSection` y los niveles.
  - **Red de la IP** (base local DB-IP Lite, CC BY 4.0): el detalle del caso (`FraudAttempts`) muestra país, sistema
    autónomo, organización y si es una nube, siempre con la atribución `DbIpCredit` (obligatoria por la licencia);
    Seguridad facial muestra de cuándo es cada archivo (`IpDatabasePanel`). La app nunca consulta servicios de IP.
  - **Un paso más** (`STEP_UP_REQUIRED`): `LiveFaceFlow` guarda el reto de `error.details.challenge`
    (`stepUpChallenge` de `utils/faceErrors.ts`) y el siguiente escaneo lo responde con capturas nuevas (las enviadas
    ya no sirven: cada captura vale una vez).
  - **Prueba de presencia** (antifraude 2b; el backend decide con `validator_signing`, `validator_location` y
    `site_codes` de la política):
    - Política del ADMIN: `components/policy/PresenceSection` (reutiliza `TuningRow`/`saveOf`): cada interruptor muestra
      solo los NOMBRES del catálogo `signal_modes` (sus descripciones hablan de puntos de señales) y su ayuda propia del
      diccionario (`policy.presence`); obligatorio avisa qué preparar y bajar de modo pasa por la regla de dos personas
      como cualquier campo (historial con `PRESENCE_FIELDS` de `policyFields.ts`).
    - Firma por petición del validador: solo con `sendSigned` (`services/http/requestSigning.ts`). El reto vive en
      memoria (`signingNonce`: lo alimentan el perfil, cada `device_nonce` de las respuestas y el detalle de los errores
      de la firma) y se renueva con `GET /checkpoint/me` si falta o vence en menos de `config.checkpointNonceMarginMs`. El
      mensaje es `"{reto}.{acción}.{huella}"` (`face`: SHA-256 de la primera captura con `sha256Hex`; `qr`/`inspect`: el
      texto del QR) y lo firma `requestSignature` de `utils/deviceKey.ts` (la misma llave). `SIGNATURE_STALE` se reintenta
      UNA vez sin avisar; sin llave se envía sin firma (nunca se bloquea ni se avisa).
    - Ubicación en cada identificación: `hooks/useWarmLocation` la mantiene "caliente" mientras el punto de control está
      abierto (pausa con la pestaña oculta) y solo espera si no hay una lectura reciente; lo que se envía sale de
      `utils/locationPayload.ts` (el mismo del registro de asistencia). Nunca se bloquea en el cliente: decide el servidor.
    - Kioscos del sitio (pantalla `COMPANY_SITES`): `SiteKiosksPage` (listado, «Eliminados», restaurar, «Nuevo código de
      vinculación» y «Eliminar», todo confirmado) y `KioskFormPage`. El código de vinculación se muestra UNA vez con
      `kioskPairingMessage` (solo se cierra con «Ya lo guardé»; `CopyField` y el QR de `{origen}/kiosk#pair=CÓDIGO`: el
      fragmento nunca llega a un servidor).
    - Pantalla del kiosco: ruta pública `/kiosk` (fuera de las guardas de sesión, como `/login`) con `useKioskDisplay`:
      guarda solo `{kiosk_id}` en `deviceStore` (llave `kiosk`), firma `"{reto}.kiosk.{id}"`, pide el siguiente código al
      vencer `expires_in`, pausa con la pestaña oculta, sin red muestra «Sin conexión» con esperas que se duplican y vuelve
      a vincular ante `KIOSK_NOT_FOUND`. Textos en el espacio `kiosk`.
    - Código de sitio del empleado: con `today.site_code`, la entrada y la salida van ubicación → `SiteCodeStep` (QR del
      kiosco con `QrScanPanel` y sus props `accept`/`children`, o los 6 dígitos; «No estoy en el sitio» si hoy puede ser
      remoto) → rostro. `SITE_CODE_REQUIRED`/`INVALID`/`USED` muestran el mensaje del servidor y regresan al código. El
      código vive solo en memoria.
- **Cobranza y consumo** (solo el ADMIN; módulo `BUSINESS` "Negocio"; tipos en `types/billing.ts` y
  `types/usage.ts`; servicios `billingService` y `usageService`; textos en los espacios `billing` y `usage`
  de los diccionarios): **todo el dinero lo calcula el backend** (la app nunca prorratea, suma ni convierte:
  muestra `Money` con `formatMoney`, y bytes, tiempo y porcentajes con `formatBytes`/`formatDuration`/
  `formatRate` de `utils/numbers.ts`).
  - **Monedas (MXN, USD, EUR)**: cada importe se muestra SIEMPRE con la moneda que trae su respuesta
    (`formatMoney(monto, data.currency)`: `$1,234.50 MXN`, `$1,234.50 USD`, `€1,234.50 EUR`, igual en es-MX y
    en-US; sin moneda —empresa sin plan ni movimientos— "—"). `formatMoney` exige la moneda: nunca se supone
    una. Los totales de la plataforma llegan por moneda (`overview.currencies`) y se dibujan en un bloque por
    moneda (`MoneyByCurrency`); jamás se suman en la app. La moneda se elige solo con `CurrencyField`
    (`components/billing`: `Select` propio con las activas del catálogo `currencies`, código · nombre y su
    símbolo; la que ya tiene la empresa se conserva aunque se desactive) en el plan y en el registro de un
    pago; fija (`account.currency_locked` o una cuenta con moneda) se muestra deshabilitada con la ayuda que
    explica por qué. Un 422 `CURRENCY_LOCKED`/`CURRENCY_INVALID`/`CURRENCY_MISMATCH` cae en el campo
    `currency` (`planServerErrors`, `fieldErrorsFrom`).
  - `ADMIN_BILLING` (`BillingPage` con indicadores y empresas; `CompanyBillingPage` con estado, plan,
    saldo, periodo en curso y pestañas Cargos/Pagos/Estado de cuenta en `?tab=`; `PaymentFormPage`,
    `ChargeDetailPage` y los formularios con motivo de `BillingReasonPages`, sobre `ReasonFormPanel`).
    Piezas en `components/billing` (`AccountParts`, `AccountTabs`, `MoneyRows`/`ChargeLines`,
    confirmaciones en `billingConfirms`); reglas puras en `utils/billing.ts`. Suspender es un
    formulario con motivo que explica que se cierran AHORA todas las sesiones; reactivar y registrar
    un pago se confirman; el comprobante se elige con `FilePicker` (input oculto, PDF/imagen ≤ 5 MB
    solo como UX) y se descarga con `utils/download.ts`.
  - **Plan y cobro** en el alta y la edición de una empresa (`PlanSection` + `usePlanForm`;
    `CompanyPlanEditor` + `useCompanyPlanEdit` al editar: plan guardado o "Cobrar a esta empresa").
    La vista previa la calcula el backend (`usePlanPreview`: pausa, cancela lo anterior; un 422 se
    explica en la sección sin popup y una falla real se avisa una vez con "Calcular de nuevo"); nunca
    impide guardar. Se calcula con quiénes se cobran (`previewHeadcount`: los empleados y validadores activos que
    ya tiene la empresa o, si no tiene a nadie, sus límites; sin límite de empleados, uno) y lo dice en la sección
    (`headcountText`, más "cada validador activo se cobra como un empleado" cuando hay validadores): el backend
    suma `employees` + `validators`. La confirmación lista el plan con su moneda (`planView` + `planLabels()`) y, al editar,
    "antes → después" (`useCompanyPlanEdit().changes()`, armado al dibujarse) con la nota de que aplica desde
    el próximo cargo. Sin plan, la moneda del formulario empieza en la de la cuenta si ya tiene movimientos. La ficha de la empresa muestra
    `CompanyBillingSection` ("Abrir cobranza" solo con la pantalla, `useHasScreen`).
  - `ADMIN_USAGE` (`UsagePage`, `CompanyUsagePage`): rango en `?start=&end=` (`useUsagePeriod`: rangos
    de un clic, fechas a mano; uno inválido no consulta), gráficas propias `ColumnChart` (una escala
    por gráfica: peticiones aparte de los datos de entrada/salida, tabla oculta para lectores de
    pantalla) y `BarList`; el costo frente al consumo es una estimación rotulada como tal, en la moneda de
    la empresa (`usage.billing.currency`) y solo comparable con empresas de la misma moneda.
  - Las pantallas de cobranza y consumo se actualizan solas mientras se ven con `useAutoRefresh`
    (sobre `usePolling`: pausa con la pestaña oculta).
  - **Empresa suspendida**: `COMPANY_SUSPENDED` (401 o 403, también en el login) lo atiende `apiClient`
    (`onCompanySuspended`) y `SuspensionGate` (junto a `DeviceGate`) muestra a pantalla completa
    `AppErrorScreen` "Tu empresa está suspendida" con el mensaje del servidor; "Volver al inicio de
    sesión" cierra la sesión local sin otro aviso (`dismissSuspension`). Ninguna pantalla repite el
    error (`isHandledGlobally`).
- **Fechas y horas en la zona del negocio** (hora del Centro, `user.timezone`): solo con
  `formatDate`/`formatDateTime`/`timeAgo` y "hoy" con `businessToday`/`businessDate`/`businessHour`
  (`utils/format.ts`); nunca `new Date().getHours()` ni formatos con la zona del dispositivo.
- Valores para copiar (llaves, URL, comandos) solo con `CopyField` / `useCopy`. Un secreto que el
  backend entrega una sola vez (llave de la API) se muestra en un popup que solo se cierra
  confirmando que se guardó (`apiKeySecretMessage`).
- Dispositivos de validadores, empleados y kioscos: la llave vive en `utils/deviceKey.ts` (WebCrypto, no exportable; una
  por navegador, la misma para todos los usos). El login del validador firma el reto cuando el backend lo pide
  (`AuthContext`) y cada identificación la vuelve a firmar (`sendSigned`, antifraude 2b); el kiosco firma cada petición
  de su código; el empleado firma el `device_nonce` que llega con el reto facial (`LiveFaceFlow` →
  `postFaceCaptures`, campos `device_key`/`device_nonce`/`device_signature`; antifraude 1b, decisión D2). Si la llave
  no está disponible (ventana privada, sin IndexedDB) se envía sin ella: el servidor lo mide, nunca se rechaza ni se
  avisa. Nunca de otra forma.
- **Llaves de acceso (WebAuthn / passkeys)** solo con `utils/webauthn.ts` (sin librerías: `navigator.credentials` y un
  base64url propio; `passkeysSupported()` detecta `PublicKeyCredential`; `createPasskey`/`getPasskey` devuelven `null` si
  la persona cancela el aviso del sistema —no es una falla, no se avisa— y `PasskeyError` (`unsupported` | `failed`, con
  su texto del diccionario) si el dispositivo no pudo). Piezas: `components/passkeys/PasskeysSection` (Mi perfil →
  «Llaves de acceso»: lista paginada, revocar con `useAction({ confirm })`), `pages/PasskeyFormPage` (registrar y
  renombrar como pantallas con `FormFooter`; `useAction` y no `useSubmit` para que cancelar el aviso del sistema deje el
  formulario disponible; renombrar toma la llave de `location.state` o la pide al servidor si la URL se abrió a mano) y
  `components/auth/PasskeyLogin` (botón «Entrar con llave de acceso» solo con soporte; `useAuth().loginWithPasskey`
  reutiliza el mismo flujo del login —dispositivo del validador, `remember`, ubicación— con `loginWithProofs`). El reto
  sellado del servidor vive solo en memoria mientras dura la ceremonia. Los términos por idioma están en el glosario
  («llave de acceso», *passkey*, «chave de acesso», «clé d'accès», «Zugangsschlüssel», «chiave di accesso», «clave de
  acceso»).
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
- **Llaves de la API: el permiso «Verificación»** (SDK móviles, migración `0084` del backend; contrato
  `docs/sdk/contrato-verificacion.md`): los permisos se dibujan desde el catálogo `api_scopes` (nada fijo), y al marcar
  `VERIFICATION` el formulario (`ApiKeyFormPage` → `VerificationWarning`, un `callout` con `role="note"`) advierte que una
  llave dentro de una aplicación se puede extraer; si además se marcó un permiso de lectura, pide una llave SOLO con
  «Verificación» para la app y otra para el servidor. Textos en los siete idiomas (`apiKeys.form.verificationWarning`).
  La bitácora puede traer el método `API_FACE` (`VerificationMethod`); su nombre viene del catálogo
  `verification_methods`, nunca escrito en la app.
- **Validadores por empresa** (decisión del dueño; el backend decide, la app solo lo refleja):
  - El ADMIN fija el límite de validadores ACTIVOS en el alta y la edición de la empresa, junto al «Límite de
    empleados» (`CompanyForm` → `ValidatorLimitField`: `NumberField` con su unidad, de 0 a `VALIDATORS_MAX`, la
    ayuda de que 0 apaga el módulo y de que cada validador activo se cobra como un empleado; al editar, el mínimo son
    sus activos, `validateMaxValidators` y la ayuda lo dicen). Va en la confirmación (`companyLabels`), en el aviso del
    alta y en la ficha (`CompanyPlanUsage`: «N de M activos» con su barra). Un 409 `VALIDATOR_LIMIT_BELOW_ACTIVE`
    cae en su campo (`fieldErrorsFrom`).
  - Con 0, la pantalla de validadores simplemente no llega en `user.screens` (sin condiciones en la app).
  - `ValidatorsPage` muestra «N de M activos» (`ValidatorSeats`, con `active`/`limit` del listado); al llegar al
    límite, «Agregar validador» y «Activar» se deshabilitan con la ayuda de pedir más al administrador de la
    plataforma (el backend responde 409 `VALIDATOR_LIMIT_REACHED` de todos modos).
  - Donde se muestra la plantilla que se cobra (periodo en curso de la cobranza, consumo de la plataforma y de cada
    empresa) va el desglose `headcountBreakdown`: «10 empleados y 2 validadores».
  - Las unidades del cobro por empleado activo son **días-persona** (decisión del dueño, 2026-10-06) y se escriben solo
    con `unitsText(units, mode, validator_units)` (detalle y líneas de un cargo, vista previa, devengado y pronóstico):
    con validadores, el desglose que envía el backend, «310 días-persona (280 de empleados, 30 de validadores)»; sin
    ellos o sin el dato (un cargo anterior), solo el total. La app nunca lo calcula ni lo deduce de otra cifra.
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
  - Cada registro va con el rostro (`LiveFaceFlow`) y la ubicación (`sampleLocation` de `utils/locationSampling.ts`:
    hasta `config.locationSamples` lecturas en `config.locationSampleWindowMs`; la más precisa decide la geocerca y
    todas viajan en `location_samples` para las señales del servidor; aviso nativo)
    y se confirma ANTES de abrirlos ("¿Registrar tu entrada?", con su turno; la salida avisa que cierra
    la jornada): los botones de `TimeClockCard` preguntan y luego abren `AttendanceRecordPage`.
  - Estados con nombre y color de los catálogos (`board_states`, `assignment_states`,
    `work_session_statuses`, `shift_request_statuses`), nunca escritos en la app.
  - El contador de solicitudes pendientes del menú es `usePendingShiftRequests` (una consulta
    periódica); tras aprobar o rechazar se avisa con `notifyShiftRequestsChanged()`.
  - **El turno dice dónde y cuándo se checa** (decisión del dueño del producto): su formulario
    (`ShiftFormPage` + `useShiftForm`) tiene la sección "Dónde se checa" (`ShiftPlaceFields` +
    `useShiftPlace`: `SitePicker` con los sitios activos —y los que el turno ya tenía aunque se hayan
    desactivado, para quitarlos— y `WeekdayPicker` de días remotos limitado a los días del turno; un
    sitio es obligatorio salvo que todos sus días sean remotos). **Asignar (a uno o a varios) y aprobar
    un cambio solo eligen el turno y desde cuándo** (`useAssignment`, `AssignmentSections`,
    `StartDateField`): el turno elegido se ve completo en `ShiftCard` (horario, sitios con domicilio y
    radio, días remotos; `SitePlaces` es la misma lista que ve el empleado en "Mi asistencia").
  - Los formularios de turnos, sitios y asignaciones reutilizan `components/shifts` (`WeekdayPicker`,
    `SitePicker`, `ShiftPlaceFields`, `ShiftChoice`, `ShiftCard`, `RecordStatus`, `PendingRequest`,
    `QuickChoices`; reglas puras en `shiftRules.ts`: `placeText`, `shiftFacts`) y los campos de
    `components/ui` (`TimeField` con horas sugeridas, `NumberField` con su unidad, `Checkbox`,
    `ChoiceGroup`). El sitio usa los límites de radio de `useValidatorForm` (los mismos del backend).
    Sus confirmaciones: `shiftConfirm` (alta con lo que se crea; edición con "antes → después",
    incluidos sitios y días remotos, y "Afecta a N empleados asignados") y `siteConfirm`, `RecordStatus`
    (activar, desactivar y eliminar; el 409 del backend explica qué turnos usan el sitio) y
    `useAssignment().send(task, título, (turno, datos) => ConfirmInput)`, que da el turno elegido y lo
    que se confirma (horario, sitios, días remotos y desde cuándo, `shiftFacts`).
  - Las jornadas se dibujan solo con `components/attendance` (`SessionTimeline`, `SessionSummary`,
    `EventTimeline`, `MinutesBadge`, `sessionFacts`), las mismas para la empresa y el empleado; el
    tablero guarda el día en `?date=` (se puede compartir y sobrevive a recargar).
  - **Varios empleados a la vez** (asignar un turno, registrar una ausencia): se eligen solo con
    `EmployeePicker` (`components/employees`: búsqueda, estado, departamento, una casilla por fila,
    "Seleccionar los N de este filtro" con `employeeService.ids` —el servidor da los ids, hasta su
    tope— y cuántos van elegidos; `single` para una persona) y el resultado por empleado se muestra
    solo con `bulkResultMessage` / `BulkResultSummary` (omitidos primero, con su motivo). El turno que
    se asigna se elige con `ShiftChoice` (con su `ShiftCard`). Pruebas: `components/employees/testData.ts`
    y, para turnos y sitios, `test/shifts.ts`. `EmployeePicker` entrega también los nombres que conoce
    de los elegidos y la confirmación dice a quiénes afecta con `describeEmployees` (hasta 8 nombres y
    "y N más": los de "Seleccionar los N" llegan sin nombre).
  - **Calendario** (pantalla `COMPANY_CALENDAR`, servicio `calendarService`, tipos en
    `types/calendar.ts`): festivos, ausencias, solicitudes y días laborables. Los tipos de ausencia
    (`day_off_types`: nombre, color, frase y si el empleado los puede pedir) y los motivos de una
    corrección (`attendance_edit_reasons`) vienen del catálogo. El contador de solicitudes de
    vacaciones o permisos del menú es `usePendingAbsenceRequests`; tras registrar, aprobar, rechazar
    o cancelar se avisa con `notifyAbsenceRequestsChanged()`.
    La pantalla se arma con `components/calendar` y las pestañas accesibles de `components/ui/Tabs` (una
    pestaña por sección en `?tab=`); cada pestaña abre con su barra `.cal-toolbar` (periodo o descripción a
    la izquierda, acciones a la derecha; a lo ancho en un contenedor angosto). Cada ausencia se confirma con
    `absenceFacts` (empleado, tipo, fechas con sus días y nota). "Agregar festivos oficiales" explica qué
    hará (las fechas las decide el backend con la ley de su año; la app no las calcula) y al terminar el
    aviso lista cada festivo agregado.
    - **Un solo periodo**: `PeriodNavigator` ("Hoy", mes anterior y siguiente, y el título "Octubre 2026" que
      abre el selector de mes y año sobre `Floating`, con el estilo de `DateField` y su `moveInGrid`). El día
      elegido vive en `?date=` (`useCalendarPeriod`; el mes que se ve es el suyo, hoy limpia la URL, uno
      inválido o fuera de `YEAR_RANGE` abre hoy); lo del año (festivos oficiales, "Festivos de {año}") es del
      año que se ve. No se agrega otro selector de año ni de mes.
    - **`MonthCalendar`**: 6 semanas fijas (`gridWeeks`; la altura no cambia), líneas finas, fines de semana
      sombreados, días vecinos atenuados (tocarlos lleva a su mes), hoy en círculo, el elegido con su anillo,
      teclado (flechas, Inicio/Fin, Re Pág/Av Pág, Enter) y marcas por día (`CalendarMarker`: tono, ícono,
      texto y `count`; "+N" si no caben): chips en una cuadrícula ancha, solo la cifra en una mediana y
      puntos con leyenda en una angosta (`@container month-cal`). Números con `lining-nums tabular-nums`.
    - **Datos del mes** (`useMonthDaysOff`): tres consultas acotadas (festivos del año, ausencias aprobadas
      y días laborables del mes, `MONTH_DATA_LIMIT`), nunca una por día; lo de cada día se calcula en memoria.
    - **`DayDetail`** (fijo al desplazar en escritorio; el panel usa `overflow: clip`): fecha con su estado
      (festivo, laborable, fin de semana), el festivo con su origen, quién descansa (`Avatar` + tipo del
      catálogo; las primeras 5 y "Ver todos") y quién trabaja su día libre, con "Marcar como festivo" /
      "Quitar festivo" (`useHolidayActions`: la misma confirmación que la tabla) y "Registrar ausencia". Los
      formularios abiertos desde un día (`?date=`) empiezan en él y regresan a él (`useCalendarReturn`).
    - **"Festivos de {año}"** (`YearHolidays`): tabla con `ListResults` (fecha, día, nombre, tipo, eliminar),
      tarjetas en pantallas angostas con el nombre arriba.
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
- **Analítica de uso solo con `services/analytics.ts`** (Firebase / Google Analytics 4; excepción a la
  regla 13 decidida por el dueño del producto): `AnalyticsTracker` (en `App.tsx`) envía cada pantalla
  como plantilla (`routeTemplate`: ids, UUID y tokens → `{id}`; sin query ni hash) y el rol de la cuenta.
  Prohibido enviar nombres, correos, empresas, ids, textos escritos o la URL real; un evento nuevo pasa
  por ese módulo con datos que no identifiquen. Sin vista automática, sin señales de Google ni anuncios
  (consentimiento de anuncios negado), carga diferida y de mejor esfuerzo (nunca un popup). Se configura
  con `VITE_FIREBASE_*` y `VITE_ANALYTICS_ENABLED` (por omisión solo en producción). Los paquetes son
  `@firebase/app` y `@firebase/analytics` (no el paquete `firebase` completo: trae Firestore, que no
  se usa y tenía vulnerabilidades).
- **Rendimiento visto desde el navegador solo con `services/perf`** (al backend PROPIO, nunca a terceros; regla 13):
  - `WebPerformanceTracker` (en `App.tsx`) llama a `startWebPerformance()` una vez (StrictMode lo detiene y lo
    reinicia sin repetir nada: lo que se mide una vez por carga vive en el módulo) y a `trackPerfScreen(pathname)`
    en cada cambio de ruta. Sin dependencias: `PerformanceObserver` NATIVO con `buffered` y detección por
    `supportedEntryTypes` (Safari y Firefox no tienen LCP, INP ni tareas largas: simplemente no se miden).
  - Qué se mide (`webPerformance.ts`, reglas puras en `vitals.ts`): por carga de la página TTFB y FCP (de la
    pantalla donde se abrió) y LCP (último candidato antes de la primera tecla o toque o de ocultarse; de la
    pantalla que se ve al terminar la carga); por visita a una pantalla CLS (ventanas de sesión: < 1 s entre
    cambios, ≤ 5 s, sin los que siguen a una acción) e INP (la peor interacción: `event` con `durationThreshold`
    40 más `first-input`, por `interactionId`), y cada tarea larga. Una visita se cierra al cambiar de pantalla o
    al ocultarse (y otra empieza al volver); un cambio de pantalla antes de la primera interacción es una
    redirección de la carga (la visita sigue con la pantalla de destino). Lo cargado en segundo plano no mide
    FCP ni LCP.
  - La API: `apiClient.onApiTiming` (un registro, no una importación: el cliente no depende de la telemetría) da
    cada INTENTO: "MÉTODO /api/plantilla", duración y estado (0 sin red, 408 tiempo agotado del cliente); una
    cancelación del llamador no se mide. El envío no pasa por `apiClient`: nunca se mide a sí mismo. Los errores
    de JS siguen en `clientErrorService` (no se duplican aquí).
  - Privacidad: una pantalla es `routeTemplate(location.pathname)` (`utils/routeTemplate.ts`, el mismo de la
    analítica: ids, UUID y tokens → `{id}`; sin query ni hash) y una API es su plantilla; nunca ids, correos,
    textos ni la URL real. Nada en Web Storage: lo no enviado se pierde con la página.
  - Envío (`telemetry.ts`): muestreo por carga (`VITE_PERF_SAMPLE_RATE`; una carga sin muestrear no observa
    nada), búfer con tope (`VITE_PERF_MAX_SAMPLES`; el exceso se descarta) y cuerpo ≤ 60 000 caracteres (el
    backend rechaza > 64 KB y el navegador limita `keepalive` a 64 KB), cada `VITE_PERF_FLUSH_SECONDS` y al
    ocultarse o cerrarse (`pagehide`) con `fetch(..., { keepalive: true })` a `POST /api/telemetry/web`. No se
    usa `navigator.sendBeacon` porque no puede llevar `Authorization`: sin el token el backend solo conserva lo
    del inicio de sesión. Tiempo límite (`VITE_PERF_TIMEOUT_SECONDS`), sin reintentos y sin popups: un lote que
    no llega (sin red, 429, 413) se descarta. Se apaga con `VITE_PERF_ENABLED=false`.
  - **Agregar una métrica del navegador**: el `kind` nuevo primero en el contrato del backend (`WebPerfBatch`);
    luego su tipo en `SampleKind` (`telemetry.ts`), su regla pura en `vitals.ts` (con su prueba) y su
    `observe(tipo, …)` en `startObservers` (con su nombre = pantalla o plantilla, nunca un dato), y su prueba con
    el `PerformanceObserver` simulado de `webPerformance.test.ts` (soportado y no soportado).
- **Rendimiento (`ADMIN_PERFORMANCE`, módulo `OPERATIONS`)**: `PerformancePage` con el periodo en `?period=`
  (`PeriodPicker`: 1 h a 90 días, por omisión 24 h) y pestañas en `?tab=` (`useQueryOption`): Resumen
  (indicadores, peticiones y tiempos p50/p95/p99 por intervalo, rutas más lentas y funciones con más tiempo; el
  subtítulo y el indicador de alertas dicen los dos umbrales de la regla 18 que envía el backend: `slow_threshold_ms`
  y, para las rutas faciales, `slow_face_threshold_ms`),
  Rutas y Funciones (`MetricsTab`: búsqueda, orden y cada fila abre `MetricDetailPage`,
  `/admin/performance/metric?kind=&name=&period=`), Navegador (Web Vitals por pantalla con su p75, calificación de
  Google y umbrales —`VitalCell`, color + texto, nunca solo color— y las APIs vistas desde el navegador), SQL
  (pg_stat_statements; sin la extensión, el vacío lo explica) y Alertas (filtro por `slow_alert_statuses` del
  catálogo y búsqueda). Piezas en `components/performance`, reglas puras en `utils/performance.ts`, servicio
  `performanceService`, tipos en `types/performance.ts`, textos en el espacio `performance`. Todo se actualiza
  solo mientras se ve (`useAutoRefresh` con `config.performanceRefreshMs`). Las tendencias se dibujan con
  `ColumnChart variant="lines"` (una línea por serie, hasta tres, `--chart-1..3`; su resumen accesible dice dónde
  termina cada línea, no la suma). `SlowAlertDetailPage` cambia el seguimiento con `useAction({ confirm })`
  (antes → después con los nombres del catálogo, sin aviso de éxito: el cambio ya se ve) y luego
  `notifySlowAlertsChanged(opened_at)`.
- **Alertas de peticiones lentas en el menú y en vivo (regla 18)**: `useSlowAlerts` (en `AppLayout`, solo si una
  pantalla del usuario lleva el contador `OPEN_SLOW_ALERTS`) hace UNA consulta periódica del resumen
  (`usePolledValue`, base también de `usePolledCount`; `VITE_POLL_SLOW_ALERTS_SECONDS`, en pausa con la pestaña
  oculta) que da el contador (`open`) y el aviso en vivo: si la alerta abierta más reciente (`latest.opened_at`)
  es posterior a lo que esta pestaña ya conocía, UN popup de advertencia (`useFeedback().show` con función: sigue
  al idioma) con la ruta, su tiempo y "Ver alerta". La primera respuesta solo fija la base (abrir la app no avisa
  lo que ya estaba abierto), cada apertura se avisa una sola vez y lo que la persona misma reabrió
  (`notifySlowAlertsChanged(opened_at)`) no se le anuncia.
- **Cargas con la marca** (decisión del dueño del producto): mientras algo carga se muestra solo
  `PageLoader` (`components/Spinner.tsx`): el ícono de la app con los colores de la marca recorriéndolo,
  el mensaje "Cargando información" y una barra fina de avance. Al abrir la app (sesión, catálogos,
  pantallas diferidas) va a pantalla completa en blanco (`fullscreen`); dentro del área de trabajo, al
  centro. Nada de ruedas girando con textos propios; las listas usan sus esqueletos (`PagedItems`).
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
    `saveIfValid`, `ReasonFormPanel`, `useAssignment().send` y `useManualSession().save` no compilan
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
- **Datos opcionales** (número, RFC, CURP y NSS del empleado —`OPTIONAL_FIELDS`—; identificador fiscal de la empresa):
  sin `required` (sin asterisco), con la ayuda «Opcional · …», validación del cliente solo con valor y en vivo solo con
  valor (los documentos, completos); vacío viaja como `null` (`optionalPayload`, `companyBody`) y borrarlo al editar se
  confirma «antes → Sin capturar». El número de empleado puede faltar (`string | null` en todos los tipos): una persona
  se nombra solo con `employeeLabel` / `employeeNumberLabel` (`utils/employeeLabel.ts`: «Ana Ruiz · EMP-7» o solo el
  nombre, nunca «· null»), lo que mostraba el número como dato secundario lo omite y el expediente dice «Sin capturar».
- **Identificador fiscal de la empresa** (cualquier país; decisión del dueño, 2026-10-06; backend `0074`): solo con
  `TaxIdFields` (en `CompanyDataFields`) y las reglas de `utils/taxId.ts`. País fiscal (`Select` con búsqueda, los países
  de `useCountryOptions`, México por omisión), tipo (`taxIdTypesFor`: los del país y «Otro» del catálogo `tax_id_types`;
  al cambiar de país, `mainTaxIdType`) y número (`normalizeTaxId`; ayuda `taxIdHint` con el formato y el ejemplo del
  catálogo; `validateTaxId` solo avisa largo y regla del catálogo —el RFC con su validación completa—: el dígito
  verificador y si ya existe los dice la validación en vivo `company_tax_id` con `related` = «país:tipo»). Viaja
  completo: al editar, si cambió el país, el tipo o el número (`taxIdKey`: sin número no cuentan), se envían los tres.
  Se muestra solo con `formatTaxId` («RFC · PNO120315AB1 · México»; `taxIdLine` con «Sin identificador fiscal») y en
  las confirmaciones en una línea (`companyView` + `companyLabels`). Nunca se escriben tipos, formatos ni países en la app.
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
  - **Campos del domicilio** (`AddressFields`, decisión del dueño del producto: este orden, estas
    etiquetas y estas ayudas, iguales al backend): País (`Select` con búsqueda), Estado o provincia,
    Municipio o alcaldía, Ciudad o localidad, Colonia o barrio (obligatoria), Código postal, Calle o
    vialidad, Número exterior, Número interior (opcional) y Referencias (opcional, varios renglones con
    `TextAreaField counter`, a lo ancho). `addressLine` incluye la colonia ("Calle Dr. Paliza 71 Int. 2,
    Centro, 83000 Hermosillo, Sonora"), nunca las referencias; lo que se envía sale de `addressPayload`
    (las referencias limpias con `cleanNotes`, como las guarda el backend). Las confirmaciones muestran
    las referencias en su propia fila (cambiar solo ellas también es un cambio).
  - **Buscador** (`PlaceSearch` → `mapsService.searchPlaces`): Autocomplete de Places (New), la API de
    Google más rápida para cada tecla (pausa de 220 ms, una sesión hasta elegir). Si Places está
    apagado, negado o falla, **la misma lista busca con la geocodificación de lo escrito**
    (`geocodePlaces`, Geocoding API: pausa de 300 ms porque se cobra por consulta, `componentRestrictions`
    del país, `bounds` de 50 km alrededor de la referencia, distancia calculada con `distanceMeters`);
    elegir uno de esos resultados no consulta nada más (ya trae punto y domicilio). Cuando Places
    responde `denied` ya no se llama en esa página (`searchSource()`) y su problema se reporta una vez
    (`onProblem` → `reportMapsProblem`, sin popup). Mínimo 3 letras y solo se dibuja la respuesta de lo
    último que se escribió (cada búsqueda lleva su `AbortSignal`: una vieja no pide ni el respaldo).
    Muestra **las 5 sugerencias más cercanas** (por `distanceMeters`; sin distancia, al final) con su
    distancia ("350 m", "1.2 km"). La referencia (`origin` + `locationBias` de Places, `bounds` de la
    geocodificación) es el punto marcado; si no hay, el centro del mapa cuando ya se acercó a una
    ciudad (`MapCanvas.onView`); si no, la ubicación que el dispositivo ya conoce (`knownLocation`, solo
    con el permiso ya dado: nunca abre el aviso); si no, solo el país. Sin ninguna de las dos APIs, la
    lista dice "Sin resultados" y qué hacer.
  - **Domicilio de un punto o de un resultado elegido**: `reverseGeocode` junta TODOS los resultados de
    Google (`addressFromResults`: manda el más preciso; la colonia, la calle, el código postal, el
    estado, el municipio, la ciudad y el país que le falten salen de los demás; el número nunca). Un
    lugar elegido (de Places o de la geocodificación) al que le falte algo de su zona se completa igual
    con la geocodificación de su punto (de mejor esfuerzo, 3 s). En México `administrative_area_level_2`
    es el municipio, `locality` la ciudad y `sublocality_level_1` la colonia (luego `sublocality` y
    `neighborhood`); `route` la calle (nunca "Vía Sin Nombre"), `street_number` el número exterior y
    `subpremise` el interior. Las referencias nunca salen de Google y se conservan al mover el punto.
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
- **Servida por el gateway** (`docker/nginx.conf.template`, que también reparte `/api` entre las réplicas del backend; es una plantilla: `docker/15-gateway-config.sh` escribe al arrancar los `NGINX_*` de `docker-compose.yml` —procesos, conexiones, keepalive hacia la API, tiempos límite, reintentos, cuerpo máximo—, con sus valores en el `.env` de la raíz; un parámetro nuevo que dependa de las réplicas o del equipo se agrega ahí, en `docker-compose.yml` y en ese `.env`, nunca fijo en la plantilla):
  `/assets/*` con caché de un año `immutable` (nombres con hash de Vite), `index.html` y `version.json` sin
  caché (así una publicación nueva se ve y se detecta), `.gz` hechos al construir la imagen (`gzip_static`) y
  un `/assets` inexistente es 404 (nunca `index.html`). Lista para una CDN. Un archivo de `public/` no lleva
  hash: nunca se le pone caché larga (solo `/assets`, `/mediapipe` 30 días e íconos 1 día).
- **Cámara y dispositivo**: una pista que termina (`ended`) o se silencia (`mute`) se detecta; "la
  cámara aún no da imagen" se reintenta; los reinicios automáticos tienen tope y esperan la red.
- **Rendimiento**: pantallas con carga diferida (`lazyPages`); listas paginadas en el backend;
  nada de temporizadores que redibujen pantallas completas; contadores del menú con UNA consulta
  periódica compartida (`usePolledCount`, o `usePolledValue` si una consulta da más de un dato), pausada con la
  pestaña oculta.

## 4. Calidad (obligatoria antes de dar algo por terminado)

- `npm run typecheck`, `npm run lint` (sin advertencias: complejidad ≤ 20, archivo ≤ 450 líneas;
  si se pasa, se extraen componentes o hooks; incluye los textos sin traducir y la ortografía de §7),
  `npm test`.
- **Cobertura del 100 %** (líneas, funciones, sentencias y ramas; `npm run coverage`) cubriendo todos los
  escenarios: éxito, cada error del backend (4xx/5xx/red/tiempo agotado), permisos, estados vacíos,
  cancelaciones y reintentos. El código que no se puede ejecutar se elimina (no se excluye).
- Cada pantalla, hook o servicio nuevo lleva prueba (incluidos errores y estados vacíos).
- Calidad global de ambos proyectos: script de la raíz del repositorio (ver
  `../scripts/quality/README.md`).
- **Dependencias al día sin romper nada** (regla 11 de la raíz): cada actualización mayor se prueba antes de adoptarse.
  Versiones que se retienen a propósito (revisadas el 2026-10-07; se vuelven a revisar en cada limpieza):
  - **TypeScript se queda en la versión más nueva que soporta typescript-eslint**: hoy `~6.0.x`, no 7.0.2
    (typescript-eslint 8.71.1 declara `typescript >=4.8.4 <6.1.0`). Con TypeScript 6 los tipos globales se declaran en
    `tsconfig` (`types`), y con React 19 una referencia de `useRef(null)` es `RefObject<T | null>` y el envío de un
    formulario es `SubmitEvent`.
  - **`@types/node` sigue a la versión de Node de la imagen** (`Dockerfile`: `node:24-alpine`): 24.x, no 26.
  - **`@mediapipe/tasks-vision` en 1.0.1**: la 1.1.0 (publicada el 2026-10-06) pesa un 10 % más (40.6 MB contra 36.8 MB
    desempaquetados; su WASM se sirve al navegador desde `public/mediapipe`) y toca el detector facial, así que solo
    entra tras pasar el banco de motores de `docs/rd/compatibilidad-biometria.md` §9 (Playwright con los tres motores,
    fuera del repositorio) y comparar el tamaño servido; pendiente de esa corrida.
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

## 6. Configuración (`.env` completo; regla 19 de la raíz)

- **`.env` tiene TODAS las variables `VITE_*` con su valor** (decisión del dueño del producto). Se leen solo
  en `src/utils/config.ts` (con valor por defecto y límites: `envNumber`, `envString`, `envBoolean`,
  `envNumberList`, `seconds`) y, las del servidor de desarrollo, en `vite.config.ts`; ningún otro módulo lee
  `import.meta.env`. Un valor ajustable (tiempo, intervalo, límite, URL) va a `config.ts`, nunca como
  constante suelta en un componente.
- **Una variable nueva, en el mismo cambio**: en `config.ts` (o `vite.config.ts`), en
  `scripts/generate-env.mjs` (mismo valor por defecto y su comentario con el rango), en `.env` y en la
  tabla del README (§7).
- `src/utils/envFile.test.ts` es el guardián: la salida del generador tiene exactamente las variables que
  lee el código, cada una con el valor por defecto del código, y las claves de Google Maps y Firebase
  vacías (nunca van al repositorio; `.env` está en `.gitignore`); el `.env` local tiene exactamente esas
  variables. Vacío = valor por defecto.
- Las `VITE_*` se incrustan en el bundle: son públicas, nunca un secreto del servidor.

## 7. Idiomas: siete idiomas (regla 16 de la raíz)

Decisión del dueño del producto (2026-10-06): **todo lo que se programa existe en los siete idiomas de la plataforma**
—español de México (`es-MX`, por omisión), inglés de Estados Unidos (`en-US`), portugués de Brasil (`pt-BR`), francés de
Francia (`fr-FR`), alemán de Alemania (`de-DE`), italiano de Italia (`it-IT`) y español de España (`es-ES`)—, con
**ortografía verificada** en cada uno y un **cambio de idioma en caliente**. Ningún cambio se da por terminado si falta
un idioma. El registro de cada idioma, el glosario por término y el vocabulario de España: `docs/i18n/glosario.md`
(obligatorio al traducir; ahí también está «cómo agregar un idioma»).

### 7.1 Cómo está hecho (`src/i18n/`)
- Capa propia y pequeña, sin librerías (`core.ts`): un estado por pestaña con el idioma activo y su
  traductor. Se eligió sobre i18next/FormatJS porque cubre lo necesario —llaves con tipo, variables, plurales
  con `Intl.PluralRules`, un archivo por idioma que se descarga solo cuando se usa— sin dependencias, sin el
  detector de idioma que guarda en `localStorage` y con un `t()` síncrono que sirve en reglas puras.
- API (`import { t, useT, Trans, useLocale } from '../i18n'`):
  - `useT()` en componentes (`const t = useT();`): traduce y redibuja al cambiar el idioma. Su `t` (igual que
    el global) traduce siempre en el idioma VIGENTE: una fábrica creada en un dibujo anterior que lo guardó
    (la de una confirmación abierta, un `useCallback`) da el texto del idioma nuevo; su identidad sí cambia
    con el idioma (lo memorizado con `[t]` se recalcula). Lo que no se puede guardar es el TEXTO ya
    traducido (§7.3).
  - `t()` fuera de React (hooks, reglas puras, fábricas de confirmaciones). **Solo dentro de funciones**: una
    constante del módulo se calcularía una vez y no cambiaría de idioma (lint `i18n/no-module-level-t`).
  - `<Trans k="ns.llave" values={{ email: <strong>{email}</strong> }} />`: frase con partes enriquecidas sin
    partirla (cada idioma ordena la oración a su manera).
  - Variables `{nombre}`; plurales con `llave_one` / `llave_other` (y `llave_zero` si cero lleva otro texto)
    usando `t('ns.llave', { count })` (`count` se muestra con separador de miles; las demás variables
    numéricas, tal cual). Las llaves tienen tipo: una llave que no existe o una variable que falta no compila.
- Diccionarios: `src/i18n/locales/es-MX/<espacio>.ts` (`as const`, fuente de las llaves) y
  `src/i18n/locales/<idioma>/<espacio>.ts` (`satisfies Translation<typeof es>`) para en-US, pt-BR, fr-FR, de-DE e
  it-IT, un espacio por área (`common`, `auth`, `layout`, `ui`, `shifts`, `attendance`, `location`...), llaves en
  camelCase agrupadas por pantalla o componente (`shifts.form.title`); el `_` solo para la forma del plural. Un archivo
  de más de 450 líneas se parte en subarchivos que su espacio importa (igual en cada idioma). **es-ES deriva de es-MX**
  (`derive(es, {...})`, `src/i18n/derive.ts`): un archivo por espacio, sin subcarpetas, con SOLO las llaves cuyo texto
  cambia en España (glosario §3: fichar, móvil, ordenador, mascarilla, gafas, clave, añadir, importe…); el español común
  no se duplica (regla 6) y la lista de diferencias queda escrita en el código. El `index.ts` de cada idioma que no es la
  fuente arma su diccionario con `assemble` (`src/i18n/assemble.ts`) desde los archivos de su carpeta
  (`import.meta.glob(['./*.ts', '!./index.ts'], { eager: true, import: 'default' })`): la lista de espacios vive solo en
  es-MX, un espacio nuevo entra con crear su archivo en cada idioma y los subarchivos de un espacio van en una subcarpeta
  (`billing/account.ts`, `shifts/form.ts`), nunca sueltos junto a los espacios. Cada idioma es un archivo diferido
  (`import()`, `LOADERS` en `core.ts`): el que no se usa no viaja en la carga inicial.
- Plurales por idioma con `Intl.PluralRules`: todos usan `_one`/`_other` (y `_zero` donde es-MX la tiene); en pt-BR y
  fr-FR el cero cae en `_one` (CLDR: «0 dia», «0 jour»), así que esa forma debe servir para 0 y 1; `many` (millones en
  es, fr, it, pt) cae en `_other` y no se escribe. `dictionaries.test.ts` lo verifica con las categorías de cada idioma.
- `common` reúne lo que significa lo mismo en cualquier pantalla (Guardar, Cancelar, Activo, Correo
  electrónico...); si en un área el texto cambia de género, número o sentido ("Activa" para una empresa), va en
  el espacio de esa área.

### 7.2 Reglas para escribir código
- **Ningún texto visible escrito en el código**: textos de JSX, `aria-*` que se leen, `title`, `placeholder`,
  `alt`, etiquetas, ayudas, validaciones, confirmaciones (`describeChanges`/`describeValues` incluidos),
  popups, estados vacíos y errores que arma la app. El lint `i18n/no-hardcoded-text` (`eslint-rules/i18n.js`,
  con sus pruebas) lo impide en JSX, en propiedades de texto (`title`, `message`, `label`, `hint`...), en lo
  que devuelve una función y en constantes; no marca códigos, identificadores, unidades sueltas ni símbolos, y
  solo permite los nombres propios de su lista (navegadores, sistemas, marcas). Lo que siempre se ve o se lee (`title`,
  `placeholder`, `alt`, los `aria-*` hablados) se marca aunque sea una palabra en minúsculas o un ejemplo
  («nombre@empresa.com» también es español). El texto de un error (`new Error('…')`) también se marca: si puede llegar a
  la persona va con `localizedError(() => t('…'))`; uno interno (un proveedor que falta, el canal en vivo) lleva un
  código en mayúsculas (`'FEEDBACK_PROVIDER_MISSING'`, `'REALTIME_TIMEOUT'`).
- **Nunca se mezclan idiomas** (regla 16 de la raíz): la ÚNICA excepción es la marca «Employee Time Clock»; fuera de ella
  solo nombres propios reales y siglas de `cspell-words.txt` y el nombre de cada idioma y su país en sí mismos
  (`ENDONYMS`). Un préstamo del inglés («app», «backend», «bucket», «stack trace», «anti-spoofing», «laptops») se escribe
  en el idioma («aplicación», «servidor», «almacenamiento», «traza de la pila», «detección de suplantación»,
  «computadoras portátiles»; en portugués «aplicativo», en francés «application»…); solo se admite el anglicismo que el
  diccionario del propio idioma reconoce («App», «Laptop», «Tablet» en alemán; «password», «app» en italiano). Lo que nombra el sistema operativo tampoco se muestra tal cual: el nombre de una cámara pasa por
  `cameraName` (`utils/cameraDevices.ts`: las cámaras del equipo, que el sistema nombra en SU idioma —«Front Camera»,
  «Back Ultra Wide Camera», «camera2 1, facing front», «FaceTime HD Camera», «Integrated Webcam», en inglés, español,
  portugués, francés, alemán o italiano—, salen con el texto de la app y su lente; un modelo con marca, «Logitech BRIO»,
  es un nombre propio). `rawLabel` conserva el original solo para las reglas (cámara virtual), nunca para mostrarse.
- **Agregar un texto**: la llave en `es-MX` (el texto en español) y la misma en los otros seis idiomas EN EL MISMO
  CAMBIO (en es-ES solo si su texto cambia), con las mismas variables y formas de plural, con el registro y el glosario
  de `docs/i18n/glosario.md`. `src/i18n/dictionaries.test.ts` descubre los diccionarios por carpeta y falla si alguno no
  tiene exactamente las mismas llaves, variables y plurales que es-MX (y los tipos no compilan si a un idioma le falta
  una llave).
- **Lo que envía el backend nunca se traduce en la app**: llega en el idioma de la petición
  (`Accept-Language` en cada petición de `apiClient`, `?lang=` en el canal en vivo): `message`,
  `errors[].message`, los textos de los catálogos (`name`, `description`, `message`, `phrase`, `instruction`)
  y los nombres de pantallas y módulos del menú. Los códigos no cambian.
- **Formatos solo con los ayudantes del idioma activo** (nunca `toLocaleString('es-MX')` ni
  `new Intl.*('es-MX')`, y tampoco sin idioma —`toLocaleDateString()`, `new Intl.DateTimeFormat()`, `a.localeCompare(b)`—,
  que usa el del NAVEGADOR: lint `i18n/no-hardcoded-locale`): `utils/format.ts` (`formatDate`, `formatDateTime`, `formatTime` —reloj de 12 h solo en en-US; 24 h en los demás—,
  `timeAgo`, `formatMinutes`, `formatConfidence`, `localeDateFormat(opciones)` con `timeZone: 'UTC'` para
  fechas de calendario o `businessTimeZone()` para instantes, `timeStyle()`) y `utils/numbers.ts`
  (`formatNumber`, `formatCount`, `formatRate`, `formatMoney(monto, moneda)` con el código ISO que envía el
  backend, `formatDistance` en metros/kilómetros, `formatList`, `localeNumberFormat`). Siempre en la zona
  horaria del negocio (§2).
- **Un nombre de catálogo dentro de una frase** («Registrar {action}», «Quítate {name}», «por {period}») pasa por
  `inSentence(nombre)` (`utils/text.ts`): minúsculas con las reglas del idioma activo, salvo en alemán, donde los
  sustantivos conservan su mayúscula («Kommen erfassen», «pro Monat»). Nunca `nombre.toLowerCase()`: el guardián de
  de-DE lo señala («pro monat» no es una palabra).

### 7.3 Cambio de idioma en caliente
- **Se aplica al instante en toda la app sin recargar ni refrescar la página por ninguna razón y sin perder
  lo que la persona hacía**: los formularios conservan lo escrito, los popups y confirmaciones abiertos se
  traducen sin cerrarse, la cámara sigue encendida y el flujo facial conserva su paso. Ninguna parte del
  cambio de idioma llama a `location.reload` (la única recarga de la app es la de una versión nueva,
  `reloadApp`).
- Por eso: **nunca se guarda texto traducido en el estado, en referencias ni en variables del módulo**; se
  guardan códigos, llaves y datos, y se traduce al dibujar. Un popup o una confirmación reciben **funciones**
  que se vuelven a evaluar al dibujarse: `run(task, { confirm: () => ({ title: t('…'), details: […] }),
  errorTitle: () => t('…'), success: () => [t('…')] })`, `useResource(fetch, key, () => t('…'))`,
  `usePagedList`/`useSearchList({ errorTitle: () => t('…') })`, `useErrorPopup(error, { title: () => t('…') })`,
  `feedback.show(() => ({ … }))`, `feedback.success(() => t('…'))`, `saveIfValid(() => errores, …)`
  (`MessageSource`, `ConfirmSource`, `LazyText`). Un error que arma la app y puede llegar a un popup se crea
  con `localizedError(() => t('…'))` (su mensaje se traduce al leerse); los de `apiClient` sin respuesta del
  servidor ya lo hacen.
- Al cambiar el idioma: se descarga su diccionario (una vez), todo lo que usa `useT()`/`useLocale()` se
  redibuja, `CatalogProvider` vuelve a pedir los catálogos (mientras llegan se ven los anteriores) y
  `LocaleSync` vuelve a pedir el usuario (nombres del menú). El canal en vivo abre una conexión nueva con el
  idioma nuevo en su siguiente consulta.
- **Todo en caliente, también lo que envía el servidor** (regla 16 de la raíz). Un mecanismo por tipo de dato:
  - **Datos de una pantalla**: el idioma es parte de la llave de `useResource`, `usePagedList` (y `useSearchList`) y
    `usePolledValue`: al cambiarlo se vuelven a pedir EN SU LUGAR (la misma página, tamaño y filtros; mientras llegan se
    ven los anteriores, sin esqueletos ni desplazamiento perdido). `useAvailability` vuelve a verificar lo escrito. Un
    formulario de edición se llena con `useLoadValues(valores, cargar)` (por valores, no por el objeto: volver a pedir el
    registro no pisa lo escrito); nunca `useLayoutEffect(() => cargar(datos), [datos])`.
  - **Catálogos**: `CatalogProvider` publica los vigentes ANTES de dibujar con ellos (`publishCatalogs` en
    `utils/catalogs.ts`) y `byCode`/`nameOf`/`active` buscan SIEMPRE en los vigentes, como `t()`: una función guardada
    con una carga anterior (la confirmación o el popup abiertos) nombra en el idioma nuevo; `FeedbackProvider` se
    suscribe (`subscribeCatalogs`) y vuelve a dibujar el popup abierto al llegar los catálogos. Un control que guarda un
    registro de un catálogo guarda su código y lo nombra al dibujarse (`PhoneField`: `directory.current(país)`).
  - **Textos del servidor ya copiados** (un popup abierto con el error de una escritura, el error de un campo en el
    estado de un formulario, el aviso de una restauración, el resultado de checar): el sobre trae en `i18n` sus textos en
    cada idioma (regla 3; solo en errores y escrituras). `ApiError.message` y `errors[].message` se leen en el idioma
    vigente y `i18n/serverTexts.ts` recuerda los textos recientes (tope 500) para `localizeServerText(texto)`, que usan
    los puntos por donde pasan: `MessageDialog`, `FieldMessage`, `AttendanceResultCard`, `VerificationResultCard` y
    `BulkResultSummary`. Un texto del servidor que se dibuje en otro lugar pasa por `localizeServerText`.
  - **Un aviso que se abre solo** (las marcas de una solicitud de registro) se abre una vez por registro (referencia
    con su id): volver a pedirlo al cambiar el idioma no lo reabre.
- El mapa de Google se carga una vez por página con el idioma de ese momento: sus controles no cambian (la app
  no recarga), pero la búsqueda de lugares y la geocodificación sí usan el idioma activo.

### 7.4 De dónde sale el idioma y dónde se guarda
- Al abrir la app (`main.tsx` → `initialLocale()` en `i18n/device.ts`): la última elección de este dispositivo
  (IndexedDB, `deviceStore` llave `locale`, con tiempo límite) → los idiomas del navegador (`matchLocale` en `core.ts`:
  `es-ES`, `es-EA` e `es-IC` → es-ES; cualquier otro `es*` → es-MX; `en*` → en-US; `pt*` → pt-BR; `fr*` → fr-FR;
  `de*` → de-DE; `it*` → it-IT; la misma tabla que el backend, glosario §5) → es-MX. Se descarga ese diccionario antes
  de dibujar; si no llega ni reintentando, una versión nueva recarga una vez y, si fue la red, `index.html` muestra el
  aviso SOLO en el idioma del dispositivo (cada idioma tiene su bloque con su «Reintentar»; nunca dos a la vez) que
  vuelve a arrancar sin recargar. La negociación con el navegador vive en `i18n/negotiation.ts` (módulo PURO, sin
  importaciones en tiempo de ejecución: `matchLocale`, `firstLocale`, `DEFAULT_LOCALE`; `core.ts` los reexporta) porque
  también la usa el **aviso «Actualiza tu navegador»** (decisión D-C1, `docs/rd/compatibilidad-biometria.md` §7):
  `index.html` trae ese aviso en los siete idiomas (bloques `lang`, con la marca intacta; cspell lo revisa) y el guion
  `src/compat/browserSupport.ts` —que `vite.config.ts` (`browserSupportNotice`) compila aparte a ES2015 con una
  compilación anidada de Vite e inserta en línea al final del `<body>`— sondea por CAPACIDAD (`noModule`, `container-type`,
  `Array.prototype.at`, `structuredClone`, *lookbehind*) antes de que el módulo principal intente interpretarse; si falta
  algo muestra SOLO el bloque del idioma del navegador y oculta la raíz; si no, no toca nada. Ese guion se escribe con
  sintaxis conservadora (nada de `at`, `structuredClone` ni expresiones regulares literales con *lookbehind*; la
  compilación falla si aparece una) y solo puede importar `i18n/negotiation.ts`. Sus pruebas usan el `index.html` real
  (`src/compat/browserSupport.test.ts`).
- Con sesión manda el idioma de la cuenta: `user.preferences.locale` (uno de `LOCALES` o `null`), aplicado
  por `LocaleSync` (también si cambió desde otro dispositivo) y recordado en el dispositivo.
- El selector (`components/LanguageSwitcher.tsx` + `i18n/useLanguage.ts`, lista propia `Select`) está en la
  barra del inicio de sesión y el kiosco (`variant="compact"`) y en Mi perfil → Idioma. Decisión del dueño del producto
  (2026-10-06): cada opción muestra la **bandera** del país (`components/ui/LocaleFlag.tsx`: SVG plano dibujado por la
  app, 20 × 14, decorativo; nunca emoji, que cada sistema dibuja distinto), el **idioma en sí mismo** y debajo su
  **país** también en ese idioma (`ENDONYMS` en `i18n/endonyms.ts`: `{ language, country, flag }`); el control cerrado
  dice «Español (México)» con su bandera (en teléfonos, en la barra del inicio de sesión, solo la bandera). La lista
  mide EXACTAMENTE lo que el control: el compacto es tan ancho como el nombre más largo («English (United States)»,
  `min-width` en CSS) y solo en teléfonos, donde muestra solo la bandera, la lista conserva un ancho mínimo alineada a
  su borde derecho (`useMediaQuery`; `Select`: `menuWidth`, `menuMinWidth`, `menuAlign="end"`, `menuClassName`;
  `Floating`: `minWidth`, `align`, sin salir de la pantalla), con los tokens `--select-*` de todas las listas (la fila
  elegida con fondo de acento y palomita, filas de 44 px). Sobre la barra azul la lista toma la paleta de la propia
  barra (`.select__menu--dark`: el azul marino del fondo translúcido y desenfocado, borde a baja opacidad, el acento de
  la marca en la fila elegida, la palomita y el anillo de foco; contraste AA), nunca un color ajeno. Cambia en caliente, lo recuerda en el
  dispositivo y, con sesión, lo guarda en la cuenta (`PATCH /users/me/preferences {locale}`); si el servidor no lo
  guarda, regresa al idioma anterior y lo avisa. No se confirma: es una preferencia de la interfaz.
  `document.documentElement.lang`, el título, la descripción de la pestaña y el manifiesto de la aplicación instalable
  (`public/site.webmanifest` para es-MX y `public/site.<idioma>.webmanifest` para los demás, `MANIFESTS` en `core.ts`)
  siguen al idioma. El mapa de Google recibe el código de idioma de cada uno (`MAPS_LANGUAGES`).

### 7.5 Ortografía (cspell) y pruebas
- `npm run spell` (también dentro de `npm run lint` y en `scripts/quality.mjs`): cspell revisa cada diccionario SOLO
  contra el diccionario de su idioma (`@cspell/dict-es-es` para es-MX y es-ES, `dict-en_us`, `dict-pt-br`, `dict-fr-fr`,
  `dict-de-de`, `dict-it-it`; distingue mayúsculas y acentos: "informacion" es un error), `src/i18n/endonyms.ts`,
  `index.html` y los manifiestos; revisa las cadenas (comillas simples, dobles e invertidas), no los comentarios.
  Cualquier palabra desconocida falla. Listas de palabras propias, revisadas: `cspell-words.txt` (comunes a todos los
  idiomas: marcas, lugares, siglas de México como RFC, CURP, NSS, IMSS, IVA, nombres propios de lugares que todos los
  idiomas conservan) y una por idioma, `cspell-words.<idioma>.txt` (es-MX: mexicanismos como *checar* o *cubrebocas* e
  imperativos con pronombre como *muéstralo*; es-ES: las formas de España que el diccionario no trae, sin ningún
  mexicanismo; pt-BR, fr-FR, de-DE, it-IT: términos del dominio y compuestos que su diccionario no trae). Una palabra se
  agrega solo después de confirmar que está bien escrita y en la lista de su idioma, nunca para silenciar un error (lo
  que no es una palabra se reescribe: "503 reintentable" pasó a "503: se puede reintentar"); jamás una palabra del
  inglés en la lista de otro idioma.
- **Las listas y la instalación de cspell son de toda la plataforma**: el backend revisa con ellas sus mensajes y los
  textos de sus catálogos (`backend-employee-time-clock/cspell.json`, en `./scripts/quality.sh --only=backend`), sin
  copiarlas. Por eso las listas traen también palabras de esos textos (los países del catálogo, los códigos de moneda,
  el nombre del producto), cada una en la lista del idioma en que es correcta. Quitar una palabra de una lista se revisa
  también contra el backend.
- Las pruebas corren en es-MX (lo activa `src/test/setup.ts` y lo restablece después de cada prueba). Para
  probar en inglés: `await setLocale('en-US')` antes de dibujar, o `await act(() => setLocale('en-US'))` con
  la pantalla montada para probar el cambio en caliente. Cada área tiene pruebas en en-US; `src/i18n/hotSwitch.test.tsx`
  cambia de idioma con un formulario lleno y un popup abierto y verifica que nada se reinicia ni se recarga.
- La cobranza y el consumo ya viven en los espacios `billing` (con sus subarchivos `billing/plan` y
  `billing/account`) y `usage`: no queda ninguna excepción del lint de textos.
- **cspell ESTRICTO** (`cspell.json`: `loadDefaultConfiguration: false`): sin los diccionarios de programación que cspell
  carga por omisión (con ellos «Save», «Retry» o «Front» pasaban en un texto en español). La marca se reconoce solo como
  frase completa (`ignoreRegExpList`); «Employee» o «Clock» sueltos fallan.
- **Guardianes del idioma** (fallan con la pantalla, el texto y la palabra; definición de terminado de la raíz):
  - `src/test/language.ts`: el revisor estricto (cspell-lib con los MISMOS diccionarios y listas, para los siete
    idiomas): una palabra que el idioma no conoce **falla**; si además la conoce el diccionario de otro de los idiomas se
    señala como «del otro idioma» (`foreign`, lo más probable es que se coló sin traducir) y si ninguno la conoce, como
    «desconocida» (`unknown`). `foreignWordsInList` cuida las listas: ninguna palabra del inglés en la lista propia de
    otro idioma (ni al revés); con siete idiomas no se exige más, porque una palabra legítima del portugués que el
    español también tiene («validador») no es una mezcla. No revisa la marca, correos, direcciones, `{variables}`,
    rutas, cabeceras ni códigos con dígitos.
  - `src/i18n/dictionaryLanguage.test.ts`: cada texto de cada diccionario está solo en su idioma (los diccionarios se
    descubren por carpeta) y cada lista propia pasa `foreignWordsInList`.
  - `src/i18n/unusedKeys.test.ts`: ninguna llave de es-MX sobra: cada una la nombra el código, literal o por una plantilla
    (`` `face.stages.${x}.name` ``). Una llave que ya nadie usa se elimina en los siete idiomas, no se traduce.
  - `src/i18n/screensLanguage.test.tsx`: CADA ruta de `SCREEN_VIEWS` se dibuja con la app completa (sesión, menú,
    catálogos y la pantalla) en CADA idioma de `LOCALES` contra el backend falso de `src/test/fakeApi` (responde según
    `Accept-Language`, con las traducciones reales de los catálogos del backend y sus textos de prueba en los siete
    idiomas, `say({...})`); se revisa todo lo que se ve o se lee (texto, `aria-label`, `title`, `placeholder`, `alt`, el
    título de la pestaña), sin lo que escribió una persona (lo que el backend devuelve igual en todos los idiomas). Una
    petición sin ruta en el backend falso también falla: una pantalla nueva agrega sus rutas ahí (`admin.ts`,
    `company.ts`, `people.ts`).
  - `src/i18n/screensHotSwitch.test.tsx`: en CADA ruta, con algo escrito y un popup abierto (la confirmación o el aviso
    del formulario, el error que respondió el servidor al guardar —con su `i18n`— o «Cerrar sesión»), el idioma cambia a
    en-US, a uno de los otros cinco idiomas (cada ruta uno distinto, por turnos: los siete participan sin multiplicar
    por siete el tiempo de la suite) y de regreso a es-MX: nada del otro idioma queda (tampoco los datos del servidor
    ni el popup), el mismo popup sigue abierto, lo escrito sigue ahí, la ruta es la misma y no hay recarga.
  - `src/i18n/backendLanguage.test.ts`: los textos del backend (mensajes y catálogos de los siete idiomas) con el mismo
    revisor.
  - Tiempo medido de las dos suites de pantallas con los siete idiomas: ≈82 s para 776 pruebas (672 de `screensLanguage`, 96 de `screensHotSwitch` y 8 de `backendLanguage`; con dos idiomas eran 288 pruebas en 44 s) en el equipo de desarrollo, con los dos archivos en paralelo.

### 7.6 Estilo de los textos (mensajes simples pero profesionales)
Decisión del dueño del producto: todo texto se lee de un vistazo. Un mensaje largo no se lee y esconde lo que
importa; uno breve y preciso se entiende y genera confianza. Rige para cada texto nuevo o cambiado, en los siete idiomas.
- **Estados vacíos** (decisión del dueño del producto, 2026-10-06: en toda lista o tabla, ícono + título + una
  descripción corta; reemplaza la regla anterior de no llevar descripción):
  - Ícono de lucide acorde a la entidad y al de la pantalla (`Building2` empresas, `Users` empleados, `Trash2`
    «Eliminados», `SearchX` sin coincidencias).
  - Título corto, de 2 a 5 palabras: «Sin empresas», «Sin validaciones». No repite el nombre de la pestaña o el
    filtro elegido.
  - Descripción: UNA línea simple y profesional, de hasta unas 10 palabras, que dice qué aparecerá ahí o cómo
    empezar: «Registra la primera empresa para empezar.», «Aquí verás las validaciones aceptadas.» (aquí sí puede
    nombrar la pestaña). Lo que depende del periodo: «Prueba con un periodo más largo.» (`performance.longerPeriod`)
    o «Elige otro rango de fechas.» (`usage.otherRange`).
  - Con búsqueda o filtro: «Sin resultados» + «Prueba con otra búsqueda o filtro.» (o la variante precisa: «Prueba
    con otro estado.»). Nada pendiente, tono `success`: «Todo al día» + qué no hay pendiente («No hay casos de
    fraude por revisar.»).
  - Sin «» alrededor de un estado, sin signos de exclamación, de «tú». en-US: "No companies" + "Register the first
    company to get started." / "Accepted validations will appear here." / "All caught up" + "No … to review.".
- **Popups de éxito, aviso y error**: el título dice el resultado («Empleado registrado», «No se pudo guardar»);
  a lo más una frase corta de mensaje, solo si agrega algo (una consecuencia o el siguiente paso). Sin relleno:
  «correctamente», «exitosamente», «Se ha…», «quedó…».
- **Errores**: qué pasó y qué hacer, una frase corta cada uno: «No se pudo conectar con el servidor. Revisa tu
  conexión.». Fallas: «No se pudo…» / «No se pudieron…» (nunca «No fue posible», «No pudimos»); «Intenta de nuevo.»
  (nunca «nuevamente»).
- **Confirmaciones**: el título es una pregunta con el registro («¿Eliminar a {name}?»); detalles y cambios conservan
  sus datos; la nota solo dice una consecuencia real («No se puede deshacer.»). Nunca se quita lo que protege a la
  persona: qué se borra o afecta, que es irreversible, sesiones que se cierran, montos, quién verá una nota.
- **Ayudas, avisos y cargas**: una línea; no repiten la etiqueta; conservan los requisitos de formato («18
  caracteres»). Subtítulos de página: una línea que dice para qué es la pantalla. Cargas: «Cargando…».
- **Tono**: de «tú», sin signos de exclamación, emojis, coloquialismos, disculpas, primera persona del plural ni
  lenguaje de mercadotecnia. Mismo vocabulario en toda la app: «registro facial», «jornada», «sitio», «checar».
- **en-US**: inglés natural y conciso de Estados Unidos, no una traducción literal: "Couldn't …", "Try again.",
  "This can't be undone.", "No results", "All caught up"; términos *check in*, *workday*, *site*, *face enrollment*,
  *liveness check*.
- **Los demás idiomas**: el registro y el glosario de `docs/i18n/glosario.md` (pt-BR «você», fr-FR «vous», de-DE «Sie»,
  it-IT «tu», es-ES «tú» con el vocabulario de España), el mismo término para la misma cosa en toda la app y en los
  mensajes del backend, y la misma guía de estilo que es-MX.
- No cambian por estilo: llaves, `{marcadores}`, formas de plural, códigos, textos legales o de privacidad (aviso de
  privacidad, consentimiento, atribuciones de licencias) ni el sentido de una regla. Se acorta; no se inventa.
