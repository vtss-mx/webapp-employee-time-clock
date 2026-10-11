# Limpieza de raíz del reloj checador en la aplicación web — qué falta tocar en la documentación

Fecha: 2026-10-09. Lo hecho en código está en el reporte del agente; aquí queda solo lo que **no** me correspondía
editar (`README.md` de la webapp y `webapp-employee-time-clock/AGENTS.md`) y los conflictos que hay que decidir.

## 1. `webapp-employee-time-clock/AGENTS.md`

Se quedó describiendo piezas que ya no existen. Hay que quitar o reescribir:

| Sección | Qué dice hoy | Qué debería decir |
|---|---|---|
| §2 «Reutilizar antes de crear» | «Rechazar una solicitud del empleado (cambio de turno, vacaciones o permiso) es `RejectRequestPanel`» | `RejectRequestPanel` se eliminó (sin consumidor). Queda `ReasonFormPanel` para todo formulario con motivo |
| §2 «Personas con su foto solo con `Avatar`» | lista `DepartmentPerson`, `CheckpointEmployee`… entre los `WithAvatar`, y «Un componente de persona recibe la ruta (`PersonItem avatar`, `EmployeeCard`, `FraudSubject`)» | `DepartmentPerson` ya no existe (se fue con `types/departments.ts`); `PersonItem` y `EmployeeCard` se eliminaron. Quedan `FraudSubject` y `Avatar` |
| §2 «Todo borrado es lógico» | «Una referencia del historial eliminada (`EmployeeRef`/`ShiftRef`/`SiteRef.deleted`)» | solo `EmployeeRef.deleted` (ya no hay `ShiftRef` ni `SiteRef`; el sitio eliminado se ve en su propia pantalla) |
| §2 «Estados de un listado» | sin cambios | — |
| §7.3 «Textos del servidor ya copiados» | enumera `MessageDialog`, `FieldMessage`, `AttendanceResultCard`, `VerificationResultCard` y `BulkResultSummary` | `AttendanceResultCard` y `BulkResultSummary` se eliminaron; quedan `MessageDialog`, `FieldMessage` y `VerificationResultCard` |
| §7.1 | «un espacio por área (`common`, `auth`, `layout`, `ui`, `shifts`, `attendance`, `location`…)» | los espacios `shifts`, `attendance`, `myAttendance`, `calendar` y `departments` ya no existen |
| §7.5 | «Tiempo medido de las dos suites de pantallas… ≈82 s para 776 pruebas (672 de `screensLanguage`, 96 de `screensHotSwitch`…)» | hoy son **608** pruebas (**512** de `screensLanguage` y **88** de `screensHotSwitch`) en ≈65 s, con 26 pantallas |
| §3 (resiliencia) | ejemplo de códigos de negocio «`FACE_NOT_APPROVED`, `QR_DISABLED`, `VALIDATORS_DISABLED`, `COMPANY_SUSPENDED`, `TOUCH_DEVICE_REQUIRED`» | siguen existiendo; conviene añadir `SITE_IN_USE`/`SITE_HAS_RECORDS` (409 con acción propia: desactivar) y `API_KEY_EXPIRY_TOO_LONG` (422 en su campo) |
| §5 | «Toda contraseña que se asigna…» y el resto | sin cambios |

Patrones nuevos que conviene dejar escritos en `AGENTS.md`:

- **Los sitios son puntos de verificación**, no lugares «donde se checa»: `components/sites/` reúne su formulario
  (`useSiteForm`), su estado (`RecordStatus`), su papelera (`SiteTrash`) y sus reglas puras (`siteRules`).
- **Piezas genéricas que vivían en `components/shifts/`** se movieron a donde se reutilizan:
  `components/ui/PageStates.tsx` (`LoadFailed`, `RecordLoader`), `components/ui/formFields.tsx`
  (`SelectField`, `QuickChoices`) y `metersText` a `utils/numbers.ts`.
- **`ApiScope` es un código del catálogo (`string`)**, no una lista que la app repita (regla 25): el nombre y la
  descripción de cada permiso salen de `api_scopes`.
- **Las llaves de los nombres de sección de la exportación son camelCase** (`dataExport.sections.profilePhoto`): la
  app convierte la llave estable del servidor (`profile_photo`) al dibujarla.

## 2. `webapp-employee-time-clock/README.md`

Hay que quitar todo lo que describa asistencia, turnos, calendario y departamentos (pantallas, rutas, servicios,
contadores del menú `PENDING_SHIFT_REQUESTS`, `PENDING_ABSENCE_REQUESTS` y `PENDING_ATTENDANCE_REVIEWS`) y:

- cambiar «Sitios de trabajo» por «Sitios de verificación» y su descripción (geocerca de una verificación);
- el inicio del empleado ya no es «Mi asistencia»: es `/employee/dashboard` (`EMPLOYEE_VERIFY`);
- el lema de la aplicación (`VITE_APP_TAGLINE`) pasó a «Verificación de identidad biométrica.» (también en `.env`,
  `scripts/generate-env.mjs`, `src/utils/config.ts` y los siete manifiestos de `public/`);
- la tabla de pantallas queda en **26** (la copia del seed vive en `src/test/screens.ts`);
- el catálogo `api_scopes` ya no tiene `ATTENDANCE_READ`: hoy es `VERIFICATIONS_READ` («Identificaciones»).

## 3. Conflictos y pendientes del backend (no son de la aplicación web)

1. **Texto del consentimiento biométrico**: `app/i18n/messages/es_mx/consent.py` (y `es_es`) sigue diciendo «Para qué:
   comprobar que eres tú **al checar tu entrada y tu salida**…». Es el texto legal que la persona lee antes de
   entregar su biometría: hay que reescribirlo a «al verificar tu identidad» en los siete idiomas. La aplicación web
   lo muestra tal cual (no lo traduce) y mi dato de prueba lo copia literal.
2. **Permiso `SITES_READ`/`SITES_WRITE` del catálogo**: su nombre sigue siendo «Sitios de trabajo». Debería ser
   «Sitios de verificación» para no mezclar vocabulario con la pantalla.
3. **`RetentionNotice.attendance_metadata_days`**: el campo del contrato conserva el nombre «attendance» aunque ya
   solo mide la ubicación/IP de cada verificación. La aplicación web lo lee tal cual y lo nombra
   «Ubicación y dispositivo de cada verificación»; renombrarlo es un cambio de contrato del backend.
4. **Módulo del menú `ATTENDANCE`**: su código sigue siendo `ATTENDANCE` (su nombre ya es «Verificación»). Si se
   renombra el código, hay que actualizar `src/test/screens.ts` y el seed en el mismo cambio.
