/**
 * Llaves de acceso (WebAuthn / passkeys, antifraude fase 3), es-MX: la sección de Mi perfil (lista, registrar,
 * renombrar, revocar), el formulario de una llave y «Entrar con llave de acceso» del inicio de sesión. Glosario
 * §2: «llave de acceso».
 */
export default {
  title: 'Llaves de acceso',
  intro: 'Entra con el rostro, la huella o el PIN de tu dispositivo, sin escribir tu contraseña. La llave privada nunca sale de tu dispositivo ni de tu cuenta de Apple o Google.',
  unsupported: 'Este navegador no admite llaves de acceso. Usa Safari, Chrome o Edge actualizados.',
  loadError: 'No se pudieron cargar tus llaves de acceso',
  add: 'Agregar llave de acceso',
  empty: {
    title: 'Sin llaves de acceso',
    description: 'Agrega una para entrar con el rostro, la huella o el PIN.',
  },
  noun: {
    one: 'llave de acceso',
    other: 'llaves de acceso',
  },
  created: 'Creada el {date}',
  lastUsed: 'Último uso: {date}',
  neverUsed: 'Sin usar todavía',
  synced: 'Sincronizada en la nube',
  deviceOnly: 'Solo en un dispositivo',
  rename: 'Renombrar',
  revoke: 'Revocar',
  actionLabel: '{action}: {name}',
  revokeAsk: {
    eyebrow: 'Llave de acceso',
    title: '¿Revocar «{name}»?',
    message: 'Esa llave dejará de servir para entrar, en todos tus dispositivos.',
    note: 'No se puede deshacer. Puedes registrar otra cuando quieras.',
    confirm: 'Revocar llave',
  },
  revoked: 'Llave de acceso revocada',
  revokeFailed: 'No se pudo revocar la llave de acceso',
  form: {
    newTitle: 'Agregar llave de acceso',
    newSubtitle: 'Registra este dispositivo para entrar sin contraseña.',
    renameTitle: 'Renombrar llave de acceso',
    renameSubtitle: 'Cambia el nombre con que la reconoces.',
    section: 'Nombre de la llave',
    intro: 'Al registrarla, tu dispositivo te pedirá el rostro, la huella o el PIN. Tu contraseña sigue funcionando.',
    name: 'Nombre',
    nameHint: 'Para reconocerla: «Mi teléfono», «Computadora del trabajo»',
    nameRequired: 'Escribe un nombre',
    nameTooLong: 'Máximo {max} caracteres',
    submit: 'Registrar llave',
    renameSubmit: 'Guardar nombre',
    back: 'Volver a Mi perfil',
    createAsk: {
      eyebrow: 'Llave de acceso',
      title: '¿Registrar una llave de acceso en este dispositivo?',
      message: 'Tu dispositivo te pedirá el rostro, la huella o el PIN para crearla.',
      note: 'Podrás revocarla cuando quieras desde Mi perfil.',
      confirm: 'Registrar',
    },
    renameAsk: {
      title: '¿Renombrar la llave de acceso?',
    },
    registered: 'Llave de acceso registrada',
    registeredText: 'Ya puedes entrar con ella desde el inicio de sesión.',
    registerFailed: 'No se pudo registrar la llave de acceso',
    renamed: 'Nombre guardado',
    renameFailed: 'No se pudo renombrar la llave de acceso',
    noChanges: 'Sin cambios',
  },
  /** Fallas de la ceremonia en el navegador (`utils/webauthn.ts`); cancelar no es una falla. */
  errors: {
    unsupported: 'Este navegador no admite llaves de acceso. Usa Safari, Chrome o Edge actualizados.',
    failed: 'Tu dispositivo no pudo completar la operación. Intenta de nuevo.',
  },
  login: {
    divider: 'o',
    button: 'Entrar con llave de acceso',
    waiting: 'Esperando a tu dispositivo…',
    failed: 'No se pudo entrar con la llave de acceso',
  },
} as const;
