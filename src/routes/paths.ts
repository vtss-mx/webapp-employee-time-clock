import type { User } from '../types';

export const paths = {
  login: '/login',
  /** Empleado que trabaja en varias empresas: elige a cuál entrar. */
  selectCompany: '/select-company',
  profile: '/profile',
  forbidden: '/forbidden',
  /** Pantalla pública de la tableta de un sitio (sin sesión): muestra el código del sitio (`#pair=` la vincula). */
  kiosk: '/kiosk',
  admin: {
    dashboard: '/admin/dashboard',
    companies: '/admin/companies',
    newCompany: '/admin/companies/new',
    company: (id: number | string) => `/admin/companies/${id}`,
    editCompany: (id: number | string) => `/admin/companies/${id}/edit`,
    /** Empleados de la empresa: solo consulta (ficha de trabajo, sin biometría). */
    companyEmployees: (id: number | string) => `/admin/companies/${id}/employees`,
    /** Política de verificación de identidad de la empresa (la configura el ADMIN). */
    companyPolicy: (id: number | string) => `/admin/companies/${id}/policy`,
    /** Rechazar (con motivo) un cambio de la política que espera aprobación (regla de dos personas). */
    rejectPolicyChange: (id: number | string, changeId: number | string) => `/admin/companies/${id}/policy/changes/${changeId}/reject`,
    newCompanyAdmin: (id: number | string) => `/admin/companies/${id}/admins/new`,
    companyAdminPassword: (id: number | string, adminId: number | string) => `/admin/companies/${id}/admins/${adminId}/password`,
    /** Subir un documento de la empresa (su lista vive en la ficha de la empresa). */
    newCompanyDocument: (id: number | string) => `/admin/companies/${id}/documents/new`,
    errors: '/admin/errors',
    error: (id: number | string) => `/admin/errors/${id}`,
    /** Seguridad facial de la plataforma: umbrales autocalibrados, empresas reforzadas y destello. */
    faceSecurity: '/admin/face-security',
    /** Cobranza: indicadores, empresas y la cuenta de cada una (cargos, pagos, estado de cuenta en `?tab=`). */
    billing: '/admin/billing',
    companyBilling: (id: number | string) => `/admin/billing/companies/${id}`,
    newPayment: (id: number | string) => `/admin/billing/companies/${id}/payments/new`,
    voidPayment: (id: number | string, paymentId: number | string) => `/admin/billing/companies/${id}/payments/${paymentId}/void`,
    charge: (id: number | string, chargeId: number | string) => `/admin/billing/companies/${id}/charges/${chargeId}`,
    voidCharge: (id: number | string, chargeId: number | string) => `/admin/billing/companies/${id}/charges/${chargeId}/void`,
    suspendCompany: (id: number | string) => `/admin/billing/companies/${id}/suspend`,
    /** Consumo de la plataforma por empresa y por usuario (rango en `?start=&end=`). */
    usage: '/admin/usage',
    companyUsage: (id: number | string) => `/admin/usage/companies/${id}`,
    /** Rendimiento: resumen y pestañas (`?tab=`) en el periodo de `?period=`; una métrica (`?kind=&name=`) y una alerta. */
    performance: '/admin/performance',
    performanceMetric: '/admin/performance/metric',
    performanceAlert: (id: number | string) => `/admin/performance/alerts/${id}`,
    /** Casos de fraude: la bandeja (filtros en la pantalla), un caso y su decisión o nota (formularios con motivo). */
    fraudCases: '/admin/fraud-cases',
    fraudCase: (id: number | string) => `/admin/fraud-cases/${id}`,
    fraudCaseDecision: (id: number | string, status: string) => `/admin/fraud-cases/${id}/decision/${status}`,
    fraudCaseNote: (id: number | string) => `/admin/fraud-cases/${id}/note`,
  },
  company: {
    dashboard: '/company/dashboard',
    employees: '/company/employees',
    newEmployee: '/company/employees/new',
    employee: (id: number | string) => `/company/employees/${id}`,
    editEmployee: (id: number | string) => `/company/employees/${id}/edit`,
    reverifyEmployee: (id: number | string) => `/company/employees/${id}/reverify`,
    /** Nueva verificación de identidad para toda la empresa. */
    reverifyAll: '/company/employees/reverify-all',
    /** Rostro en persona: registrar (enroll) o verificar (verify) con el empleado presente. */
    employeeFace: (id: number | string, mode: 'enroll' | 'verify' | ':mode') => `/company/employees/${id}/face/${mode}`,
    departments: '/company/departments',
    newDepartment: '/company/departments/new',
    department: (id: number | string) => `/company/departments/${id}`,
    editDepartment: (id: number | string) => `/company/departments/${id}/edit`,
    /** Elegir empleados para asignar al departamento o nombrar responsables. */
    assignDepartment: (id: number | string, role: 'employees' | 'managers' | ':role') => `/company/departments/${id}/assign/${role}`,
    validations: '/company/validations',
    validation: (id: number | string) => `/company/validations/${id}`,
    rejectValidation: (id: number | string) => `/company/validations/${id}/reject`,
    validators: '/company/validators',
    newValidator: '/company/validators/new',
    editValidator: (id: number | string) => `/company/validators/${id}/edit`,
    validatorDevices: (id: number | string) => `/company/validators/${id}/devices`,
    validatorPassword: (id: number | string) => `/company/validators/${id}/password`,
    /** Asistencia: tablero del día, historial de jornadas y la evidencia de cada una. */
    attendance: '/company/attendance',
    attendanceHistory: '/company/attendance/history',
    attendanceSession: (id: number | string) => `/company/attendance/sessions/${id}`,
    /** La empresa registra la jornada de quien no checó (`?employee=&date=`) o corrige una (solo la empresa). */
    newAttendanceSession: '/company/attendance/sessions/new',
    correctAttendanceSession: (id: number | string) => `/company/attendance/sessions/${id}/correct`,
    /** Rechazar (con nota que verá el empleado) una jornada que el motor de riesgo dejó "en revisión". */
    rejectAttendanceReview: (id: number | string) => `/company/attendance/sessions/${id}/reject`,
    /** Turnos: catálogo, asignación por empleado y solicitudes de cambio. */
    shifts: '/company/shifts',
    newShift: '/company/shifts/new',
    editShift: (id: number | string) => `/company/shifts/${id}/edit`,
    shiftRequests: '/company/shifts/requests',
    approveShiftRequest: (id: number | string) => `/company/shifts/requests/${id}/approve`,
    rejectShiftRequest: (id: number | string) => `/company/shifts/requests/${id}/reject`,
    /** Turnos de un empleado (vigente, programados y anteriores) y asignarle uno. */
    employeeShifts: (id: number | string) => `/company/shifts/employees/${id}`,
    assignShift: (id: number | string) => `/company/shifts/employees/${id}/assign`,
    /** Asignar un turno a varios empleados a la vez (`?shift=` lo deja elegido). */
    bulkAssignShift: '/company/shifts/assign',
    /** Calendario: festivos, ausencias, solicitudes de vacaciones o permisos y días laborables (`?tab=`). */
    calendar: '/company/calendar',
    newHoliday: '/company/calendar/holidays/new',
    newAbsence: '/company/calendar/absences/new',
    rejectAbsence: (id: number | string) => `/company/calendar/absences/${id}/reject`,
    newWorkday: '/company/calendar/workdays/new',
    /** Sitios de trabajo con su geocerca. */
    sites: '/company/sites',
    newSite: '/company/sites/new',
    editSite: (id: number | string) => `/company/sites/${id}/edit`,
    /** Kioscos del sitio (la tableta que muestra el código que se pide al checar) y alta de uno. */
    siteKiosks: (id: number | string) => `/company/sites/${id}/kiosks`,
    newSiteKiosk: (id: number | string) => `/company/sites/${id}/kiosks/new`,
    integrations: '/company/integrations',
    newApiKey: '/company/integrations/new',
    /** Documentos de la empresa para su facturación (lista con «Eliminados») y subir uno. */
    documents: '/company/documents',
    newDocument: '/company/documents/new',
  },
  /** Validador de identidad (tableta o teléfono en un acceso). */
  validator: {
    checkpoint: '/validator/checkpoint',
  },
  employee: {
    /** Mi asistencia: qué puedo registrar ahora, registrar (rostro + ubicación), historial y cambios de turno. */
    attendance: '/employee/attendance',
    recordAttendance: (action: 'check-in' | 'break-start' | 'break-end' | 'check-out' | ':action') => `/employee/attendance/record/${action}`,
    attendanceHistory: '/employee/attendance/history',
    shiftRequests: '/employee/attendance/requests',
    newShiftRequest: '/employee/attendance/requests/new',
    /** Mis días libres (ausencias y próximos festivos) y pedir vacaciones o un permiso. */
    daysOff: '/employee/attendance/days-off',
    newAbsenceRequest: '/employee/attendance/days-off/new',
    dashboard: '/employee/dashboard',
    verify: '/employee/verify',
    verifyFace: '/employee/verify/face',
    myQr: '/employee/qr',
    enroll: '/employee/enroll',
    pending: '/employee/pending',
  },
} as const;

type HomeUser = Pick<User, 'home'>;

/** Inicio del usuario: lo decide el backend (su primera pantalla). */
export function homeForUser(user: HomeUser): string {
  return user.home ?? paths.profile;
}

/**
 * Persona que trabaja en varias empresas y aún no elige a cuál entrar: el backend le da como
 * inicio el selector de empresa (lo decide su estado, no el rol).
 */
export function needsCompanySelection(user: HomeUser): boolean {
  return user.home === paths.selectCompany;
}
