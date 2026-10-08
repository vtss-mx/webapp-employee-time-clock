import { derive } from '../../derive';
import es from '../es-MX/passkeys';

/**
 * Llaves de acceso en español de España (es-ES): solo lo que cambia respecto de es-MX (glosario §3: «clave»,
 * «añadir», «móvil», «ordenador», «Inténtalo de nuevo»).
 */
export default derive(es, {
  title: 'Claves de acceso',
  intro: 'Entra con el rostro, la huella o el PIN de tu dispositivo, sin escribir tu contraseña. La clave privada nunca sale de tu dispositivo ni de tu cuenta de Apple o Google.',
  unsupported: 'Este navegador no admite claves de acceso. Usa Safari, Chrome o Edge actualizados.',
  loadError: 'No se pudieron cargar tus claves de acceso',
  add: 'Añadir clave de acceso',
  empty: {
    title: 'Sin claves de acceso',
    description: 'Añade una para entrar con el rostro, la huella o el PIN.',
  },
  noun: {
    one: 'clave de acceso',
    other: 'claves de acceso',
  },
  revokeAsk: {
    eyebrow: 'Clave de acceso',
    message: 'Esa clave dejará de servir para entrar, en todos tus dispositivos.',
    confirm: 'Revocar clave',
  },
  revoked: 'Clave de acceso revocada',
  revokeFailed: 'No se pudo revocar la clave de acceso',
  form: {
    newTitle: 'Añadir clave de acceso',
    renameTitle: 'Renombrar clave de acceso',
    section: 'Nombre de la clave',
    nameHint: 'Para reconocerla: «Mi móvil», «Ordenador del trabajo»',
    submit: 'Registrar clave',
    createAsk: {
      eyebrow: 'Clave de acceso',
      title: '¿Registrar una clave de acceso en este dispositivo?',
    },
    renameAsk: {
      title: '¿Renombrar la clave de acceso?',
    },
    registered: 'Clave de acceso registrada',
    registerFailed: 'No se pudo registrar la clave de acceso',
    renameFailed: 'No se pudo renombrar la clave de acceso',
  },
  errors: {
    unsupported: 'Este navegador no admite claves de acceso. Usa Safari, Chrome o Edge actualizados.',
    failed: 'Tu dispositivo no pudo completar la operación. Inténtalo de nuevo.',
  },
  login: {
    button: 'Entrar con clave de acceso',
    failed: 'No se pudo entrar con la clave de acceso',
  },
});
