/** Textos de inicio de sesión, cuenta recordada, dispositivo, empresa suspendida y cierre de sesión (es-MX). */
export default {
  /** Marco de las pantallas sin sesión (inicio de sesión, elegir empresa). */
  layout: {
    copyright: '© {year} {app}. Todos los derechos reservados.',
  },
  login: {
    title: 'Iniciar sesión',
    subtitle: 'Usa tu cuenta corporativa de {app}',
    emailPlaceholder: 'tu@empresa.com',
    password: 'Contraseña',
    passwordRequired: 'La contraseña es obligatoria',
    remembered: 'Cuenta recordada en este dispositivo.',
    useOtherAccount: 'Usar otra cuenta',
    remember: 'Recordar mi cuenta',
    rememberHint: 'Mantén la sesión abierta en este dispositivo. No la uses en equipos compartidos.',
    submit: 'Iniciar sesión',
    submitDisabled: 'Escribe tu correo y tu contraseña',
    locating: 'Verificando tu ubicación…',
    failed: 'No se pudo iniciar sesión',
    switchFailed: 'No se pudo cambiar de cuenta',
    /** Popup al llegar tras un cierre forzado (el motivo va debajo). */
    sessionEnded: 'Tu sesión terminó',
  },
  session: {
    expired: 'Tu sesión expiró. Inicia sesión de nuevo.',
  },
  /** Contraseña que se asigna (alta, restablecer, cambiar). */
  password: {
    new: 'Contraseña nueva',
    hint: 'Mínimo 8 caracteres, con mayúscula, minúscula y número',
  },
  /** Reglas del dispositivo de un validador al iniciar sesión. */
  device: {
    eyebrow: 'Dispositivo',
    unsupported: 'No se pudo registrar el dispositivo',
    titles: {
      DEVICE_PENDING_APPROVAL: 'Dispositivo por autorizar',
      DEVICE_REJECTED: 'Dispositivo no autorizado',
      DEVICE_REVOKED: 'Autorización retirada',
      DEVICE_PROOF_INVALID: 'No se pudo verificar el dispositivo',
    },
    pendingSteps: {
      ask: 'Pide a un administrador de tu empresa que entre a Validadores › Dispositivos.',
      authorize: 'Que autorice este dispositivo (aparece con el nombre de este navegador).',
      retry: 'Vuelve a iniciar sesión aquí mismo.',
    },
  },
  /** Validador en una computadora cuando su empresa exige tableta o teléfono. */
  deviceBlock: {
    eyebrow: 'Estás usando una computadora',
    title: 'Continúa desde una tableta o un teléfono',
    footnote: '¿Necesitas ayuda? Comunícate con el administrador de tu empresa.',
  },
  suspension: {
    badge: 'Acceso suspendido',
    title: 'Tu empresa está suspendida',
    footnote: 'Para reactivarla, comunícate con el administrador de la plataforma.',
    exit: 'Volver al inicio de sesión',
  },
  logout: {
    title: '¿Cerrar sesión?',
    thisDevice: 'Este dispositivo',
    lastLogin: 'Último inicio de sesión',
    stay: 'Seguir aquí',
    everywhere: 'Salir de todos mis dispositivos',
    everywhereFailed: 'No se pudo cerrar sesión en todos los dispositivos',
    /** Qué deja de pasar al salir, según lo que hace cada rol. */
    consequence: {
      EMPLOYEE: 'Deberás iniciar sesión de nuevo para identificarte o mostrar tu código QR.',
      VALIDATOR: 'Este punto de control dejará de identificar al personal hasta que alguien vuelva a iniciar sesión en este dispositivo.',
      COMPANY: 'Tu trabajo está guardado. Deberás iniciar sesión de nuevo para administrar tu empresa.',
      ADMIN: 'Tu trabajo está guardado. Deberás iniciar sesión de nuevo para administrar la plataforma.',
    },
  },
  /** Persona que trabaja en varias empresas: elige a cuál entrar. */
  companySelect: {
    title: 'Elige tu empresa',
    intro_one: 'Trabajas en {count} empresa con la cuenta {email}.',
    intro_other: 'Trabajas en {count} empresas con la cuenta {email}.',
    companyInactive: 'Empresa desactivada',
    accessInactive: 'Tu acceso está desactivado',
    current: 'Empresa actual · {note}',
    entering: 'Entrando',
    enterFailed: 'No se pudo entrar a {company}',
  },
} as const;
