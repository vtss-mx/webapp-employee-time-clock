import type { User } from '../types';

export const paths = {
  login: '/login',
  /** Empleado que trabaja en varias empresas: elige a cuál entrar. */
  selectCompany: '/select-company',
  profile: '/profile',
  /** Llaves de acceso (WebAuthn) de la cuenta: registrar una en este dispositivo y renombrar una existente. */
  profilePasskeyNew: '/profile/passkeys/new',
  profilePasskeyRename: (id: number | string) => `/profile/passkeys/${id}/rename`,
  /** Consentimiento biométrico: el texto completo del servidor y los botones para otorgarlo (regla 22 de la raíz). */
  profileConsents: '/profile/consents',
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
    /** Deriva de las señales del motor facial (antifraude fase 3): por señal, plataforma y empresa, cada semana. */
    drift: '/admin/drift',
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
    /** Bitácora de auditoría: quién hizo qué, sobre qué y desde dónde, con su exportación para el auditor. */
    audit: '/admin/audit',
    /** Revisión de accesos: cada cuenta con su rol, su último acceso, su segundo factor y sus sesiones. */
    accessReview: '/admin/access-review',
    /** Casos de fraude: la bandeja (filtros en la pantalla), un caso y su decisión o nota (formularios con motivo). */
    verifications: '/admin/verifications',
    verification: (id: number | string) => `/admin/verifications/${id}`,
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
    validations: '/company/validations',
    validation: (id: number | string) => `/company/validations/${id}`,
    rejectValidation: (id: number | string) => `/company/validations/${id}/reject`,
    validators: '/company/validators',
    newValidator: '/company/validators/new',
    editValidator: (id: number | string) => `/company/validators/${id}/edit`,
    validatorDevices: (id: number | string) => `/company/validators/${id}/devices`,
    validatorPassword: (id: number | string) => `/company/validators/${id}/password`,
    /** Verificaciones de identidad con su ubicación en el mapa (decisión del dueño, 2026-10-07). */
    verifications: '/company/verifications',
    verification: (id: number | string) => `/company/verifications/${id}`,
    /** Puntos de verificación con su geocerca. */
    sites: '/company/sites',
    newSite: '/company/sites/new',
    editSite: (id: number | string) => `/company/sites/${id}/edit`,
    /** Kioscos del sitio (la tableta que muestra el código que se pide al verificar) y alta de uno. */
    siteKiosks: (id: number | string) => `/company/sites/${id}/kiosks`,
    newSiteKiosk: (id: number | string) => `/company/sites/${id}/kiosks/new`,
    integrations: '/company/integrations',
    newApiKey: '/company/integrations/new',
    /**
     * Claves de FIRMA de la empresa (migración 0105): su clave pública y la de la plataforma. Es una SECCIÓN de la
     * misma pantalla `COMPANY_API` (no una pantalla nueva: el seed del backend no cambia). «Rotar» llega al
     * formulario con `?replaces=<id>`.
     */
    signingKeys: '/company/integrations/signing-keys',
    newSigningKey: '/company/integrations/signing-keys/new',
    /** Documentos de la empresa para su facturación (lista con «Eliminados») y subir uno. */
    documents: '/company/documents',
    newDocument: '/company/documents/new',
  },
  /** Validador de identidad (tableta o teléfono en un acceso). */
  validator: {
    checkpoint: '/validator/checkpoint',
  },
  employee: {
    dashboard: '/employee/dashboard',
    verify: '/employee/verify',
    verifyFace: '/employee/verify/face',
    myQr: '/employee/qr',
    /**
     * Registro de identidad: el índice del flujo que pide su empresa y la pantalla de cada paso (decisión del dueño,
     * 2026-10-08: el flujo es dinámico; el ADMIN elige qué pasos y en qué orden). Los documentos de identidad son
     * pasos de este flujo (la pantalla «Mis documentos» del empleado desapareció el mismo día).
     */
    enroll: '/employee/enroll',
    enrollPhoto: '/employee/enroll/photo',
    enrollCapture: '/employee/enroll/capture',
    enrollVoice: '/employee/enroll/voice',
    /** Paso de un documento de identidad (su código del catálogo en la ruta) y subir el archivo de ese paso. */
    enrollDocument: (step: string) => `/employee/enroll/document/${step}`,
    newEnrollmentDocument: (step: string) => `/employee/enroll/document/${step}/new`,
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
